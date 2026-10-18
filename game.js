
/* =========================================================
   TIC-TAC-TOE — UPDATED JAVASCRIPT
   Game history + numeric IDs + suggestions
   Philippine date/time + legacy_id support
   ========================================================= */

const SUPABASE_URL = "https://faleqiuiuejqwanxtfbs.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_AA2Kw2wYE5DLgjFziFn8Gw_62CojRdk";

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

const on = (selector, eventName, handler) => {
  const el = $(selector);
  if (el) el.addEventListener(eventName, handler);
  else console.warn("Element not found:", selector);
};

const store = {
  get: key => {
    try { return localStorage.getItem(key); }
    catch { return null; }
  },
  set: (key, value) => {
    try { localStorage.setItem(key, value); }
    catch {}
  },
  remove: key => {
    try { localStorage.removeItem(key); }
    catch {}
  }
};

const cells = $$(".cell");
const statusText = $("#status") || document.createElement("p");
const settingsDrawer = $("#settingsDrawer");
const historyDrawer = $("#historyDrawer");
const feedbackDrawer = $("#feedbackDrawer");
const backdrop = $("#drawerBackdrop");

let board = Array(9).fill("");
let gameActive = false;
let aiThinking = false;
let resultSaved = false;
let roundId = null;
let mode = "ai";
let soundOn = store.get("tttSound") !== "false";
let scores = { player: 0, ai: 0, draws: 0 };
let audioContext = null;
let toastTimer;
let aiTimer = null;
let overlayTimer = null;

const wins = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6]
];

const themes = {
  chocolate: {
    page: "#F5EBDD", card: "#FFF9F0",
    accent: "#80543D", text: "#38241D",
    muted: "#806B5A", border: "#D9C5AF", cell: "#F5EBDD"
  },
  dark: {
    page: "#171717", card: "#262626",
    accent: "#C59A6B", text: "#F7F0E8",
    muted: "#C2B7AB", border: "#51463C", cell: "#202020"
  },
  ocean: {
    page: "#EAF3FA", card: "#FFFFFF",
    accent: "#246B9E", text: "#17334A",
    muted: "#58758A", border: "#BED4E4", cell: "#EAF3FA"
  },
  forest: {
    page: "#EAF1E8", card: "#FFFFFF",
    accent: "#386641", text: "#233B28",
    muted: "#647A68", border: "#C5D5C3", cell: "#EAF1E8"
  },
  purple: {
    page: "#211A35", card: "#302644",
    accent: "#A78BFA", text: "#F5EEFF",
    muted: "#C5B8DD", border: "#594875", cell: "#261F3A"
  }
};

function showToast(message) {
  const toast = $("#toast");
  if (!toast) {
    console.log(message);
    return;
  }

  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3000);
}

function setStatus(message) {
  statusText.textContent = message;
}

function playSound(frequency = 440, duration = 0.09) {
  if (!soundOn) return;

  try {
    audioContext ||= new (
      window.AudioContext || window.webkitAudioContext
    )();

    if (audioContext.state === "suspended") {
      audioContext.resume();
    }

    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.frequency.value = frequency;
    oscillator.type = "sine";
    gain.gain.setValueAtTime(0.08, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      audioContext.currentTime + duration
    );

    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
  } catch {}
}

function renderScores() {
  if ($("#playerWins")) $("#playerWins").textContent = scores.player;
  if ($("#aiWins")) $("#aiWins").textContent = scores.ai;
  if ($("#draws")) $("#draws").textContent = scores.draws;
}

function setMode(newMode) {
  if (newMode !== mode) {
    scores = { player: 0, ai: 0, draws: 0 };
    renderScores();
  }

  mode = newMode;

  $("#aiModeBtn")?.classList.toggle("active", mode === "ai");
  $("#twoPlayerBtn")?.classList.toggle("active", mode === "two");

  startGame();
}

function startGame() {
  clearTimeout(aiTimer);
  clearTimeout(overlayTimer);

  $("#victoryOverlay")?.remove();
  cells.forEach(cell => cell.classList.remove("winning-cell"));

  board = Array(9).fill("");
  gameActive = true;
  aiThinking = false;
  resultSaved = false;
  roundId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  cells.forEach((cell, index) => {
    cell.textContent = "";
    cell.disabled = false;
    delete cell.dataset.mark;
    cell.setAttribute("aria-label", `Cell ${index + 1}, empty`);
  });

  setStatus(mode === "ai" ? "Your turn — X" : "Player X's turn");
}

