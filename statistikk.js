console.log("Stats-side lastet");

import { initializeApp, getApps, getApp } from
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  getDoc,
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

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let allMatches = [];
let selectedMatch = null;

const totalBtn = document.getElementById("totalBtn");
const matchSelect = document.getElementById("matchSelect");
const printBtn = document.getElementById("printBtn");
const statusEl = document.getElementById("statsStatus");
const detailEl = document.getElementById("matchDetail");

onAuthStateChanged(auth, async user => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  try {
    statusEl.textContent = "Laster kamper…";
    allMatches = await loadMatches(user.uid);
    allMatches.sort(sortMatchesNewestFirst);

    renderMatches(allMatches);
    populateMatchSelect(allMatches);
    showTotal();

    statusEl.textContent = allMatches.length
      ? `${allMatches.length} kamper funnet`
      : "Ingen lagrede kamper funnet.";
  } catch (error) {
    console.error(error);
    statusEl.textContent = "Kunne ikke laste kampstatistikk. Prøv å laste siden på nytt.";
  }
});

async function loadMatches(uid) {
  const matches = new Map();

  let role = "coach";
  try {
    const userSnap = await getDoc(doc(db, "users", uid));
    if (userSnap.exists()) role = userSnap.data().role || role;
  } catch (error) {
    console.warn("Kunne ikke lese brukerrolle", error);
  }

  if (role === "assistantCoach") {
    await addCollection(matches, collection(db, "assistantMatches", uid, "matches"));
  } else {
    try {
      const ownMatches = query(collection(db, "matches"), where("ownerUid", "==", uid));
      await addCollection(matches, ownMatches);
    } catch (error) {
      console.warn("Kunne ikke lese toppnivå matches", error);
    }
  }

  try {
    await addCollection(matches, collection(db, "users", uid, "matches"), false);
  } catch (error) {
    console.warn("Ingen eldre kampdata tilgjengelig", error);
  }

  return [...matches.values()];
}

async function addCollection(target, ref, overwrite = true) {
  const snap = await getDocs(ref);
  snap.docs.forEach(d => {
    if (!overwrite && target.has(d.id)) return;
    target.set(d.id, { id: d.id, ...d.data() });
  });
}

function sortMatchesNewestFirst(a, b) {
  const aKey = `${a.meta?.date || ""}T${a.meta?.startTime || "00:00"}`;
  const bKey = `${b.meta?.date || ""}T${b.meta?.startTime || "00:00"}`;
  return bKey.localeCompare(aKey);
}

totalBtn.addEventListener("click", showTotal);

matchSelect.addEventListener("change", () => {
  const match = allMatches.find(m => m.id === matchSelect.value);
  if (match) showMatch(match);
});

printBtn.addEventListener("click", () => window.print());

function showTotal() {
  selectedMatch = null;
  matchSelect.value = "";
  document.getElementById("statsTitle").textContent = "Spillerstatistikk – totalt";
  document.getElementById("printMatchTitle").textContent = "Spillerstatistikk – totalt";
  renderPlayerStats(allMatches);
  renderTotalSummary(allMatches);
  clearSelectedRows();
}

function showMatch(match) {
  selectedMatch = match;
  matchSelect.value = match.id;

  const title = `${match.meta?.ourTeam || "Samnanger"} – ${match.meta?.opponent || "Motstander"}`;
  document.getElementById("statsTitle").textContent = `Spillerstatistikk – ${title}`;
  document.getElementById("printMatchTitle").textContent =
    `${title} · ${formatDate(match.meta?.date)} · ${venueText(match)}`;

  renderPlayerStats([match]);
  renderMatchDetail(match);
  markSelectedRow(match.id);
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

function renderMatches(matches) {
  const tbody = document.querySelector("#matchesTable tbody");
  tbody.innerHTML = "";

  matches.forEach(match => {
    const tr = document.createElement("tr");
    tr.dataset.matchId = match.id;
    tr.tabIndex = 0;
    tr.className = "match-row";
    tr.innerHTML = `
      <td>${escapeHtml(formatDate(match.meta?.date))}</td>
      <td>${escapeHtml(match.meta?.ourTeam || "Samnanger")} – ${escapeHtml(match.meta?.opponent || "Motstander")}</td>
      <td>${escapeHtml(venueText(match))}</td>
      <td><strong>${escapeHtml(scoreText(match))}</strong></td>
      <td><button class="view-match-btn" type="button">Se statistikk</button></td>
    `;

    const open = () => showMatch(match);
    tr.addEventListener("click", open);
    tr.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") open();
    });
    tbody.appendChild(tr);
  });
}

