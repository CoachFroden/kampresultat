import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  serverTimestamp
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

let currentUser = null;
let userRole = null;
let allMatches = [];
let selectedMatchId = null;

const $ = id => document.getElementById(id);
const matchesList = $("matchesList");
const matchDetail = $("matchDetail");
const eventDialog = $("eventDialog");
const eventForm = $("eventForm");

function message(text = "", isError = false) {
  const el = $("pageMessage");
  el.textContent = text;
  el.classList.toggle("error", isError);
}

function formatDate(value) {
  if (!value) return "Ukjent dato";
  const d = new Date(`${value}T12:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("no-NO", { day: "2-digit", month: "long", year: "numeric" }).format(d);
}

function matchSortValue(match) {
  const date = match.meta?.date || "0000-00-00";
  const time = match.meta?.startTime || "00:00";
  return `${date}T${time}`;
}

function cleanEventText(text = "") {
  return String(text).replace(/^\d{1,2}:\d{2}\s*[–-]\s*/, "").trim();
}

function displayEventText(event) {
  let text = cleanEventText(event?.text || "Hendelse");
  if (event?.minute) {
    text = text
      .replace(`${event.minute} – `, "")
      .replace(`${event.minute} - `, "");
  }
  return text.trim();
}

function minuteValue(value) {
  if (value == null || value === "") return Number.POSITIVE_INFINITY;
  const text = String(value).trim();
  const plus = text.match(/^(\d+)\s*\+\s*(\d+)$/);
  if (plus) return Number(plus[1]) + Number(plus[2]) / 100;
  const n = Number(text);
  return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
}

function orderedEvents(match) {
  const events = Array.isArray(match.events) ? [...match.events] : [];
  return events.sort((a, b) => {
    const am = minuteValue(a.minute);
    const bm = minuteValue(b.minute);
    if (am !== bm) return am - bm;
    return String(a.reportedAt || "").localeCompare(String(b.reportedAt || ""));
  });
}

function scoreText(match) {
  return `${Number(match.score?.our ?? 0)}–${Number(match.score?.their ?? 0)}`;
}

function matchCollection() {
  if (!currentUser) throw new Error("Du er ikke logget inn.");
  if (userRole === "assistantCoach") {
    return collection(db, "assistantMatches", currentUser.uid, "matches");
  }
  return collection(db, "matches");
}

function matchRef(matchId) {
  if (!currentUser) throw new Error("Du er ikke logget inn.");
  if (userRole === "assistantCoach") {
    return doc(db, "assistantMatches", currentUser.uid, "matches", matchId);
  }
  return doc(db, "matches", matchId);
}

async function loadMatches(preselectId = selectedMatchId) {
  message("");
  matchesList.innerHTML = '<div class="empty-state">Henter kamper…</div>';
  try {
    const snap = await getDocs(matchCollection());
    allMatches = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(match => match.status === "ENDED")
      .sort((a, b) => matchSortValue(b).localeCompare(matchSortValue(a)));

    renderMatchList();

    if (preselectId && allMatches.some(m => m.id === preselectId)) {
      selectMatch(preselectId);
    } else if (allMatches.length) {
      selectMatch(allMatches[0].id);
    } else {
      selectedMatchId = null;
      renderEmptyDetail();
    }
  } catch (error) {
    console.error(error);
    matchesList.innerHTML = '<div class="empty-state">Kunne ikke hente kamper.</div>';
    message(error.message || "Kunne ikke hente kamper.", true);
  }
}

function renderMatchList() {
  matchesList.innerHTML = "";
  if (!allMatches.length) {
    matchesList.innerHTML = '<div class="empty-state">Ingen ferdigspilte kamper ennå.</div>';
    return;
  }

  allMatches.forEach(match => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `match-card${match.id === selectedMatchId ? " active" : ""}`;
    btn.dataset.matchId = match.id;

    const date = document.createElement("span");
    date.className = "match-card-date";
    date.textContent = formatDate(match.meta?.date);

    const teams = document.createElement("div");
    teams.className = "match-card-teams";
    teams.textContent = `${match.meta?.ourTeam || "Samnanger"} – ${match.meta?.opponent || "Motstander"}`;

    const score = document.createElement("div");
    score.className = "match-card-score";
    score.textContent = scoreText(match);

    btn.append(date, teams, score);
    btn.addEventListener("click", () => selectMatch(match.id));
    matchesList.appendChild(btn);
  });
}

function renderMatchEmpty() {
  matchDetail.innerHTML = `
    <div class="empty-detail">
      <div class="empty-icon">⚽</div>
      <h2>Ingen kamp valgt</h2>
      <p>Ferdigspilte kamper vises her når de finnes.</p>
    </div>`;
}

function selectMatch(matchId) {
  selectedMatchId = matchId;
  renderMatchList();
  renderSelectedMatch();
}

function renderSelectedMatch() {
  const match = allMatches.find(m => m.id === selectedMatchId);
  if (!match) return renderMatchEmpty();

  matchDetail.innerHTML = "";
  const content = document.createElement("div");
  content.className = "detail-content";

  const top = document.createElement("div");
  top.className = "detail-top";

  const info = document.createElement("div");
  const date = document.createElement("div");
  date.className = "detail-date";
  date.textContent = `${formatDate(match.meta?.date)}${match.meta?.startTime ? ` · ${match.meta.startTime}` : ""}`;
  const teams = document.createElement("h2");
  teams.className = "detail-teams";
  teams.textContent = `${match.meta?.ourTeam || "Samnanger"} – ${match.meta?.opponent || "Motstander"}`;
  const score = document.createElement("div");
  score.className = "detail-score";
  score.textContent = scoreText(match);
  info.append(date, teams, score);

  const actions = document.createElement("div");
  actions.className = "detail-actions";
  const shareBtn = document.createElement("button");
  shareBtn.type = "button";
  shareBtn.className = "secondary-btn";
  shareBtn.textContent = "Del kampresultat";
  shareBtn.addEventListener("click", () => shareMatch(match));
  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "primary-btn";
  addBtn.textContent = "+ Legg til hendelse";
  addBtn.addEventListener("click", () => openEventDialog(match));
  actions.append(shareBtn, addBtn);
  top.append(info, actions);

  const eventsSection = document.createElement("section");
  eventsSection.className = "events-section";
  const heading = document.createElement("h3");
  heading.textContent = "Hendelser";
  const list = document.createElement("div");
  list.className = "events-list";

  const events = orderedEvents(match);
  if (!events.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Ingen hendelser registrert.";
    list.appendChild(empty);
  } else {
    events.forEach(event => {
      const row = document.createElement("div");
      row.className = "event-row";
      const minute = document.createElement("div");
      minute.className = "event-minute";
      minute.textContent = event.minute ? `${event.minute}'` : "";
      const textWrap = document.createElement("div");
      const text = document.createElement("div");
      text.className = "event-text";
      text.textContent = displayEventText(event);
      textWrap.appendChild(text);
      if (event.addedAfterMatch) {
        const badge = document.createElement("span");
        badge.className = "event-added";
        badge.textContent = "Lagt til etter kampslutt";
        textWrap.appendChild(badge);
      }
      row.append(minute, textWrap);
      list.appendChild(row);
    });
  }

  eventsSection.append(heading, list);
  content.append(top, eventsSection);
  matchDetail.appendChild(content);
}