function checkWinner(position) {
  for (const [a, b, c] of wins) {
    if (
      position[a] &&
      position[a] === position[b] &&
      position[b] === position[c]
    ) {
      return position[a];
    }
  }

  return position.every(Boolean) ? "draw" : null;
}

function getWinningLine(position) {
  return wins.find(([a, b, c]) =>
    position[a] &&
    position[a] === position[b] &&
    position[b] === position[c]
  ) || [];
}

function showVictoryEffect(result) {
  $("#victoryOverlay")?.remove();

  const title = result === "draw"
    ? "IT'S A DRAW!"
    : result === "X"
      ? (mode === "ai" ? "YOU WIN!" : "PLAYER X WINS!")
      : (mode === "ai" ? "AI WINS!" : "PLAYER O WINS!");

  const overlay = document.createElement("div");
  overlay.id = "victoryOverlay";
  overlay.className =
    `victory-overlay ${result === "draw" ? "is-draw" : "is-win"}`;

  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", title);

  const panel = document.createElement("div");
  panel.className = "victory-panel";

  const heading = document.createElement("h2");
  heading.textContent = title;

  const message = document.createElement("p");
  message.textContent = result === "draw"
    ? "A close match. Try again!"
    : mode === "two"
      ? "Great game, both of you!"
      : result === "X"
        ? "Great move. You played well!"
        : "Better luck next round!";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "victory-play-again";
  button.textContent = "PLAY AGAIN";

  button.addEventListener("click", () => {
    overlay.remove();
    startGame();
    playSound(500, 0.12);
  });

  panel.append(heading, message, button);
  overlay.append(panel);
  document.body.append(overlay);

  if (result !== "draw") {
    for (let i = 0; i < 48; i++) {
      const bit = document.createElement("span");
      bit.className = "confetti-piece";
      bit.style.left = `${Math.random() * 100}%`;
      bit.style.animationDelay = `${Math.random() * 0.7}s`;
      bit.style.setProperty(
        "--confetti-rotate",
        `${Math.random() * 720 - 360}deg`
      );
      overlay.append(bit);
    }
  }

  button.focus();
}

function updateCell(index, mark) {
  board[index] = mark;
  cells[index].textContent = mark;
  cells[index].dataset.mark = mark;
  cells[index].setAttribute("aria-label", `Cell ${index + 1}, ${mark}`);
  cells[index].disabled = true;
  playSound(mark === "X" ? 520 : 360);
}

function handleCellClick(event) {
  const index = Number(event.currentTarget.dataset.index);

  if (
    !gameActive ||
    aiThinking ||
    !Number.isInteger(index) ||
    index < 0 ||
    index > 8 ||
    board[index]
  ) return;

  if (mode === "ai") {
    updateCell(index, "X");

    if (finishIfOver()) return;

    aiThinking = true;
    cells.forEach(cell => cell.disabled = true);
    setStatus("AI is thinking...");

    aiTimer = setTimeout(() => {
      if (!gameActive) return;

      const move = getBestMove(board);
      if (move !== -1) updateCell(move, "O");

      aiThinking = false;

      cells.forEach((cell, i) => {
        cell.disabled = !gameActive || Boolean(board[i]);
      });

      if (!finishIfOver()) setStatus("Your turn — X");
    }, 450);
  } else {
    const mark = board.filter(Boolean).length % 2 === 0 ? "X" : "O";
    updateCell(index, mark);

    if (!finishIfOver()) {
      setStatus(mark === "X" ? "Player O's turn" : "Player X's turn");
    }
  }
}

function minimax(position, maximizing, depth = 0) {
  const result = checkWinner(position);

  if (result === "O") return 10 - depth;
  if (result === "X") return depth - 10;
  if (result === "draw") return 0;

  if (maximizing) {
    let best = -Infinity;

    for (let i = 0; i < 9; i++) {
      if (position[i]) continue;

      position[i] = "O";
      best = Math.max(best, minimax(position, false, depth + 1));
      position[i] = "";
    }

    return best;
  }

  let best = Infinity;

  for (let i = 0; i < 9; i++) {
    if (position[i]) continue;

    position[i] = "X";
    best = Math.min(best, minimax(position, true, depth + 1));
    position[i] = "";
  }

  return best;
}