function renderTotalSummary(matches) {
  const ended = matches.filter(m => m.status === "ENDED" || Number.isFinite(m.score?.our));
  let wins = 0;
  let draws = 0;
  let losses = 0;
  let gf = 0;
  let ga = 0;

  ended.forEach(match => {
    const our = Number(match.score?.our ?? 0);
    const their = Number(match.score?.their ?? 0);
    gf += our;
    ga += their;
    if (our > their) wins += 1;
    else if (our === their) draws += 1;
    else losses += 1;
  });

  detailEl.innerHTML = `
    <div class="summary-grid">
      ${summaryCard("Kamper", ended.length)}
      ${summaryCard("Seier / U / Tap", `${wins} / ${draws} / ${losses}`)}
      ${summaryCard("Mål", `${gf}–${ga}`)}
      ${summaryCard("Målforskjell", `${gf - ga >= 0 ? "+" : ""}${gf - ga}`)}
    </div>
    <p class="detail-hint">Trykk på en kamp i listen for å se statistikken fra akkurat den kampen.</p>
  `;
}

function renderMatchDetail(match) {
  const stats = buildPlayerStats([match]);
  const goalScorers = Object.values(stats)
    .filter(p => p.goals > 0)
    .map(p => `${escapeHtml(p.name)} ${p.goals > 1 ? `(${p.goals})` : ""}`.trim());

  const cardPlayers = Object.values(stats)
    .filter(p => p.yellow > 0 || p.red > 0)
    .map(p => `${escapeHtml(p.name)}${p.yellow ? ` 🟨×${p.yellow}` : ""}${p.red ? ` 🟥×${p.red}` : ""}`);

  const events = dedupeStartEvents(match.events || []);
  const eventsHtml = events.length
    ? `<ul class="match-events">${events.map(event => `<li>${escapeHtml(event.text || String(event))}</li>`).join("")}</ul>`
    : `<p class="muted">Ingen hendelser registrert.</p>`;

  detailEl.innerHTML = `
    <div class="detail-head">
      <div>
        <p class="eyebrow">${escapeHtml(formatDate(match.meta?.date))} · ${escapeHtml(venueText(match))}</p>
        <h2>${escapeHtml(match.meta?.ourTeam || "Samnanger")} – ${escapeHtml(match.meta?.opponent || "Motstander")}</h2>
      </div>
      <div class="detail-score">${escapeHtml(scoreText(match))}</div>
    </div>
    <div class="summary-grid">
      ${summaryCard("Målscorere", goalScorers.length ? goalScorers.join(", ") : "–")}
      ${summaryCard("Kort", cardPlayers.length ? cardPlayers.join(", ") : "–")}
      ${summaryCard("Kamptype", matchTypeText(match.meta?.type))}
      ${summaryCard("Spilletid", `${match.meta?.halfLengthMin || 35} min × 2`)}
    </div>
    <details class="events-details">
      <summary>Hendelser i kampen (${events.length})</summary>
      ${eventsHtml}
    </details>
  `;
}