function buildShareText(match) {
  const lines = [
    "Kampresultat",
    `${match.meta?.ourTeam || "Samnanger"} ${scoreText(match)} ${match.meta?.opponent || "Motstander"}`,
    formatDate(match.meta?.date),
    "",
    "Hendelser:"
  ];

  const events = orderedEvents(match);
  if (!events.length) {
    lines.push("Ingen hendelser registrert.");
  } else {
    events.forEach(event => {
      const prefix = event.minute ? `${event.minute}' ` : "";
      lines.push(`${prefix}${displayEventText(event)}`.trim());
    });
  }
  return lines.join("\n");
}

async function shareMatch(match) {
  const text = buildShareText(match);
  try {
    if (navigator.share) {
      await navigator.share({ title: "Kampresultat", text });
      return;
    }
    await navigator.clipboard.writeText(text);
    message("Kampresultatet er kopiert til utklippstavlen.");
  } catch (error) {
    if (error?.name === "AbortError") return;
    try {
      await navigator.clipboard.writeText(text);
      message("Kampresultatet er kopiert til utklippstavlen.");
    } catch {
      message("Kunne ikke dele kampresultatet.", true);
    }
  }
}

function playersForMatch(match) {
  if (match.players && !Array.isArray(match.players)) {
    return Object.values(match.players)
      .filter(p => p?.id && p?.name)
      .sort((a, b) => a.name.localeCompare(b.name, "no"));
  }
  return (match.squad?.present || [])
    .filter(p => p?.id && p?.name)
    .sort((a, b) => a.name.localeCompare(b.name, "no"));
}

