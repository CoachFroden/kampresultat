console.log("Stats-side lastet");

/* ======================================================
   FIREBASE (CDN – selvstendig)
   ====================================================== */

import { initializeApp } from
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";

import { getAuth, onAuthStateChanged } from
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  getFirestore,
  collection,
  getDocs
} from
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAKZMu2HZPmmoZ1fFT7DNA9Q6ystbKEPgE",
  authDomain: "samnanger-g14-f10a1.firebaseapp.com",
  projectId: "samnanger-g14-f10a1",
  storageBucket: "samnanger-g14-f10a1.firebasestorage.app",
  messagingSenderId: "926427862844",
  appId: "1:926427862844:web:eeb814a349e9bfd701b039",
  measurementId: "G-XJ4X7NXQCM"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* ======================================================
   GLOBAL STATE
   ====================================================== */
let selectedMatchForPrint = null;
let allMatches = [];

/* ======================================================
   AUTH
   ====================================================== */

onAuthStateChanged(auth, async user => {
  if (!user) {
    console.warn("Ikke innlogget – ingen data");
    return;
  }

  allMatches = await loadMatches(user.uid);

  renderMatches(allMatches);
  populateMatchSelect(allMatches);
  renderPlayerStats(allMatches);
});

/* ======================================================
   FIRESTORE
   ====================================================== */

async function loadMatches(uid) {
  const ref = collection(db, "users", uid, "matches");
  const snap = await getDocs(ref);

  return snap.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}

/* ======================================================
   UI CONTROLS
   ====================================================== */

const totalBtn = document.getElementById("totalBtn");
const matchSelect = document.getElementById("matchSelect");

totalBtn.onclick = () => {
  matchSelect.hidden = false;
  matchSelect.value = "";
  selectedMatchForPrint = null;

  document.getElementById("printMatchTitle").textContent =
    "Spillerstatistikk – Totalt";

  renderPlayerStats(allMatches);
};

matchSelect.onchange = () => {
  const id = matchSelect.value;
  if (!id) return;

  const match = allMatches.find(m => m.id === id);
  if (!match) return;

  selectedMatchForPrint = match;

  document.getElementById("printMatchTitle").textContent =
    `${match.meta.ourTeam} – ${match.meta.opponent}
     (${match.meta.venue === "away" ? "Bortekamp" : "Hjemmekamp"},
      ${match.meta.date})`;

  renderPlayerStats([match]);
};

function populateMatchSelect(matches) {
  matchSelect.hidden = false;
  matchSelect.innerHTML = `<option value="">Velg kamp</option>`;

  matches.forEach(match => {
    const opt = document.createElement("option");
    opt.value = match.id;
    opt.textContent =
      `${match.meta?.date || ""} – ${match.meta?.opponent || ""}`;
    matchSelect.appendChild(opt);
  });
}

/* ======================================================
   KAMP-LISTE
   ====================================================== */

function renderMatches(matches) {
  const tbody =
    document.querySelector("#matchesTable tbody");

  tbody.innerHTML = "";

  matches.forEach(match => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${match.meta?.date || ""}</td>
      <td>${match.meta?.ourTeam || ""} – ${match.meta?.opponent || ""}</td>
      <td>${match.meta?.venue === "away" ? "Borte" : "Hjemme"}</td>
      <td>${match.score?.our ?? "-"} – ${match.score?.their ?? "-"}</td>
    `;

    tbody.appendChild(tr);
  });
}

/* ======================================================
   SPILLERSTATISTIKK
   ====================================================== */

function renderPlayerStats(matches) {
  const stats = {};

  matches.forEach(match => {
    if (!match.players) return;

    // 1️⃣ Bygg spillergrunnlag

    if (Array.isArray(match.players)) {
      match.players.forEach(player => {
        if (!player?.id) return;
        accumulate(stats, player);
      });
    } else {
      Object.entries(match.players).forEach(([id, player]) => {
        if (!player) return;
        accumulate(stats, {
          id,
          name: player.name,
          minutes: player.minutes,
          yellow: player.yellow,
          red: player.red
        });
      });
    }

    // 2️⃣ Tell mål (kun Samnanger)

    match.events?.forEach(event => {
      if (
        event.type === "goal" &&
        event.team === "home" &&
        event.playerId &&
        stats[event.playerId]
      ) {
        stats[event.playerId].goals += 1;
      }
    });
  });

  // 3️⃣ Render tabell

  const tbody =
    document.querySelector("#playersTable tbody");

  tbody.innerHTML = "";

  Object.values(stats).forEach(p => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${p.name}</td>
      <td>${p.matches}</td>
      <td>${p.minutes}</td>
      <td>${p.goals}</td>
      <td>${p.yellow}</td>
      <td>${p.red}</td>
    `;

    tbody.appendChild(tr);
  });
}

/* ======================================================
   HELPER
   ====================================================== */

function accumulate(stats, player) {
  if (!stats[player.id]) {
    stats[player.id] = {
      name: player.name,
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
  stats[player.id].red += player.red ? 1 : 0;
}

const printBtn = document.getElementById("printBtn");

printBtn.onclick = () => {
  window.print();
};
