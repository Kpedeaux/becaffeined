/* ==========================================================================
 * main.js — Application entry point
 *
 * Owns the game state machine:
 *   TITLE → PLAYING → SPLASH → PLAYING → ... → GAME_OVER → TITLE
 *
 * Wires:
 *   board.js  (engine, pure logic)
 *   render.js (DOM animation)
 *   input.js  (touch/mouse → swap intents)
 *   audio.js  (Web Audio SFX)
 *   splash.js (overlay screens)
 *   levels.js (config + brand content)
 *   storage.js (localStorage persistence)
 * ========================================================================== */

import {
  createBoard, isLegalMove, applySwap, resolveCascades,
  activateColorBomb, getHint, SPECIALS,
} from './board.js';
import {
  mount, animateSwap, animateCascade, animateCascades, reconcile,
  setSelected, clearSelected, setHint, clearHint, measure, showToast,
} from './render.js';
import { attachInput } from './input.js';
import {
  sfxSwap, sfxIllegal, sfxMatch, sfxBigCombo, sfxSpecial, sfxPowerupActivate,
  sfxLevelUp, sfxGameOver, sfxTick,
  unlockOnGesture, isMuted, toggleMute,
} from './audio.js';
import {
  showTitle, showSplash, showGameOver, showPause, showBonusQuestion,
  showNameEntry, refreshLeaderboard,
} from './splash.js';
import {
  LEVELS, TIME_BONUS_PER_PIECE, TIME_WARN_THRESHOLD, HINT_DELAY_MS,
} from './levels.js';
import {
  getHighScore, setHighScore, load, save,
  fetchTopScores, getCachedTopScores, submitTopScore, qualifiesForTopScore,
} from './storage.js';
import {
  trackGameStart, trackLevelStart, trackLevelComplete,
  trackGameOver, trackHighScore, trackMuteToggle,
} from './analytics.js';

const STATE = {
  TITLE: 'title',
  PLAYING: 'playing',
  SPLASH: 'splash',
  PAUSED: 'paused',
  GAME_OVER: 'gameover',
};

const game = {
  state: STATE.TITLE,
  board: null,
  level: 0,                    // index into LEVELS
  score: 0,
  totalScore: 0,
  timeLeft: 0,
  timerId: null,
  hintTimer: null,
  busy: false,                 // true while a cascade is animating
  detachInput: null,
  usedTriviaIndices: [],       // questions already shown this run
  bonusLevelsReached: 0,       // how many bonus levels were unlocked
};

const $ = sel => document.querySelector(sel);
const els = {
  app:         () => $('#app'),
  boardFrame:  () => $('#board-frame'),
  board:       () => $('#board'),
  hudLevel:    () => $('#hud-level'),
  hudScore:    () => $('#hud-score'),
  hudTime:     () => $('#hud-time'),
  progressFill: () => $('#progress-fill'),
  pauseBtn:    () => $('#btn-pause'),
  muteBtn:     () => $('#btn-mute'),
};

/* ---------- HUD ---------- */

function updateHUD() {
  const lvl = LEVELS[game.level];
  if (!lvl) return;
  els.hudLevel().textContent = `${lvl.id}/${LEVELS.length}`;
  els.hudScore().textContent = game.score.toLocaleString();
  const tEl = els.hudTime();
  tEl.textContent = Math.max(0, Math.ceil(game.timeLeft));
  tEl.classList.toggle('warn', game.timeLeft <= TIME_WARN_THRESHOLD);
  const pct = Math.min(100, (game.score / lvl.target) * 100);
  els.progressFill().style.width = `${pct}%`;
}

function updateMuteButton() {
  const btn = els.muteBtn();
  if (!btn) return;
  btn.textContent = isMuted() ? 'Sound: off' : 'Sound: on';
  btn.setAttribute('aria-pressed', String(!isMuted()));
}

/* ---------- Timer ---------- */

function startTimer() {
  stopTimer();
  let last = performance.now();
  let tickCounter = 0;
  game.timerId = requestAnimationFrame(function loop(now) {
    if (game.state !== STATE.PLAYING) {
      last = now;
      game.timerId = requestAnimationFrame(loop);
      return;
    }
    const dt = (now - last) / 1000;
    last = now;
    game.timeLeft -= dt;
    if (game.timeLeft <= 5 && game.timeLeft > 0) {
      tickCounter += dt;
      if (tickCounter >= 1) { tickCounter = 0; sfxTick(); }
    }
    updateHUD();
    if (game.timeLeft <= 0) {
      game.timeLeft = 0;
      stopTimer();
      onTimeOut();
      return;
    }
    game.timerId = requestAnimationFrame(loop);
  });
}
function stopTimer() {
  if (game.timerId) cancelAnimationFrame(game.timerId);
  game.timerId = null;
}