function openEventDialog(match) {
  const team = $("eventTeam");
  team.innerHTML = "";
  const ourOpt = document.createElement("option");
  ourOpt.value = "home";
  ourOpt.textContent = match.meta?.ourTeam || "Samnanger";
  const theirOpt = document.createElement("option");
  theirOpt.value = "away";
  theirOpt.textContent = match.meta?.opponent || "Motstander";
  team.append(ourOpt, theirOpt);

  const player = $("eventPlayer");
  player.innerHTML = '<option value="">Velg spiller</option>';
  playersForMatch(match).forEach(p => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.name;
    player.appendChild(opt);
  });

  $("eventType").value = "goal";
  $("eventTeam").value = "home";
  $("eventMinute").value = "";
  $("opponentPlayer").value = "";
  $("eventDescription").value = "";
  updateEventFormVisibility();
  eventDialog.showModal();
}

function updateEventFormVisibility() {
  const type = $("eventType").value;
  const team = $("eventTeam").value;
  const isNote = type === "note";
  $("teamRow").classList.toggle("hidden", isNote);
  $("homePlayerRow").classList.toggle("hidden", isNote || team !== "home");
  $("awayPlayerRow").classList.toggle("hidden", isNote || team !== "away");
  $("descriptionRow").classList.toggle("hidden", !isNote);
  $("eventMinute").required = !isNote;
  $("eventPlayer").required = !isNote && team === "home";
  $("eventDescription").required = isNote;
}