function getBestMove(position) {
  let bestScore = -Infinity;
  let bestMove = -1;

  for (let i = 0; i < 9; i++) {
    if (position[i]) continue;

    position[i] = "O";
    const score = minimax(position, false);
    position[i] = "";

    if (score > bestScore) {
      bestScore = score;
      bestMove = i;
    }
  }

  return bestMove;
}

function finishIfOver() {
  const result = checkWinner(board);
  if (!result) return false;

  gameActive = false;
  aiThinking = false;
  cells.forEach(cell => cell.disabled = true);

  if (result === "draw") {
    scores.draws++;
    setStatus("It's a draw!");
    playSound(280, 0.2);
  } else if (result === "X") {
    scores.player++;
    setStatus(mode === "ai" ? "You win!" : "Player X wins!");
    playSound(660, 0.2);

    getWinningLine(board).forEach(index =>
      cells[index]?.classList.add("winning-cell")
    );
  } else {
    scores.ai++;
    setStatus(mode === "ai" ? "AI wins!" : "Player O wins!");
    playSound(200, 0.2);

    getWinningLine(board).forEach(index =>
      cells[index]?.classList.add("winning-cell")
    );
  }

  renderScores();
  saveGameResult(result);

  overlayTimer = setTimeout(() => showVictoryEffect(result), 300);
  return true;
}

/* =========================================================
   SUPABASE REQUEST HELPERS
   ========================================================= */

