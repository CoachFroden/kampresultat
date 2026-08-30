import { initializeApp } from
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAKZMu2HZPmmoZ1fFT7DNA9Q6ystbKEPgE",
  authDomain: "samnanger-g14-f10a1.firebaseapp.com",
  projectId: "samnanger-g14-f10a1",
  storageBucket: "samnanger-g14-f10a1.firebasestorage.app",
  messagingSenderId: "926427862844",
  appId: "1:926427862844:web:eeb814a349e9bfd701b039"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const matchSelect = document.getElementById("matchSelect");
const statusEl = document.getElementById("statsStatus");
const statsTitle = document.getElementById("statsTitle");
const tbody = document.querySelector("#playersTable tbody");

const gamesValue = document.getElementById("gamesValue");
const winsValue = document.getElementById("winsValue");
const drawsValue = document.getElementById("drawsValue");
const lossesValue = document.getElementById("lossesValue");
const goalsValue = document.getElementById("goalsValue");

let allMatches = [];

onAuthStateChanged(auth, async user => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  try {
    statusEl.textContent = "Laster statistikk…";
    allMatches = (await loadMatches(user.uid))
      .filter(isCompletedMatch)
      .sort(sortMatchesNewestFirst);

    populateMatchSelect(allMatches);
    renderView(allMatches, null);
    statusEl.textContent = "";
  } catch (error) {
    console.error("Kunne ikke laste statistikk", error);
    statusEl.textContent = "Kunne ikke laste statistikken.";
  }
});

