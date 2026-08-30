console.log("Stats-side lastet");

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

let allMatches = [];

const totalBtn = document.getElementById("totalBtn");
const matchSelect = document.getElementById("matchSelect");
const printBtn = document.getElementById("printBtn");
const statusEl = document.getElementById("statsStatus");
const statsTitle = document.getElementById("statsTitle");
const printMatchTitle = document.getElementById("printMatchTitle");

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
    showTotal();

    statusEl.textContent = allMatches.length
      ? `${allMatches.length} fullførte kamper i statistikken`
      : "Ingen fullførte kamper funnet.";
  } catch (error) {
    console.error("Kunne ikke laste statistikk", error);
    statusEl.textContent = "Kunne ikke laste statistikken. Prøv å laste siden på nytt.";
  }
});

// VIKTIG: Statistikken skal KUN lese fra toppnivå-samlingen `matches`.
async function loadMatches(uid) {
  const ownMatches = query(
    collection(db, "matches"),
    where("ownerUid", "==", uid)
  );

  const snap = await getDocs(ownMatches);
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

totalBtn.addEventListener("click", showTotal);

matchSelect.addEventListener("change", () => {
  if (!matchSelect.value) {
    showTotal();
    return;
  }

  const match = allMatches.find(m => m.id === matchSelect.value);
  if (match) showMatch(match);
});

printBtn.addEventListener("click", () => window.print());

function showTotal() {
  matchSelect.value = "";
  statsTitle.textContent = "Spillerstatistikk – totalt";
  printMatchTitle.textContent = "Spillerstatistikk – totalt";
  renderPlayerStats(allMatches);
}

function showMatch(match) {
  matchSelect.value = match.id;

  const title = `${match.meta?.ourTeam || "Samnanger"} – ${match.meta?.opponent || "Motstander"}`;
  statsTitle.textContent = `Spillerstatistikk – ${title}`;
  printMatchTitle.textContent = `${title} (${formatDate(match.meta?.date)}, ${venueText(match)})`;

  renderPlayerStats([match]);
}

function populateMatchSelect(matches) {
  matchSelect.innerHTML = `<option value="">Velg kamp</option>`;

  matches.forEach(match => {
    const opt = document.createElement("option");
    opt.value = match.id;
    opt.textContent = `${formatDate(match.meta?.date)} – ${match.meta?.opponent || "Motstander"} (${scoreText(match)})`;
    matchSelect.appendChild(opt);
  });
}

function renderPlayerStats(matches) {
  const stats = buildPlayerStats(matches);
  const tbody = document.querySelector("#playersTable tbody");
  tbody.innerHTML = "";

  const players = Object.values(stats).sort((a, b) =>
    b.minutes - a.minutes ||
    b.goals - a.goals ||
    a.name.localeCompare(b.name, "no")
  );

  players.forEach(player => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(player.name)}</td>
      <td>${player.matches}</td>
      <td>${player.minutes}</td>
      <td>${player.goals}</td>
      <td>${player.yellow}</td>
      <td>${player.red}</td>
    `;
    tbody.appendChild(tr);
  });

  if (!players.length) {
    tbody.innerHTML = `<tr><td colspan="6">Ingen spillerdata registrert.</td></tr>`;
  }
}

function buildPlayerStats(matches) {
  const stats = {};

  matches.forEach(match => {
    const rows = playerRowsForMatch(match);

    rows.forEach(player => {
      if (!player.id) return;

      if (!stats[player.id]) {
        stats[player.id] = {
          id: player.id,
          name: player.name || "Ukjent",
          matches: 0,
          minutes: 0,
          goals: 0,
          yellow: 0,
          red: 0
        };
      }

      stats[player.id].matches += 1;
      stats[player.id].minutes += Number(player.minutes || 0);
      stats[player.id].yellow += Number(player.yellow || 0);
      stats[player.id].red += Number(player.red || 0);
    });

    (match.events || []).forEach(event => {
      if (
        event?.type === "goal" &&
        event.team === "home" &&
        event.playerId
      ) {
        if (!stats[event.playerId]) {
          stats[event.playerId] = {
            id: event.playerId,
            name: event.playerName || "Ukjent",
            matches: 0,
            minutes: 0,
            goals: 0,
            yellow: 0,
            red: 0
          };
        }

        stats[event.playerId].goals += 1;
      }
    });
  });

  return stats;
}

function playerRowsForMatch(match) {
  const result = new Map();
  const playersObject = !Array.isArray(match.players) && match.players
    ? match.players
    : {};

  if (Array.isArray(match.playingTime) && match.playingTime.length) {
    match.playingTime.forEach(player => {
      const source = playersObject[player.id] || {};
      result.set(player.id, {
        id: player.id,
        name: player.name || source.name || "Ukjent",
        minutes: Number(player.minutes || 0),
        ...cardCounts(source)
      });
    });
  } else if (Array.isArray(match.players)) {
    match.players.forEach(player => {
      if (!player?.id) return;
      result.set(player.id, {
        id: player.id,
        name: player.name || "Ukjent",
        minutes: Number(player.minutes || 0),
        yellow: Number(player.yellow || 0),
        red: player.red ? 1 : 0
      });
    });
  } else {
    Object.entries(playersObject).forEach(([id, player]) => {
      if (!player) return;
      result.set(id, {
        id,
        name: player.name || "Ukjent",
        minutes: calculateSavedMinutes(player, match),
        ...cardCounts(player)
      });
    });
  }

  return [...result.values()];
}

function calculateSavedMinutes(player, match) {
  if (Number.isFinite(player?.minutes)) {
    return Math.max(0, Math.round(player.minutes));
  }

  if (!Array.isArray(player?.intervals)) return 0;

  const fallbackEnd = Number(match.timer?.elapsedMs) ||
    ((Number(match.meta?.halfLengthMin) || 35) * 2 * 60 * 1000);

  const totalMs = player.intervals.reduce((sum, interval) => {
    const start = Number(interval?.in || 0);
    const end = interval?.out == null
      ? fallbackEnd
      : Number(interval.out);

    return sum + Math.max(0, end - start);
  }, 0);

  return Math.floor(totalMs / 60000);
}

function cardCounts(player) {
  if (Array.isArray(player?.cards)) {
    return {
      yellow: player.cards.filter(card => card?.type === "yellow").length,
      red: player.cards.filter(card => card?.type === "red").length
    };
  }

  return {
    yellow: Number(player?.yellow || 0),
    red: player?.red ? 1 : 0
  };
}

function scoreText(match) {
  return `${match.score?.our ?? "-"}–${match.score?.their ?? "-"}`;
}

function venueText(match) {
  return match.meta?.venue === "away" ? "Bortekamp" : "Hjemmekamp";
}

function formatDate(value) {
  if (!value) return "Ukjent dato";
  const [year, month, day] = value.split("-");
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
