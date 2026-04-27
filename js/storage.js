/* ==========================================================================
 * storage.js — localStorage wrappers
 *
 * Tiny abstraction so we can swap to Cloudflare D1 later without touching
 * call sites. All keys are namespaced under `becaffeined.`.
 * ========================================================================== */

const NS = 'becaffeined.';

function safe(fn, fallback) {
  try { return fn(); } catch { return fallback; }
}

export function load(key, fallback = null) {
  return safe(() => {
    const raw = localStorage.getItem(NS + key);
    return raw == null ? fallback : JSON.parse(raw);
  }, fallback);
}

export function save(key, value) {
  return safe(() => {
    localStorage.setItem(NS + key, JSON.stringify(value));
    return true;
  }, false);
}

export function remove(key) {
  return safe(() => { localStorage.removeItem(NS + key); return true; }, false);
}

/* High-score helpers */
export const HIGH_SCORE_KEY = 'highScore';
export const SETTINGS_KEY = 'settings';

export function getHighScore() {
  return load(HIGH_SCORE_KEY, 0) || 0;
}
export function setHighScore(score) {
  const cur = getHighScore();
  if (score > cur) {
    save(HIGH_SCORE_KEY, score);
    return true;
  }
  return false;
}

export function getSettings() {
  return load(SETTINGS_KEY, { sound: true });
}
export function setSettings(patch) {
  const next = { ...getSettings(), ...patch };
  save(SETTINGS_KEY, next);
  return next;
}
/* ----- Top 3 leaderboard ----- */
export const TOP_SCORES_KEY = 'topScores';
const MAX_TOP_SCORES = 3;

export function getTopScores() {
  return load(TOP_SCORES_KEY, []) || [];
}

/** Returns true if a new score would land on the top-3 board.
 *  A score qualifies if there are fewer than 3 entries OR it beats
 *  the lowest current entry. Scores of 0 never qualify. */
export function qualifiesForTopScore(score) {
  if (!score || score <= 0) return false;
  const top = getTopScores();
  if (top.length < MAX_TOP_SCORES) return true;
  const lowest = top[top.length - 1].score;
  return score > lowest;
}

/** Add a new entry to the top-3 board. Sorted desc, capped at 3. */
export function addTopScore(name, score) {
  const safeName = (name || 'Player').toString().trim().slice(0, 12) || 'Player';
  const top = getTopScores();
  top.push({
    name: safeName,
    score: score,
    date: new Date().toISOString().slice(0, 10),
  });
  top.sort((a, b) => b.score - a.score);
  const trimmed = top.slice(0, MAX_TOP_SCORES);
  save(TOP_SCORES_KEY, trimmed);
  return trimmed;
}