// Statistikken leser KUN fra toppnivå-samlingen matches.
async function loadMatches(uid) {
  const ref = query(
    collection(db, "matches"),
    where("ownerUid", "==", uid)
  );
  const snap = await getDocs(ref);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

function isCompletedMatch(match) {
  return match?.status === "ENDED";
}

function sortMatchesNewestFirst(a, b) {
  const aKey = `${a.meta?.date || ""}T${a.meta?.startTime || "00:00"}`;
  const bKey = `${b.meta?.date || ""}T${b.meta?.startTime || "00:00"}`;
  return bKey.localeCompare(aKey);
}

matchSelect.addEventListener("change", () => {
  if (!matchSelect.value) {
    renderView(allMatches, null);
    return;
  }

  const match = allMatches.find(m => m.id === matchSelect.value);
  if (match) renderView([match], match);
});

function populateMatchSelect(matches) {
  matchSelect.innerHTML = `<option value="">Velg kamp</option>`;

  matches.forEach(match => {
    const option = document.createElement("option");
    option.value = match.id;
    option.textContent = `${formatDate(match.meta?.date)} · ${match.meta?.opponent || "Motstander"} · ${scoreText(match)}`;
    matchSelect.appendChild(option);
  });
}

function renderView(matches, selectedMatch) {
  renderSummary(matches);
  renderPlayers(matches);

  if (selectedMatch) {
    statsTitle.textContent = `Kampstatistikk – ${selectedMatch.meta?.opponent || "Motstander"}`;
  } else {
    statsTitle.textContent = "Sesongstatistikk";
  }
}

function renderSummary(matches) {
  let wins = 0;
  let draws = 0;
  let losses = 0;
  let goalsFor = 0;
  let goalsAgainst = 0;

  matches.forEach(match => {
    const our = Number(match.score?.our ?? 0);
    const their = Number(match.score?.their ?? 0);

    goalsFor += our;
    goalsAgainst += their;

    if (our > their) wins += 1;
    else if (our < their) losses += 1;
    else draws += 1;
  });

  gamesValue.textContent = matches.length;
  winsValue.textContent = wins;
  drawsValue.textContent = draws;
  lossesValue.textContent = losses;
  goalsValue.textContent = `${goalsFor}–${goalsAgainst}`;
}

function renderPlayers(matches) {
  const stats = buildPlayerStats(matches);
  tbody.innerHTML = "";

  const players = Object.values(stats).sort((a, b) =>
    b.minutes - a.minutes ||
    b.goals - a.goals ||
    a.name.localeCompare(b.name, "no")
  );

  players.forEach(player => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${escapeHtml(player.name)}</td>
      <td>${player.matches}</td>
      <td>${player.minutes}</td>
      <td>${player.goals}</td>
      <td>${player.yellow}</td>
      <td>${player.red}</td>
    `;
    tbody.appendChild(row);
  });

  if (!players.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="6">Ingen spillerdata registrert.</td></tr>`;
  }
}

function buildPlayerStats(matches) {
  const stats = {};

  matches.forEach(match => {
    const playersObject = normalizePlayersObject(match.players);
    const rows = playerRowsForMatch(match, playersObject);

    rows.forEach(player => {
      if (!player.id) return;
      ensurePlayer(stats, player.id, player.name);
      stats[player.id].matches += 1;
      stats[player.id].minutes += Math.max(0, Math.round(Number(player.minutes || 0)));
      stats[player.id].yellow += Number(player.yellow || 0);
      stats[player.id].red += Number(player.red || 0);
    });

    (match.events || []).forEach(event => {
      if (event?.type === "goal" && event.team === "home" && event.playerId) {
        ensurePlayer(stats, event.playerId, event.playerName || playersObject[event.playerId]?.name || "Ukjent");
        stats[event.playerId].goals += 1;
      }
    });
  });

  return stats;
}

function normalizePlayersObject(players) {
  if (!players) return {};
  if (Array.isArray(players)) {
    return Object.fromEntries(players.filter(p => p?.id).map(p => [p.id, p]));
  }
  // Ny kampstruktur lagrer spillerne direkte som {h1: {...}, h2: {...}}.
  return players.home && typeof players.home === "object" ? players.home : players;
}

function playerRowsForMatch(match, playersObject) {
  if (Array.isArray(match.playingTime) && match.playingTime.length) {
    return match.playingTime.map(player => {
      const source = playersObject[player.id] || {};
      return {
        id: player.id,
        name: player.name || source.name || "Ukjent",
        minutes: Number(player.minutes || 0),
        yellow: yellowCount(source),
        red: redCount(source)
      };
    });
  }

  return Object.entries(playersObject)
    .filter(([, player]) => player?.present !== false)
    .map(([id, player]) => ({
      id,
      name: player.name || "Ukjent",
      minutes: calculateMinutes(player, match),
      yellow: yellowCount(player),
      red: redCount(player)
    }));
}

function yellowCount(player) {
  if (Array.isArray(player?.cards)) {
    return player.cards.filter(card => card?.type === "yellow").length;
  }
  return Number(player?.yellow || 0);
}

function redCount(player) {
  if (Array.isArray(player?.cards)) {
    return player.cards.filter(card => card?.type === "red").length;
  }
  return player?.red ? 1 : 0;
}

function calculateMinutes(player, match) {
  if (Number.isFinite(player?.minutes)) return Math.max(0, Math.round(player.minutes));
  if (!Array.isArray(player?.intervals)) return 0;

  const fallbackEnd = Number(match.timer?.elapsedMs) ||
    ((Number(match.meta?.halfLengthMin) || 35) * 2 * 60 * 1000);

  const totalMs = player.intervals.reduce((sum, interval) => {
    const start = Number(interval?.in || 0);
    const end = interval?.out == null ? fallbackEnd : Number(interval.out);
    return sum + Math.max(0, end - start);
  }, 0);

  return Math.floor(totalMs / 60000);
}

function ensurePlayer(stats, id, name) {
  if (!stats[id]) {
    stats[id] = {
      id,
      name: name || "Ukjent",
      matches: 0,
      minutes: 0,
      goals: 0,
      yellow: 0,
      red: 0
    };
  }
}

function scoreText(match) {
  return `${match.score?.our ?? "-"}–${match.score?.their ?? "-"}`;
}

function formatDate(value) {
  if (!value) return "Ukjent dato";
  const [year, month, day] = String(value).split("-");
  return year && month && day ? `${day}.${month}.${year}` : value;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