/* ---------- Hint ---------- */

function scheduleHint() {
  clearTimeout(game.hintTimer);
  game.hintTimer = setTimeout(() => {
    if (game.state !== STATE.PLAYING || game.busy) return;
    const pair = getHint(game.board);
    if (pair) setHint(els.board(), pair, true);
  }, HINT_DELAY_MS);
}
function killHint() {
  clearTimeout(game.hintTimer);
  clearHint(els.board());
}

/* ---------- Core game loop ---------- */

async function startLevel(idx) {
  game.level = idx;
  game.score = 0;
  const lvl = LEVELS[idx];
  game.timeLeft = lvl.seconds;
  game.busy = false;
  game.board = createBoard(7, 7);
  game.state = STATE.PLAYING;

  measure(els.board());
  mount(els.board(), game.board);
  updateHUD();
  scheduleHint();
  startTimer();
  trackLevelStart(lvl.id);
}

async function attemptSwap(a, b) {
  if (game.busy || game.state !== STATE.PLAYING) return;
  killHint();
  clearSelected(els.board());

  // Bounds check
  const { rows, cols } = game.board;
  if (b.r < 0 || b.r >= rows || b.c < 0 || b.c >= cols) return;
  if (Math.abs(a.r - b.r) + Math.abs(a.c - b.c) !== 1) return;

  const pa = game.board.grid[a.r][a.c];
  const pb = game.board.grid[b.r][b.c];

  // Color-bomb special swap: bomb + regular = clear all of regular's type
  let isColorBombSwap = false;
  let bombPos = null, bombTarget = null;
  if (pa.special === SPECIALS.COLOR && !pb.special) {
    isColorBombSwap = true; bombPos = a; bombTarget = pb.type;
  } else if (pb.special === SPECIALS.COLOR && !pa.special) {
    isColorBombSwap = true; bombPos = b; bombTarget = pa.type;
  }

  game.busy = true;

  if (isColorBombSwap) {
    sfxSwap();
    await animateSwap(els.board(), a, b);
    sfxSpecial();
    const events = activateColorBomb(applySwap(game.board, a, b), bombPos, bombTarget);
    await runCascade(events);
    game.busy = false;
    afterTurn();
    return;
  }

  if (!isLegalMove(game.board, a, b)) {
    sfxIllegal();
    await animateSwap(els.board(), a, b, 220);
    await animateSwap(els.board(), a, b, 220); // swap back
    game.busy = false;
    scheduleHint();
    return;
  }

  sfxSwap();
  await animateSwap(els.board(), a, b);
  game.board = applySwap(game.board, a, b);
  // Run cascades from this swap, with the swap target cell as the
  // preferred special-spawn position
  const events = resolveCascades(game.board, b);
  await runCascade(events);

  game.busy = false;
  afterTurn();
}

async function runCascade(events) {
  let totalCleared = 0;
  let pointsEarned = 0;
  let highestCascade = 0;

  // Walk events one at a time, firing the SFX for that cascade right
  // before its animation starts. This is what makes the falls feel
  // alive — every match-on-fall now has its own audio cue, not one
  // batch of sounds at t=0 followed by silent visuals.
  for (const ev of events) {
    if (ev.shuffle) {
      await animateCascade(els.board(), els.boardFrame(), ev);
      continue;
    }
    totalCleared += ev.cleared.length;
    pointsEarned += ev.scoreDelta;
    highestCascade = Math.max(highestCascade, ev.cascadeLevel);
    const longestMatch = ev.matches.reduce((m, x) => Math.max(m, x.length), 3);
    sfxMatch(ev.cascadeLevel, longestMatch);
    if (ev.specialSpawns.length > 0) {
      sfxSpecial();
      // Show the powerup tutorial toast once per device, the first time
      // any powerup spawns. Avoids confusion about "what's that red square."
      if (!load('seenPowerupTutorial', false)) {
        save('seenPowerupTutorial', true);
        showToast(
          'You made a <strong>powerup!</strong><br>' +
          'Match three drinks including the glowing one to fire it. ' +
          'Arrows clear a row or column, the burst clears a 3x3 area, ' +
          'and the star clears every drink of one type.'
        );
      }
    }
    // POWERUP ACTIVATION: if any specials are firing this cascade, drop
    // a much bigger sound + visual so the player feels the explosion.
    if (ev.activatedSpecials && ev.activatedSpecials.length > 0) {
      sfxPowerupActivate();
    }
    await animateCascade(els.board(), els.boardFrame(), ev);
  }

  // Reconcile DOM with engine state after the chain settles
  if (events.length) reconcile(els.board(), events[events.length - 1].nextBoard);

  // Apply state changes after animations so the HUD ticks visibly.
  // Bonus levels (9, 10) carry pointsMultiplier: 2 — every match worth 2x.
  const finalBoard = events.length ? events[events.length - 1].nextBoard : game.board;
  const lvl = LEVELS[game.level];
  const mult = lvl.pointsMultiplier || 1;
  const earned = pointsEarned * mult;
  game.board = finalBoard;
  game.score += earned;
  game.totalScore += earned;
  game.timeLeft += totalCleared * TIME_BONUS_PER_PIECE;
  updateHUD();

  if (highestCascade >= 4) sfxBigCombo();
}

