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
/* ============================================================================
 * Global leaderboard — backed by the Cloudflare Pages Function /api/scores
 *
 * This module exposes an async API (fetchTopScores, submitTopScore,
 * qualifiesForTopScore) plus a synchronous getCachedTopScores() so consumers
 * can show a board immediately even before the network responds.
 *
 * Offline strategy:
 *   - Every successful API response is mirrored to localStorage as cache.
 *   - If the API call fails, we fall back to whatever cache we have, so
 *     the title screen still shows a board on a flaky connection.
 *   - submitTopScore on offline simply caches the entry locally so the
 *     player still sees their name on this device's view of the board.
 *
 * The local cache size is intentionally larger (top 10) than the original
 * 3 because the global board displays a top 10. Clients still render only
 * what fits.
 * ============================================================================ */

export const TOP_SCORES_KEY = 'topScoresCache';
const TOP_LIMIT = 10;
const API_URL = '/api/scores';

/** Synchronously read the last cached top scores. Used to render the title
 *  screen instantly before the network round-trip resolves. */
export function getCachedTopScores() {
  return load(TOP_SCORES_KEY, []) || [];
}

/** Fetch the current global top scores from the Worker API. Returns the
 *  cached list on network failure. */
export async function fetchTopScores() {
  try {
    const res = await fetch(API_URL, { method: 'GET' });
    if (res.ok) {
      const data = await res.json();
      const scores = Array.isArray(data.scores) ? data.scores : [];
      save(TOP_SCORES_KEY, scores);
      return scores;
    }
  } catch { /* network error — fall through to cache */ }
  return getCachedTopScores();
}

/** Returns true if score is high enough to land on the global top.
 *  Uses the LIVE result so it doesn't disagree with what the server will
 *  decide. Fails open on network error (offer name entry; server may
 *  reject if not actually a top entry, in which case we add to cache only). */
export async function qualifiesForTopScore(score) {
  if (!score || score <= 0) return false;
  const top = await fetchTopScores();
  if (top.length < TOP_LIMIT) return true;
  const lowest = top[top.length - 1].score;
  return score > lowest;
}

/** Submit a new score. Returns the refreshed top list. Cache is always
 *  written either from the server response or as an optimistic local
 *  insert if the network is unavailable. */
export async function submitTopScore({ name, score, levelReached, bonusLevels = 0 }) {
  const safeName = (name || 'Player').toString().trim().slice(0, 12) || 'Player';
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: safeName,
        score: Math.round(score),
        levelReached: levelReached || 0,
        bonusLevels: bonusLevels || 0,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      const scores = Array.isArray(data.scores) ? data.scores : [];
      save(TOP_SCORES_KEY, scores);
      return scores;
    }
    // Server rejected — could be cheat detection or rate limit. Optimistic
    // local insert so the player still sees something.
  } catch { /* network error */ }

  const cached = getCachedTopScores();
  cached.push({
    name: safeName,
    score: Math.round(score),
    levelReached: levelReached || 0,
    bonusLevels: bonusLevels || 0,
    createdAt: new Date().toISOString(),
  });
  cached.sort((a, b) => b.score - a.score);
  const trimmed = cached.slice(0, TOP_LIMIT);
  save(TOP_SCORES_KEY, trimmed);
  return trimmed;
}

// ---------------------------------------------------------------------------
// Backwards-compatible shims so older call sites still work without changes.
// (getTopScores returns the SYNC cache; addTopScore is now async.)
// ---------------------------------------------------------------------------
export const getTopScores = getCachedTopScores;
export const addTopScore = (name, score) => submitTopScore({ name, score });
