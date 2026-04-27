/* ==========================================================================
 * analytics.js — Wrapper around the GA4 gtag() global
 *
 * Defined in index.html as a global. We wrap so we can:
 *   - Silently no-op when gtag isn't loaded (offline, ad-blocker, dev)
 *   - Centralize our event taxonomy
 *
 * Custom events fire in addition to the automatic page_view that gtag.js
 * sends on page load. View these in GA4 → Reports → Engagement → Events.
 * ========================================================================== */

function track(name, params = {}) {
  try {
    if (typeof window.gtag === 'function') {
      window.gtag('event', name, params);
    }
  } catch { /* no-op */ }
}

export const trackGameStart = () => track('game_start');
export const trackLevelStart = (level) => track('level_start', { level });
export const trackLevelComplete = (level, score, secondsLeft) =>
  track('level_complete', { level, score, seconds_left: Math.round(secondsLeft) });
export const trackGameOver = (totalScore, levelReached, won) =>
  track('game_over', { total_score: totalScore, level_reached: levelReached, won });
export const trackHighScore = (score) => track('high_score', { score });
export const trackMuteToggle = (muted) => track('mute_toggle', { muted });