function afterTurn() {
  // Did the player clear the level?
  const lvl = LEVELS[game.level];
  if (game.score >= lvl.target) {
    advanceLevel();
    return;
  }
  scheduleHint();
}

async function advanceLevel() {
  stopTimer();
  game.state = STATE.SPLASH;
  sfxLevelUp();
  const lvl = LEVELS[game.level];
  trackLevelComplete(lvl.id, game.score, game.timeLeft);
  await showSplash(lvl.splash, lvl.id, LEVELS.length);

  // Trivia gate after Level 8 unlocks bonus Level 9 (2x points)
  if (lvl.id === 8) {
    return runBonusGate(0);
  }
  // Trivia gate after Level 9 unlocks bonus Level 10 (2x points)
  if (lvl.id === 9) {
    return runBonusGate(1);
  }
  // Cleared the final bonus level
  if (lvl.id === 10) {
    return onWin();
  }
  // Regular progression
  startLevel(game.level + 1);
}

/** Trivia gate between regular run and a bonus level.
 *  bonusIndex 0 = unlock Level 9, bonusIndex 1 = unlock Level 10.
 *  Correct answer starts the bonus level; wrong answer ends the run with
 *  current score. */
async function runBonusGate(bonusIndex) {
  game.state = STATE.SPLASH;
  const targetLevelId = 9 + bonusIndex;

  // Gate 1 (after L8): casual prompt to unlock the first bonus round.
  // Gate 2 (after L9): higher stakes — the final bonus round, all 2x.
  const config = bonusIndex === 0
    ? {
        eyebrow: 'Bonus Round',
        title: 'One Question.',
        subtitle: 'Answer correctly to unlock Level 9. Every match in that round is worth double points.',
      }
    : {
        eyebrow: 'Final Bonus Round',
        title: 'Last Question.',
        subtitle: 'Get this one and the final round opens up. Level 10 pays double too. Make it count.',
      };

  const result = await showBonusQuestion({
    eyebrow: config.eyebrow,
    title: config.title,
    subtitle: config.subtitle,
    score: game.totalScore,
    excludeIndices: game.usedTriviaIndices,
  });
  game.usedTriviaIndices.push(result.questionIndex);

  if (result.correct) {
    game.bonusLevelsReached = bonusIndex + 1;
    startLevel(7 + bonusIndex + 1);  // L9 = index 8, L10 = index 9
  } else {
    onWin();
  }
}


/** Show the end-of-game flow: if the player's score qualifies for the
 *  global top board, prompt for their name and submit. Returns the
 *  refreshed top scores so the game-over screen can show them. */
async function endGameWithLeaderboard({ score, levelReached, won }) {
  // Personal best (localStorage, always works)
  const isNewBest = setHighScore(score);
  const high = getHighScore();
  trackGameOver(score, levelReached, won);
  if (isNewBest) trackHighScore(high);

  // Global leaderboard — fetch live to decide qualification, then maybe
  // prompt for name and submit
  const liveTop = await fetchTopScores();
  let topScores = liveTop;
  const qualifies = await qualifiesForTopScore(score);
  let madeLeaderboard = false;
  if (qualifies) {
    let rank = liveTop.findIndex(e => score > e.score) + 1;
    if (rank === 0) rank = liveTop.length + 1;
    const name = await showNameEntry({ score, rank });
    topScores = await submitTopScore({
      name,
      score,
      levelReached,
      bonusLevels: game.bonusLevelsReached,
    });
    madeLeaderboard = true;
  }

  return { isNewBest, high, topScores, madeLeaderboard };
}