function reportedPrefix() {
  return new Intl.DateTimeFormat("no-NO", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
}

async function savePostMatchEvent() {
  const selected = allMatches.find(m => m.id === selectedMatchId);
  if (!selected) throw new Error("Ingen kamp er valgt.");

  const ref = matchRef(selected.id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Kampen finnes ikke lenger.");
  const match = { id: snap.id, ...snap.data() };
  if (match.status !== "ENDED") throw new Error("Etterregistrering er bare tilgjengelig for ferdigspilte kamper.");

  const type = $("eventType").value;
  const team = $("eventTeam").value;
  const minute = $("eventMinute").value.trim();
  const description = $("eventDescription").value.trim();
  const maxMinute = Number(match.meta?.halfLengthMin || 35) * 2;

  if (type !== "note") {
    const minuteNumber = Number(minute);
    if (!Number.isInteger(minuteNumber) || minuteNumber < 1 || minuteNumber > maxMinute) {
      throw new Error(`Minutt må være mellom 1 og ${maxMinute}.`);
    }
  }

  const events = Array.isArray(match.events) ? [...match.events] : [];
  const score = {
    our: Number(match.score?.our ?? 0),
    their: Number(match.score?.their ?? 0)
  };
  const timestamp = reportedPrefix();
  const common = {
    minute: minute || null,
    reportedAt: new Date().toISOString(),
    reportedBy: currentUser.uid,
    addedAfterMatch: true
  };

  let event;
  let players = match.players && !Array.isArray(match.players) ? structuredClone(match.players) : null;

  if (type === "goal") {
    if (team === "home") {
      const playerId = $("eventPlayer").value;
      const player = playersForMatch(match).find(p => p.id === playerId);
      if (!player) throw new Error("Velg målscorer.");
      score.our += 1;
      event = {
        ...common,
        type: "goal",
        team: "home",
        playerId: player.id,
        playerName: player.name,
        text: `${timestamp} – ⚽ ${minute} – ${player.name} (${match.meta?.ourTeam || "Samnanger"})`
      };
    } else {
      const name = $("opponentPlayer").value.trim() || "Ukjent spiller";
      score.their += 1;
      event = {
        ...common,
        type: "goal",
        team: "away",
        playerId: null,
        playerName: name,
        text: `${timestamp} – ⚽ ${minute} – ${name} (${match.meta?.opponent || "Motstander"})`
      };
    }
  } else if (type === "yellow" || type === "red") {
    const icon = type === "yellow" ? "🟨" : "🟥";
    if (team === "home") {
      const playerId = $("eventPlayer").value;
      const player = playersForMatch(match).find(p => p.id === playerId);
      if (!player) throw new Error("Velg spiller.");
      event = {
        ...common,
        type: "card",
        cardType: type,
        team: "home",
        playerId: player.id,
        playerName: player.name,
        text: `${timestamp} – ${icon} ${minute} – ${player.name}`
      };
      if (players?.[player.id]) {
        const currentCards = Array.isArray(players[player.id].cards) ? players[player.id].cards : [];
        players[player.id].cards = [
          ...currentCards,
          { type, timeMs: Number(minute) * 60 * 1000, addedAfterMatch: true }
        ];
      }
    } else {
      const name = $("opponentPlayer").value.trim() || "Ukjent spiller";
      event = {
        ...common,
        type: "card",
        cardType: type,
        team: "away",
        playerId: null,
        playerName: name,
        text: `${timestamp} – ${icon} ${minute} – ${name} (${match.meta?.opponent || "Motstander"})`
      };
    }
  } else {
    if (!description) throw new Error("Skriv en beskrivelse av hendelsen.");
    event = {
      ...common,
      type: "text",
      text: `${timestamp} – 📝 ${minute ? `${minute} – ` : ""}${description}`
    };
  }

  events.unshift(event);
  const patch = {
    score,
    result: `${score.our}-${score.their}`,
    events,
    updatedAt: serverTimestamp()
  };
  if (players && (type === "yellow" || type === "red") && team === "home") {
    patch.players = players;
  }

  await setDoc(ref, patch, { merge: true });
}

$("eventType").addEventListener("change", updateEventFormVisibility);
$("eventTeam").addEventListener("change", updateEventFormVisibility);
$("closeEventDialog").addEventListener("click", () => eventDialog.close());
$("cancelEventBtn").addEventListener("click", () => eventDialog.close());
$("reloadBtn").addEventListener("click", () => loadMatches());

eventForm.addEventListener("submit", async event => {
  event.preventDefault();
  const btn = $("saveEventBtn");
  btn.disabled = true;
  const original = btn.textContent;
  btn.textContent = "Lagrer…";
  try {
    await savePostMatchEvent();
    eventDialog.close();
    message("Hendelsen er lagt til og kampresultatet er oppdatert.");
    await loadMatches(selectedMatchId);
  } catch (error) {
    console.error(error);
    message(error.message || "Kunne ikke lagre hendelsen.", true);
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
});

onAuthStateChanged(auth, async user => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }
  currentUser = user;
  try {
    const userSnap = await getDoc(doc(db, "users", user.uid));
    if (!userSnap.exists()) throw new Error("Fant ikke brukerprofilen din.");
    userRole = userSnap.data().role;
    if (!["coach", "assistantCoach"].includes(userRole)) {
      throw new Error("Du har ikke tilgang til kamparkivet.");
    }
    await loadMatches();
  } catch (error) {
    console.error(error);
    message(error.message || "Kunne ikke åpne kamparkivet.", true);
  }
});
