/* =========================================================
   TIC-TAC-TOE — UPDATED JAVASCRIPT
   GameBoard Class + Game history + numeric IDs + suggestions
   Philippine date/time + legacy_id support
   + Difficulty levels (Easy/Medium 3x3, Hard 5x5)
   + Board hidden until Start game
   + Gameplay screen with Back button
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

/* Cells are now created by buildBoardCells() to match the difficulty. */
let cells = [];
const boardEl = $("#board");
const boardSection = $("#boardSection");
const layoutCanvas = $("#layoutCanvas");
const statusText = $("#status") || document.createElement("p");
const settingsDrawer = $("#settingsDrawer");
const historyDrawer = $("#historyDrawer");
const feedbackDrawer = $("#feedbackDrawer");
const backdrop = $("#drawerBackdrop");

/* =========================================================
   GAME VARIABLES
   ========================================================= */

let board;
let gameActive = false;
let aiThinking = false;
let resultSaved = false;
let roundId = null;
let roundMode = "ai";
let mode = "ai";
let selectedLevel = null;
let boardSize = 3;
let winLength = 3;
let soundOn = store.get("tttSound") !== "false";
let scores = { player: 0, ai: 0, draws: 0 };
let audioContext = null;
let toastTimer;
let aiTimer = null;
let overlayTimer = null;

/* =========================================================
   GAME BOARD CLASS — OBJECT-ORIENTED PROGRAMMING
   ========================================================= */

class GameBoard {
  constructor(size = 9) {
    this.size = size;
    this.board = Array(size).fill("");
  }

  reset() {
    this.board.fill("");
  }

  /* Change the number of cells (9 for 3x3, 25 for 5x5). */
  resize(size) {
    this.size = size;
    this.board = Array(size).fill("");
  }

  placeMark(index, mark) {
    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index >= this.size ||
      this.board[index] !== "" ||
      (mark !== "X" && mark !== "O")
    ) {
      return false;
    }

    this.board[index] = mark;
    return true;
  }

  getBoard() {
    return this.board;
  }
}

/* Create the game board instance */
const gameBoard = new GameBoard(9);
board = gameBoard.getBoard();

/* =========================================================
   DIFFICULTY LEVELS AND WINNING COMBINATIONS
   Easy/Medium: 3x3, three in a row.
   Hard: 5x5, five in a row.
   ========================================================= */

const LEVELS = {
  easy:   { size: 3, winLength: 3 },
  medium: { size: 3, winLength: 3 },
  hard:   { size: 5, winLength: 5 }
};

/* Every horizontal, vertical and diagonal run of `k` cells on a size x size board. */
function buildWinLines(size, k) {
  const lines = [];
  const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      for (const [dr, dc] of directions) {
        const endRow = r + dr * (k - 1);
        const endCol = c + dc * (k - 1);

        if (endRow < 0 || endRow >= size || endCol < 0 || endCol >= size) {
          continue;
        }

        lines.push(
          Array.from({ length: k }, (_, i) =>
            (r + dr * i) * size + (c + dc * i)
          )
        );
      }
    }
  }

  return lines;
}

let wins = buildWinLines(3, 3);

/* =========================================================
   THEMES
   ========================================================= */

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

/* =========================================================
   GENERAL HELPERS
   ========================================================= */

function showToast(message) {
  const toast = $("#toast");

  if (!toast) {
    console.log(message);
    return;
  }

  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
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
  if ($("#playerWins")) {
    $("#playerWins").textContent = scores.player;
  }

  if ($("#aiWins")) {
    $("#aiWins").textContent = scores.ai;
  }

  if ($("#draws")) {
    $("#draws").textContent = scores.draws;
  }
}

/* =========================================================
   BOARD BUILDING AND VISIBILITY
   ========================================================= */

/* Create empty cells for a size x size board. Cells start disabled. */
function buildBoardCells(size) {
  if (!boardEl) return;

  boardEl.replaceChildren();
  boardEl.style.setProperty("--cols", String(size));
  boardEl.dataset.size = String(size);

  cells = [];

  for (let i = 0; i < size * size; i++) {
    const cell = document.createElement("button");

    cell.type = "button";
    cell.className = "cell";
    cell.dataset.index = String(i);
    cell.disabled = true;
    cell.setAttribute("aria-label", `Cell ${i + 1}, empty`);

    boardEl.append(cell);
    cells.push(cell);
  }
}