async function onTimeOut() {
  if (game.state !== STATE.PLAYING) return;
  game.state = STATE.GAME_OVER;
  sfxGameOver();
  const totalScore = game.totalScore;
  const { isNewBest, high, topScores, madeLeaderboard } = await endGameWithLeaderboard({
    score: totalScore,
    levelReached: LEVELS[game.level].id,
    won: false,
  });
  const choice = await showGameOver({
    score: totalScore,
    highScore: high,
    isNewBest,
    levelReached: LEVELS[game.level].id,
    totalLevels: 10,
    won: false,
    topScores,
    madeLeaderboard,
  });
  if (choice === 'replay') startGame();
  else returnToTitle();
}

async function onWin() {
  game.state = STATE.GAME_OVER;
  // Time-remaining bonus from the last completed level
  game.totalScore += Math.round(game.timeLeft) * 10;

  const lastClearedId = LEVELS[game.level] ? LEVELS[game.level].id : 8;
  const { isNewBest, high, topScores, madeLeaderboard } = await endGameWithLeaderboard({
    score: game.totalScore,
    levelReached: lastClearedId,
    won: true,
  });
  const choice = await showGameOver({
    score: game.totalScore,
    highScore: high,
    isNewBest,
    levelReached: lastClearedId,
    totalLevels: 10,
    won: true,
    bonusLevelsReached: game.bonusLevelsReached,
    topScores,
    madeLeaderboard,
  });
  if (choice === 'replay') startGame();
  else returnToTitle();
}

/* ---------- Pause ---------- */

async function togglePause() {
  if (game.state === STATE.PLAYING) {
    game.state = STATE.PAUSED;
    stopTimer();
    await showPause();
    game.state = STATE.PLAYING;
    startTimer();
  }
}

window.addEventListener('blur', () => {
  if (game.state === STATE.PLAYING) togglePause();
});

/* ---------- Top-level flow ---------- */

async function startGame() {
  game.totalScore = 0;
  game.level = 0;
  game.usedTriviaIndices = [];
  game.bonusLevelsReached = 0;
  trackGameStart();
  startLevel(0);
}

async function returnToTitle() {
  game.state = STATE.TITLE;
  game.totalScore = 0;
  els.board().innerHTML = '';
  // Show title with whatever scores are in cache for an instant render,
  // then kick off a background refresh that swaps the leaderboard DOM
  // in place when fresh data arrives. Only updates if we're still on the
  // title — we don't stomp on a game in progress.
  const cachedScores = getCachedTopScores();
  fetchTopScores().then(scores => {
    if (game.state === STATE.TITLE) refreshLeaderboard(scores);
  }).catch(() => {});
  await showTitle({ highScore: getHighScore(), topScores: cachedScores });
  startGame();
}

/* ---------- Bootstrap ---------- */

function isInteractive() {
  return game.state === STATE.PLAYING && !game.busy;
}

function onSelect(pos) {
  if (!isInteractive()) return;
  killHint();
  clearSelected(els.board());
  setSelected(els.board(), pos, true);
}

function onSwap(a, b) {
  unlockOnGesture(); // first user gesture unlocks audio
  attemptSwap(a, b);
}

window.addEventListener('DOMContentLoaded', async () => {
  game.detachInput = attachInput(els.board(), { onSelect, onSwap, isInteractive });

  els.muteBtn().addEventListener('click', () => {
    unlockOnGesture();
    const muted = toggleMute();
    updateMuteButton();
    trackMuteToggle(muted);
    // Audible confirmation — single drip if we just unmuted
    if (!muted) sfxSwap();
  });
  els.pauseBtn().addEventListener('click', () => {
    if (game.state === STATE.PLAYING) togglePause();
  });

  // Resize → re-measure cell sizes and re-position pieces. Skip while a
  // cascade is animating — re-mounting mid-cascade was the root cause of
  // the rare empty-cell glitch the user reported.
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (game.board && !game.busy) {
        measure(els.board());
        mount(els.board(), game.board);
      }
    }, 200);
  });

  updateMuteButton();
  // Show title with whatever scores are in cache for an instant render,
  // then kick off a background refresh that swaps the leaderboard DOM in
  // place when fresh data arrives. First-time visitors have an empty
  // cache, so the leaderboard initially says "No scores yet" and updates
  // a moment later when the API returns.
  const cachedScores = getCachedTopScores();
  fetchTopScores().then(scores => {
    if (game.state === STATE.TITLE) refreshLeaderboard(scores);
  }).catch(() => {});
  await showTitle({ highScore: getHighScore(), topScores: cachedScores });
  startGame();
});