async function fetchWithTimeout(url, options = {}, ms = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

function supabaseReady() {
  return Boolean(
    SUPABASE_URL &&
    SUPABASE_ANON_KEY &&
    !SUPABASE_ANON_KEY.startsWith("YOUR_")
  );
}

async function supabaseInsert(table, row) {
  if (!supabaseReady()) {
    throw new Error("Supabase URL or publishable key is missing.");
  }

  return fetchWithTimeout(
    `${SUPABASE_URL}/rest/v1/${table}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Prefer: "return=representation"
      },
      body: JSON.stringify(row)
    },
    60000
  );
}

async function supabaseSelect(table, query) {
  if (!supabaseReady()) {
    throw new Error("Supabase URL or publishable key is missing.");
  }

  const response = await fetchWithTimeout(
    `${SUPABASE_URL}/rest/v1/${table}?${query}`,
    {
      method: "GET",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Accept: "application/json"
      }
    },
    30000
  );

  if (!response.ok) {
    throw new Error(
      `Supabase read failed (${response.status}): ${await response.text()}`
    );
  }

  return response.json();
}

function formatPhilippineDate(value) {
  if (!value) return "Date unavailable";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";

  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  }).format(date);
}

/* =========================================================
   GAME HISTORY
   ========================================================= */

const HISTORY_KEY = "tttHistory";
const HISTORY_LIMIT = 100;

let syncPromise = null;
let lastSyncFailed = false;
let syncToastShown = false;

function loadStoredHistory() {
  try {
    const log = JSON.parse(store.get(HISTORY_KEY) || "[]");
    return Array.isArray(log) ? log : [];
  } catch {
    return [];
  }
}

let historyLog = loadStoredHistory();

function persistHistory() {
  historyLog = historyLog.slice(-HISTORY_LIMIT);
  store.set(HISTORY_KEY, JSON.stringify(historyLog));
}

function resultLabel(result) {
  if (result === "draw") return "Draw";

  if (mode === "two") {
    return result === "X" ? "Player X Win" : "Player O Win";
  }

  return result === "X" ? "Player X Win" : "AI Win";
}

function normalizeResult(value) {
  const normalized = String(value || "").trim().toLowerCase();

  const known = {
    "draw": "Draw",
    "ai win": "AI Win",
    "ai wins": "AI Win",
    "player win": "Player X Win",
    "player wins": "Player X Win",
    "player x win": "Player X Win",
    "player x wins": "Player X Win",
    "player o win": "Player O Win",
    "player o wins": "Player O Win"
  };

  return known[normalized] || null;
}

function saveGameResult(result) {
  if (resultSaved) return;
  resultSaved = true;

  historyLog.push({
    local_key: roundId,
    id: null,
    result: resultLabel(result),
    created_at: new Date().toISOString(),
    synced: false
  });

  persistHistory();
  renderHistory();

  syncHistory().then(() => {
    renderHistory();
  });
}

/*
  FIX:
  - Send legacy_id because the database requires it.
  - Do not send id; PostgreSQL should generate the numeric ID.
  - Do not send device_id.
  - Preserve pending entries if upload fails.
*/
function syncHistory({ quiet = false } = {}) {
  if (syncPromise) return syncPromise;

  syncPromise = (async () => {
    let failed = false;

    for (const entry of historyLog) {
      if (entry.synced) continue;

      const normalized = normalizeResult(entry.result);

      if (!normalized) {
        console.warn(
          "Skipped unsupported game result:",
          entry.result
        );
        failed = true;
        continue;
      }

      try {
        if (!entry.local_key) {
          entry.local_key =
            typeof entry.id === "string" && entry.id
              ? entry.id
              : `legacy-${Date.now()}-${Math.random()
                  .toString(36)
                  .slice(2, 12)}`;
        }

        persistHistory();

        const response = await supabaseInsert("game_results", {
          legacy_id: String(entry.local_key),
          result: normalized,
          created_at: entry.created_at || new Date().toISOString()
        });

        if (!response.ok) {
          throw new Error(
            `Game result insert failed (${response.status}): ${await response.text()}`
          );
        }

        const rows = await response.json();
        const saved = Array.isArray(rows) ? rows[0] : null;

        if (!saved || saved.id == null) {
          throw new Error(
            "Supabase did not return a numeric ID. Check the table schema and permissions."
          );
        }

        entry.id = saved.id;
        entry.result = saved.result || normalized;
        entry.created_at = saved.created_at || entry.created_at;
        entry.synced = true;

        persistHistory();
      } catch (error) {
        console.error("Game history upload failed:", error);
        failed = true;
        break;
      }
    }

    lastSyncFailed = failed;

    if (failed && !quiet && !syncToastShown) {
      syncToastShown = true;
      showToast(
        "Some results could not upload. Check the database error in Console."
      );
    }

    if (!failed) syncToastShown = false;

    return failed;
  })().finally(() => {
    syncPromise = null;
  });

  return syncPromise;
}

async function loadServerGameHistory() {
  const rows = await supabaseSelect(
    "game_results",
    "select=id,result,created_at&order=id.desc&limit=100"
  );

  const serverEntries = rows.map(row => ({
    id: row.id,
    result: row.result,
    created_at: row.created_at,
    synced: true
  }));

  const pending = historyLog.filter(entry => !entry.synced);

  historyLog = [...serverEntries.reverse(), ...pending]
    .slice(-HISTORY_LIMIT);

  persistHistory();
}

function renderHistory() {
  const list = $("#historyList");
  const historyStatus = $("#historyStatus");

  if (!list || !historyStatus) return;

  list.replaceChildren();

  const records = [...historyLog].reverse();

  if (!records.length) {
    historyStatus.textContent =
      "No saved games yet. Play a game to see results here.";
    return;
  }

  const pending = records.filter(record => !record.synced).length;

  historyStatus.textContent =
    `${records.length} saved result(s)` +
    (pending ? ` · ${pending} waiting to upload` : "") +
    (lastSyncFailed ? " · Some results could not sync." : "");

  records.forEach(record => {
    const item = document.createElement("li");
    const title = document.createElement("strong");
    const details = document.createElement("small");

    title.textContent =
      normalizeResult(record.result) || record.result || "Game result";

    const hasNumericId =
      record.id !== null &&
      record.id !== undefined &&
      record.id !== "" &&
      Number.isSafeInteger(Number(record.id));

    const idText = hasNumericId
      ? `ID: ${Number(record.id)}`
      : "ID: Pending";

    details.textContent =
      `${idText} · ${formatPhilippineDate(record.created_at)}` +
      (!record.synced ? " · Waiting to upload" : "");

    item.append(title, details);
    list.append(item);
  });
}

async function loadGameHistory() {
  renderHistory();

  try {
    await syncHistory({ quiet: true });
    await loadServerGameHistory();
    lastSyncFailed = false;
  } catch (error) {
    lastSyncFailed = true;
    console.error("Could not load server game history:", error);
  }

  renderHistory();
}

/* =========================================================
   DRAWERS
   ========================================================= */

const drawers = [
  settingsDrawer,
  historyDrawer,
  feedbackDrawer
].filter(Boolean);

let lastFocus = null;

function openDrawer(drawer) {
  if (!drawer) return;

  const alreadyOpen = drawers.some(d => d.classList.contains("open"));
  if (!alreadyOpen) lastFocus = document.activeElement;

  closeDrawers({ restoreFocus: false });

  drawer.classList.add("open");
  drawer.setAttribute("aria-hidden", "false");
  backdrop?.classList.add("open");

  if (drawer === settingsDrawer) {
    $("#menuBtn")?.setAttribute("aria-expanded", "true");
  }

  drawer.querySelector(".icon-btn")?.focus();
}

function closeDrawers({ restoreFocus = true } = {}) {
  const wasOpen = drawers.some(d => d.classList.contains("open"));

  drawers.forEach(drawer => {
    drawer.classList.remove("open");
    drawer.setAttribute("aria-hidden", "true");
  });

  backdrop?.classList.remove("open");
  $("#menuBtn")?.setAttribute("aria-expanded", "false");

  if (restoreFocus && wasOpen && lastFocus?.focus) {
    lastFocus.focus();
  }
}

on("#menuBtn", "click", () => openDrawer(settingsDrawer));
on("#closeMenuBtn", "click", closeDrawers);
on("#closeHistoryBtn", "click", closeDrawers);
on("#closeFeedbackBtn", "click", closeDrawers);

backdrop?.addEventListener("click", closeDrawers);

document.addEventListener("keydown", event => {
  if (event.key === "Escape") closeDrawers();
});

on("#historyMenuBtn", "click", () => {
  openDrawer(historyDrawer);
  loadGameHistory();
});

on("#feedbackMenuBtn", "click", () => {
  openDrawer(feedbackDrawer);
  flushFeedbackQueue();
  loadSuggestions();
});

on("#aiModeBtn", "click", () => setMode("ai"));
on("#twoPlayerBtn", "click", () => setMode("two"));

on("#startBtn", "click", () => {
  startGame();
  playSound(500, 0.12);
});

on("#restartBtn", "click", () => {
  startGame();
  playSound(380, 0.1);
});

cells.forEach(cell => {
  cell.addEventListener("click", handleCellClick);
});

on("#refreshHistoryBtn", "click", loadGameHistory);

/* =========================================================
   SOUND SETTINGS
   ========================================================= */

function updateSoundUI() {
  if ($("#soundIcon")) {
    $("#soundIcon").textContent = soundOn ? "🔊" : "🔇";
  }

  if ($("#soundStatus")) {
    $("#soundStatus").textContent =
      soundOn ? "Sound is on" : "Sound is off";
  }

  $("#soundSwitch")?.classList.toggle("on", soundOn);
}

on("#soundBtn", "click", () => {
  soundOn = !soundOn;
  store.set("tttSound", String(soundOn));
  updateSoundUI();

  if (soundOn) playSound(520, 0.1);
});

/* =========================================================
   THEMES AND CUSTOM COLORS
   ========================================================= */

function luma(hex) {
  const n = parseInt(hex.replace("#", ""), 16);

  return 0.299 * (n >> 16) +
    0.587 * ((n >> 8) & 255) +
    0.114 * (n & 255);
}

function applyTheme(colors) {
  const root = document.documentElement;

  Object.entries(colors).forEach(([key, value]) => {
    root.style.setProperty(`--${key}`, value);
  });

  root.style.setProperty(
    "--on-accent",
    luma(colors.accent) > 150 ? "#20172E" : "#FFFFFF"
  );

  root.style.colorScheme =
    luma(colors.page) < 128 ? "dark" : "light";
}

function setTheme(name, { silent = false } = {}) {
  const colors = themes[name];
  if (!colors) return;

  applyTheme(colors);

  store.set("tttTheme", name);
  store.set("tttCustomColors", JSON.stringify(colors));

  $$(".theme-option").forEach(button => {
    const selected = button.dataset.theme === name;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });

  if ($("#backgroundColor")) {
    $("#backgroundColor").value = colors.page;
  }

  if ($("#accentColor")) {
    $("#accentColor").value = colors.accent;
  }

  if ($("#cardColor")) {
    $("#cardColor").value = colors.card;
  }

  if (!silent) {
    showToast(
      `${name.charAt(0).toUpperCase() + name.slice(1)} theme applied`
    );
  }
}

function applyCustomColors() {
  let previous;

  try {
    previous = JSON.parse(store.get("tttCustomColors") || "null");
  } catch {
    previous = null;
  }

  const page = $("#backgroundColor")?.value || themes.chocolate.page;
  const accent = $("#accentColor")?.value || themes.chocolate.accent;
  const card = $("#cardColor")?.value || themes.chocolate.card;
  const dark = luma(page) < 128;

  const colors = {
    ...(previous || themes.chocolate),
    page,
    accent,
    card,
    cell: page,
    text: dark ? "#F7F0E8" : "#38241D",
    muted: dark ? "#C2B7AB" : "#806B5A"
  };

  applyTheme(colors);

  store.set("tttTheme", "custom");
  store.set("tttCustomColors", JSON.stringify(colors));

  $$(".theme-option").forEach(button => {
    button.classList.remove("selected");
    button.setAttribute("aria-pressed", "false");
  });
}

$$(".theme-option").forEach(button => {
  button.addEventListener("click", () => setTheme(button.dataset.theme));
});

["backgroundColor", "accentColor", "cardColor"].forEach(id => {
  on(`#${id}`, "input", applyCustomColors);
});

on("#resetThemeBtn", "click", () => setTheme("chocolate"));

/* =========================================================
   COMMENTS AND SUGGESTIONS
   ========================================================= */

const FEEDBACK_COOLDOWN_MS = 30000;
const FEEDBACK_QUEUE_KEY = "tttFeedbackQueue";
const feedbackForm = $("#feedbackForm");
const feedbackMessage = $("#feedbackMessage");
const feedbackStatus = $("#feedbackStatus");
const sendFeedbackBtn = $("#sendFeedbackBtn");

let lastFeedbackAt = Number(store.get("tttFeedbackLast")) || 0;
let flushingFeedback = false;

function setFeedbackStatus(message, kind = "") {
  if (!feedbackStatus) return;

  feedbackStatus.textContent = message;
  feedbackStatus.className = `feedback-status ${kind}`.trim();
}

function readFeedbackQueue() {
  try {
    const queue = JSON.parse(store.get(FEEDBACK_QUEUE_KEY) || "[]");
    return Array.isArray(queue) ? queue : [];
  } catch {
    return [];
  }
}

function writeFeedbackQueue(queue) {
  if (queue.length) {
    store.set(FEEDBACK_QUEUE_KEY, JSON.stringify(queue.slice(-20)));
  } else {
    store.remove(FEEDBACK_QUEUE_KEY);
  }
}

async function postFeedback(entry) {
  const response = await supabaseInsert("suggestions", {
    message: entry.message
  });

  if (!response.ok) {
    const detail = await response.text();
    const error = new Error(
      `Feedback request failed (${response.status}): ${detail}`
    );

    error.setup = [400, 401, 403, 404, 422].includes(response.status);
    throw error;
  }
}

async function flushFeedbackQueue() {
  if (flushingFeedback) return;

  const queue = readFeedbackQueue();
  if (!queue.length) return;

  flushingFeedback = true;
  const remaining = [];

  try {
    for (const entry of queue) {
      try {
        await postFeedback(entry);
      } catch (error) {
        console.error("Queued feedback upload failed:", error);
        remaining.push(entry);
      }
    }

    writeFeedbackQueue(remaining);
  } finally {
    flushingFeedback = false;
  }
}

function ensureSuggestionsList() {
  const drawer = $("#feedbackDrawer");
  if (!drawer) return null;

  let container = $("#suggestionsList");

  if (!container) {
    container = document.createElement("section");
    container.id = "suggestionsList";

    const heading = document.createElement("h3");
    heading.textContent = "Comments & Suggestions";

    const refresh = document.createElement("button");
    refresh.type = "button";
    refresh.id = "refreshSuggestionsBtn";
    refresh.textContent = "Refresh Comments";

    const list = document.createElement("ul");
    list.id = "suggestionsEntries";

    container.append(heading, refresh, list);
    drawer.append(container);

    refresh.addEventListener("click", loadSuggestions);
  }

  return $("#suggestionsEntries");
}

async function loadSuggestions() {
  const entries = ensureSuggestionsList();
  if (!entries) return;

  entries.replaceChildren();

  const loading = document.createElement("li");
  loading.textContent = "Loading comments...";
  entries.append(loading);

  try {
    const rows = await supabaseSelect(
      "suggestions",
      "select=id,message,created_at&order=created_at.desc&limit=100"
    );

    entries.replaceChildren();

    if (!rows.length) {
      const empty = document.createElement("li");
      empty.textContent = "No comments or suggestions yet.";
      entries.append(empty);
      return;
    }

    rows.forEach(row => {
      const item = document.createElement("li");
      const message = document.createElement("p");
      const details = document.createElement("small");

      message.textContent = row.message || "";
      details.textContent =
        `ID: ${row.id} · ${formatPhilippineDate(row.created_at)}`;

      item.append(message, details);
      entries.append(item);
    });
  } catch (error) {
    console.error("Could not load suggestions:", error);

    entries.replaceChildren();

    const item = document.createElement("li");
    item.textContent =
      "Unable to load comments. Check the Supabase connection and permissions.";

    entries.append(item);
  }
}

feedbackMessage?.addEventListener("input", () => {
  if ($("#feedbackCount")) {
    $("#feedbackCount").textContent =
      `${feedbackMessage.value.length} / 500`;
  }

  feedbackMessage.removeAttribute("aria-invalid");
});

feedbackForm?.addEventListener("submit", async event => {
  event.preventDefault();

  if ($("#feedbackWebsite")?.value) {
    feedbackForm.reset();
    return;
  }

  const message = feedbackMessage?.value.trim() || "";

  if (message.length < 5 || message.length > 500) {
    feedbackMessage?.setAttribute("aria-invalid", "true");

    setFeedbackStatus(
      "Please enter between 5 and 500 characters.",
      "error"
    );

    feedbackMessage?.focus();
    return;
  }

  const waitMs =
    FEEDBACK_COOLDOWN_MS - (Date.now() - lastFeedbackAt);

  if (waitMs > 0) {
    setFeedbackStatus(
      `Please wait ${Math.ceil(waitMs / 1000)} seconds before sending another message.`,
      "error"
    );
    return;
  }

  const entry = { message };

  if (sendFeedbackBtn) sendFeedbackBtn.disabled = true;

  setFeedbackStatus("Submitting... Please wait.");

  try {
    await postFeedback(entry);

    setFeedbackStatus(
      "Thank you! Your comment or suggestion was submitted successfully.",
      "ok"
    );

    showToast("Submitted. Thank you!");

    feedbackMessage.value = "";

    if ($("#feedbackCount")) {
      $("#feedbackCount").textContent = "0 / 500";
    }

    await loadSuggestions();
  } catch (error) {
    console.error("Feedback send failed:", error);

    writeFeedbackQueue([...readFeedbackQueue(), entry]);

    setFeedbackStatus(
      error.setup
        ? "The server rejected this message. It has been saved on this device for retry."
        : "Couldn't reach the server. Your message is saved on this device for retry.",
      "error"
    );
  } finally {
    lastFeedbackAt = Date.now();
    store.set("tttFeedbackLast", String(lastFeedbackAt));

    if (sendFeedbackBtn) sendFeedbackBtn.disabled = false;
  }
});

/* =========================================================
   RESTORE PREFERENCES AND START
   ========================================================= */

function restorePreferences() {
  const savedTheme = store.get("tttTheme") || "chocolate";
  const savedColors = store.get("tttCustomColors");

  if (savedTheme === "custom" && savedColors) {
    try {
      const colors = JSON.parse(savedColors);

      applyTheme(colors);

      if ($("#backgroundColor")) {
        $("#backgroundColor").value = colors.page;
      }

      if ($("#accentColor")) {
        $("#accentColor").value = colors.accent;
      }

      if ($("#cardColor")) {
        $("#cardColor").value = colors.card;
      }
    } catch {
      setTheme("chocolate", { silent: true });
    }
  } else {
    setTheme(
      themes[savedTheme] ? savedTheme : "chocolate",
      { silent: true }
    );
  }

  store.remove("tttCustomLayout");
  updateSoundUI();
}

restorePreferences();
renderScores();
renderHistory();
startGame();

syncHistory({ quiet: true })
  .then(() => loadGameHistory())
  .catch(error => {
    console.error("Initial game history sync failed:", error);
  });
