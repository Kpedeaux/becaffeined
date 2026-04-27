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