/* Prepare an empty board for a level without showing it. */
function configureBoard(level) {
  const config = LEVELS[level];

  boardSize = config.size;
  winLength = config.winLength;
  wins = buildWinLines(boardSize, winLength);

  gameBoard.resize(boardSize * boardSize);
  board = gameBoard.getBoard();

  buildBoardCells(boardSize);
}

function clearBoardCells() {
  boardEl?.replaceChildren();
  cells = [];

  gameBoard.reset();
  board = gameBoard.getBoard();
}

/* Switch between the setup screen (visible = false) and the
   gameplay screen (visible = true). The Back button is shown
   only on the gameplay screen. */
function showBoard(visible) {
  if (boardSection) boardSection.hidden = !visible;
  layoutCanvas?.classList.toggle("board-hidden", !visible);
  layoutCanvas?.classList.toggle("playing", visible);

  const backSection = $("#backSection");
  if (backSection) backSection.hidden = !visible;
}

function updateLevelButtons() {
  $$("[data-level]").forEach(button => {
    const selected = button.dataset.level === selectedLevel;

    button.classList.toggle("active", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}

/* Back to the "before Start game" state: board hidden, no round running. */
function enterSetupState(message) {
  clearTimeout(aiTimer);
  clearTimeout(overlayTimer);

  $("#victoryOverlay")?.remove();

  gameActive = false;
  aiThinking = false;
  resultSaved = false;
  roundId = null;

  showBoard(false);

  if (selectedLevel) {
    configureBoard(selectedLevel);
  } else {
    clearBoardCells();
  }

  setStatus(
    message ||
    (selectedLevel
      ? "Press Start game to play"
      : "Choose a difficulty to begin")
  );
}

/* =========================================================
   GAME MODE, DIFFICULTY, START AND RESET
   ========================================================= */

function setMode(newMode) {
  if (newMode === mode) return;

  scores = { player: 0, ai: 0, draws: 0 };
  renderScores();

  mode = newMode;

  $("#aiModeBtn")?.classList.toggle("active", mode === "ai");
  $("#twoPlayerBtn")?.classList.toggle("active", mode === "two");

  enterSetupState();
}

function selectLevel(level) {
  if (!LEVELS[level] || level === selectedLevel) return;

  selectedLevel = level;

  scores = { player: 0, ai: 0, draws: 0 };
  renderScores();

  updateLevelButtons();
  enterSetupState();
  playSound(440, 0.08);
}

/* Called by the Start game button. Returns true if a new game started. */
function beginGame() {
  if (!selectedLevel) {
    setStatus("Choose a difficulty first");
    showToast("Please choose Easy, Medium or Hard first.");
    return false;
  }

  /* A round is already running: ignore repeated clicks. */
  if (gameActive) return false;

  return startGame();
}

function startGame() {
  if (!selectedLevel) return false;

  clearTimeout(aiTimer);
  clearTimeout(overlayTimer);

  $("#victoryOverlay")?.remove();

  /* Fresh, empty cells for the selected level (no leftovers). */
  configureBoard(selectedLevel);

  cells.forEach(cell => {
    cell.disabled = false;
  });

  showBoard(true);

  gameActive = true;
  aiThinking = false;
  resultSaved = false;
  roundMode = mode;

  roundId =
    `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  setStatus(
    mode === "ai" ? "Your turn — X" : "Player X's turn"
  );

  return true;
}

/* Reset button: scoreboard, board, message and difficulty choice.
   Saved game history (localStorage and Supabase) is not touched. */
function resetAll() {
  scores = { player: 0, ai: 0, draws: 0 };
  renderScores();

  selectedLevel = null;
  updateLevelButtons();

  enterSetupState("Choose a difficulty to begin");
}

/* =========================================================
   WINNER DETECTION
   ========================================================= */

function checkWinner(position) {
  for (const line of wins) {
    const first = position[line[0]];

    if (first && line.every(index => position[index] === first)) {
      return first;
    }
  }

  return position.every(Boolean) ? "draw" : null;
}

function getWinningLine(position) {
  return wins.find(line => {
    const first = position[line[0]];

    return first && line.every(index => position[index] === first);
  }) || [];
}

/* =========================================================
   VICTORY EFFECT
   ========================================================= */

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

/* =========================================================
   PLACE MARK ON THE BOARD
   ========================================================= */

function updateCell(index, mark) {
  // The class validates and places the mark.
  if (!gameBoard.placeMark(index, mark)) {
    return;
  }

  cells[index].textContent = mark;
  cells[index].dataset.mark = mark;

  cells[index].setAttribute(
    "aria-label",
    `Cell ${index + 1}, ${mark}`
  );

  cells[index].disabled = true;

  playSound(mark === "X" ? 520 : 360);
}

/* =========================================================
   PLAYER INPUT AND GAME LOGIC
   ========================================================= */

function handleCellClick(event) {
  const cellEl = event.target.closest(".cell");

  if (!cellEl) return;

  const index = Number(cellEl.dataset.index);

  if (
    !gameActive ||
    aiThinking ||
    !Number.isInteger(index) ||
    index < 0 ||
    index >= board.length ||
    board[index]
  ) {
    return;
  }

  if (mode === "ai") {
    updateCell(index, "X");

    if (finishIfOver()) return;

    aiThinking = true;

    cells.forEach(cell => {
      cell.disabled = true;
    });

    setStatus("AI is thinking...");

    aiTimer = setTimeout(() => {
      if (!gameActive) return;

      const move = pickAiMove(board);

      if (Number.isInteger(move) && move !== -1) {
        updateCell(move, "O");
      }

      aiThinking = false;

      cells.forEach((cell, i) => {
        cell.disabled = !gameActive || Boolean(board[i]);
      });

      if (!finishIfOver()) {
        setStatus("Your turn — X");
      }
    }, 450);
  } else {
    const mark =
      board.filter(Boolean).length % 2 === 0 ? "X" : "O";

    updateCell(index, mark);

    if (!finishIfOver()) {
      setStatus(
        mark === "X" ? "Player O's turn" : "Player X's turn"
      );
    }
  }
}

/* =========================================================
   AI — DIFFICULTY LEVELS
   The AI plays "O". The human plays "X".
   Easy:   random valid move.
   Medium: takes a win, blocks X's win, prefers the center.
   Hard:   win, block, then fork creation/blocking and a
           line-scoring heuristic (used on the 5x5 board).
   ========================================================= */

function emptyIndexes(position) {
  const empty = [];

  position.forEach((value, i) => {
    if (!value) empty.push(i);
  });

  return empty;
}

function randomFrom(list) {
  return list.length
    ? list[Math.floor(Math.random() * list.length)]
    : -1;
}

/* If `line` needs exactly one more `mark` to be complete, return that empty cell. */
function lineThreat(position, line, mark) {
  let own = 0;
  let emptyCount = 0;
  let emptyIndex = -1;

  for (const i of line) {
    if (position[i] === mark) {
      own++;
    } else if (!position[i]) {
      emptyCount++;
      emptyIndex = i;
    }
  }

  return own === winLength - 1 && emptyCount === 1 ? emptyIndex : -1;
}

/* A move that wins the game immediately for `mark`, or -1. */
function findCompletingMove(position, mark) {
  for (const line of wins) {
    const spot = lineThreat(position, line, mark);

    if (spot !== -1) return spot;
  }

  return -1;
}

/* How many different cells would win the game for `mark` right now. */
function countThreats(position, mark) {
  const spots = new Set();

  for (const line of wins) {
    const spot = lineThreat(position, line, mark);

    if (spot !== -1) spots.add(spot);
  }

  return spots.size;
}

/* Heuristic value of playing `index`: open lines count more as they fill up. */
function scoreCell(position, index, me, opponent) {
  let score = 0;

  for (const line of wins) {
    if (!line.includes(index)) continue;

    let mine = 0;
    let theirs = 0;

    for (const i of line) {
      if (position[i] === me) mine++;
      else if (position[i] === opponent) theirs++;
    }

    if (mine && theirs) continue;

    if (!theirs) score += Math.pow(4, mine);
    if (!mine) score += Math.pow(4, theirs) * 0.9;
  }

  return score;
}

function pickEasyMove(position) {
  return randomFrom(emptyIndexes(position));
}

function pickMediumMove(position) {
  const win = findCompletingMove(position, "O");
  if (win !== -1) return win;

  const block = findCompletingMove(position, "X");
  if (block !== -1) return block;

  const center = Math.floor(position.length / 2);
  if (!position[center]) return center;

  return randomFrom(emptyIndexes(position));
}

function pickHardMove(position) {
  const win = findCompletingMove(position, "O");
  if (win !== -1) return win;

  const block = findCompletingMove(position, "X");
  if (block !== -1) return block;

  let bestScore = -Infinity;
  let best = [];

  emptyIndexes(position).forEach(i => {
    let score = scoreCell(position, i, "O", "X");

    /* Create two winning threats at once. */
    position[i] = "O";
    if (countThreats(position, "O") >= 2) score += 1000;

    /* Take the cell where X would create two threats at once. */
    position[i] = "X";
    if (countThreats(position, "X") >= 2) score += 500;

    position[i] = "";

    if (score > bestScore) {
      bestScore = score;
      best = [i];
    } else if (score === bestScore) {
      best.push(i);
    }
  });

  return randomFrom(best);
}

function pickAiMove(position) {
  if (selectedLevel === "easy") return pickEasyMove(position);
  if (selectedLevel === "hard") return pickHardMove(position);

  return pickMediumMove(position);
}

/* =========================================================
   FINISH GAME AND SAVE RESULT
   ========================================================= */

function finishIfOver() {
  const result = checkWinner(board);

  if (!result) return false;

  gameActive = false;
  aiThinking = false;

  cells.forEach(cell => {
    cell.disabled = true;
  });

  if (result === "draw") {
    scores.draws++;

    setStatus("It's a draw!");
    playSound(280, 0.2);
  } else if (result === "X") {
    scores.player++;

    setStatus(
      mode === "ai" ? "You win!" : "Player X wins!"
    );

    playSound(660, 0.2);

    getWinningLine(board).forEach(index => {
      cells[index]?.classList.add("winning-cell");
    });
  } else {
    scores.ai++;

    setStatus(
      mode === "ai" ? "AI wins!" : "Player O wins!"
    );

    playSound(200, 0.2);

    getWinningLine(board).forEach(index => {
      cells[index]?.classList.add("winning-cell");
    });
  }

  renderScores();
  saveGameResult(result);

  overlayTimer = setTimeout(() => {
    showVictoryEffect(result);
  }, 300);

  return true;
}

/* =========================================================
   SUPABASE REQUEST HELPERS
   ========================================================= */

async function fetchWithTimeout(url, options = {}, ms = 30000) {
  const controller = new AbortController();

  const timer = setTimeout(() => {
    controller.abort();
  }, ms);

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
    throw new Error(
      "Supabase URL or publishable key is missing."
    );
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
    throw new Error(
      "Supabase URL or publishable key is missing."
    );
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

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

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

/* Value saved to the database. These match the table's accepted values:
   'AI Win', 'Player X Win', 'Player O Win', 'Draw'. */
function resultLabel(result, gameMode = mode) {
  if (result === "draw") return "Draw";

  if (gameMode === "two") {
    return result === "X"
      ? "Player X Win"
      : "Player O Win";
  }

  return result === "X" ? "Player X Win" : "AI Win";
}

function normalizeResult(value) {
  const normalized = String(value || "").trim().toLowerCase();

  const known = {
    "draw": "Draw",
    "ai win": "AI Win",
    "ai wins": "AI Win",
    "ai won": "AI Win",
    "player win": "Player X Win",
    "player wins": "Player X Win",
    "player x win": "Player X Win",
    "player x wins": "Player X Win",
    "player x won": "Player X Win",
    "player o win": "Player O Win",
    "player o wins": "Player O Win",
    "player o won": "Player O Win"
  };

  return known[normalized] || null;
}

/* Label shown to the player in Game history. */
const RESULT_DISPLAY = {
  "AI Win": "AI Won",
  "Player X Win": "Player X Won",
  "Player O Win": "Player O Won",
  "Draw": "Draw"
};

function displayResult(value) {
  const normalized = normalizeResult(value);

  return normalized
    ? RESULT_DISPLAY[normalized]
    : (value || "Game result");
}

function saveGameResult(result) {
  if (resultSaved) return;

  resultSaved = true;

  historyLog.push({
    local_key: roundId,
    id: null,
    result: resultLabel(result, roundMode),
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

    if (!failed) {
      syncToastShown = false;
    }

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

    title.textContent = displayResult(record.result);

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

    console.error(
      "Could not load server game history:",
      error
    );
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

  const alreadyOpen = drawers.some(d =>
    d.classList.contains("open")
  );

  if (!alreadyOpen) {
    lastFocus = document.activeElement;
  }

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
  const wasOpen = drawers.some(d =>
    d.classList.contains("open")
  );

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
  if (event.key === "Escape") {
    closeDrawers();
  }
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

$$("[data-level]").forEach(button => {
  button.addEventListener("click", () => {
    selectLevel(button.dataset.level);
    button.blur();
  });
});

on("#startBtn", "click", () => {
  if (beginGame()) {
    playSound(500, 0.12);
  }

  /* Release focus so the button never stays in a pressed-looking state. */
  $("#startBtn")?.blur();
});

on("#restartBtn", "click", () => {
  resetAll();
  playSound(380, 0.1);

  $("#restartBtn")?.blur();
  $("#startBtn")?.blur();
});

/* Back button (gameplay screen only): ends the current round and returns
   to the setup screen. enterSetupState() clears the AI and overlay timers,
   removes the victory overlay and resets the round state, so the old
   session cannot interfere with the next game. */
on("#backBtn", "click", () => {
  enterSetupState();
  playSound(380, 0.1);

  $("#backBtn")?.blur();
});

/* One listener for all cells, including cells created later. */
boardEl?.addEventListener("click", handleCellClick);

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

  if (soundOn) {
    playSound(520, 0.1);
  }
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

    button.setAttribute(
      "aria-pressed",
      String(selected)
    );
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
    previous = JSON.parse(
      store.get("tttCustomColors") || "null"
    );
  } catch {
    previous = null;
  }

  const page =
    $("#backgroundColor")?.value || themes.chocolate.page;

  const accent =
    $("#accentColor")?.value || themes.chocolate.accent;

  const card =
    $("#cardColor")?.value || themes.chocolate.card;

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
  button.addEventListener("click", () => {
    setTheme(button.dataset.theme);
  });
});

["backgroundColor", "accentColor", "cardColor"].forEach(id => {
  on(`#${id}`, "input", applyCustomColors);
});

on("#resetThemeBtn", "click", () => {
  setTheme("chocolate");
});

/* =========================================================
   COMMENTS AND SUGGESTIONS
   ========================================================= */

const FEEDBACK_COOLDOWN_MS = 30000;
const FEEDBACK_QUEUE_KEY = "tttFeedbackQueue";

const feedbackForm = $("#feedbackForm");
const feedbackMessage = $("#feedbackMessage");
const feedbackStatus = $("#feedbackStatus");
const sendFeedbackBtn = $("#sendFeedbackBtn");

let lastFeedbackAt =
  Number(store.get("tttFeedbackLast")) || 0;

let flushingFeedback = false;

function setFeedbackStatus(message, kind = "") {
  if (!feedbackStatus) return;

  feedbackStatus.textContent = message;
  feedbackStatus.className =
    `feedback-status ${kind}`.trim();
}

function readFeedbackQueue() {
  try {
    const queue = JSON.parse(
      store.get(FEEDBACK_QUEUE_KEY) || "[]"
    );

    return Array.isArray(queue) ? queue : [];
  } catch {
    return [];
  }
}

function writeFeedbackQueue(queue) {
  if (queue.length) {
    store.set(
      FEEDBACK_QUEUE_KEY,
      JSON.stringify(queue.slice(-20))
    );
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

    error.setup = [400, 401, 403, 404, 422].includes(
      response.status
    );

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
        console.error(
          "Queued feedback upload failed:",
          error
        );

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

      empty.textContent =
        "No comments or suggestions yet.";

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
    console.error(
      "Could not load suggestions:",
      error
    );

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

  if (sendFeedbackBtn) {
    sendFeedbackBtn.disabled = true;
  }

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

    writeFeedbackQueue([
      ...readFeedbackQueue(),
      entry
    ]);

    setFeedbackStatus(
      error.setup
        ? "The server rejected this message. It has been saved on this device for retry."
        : "Couldn't reach the server. Your message is saved on this device for retry.",
      "error"
    );
  } finally {
    lastFeedbackAt = Date.now();

    store.set(
      "tttFeedbackLast",
      String(lastFeedbackAt)
    );

    if (sendFeedbackBtn) {
      sendFeedbackBtn.disabled = false;
    }
  }
});

/* =========================================================
   RESTORE PREFERENCES AND START
   ========================================================= */

function restorePreferences() {
  const savedTheme =
    store.get("tttTheme") || "chocolate";

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

/* The board starts hidden: no difficulty chosen, no game started. */
updateLevelButtons();
enterSetupState();

syncHistory({ quiet: true })
  .then(() => loadGameHistory())
  .catch(error => {
    console.error(
      "Initial game history sync failed:",
      error
    );
  });
  
/* START GAME AND RESET — REPLAY CLICK EFFECT ON EVERY CLICK */

document.addEventListener("click", function (event) {
  const button = event.target.closest("#startBtn, #restartBtn");

  if (!button || button.disabled) return;

  button.classList.remove("button-click-effect");

  // I-restart ang animation sa bawat click.
  void button.offsetWidth;

  button.classList.add("button-click-effect");
});

document.addEventListener("animationend", function (event) {
  if (event.animationName !== "button-click-feedback") return;

  event.target.classList.remove("button-click-effect");
});