function renderPlayerStats(matches) {
  const stats = buildPlayerStats(matches);
  const tbody = document.querySelector("#playersTable tbody");
  tbody.innerHTML = "";

  Object.values(stats)
    .sort((a, b) => b.minutes - a.minutes || b.goals - a.goals || a.name.localeCompare(b.name, "no"))
    .forEach(p => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(p.name)}</td>
        <td>${p.matches}</td>
        <td>${p.minutes}</td>
        <td>${p.goals}</td>
        <td>${p.yellow}</td>
        <td>${p.red}</td>
      `;
      tbody.appendChild(tr);
    });

  if (!Object.keys(stats).length) {
    tbody.innerHTML = `<tr><td colspan="6" class="muted">Ingen spillerdata registrert.</td></tr>`;
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
      stats[player.id].minutes += player.minutes || 0;
      stats[player.id].yellow += player.yellow || 0;
      stats[player.id].red += player.red || 0;
    });

    (match.events || []).forEach(event => {
      if (event?.type !== "goal" || event.team !== "home" || !event.playerId) return;
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
    });
  });

  return stats;
}

function playerRowsForMatch(match) {
  const result = new Map();
  const playersObject = !Array.isArray(match.players) && match.players ? match.players : {};

  if (Array.isArray(match.playingTime) && match.playingTime.length) {
    match.playingTime.forEach(p => {
      const source = playersObject[p.id] || {};
      result.set(p.id, {
        id: p.id,
        name: p.name || source.name || "Ukjent",
        minutes: Number(p.minutes || 0),
        ...cardCounts(source)
      });
    });
  } else if (Array.isArray(match.players)) {
    match.players.forEach(p => {
      if (!p?.id) return;
      result.set(p.id, {
        id: p.id,
        name: p.name || "Ukjent",
        minutes: Number(p.minutes || 0),
        yellow: Number(p.yellow || 0),
        red: p.red ? 1 : 0
      });
    });
  } else {
    Object.entries(playersObject).forEach(([id, p]) => {
      if (!p) return;
      result.set(id, {
        id,
        name: p.name || "Ukjent",
        minutes: calculateSavedMinutes(p, match),
        ...cardCounts(p)
      });
    });
  }

  (match.squad?.present || []).forEach(p => {
    if (!result.has(p.id)) {
      result.set(p.id, { id: p.id, name: p.name || "Ukjent", minutes: 0, yellow: 0, red: 0 });
    }
  });

  return [...result.values()];
}

function calculateSavedMinutes(player, match) {
  if (Number.isFinite(player.minutes)) return Math.max(0, Math.round(player.minutes));
  if (!Array.isArray(player.intervals)) return 0;

  const fallbackEnd = Number(match.timer?.elapsedMs) ||
    ((Number(match.meta?.halfLengthMin) || 35) * 2 * 60 * 1000);

  const ms = player.intervals.reduce((sum, interval) => {
    const start = Number(interval?.in || 0);
    const end = interval?.out == null ? fallbackEnd : Number(interval.out);
    return sum + Math.max(0, end - start);
  }, 0);

  return Math.floor(ms / 60000);
}

function cardCounts(player) {
  if (!Array.isArray(player?.cards)) {
    return {
      yellow: Number(player?.yellow || 0),
      red: player?.red ? 1 : 0
    };
  }
  return {
    yellow: player.cards.filter(c => c?.type === "yellow").length,
    red: player.cards.filter(c => c?.type === "red").length
  };
}

function dedupeStartEvents(events) {
  let startSeen = false;
  return events.filter(event => {
    const text = event?.text || String(event || "");
    if (!text.includes("Kamp startet")) return true;
    if (startSeen) return false;
    startSeen = true;
    return true;
  });
}

function markSelectedRow(id) {
  clearSelectedRows();
  document.querySelector(`[data-match-id="${CSS.escape(id)}"]`)?.classList.add("selected");
}

function clearSelectedRows() {
  document.querySelectorAll(".match-row.selected").forEach(row => row.classList.remove("selected"));
}

function scoreText(match) {
  return `${match.score?.our ?? "-"}–${match.score?.their ?? "-"}`;
}

function venueText(match) {
  return match.meta?.venue === "away" ? "Borte" : "Hjemme";
}

function matchTypeText(type) {
  return ({ league: "Seriekamp", cup: "Cupkamp", friendly: "Treningskamp" })[type] || "Kamp";
}

function formatDate(value) {
  if (!value) return "Ukjent dato";
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}.${month}.${year}` : value;
}

function summaryCard(label, value) {
  return `<div class="summary-card"><span>${escapeHtml(label)}</span><strong>${value}</strong></div>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
