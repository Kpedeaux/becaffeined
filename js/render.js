/* ==========================================================================
 * render.js — DOM/SVG board renderer
 *
 * Pieces are absolutely-positioned <div>s with stable data-id attributes.
 * Their position is set via CSS custom properties (--x, --y) and animated
 * via the transform transition declared in game.css. This avoids layout
 * thrash and stays GPU-accelerated on mobile.
 *
 * The renderer is event-driven: it consumes the cascade events returned by
 * board.js and animates each frame in sequence.
 * ========================================================================== */

import { TYPES } from './board.js';

const ART_PATHS = {
  'iced-cr':     'assets/svg/drink-iced-cr.svg',
  'streetcar':   'assets/svg/drink-streetcar.svg',
  'cappuccino':  'assets/svg/drink-cappuccino.svg',
  'bayou-beast': 'assets/svg/drink-bayou-beast.svg',
  'iced-mocha':  'assets/svg/drink-iced-mocha.svg',
  'coffee-bag':  'assets/svg/drink-coffee-bag.svg',
};

// Human-readable labels for screen readers. Without this, alt text reads
// as "iced-cr" — a slug — instead of "Iced CR Cold Brew."
const ART_LABELS = {
  'iced-cr':     'Iced CR Cold Brew',
  'streetcar':   'Streetcar Tumbler',
  'cappuccino':  'CR Cappuccino',
  'bayou-beast': 'Bayou Beast',
  'iced-mocha':  'Iced Mocha',
  'coffee-bag':  'Cold Brew Blend Bag',
};

const SPECIAL_CLASS = {
  'line-h': 'is-line-h',
  'line-v': 'is-line-v',
  'area':   'is-area',
  'color':  'is-color',
};

let cellSize = 56;
let cellGap = 4;

/** Read the current cell size + gap. Called whenever the board is
 *  (re)mounted or the viewport resizes.
 *
 *  We CAN'T trust getComputedStyle on --cell-size because some browsers
 *  return the raw `min(calc(...), 64px)` expression instead of the
 *  resolved px value, and parseFloat of that returns NaN. So we read the
 *  actual rendered size off the DOM:
 *    1. If a piece is already mounted, use its bounding rect (perfect).
 *    2. Otherwise, derive cell size from the .board element's width.
 *    3. Final fallback: 56px (won't happen in practice). */
export function measure(boardEl) {
  cellGap = parseFloat(getComputedStyle(document.documentElement)
              .getPropertyValue('--cell-gap')) || 4;
  const piece = boardEl.querySelector('.piece');
  if (piece) {
    const rect = piece.getBoundingClientRect();
    if (rect.width > 0) { cellSize = rect.width; return; }
  }
  const boardRect = boardEl.getBoundingClientRect();
  if (boardRect.width > 0) {
    // .board width = 7*cell + 6*gap → cell = (width - 6*gap) / 7
    cellSize = (boardRect.width - cellGap * 6) / 7;
    return;
  }
  cellSize = 56;
}

function px(n) { return `${n}px`; }
function xFor(c) { return c * (cellSize + cellGap); }
function yFor(r) { return r * (cellSize + cellGap); }

function makePieceEl(piece, r, c) {
  const el = document.createElement('div');
  el.className = 'piece';
  el.dataset.id = piece.id;
  el.dataset.type = piece.type;
  el.dataset.r = r;
  el.dataset.c = c;
  el.style.setProperty('--x', px(xFor(c)));
  el.style.setProperty('--y', px(yFor(r)));

  const img = document.createElement('img');
  img.className = 'piece__art';
  img.src = ART_PATHS[piece.type];
  img.alt = ART_LABELS[piece.type] || piece.type;
  img.draggable = false;
  el.appendChild(img);

  if (piece.special) el.classList.add(SPECIAL_CLASS[piece.special]);
  return el;
}

/** Render the entire board fresh. Use on mount or after a shuffle. */
export function mount(boardEl, board) {
  measure(boardEl);
  boardEl.innerHTML = '';
  for (let r = 0; r < board.rows; r++) {
    for (let c = 0; c < board.cols; c++) {
      const piece = board.grid[r][c];
      if (!piece) continue;
      boardEl.appendChild(makePieceEl(piece, r, c));
    }
  }
}

function pieceById(boardEl, id) {
  return boardEl.querySelector(`[data-id="${id}"]`);
}
function pieceAt(boardEl, r, c) {
  return boardEl.querySelector(`[data-r="${r}"][data-c="${c}"]`);
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/** Animate a swap of two pieces. Returns when animation completes. */
export async function animateSwap(boardEl, a, b, durationMs = 220) {
  const elA = pieceAt(boardEl, a.r, a.c);
  const elB = pieceAt(boardEl, b.r, b.c);
  if (!elA || !elB) return;
  // Swap dataset positions
  elA.dataset.r = b.r; elA.dataset.c = b.c;
  elB.dataset.r = a.r; elB.dataset.c = a.c;
  elA.style.setProperty('--x', px(xFor(b.c)));
  elA.style.setProperty('--y', px(yFor(b.r)));
  elB.style.setProperty('--x', px(xFor(a.c)));
  elB.style.setProperty('--y', px(yFor(a.r)));
  await sleep(durationMs);
}

export function setSelected(boardEl, pos, on) {
  if (!pos) return;
  const el = pieceAt(boardEl, pos.r, pos.c);
  if (el) el.classList.toggle('is-selected', !!on);
}
export function clearSelected(boardEl) {
  boardEl.querySelectorAll('.is-selected').forEach(el => el.classList.remove('is-selected'));
}
export function setHint(boardEl, pair, on) {
  if (!pair) return;
  for (const p of pair) {
    const el = pieceAt(boardEl, p.r, p.c);
    if (el) el.classList.toggle('is-hint', !!on);
  }
}
export function clearHint(boardEl) {
  boardEl.querySelectorAll('.is-hint').forEach(el => el.classList.remove('is-hint'));
}

/** Add a floating "+N" score popup at a board position. */
export function spawnScorePop(boardEl, r, c, text) {
  const el = document.createElement('div');
  el.className = 'score-pop';
  el.style.setProperty('--x', px(xFor(c) + cellSize / 2 - 24));
  el.style.setProperty('--y', px(yFor(r)));
  el.textContent = text;
  boardEl.appendChild(el);
  setTimeout(() => el.remove(), 950);
}

/** Show a big combo banner over the board. */
export function spawnComboBanner(boardEl, text) {
  const banner = document.createElement('div');
  banner.className = 'combo-banner';
  const inner = document.createElement('div');
  inner.className = 'combo-banner__text';
  inner.textContent = text;
  banner.appendChild(inner);
  boardEl.appendChild(banner);
  setTimeout(() => banner.remove(), 950);
}

/** Briefly shake the board frame element. */
export function shake(frameEl) {
  frameEl.classList.remove('shake');
  // Trigger reflow
  void frameEl.offsetWidth;
  frameEl.classList.add('shake');
  setTimeout(() => frameEl.classList.remove('shake'), 400);
}

/** Animate one cascade event. Returns when the next pieces are settled. */
export async function animateCascade(boardEl, frameEl, event) {
  if (event.shuffle) {
    // Re-mount fresh (cheap; the alternative is animating every piece)
    mount(boardEl, event.nextBoard);
    spawnComboBanner(boardEl, 'Reshuffled');
    await sleep(360);
    return;
  }

  // Step 1: pop matched + activated specials
  const popPositions = new Set();
  for (const m of event.matches) for (const cell of m.cells) popPositions.add(`${cell.r},${cell.c}`);
  for (const c of event.cleared) popPositions.add(`${c.r},${c.c}`);
  for (const a of event.activatedSpecials) popPositions.add(`${a.r},${a.c}`);

  for (const k of popPositions) {
    const [r, c] = k.split(',').map(Number);
    const el = pieceAt(boardEl, r, c);
    if (!el) continue;
    el.classList.add('is-clearing');
  }

  // Score popups (one per match center)
  if (event.matches && event.matches.length) {
    for (const m of event.matches) {
      const cell = m.cells[Math.floor(m.cells.length / 2)];
      const points = Math.round(50 * m.length * (1 + (event.cascadeLevel - 1) * 0.5));
      spawnScorePop(boardEl, cell.r, cell.c, `+${points}`);
    }
  }
  if (event.cascadeLevel >= 3) {
    const labels = ['', '', '', 'Tasty!', 'Buzzed!', 'Caffeinated!', 'Wired!', 'Becaffeined!'];
    spawnComboBanner(boardEl, labels[Math.min(event.cascadeLevel, labels.length - 1)]);
  }

  // Wait for pop animation to finish
  await sleep(260);

  // Step 2: remove cleared elements from DOM
  for (const k of popPositions) {
    const [r, c] = k.split(',').map(Number);
    const el = pieceAt(boardEl, r, c);
    if (el && el.classList.contains('is-clearing')) el.remove();
  }

  // Step 2.5: place any newly-spawned specials in the cleared spots
  for (const sp of event.specialSpawns) {
    const piece = event.nextBoard.grid[sp.position.r][sp.position.c];
    if (!piece) continue;
    // Replace any existing element (defensive) and add fresh
    const existing = pieceAt(boardEl, sp.position.r, sp.position.c);
    if (existing) existing.remove();
    const el = makePieceEl(piece, sp.position.r, sp.position.c);
    boardEl.appendChild(el);
  }

  // Step 3: animate fallen pieces — update their dataset and CSS vars
  for (const move of event.fallen) {
    const el = pieceById(boardEl, move.id);
    if (!el) continue;
    el.dataset.r = move.to.r;
    el.dataset.c = move.to.c;
    el.style.setProperty('--y', px(yFor(move.to.r)));
  }

  // Step 4: spawn new pieces above the board, then drop them in
  for (const s of event.spawned) {
    const piece = event.nextBoard.grid[s.r][s.c];
    if (!piece) continue;
    const el = makePieceEl(piece, s.r, s.c);
    el.classList.add('is-spawning');
    boardEl.appendChild(el);
    // Remove the spawning class after the animation
    setTimeout(() => el.classList.remove('is-spawning'), 380);
  }

  // Wait for fall animation
  await sleep(380);

  // Optional shake on big cascades
  if (event.cascadeLevel >= 4 || (event.cleared && event.cleared.length >= 8)) {
    shake(frameEl);
  }
}

/** Run a sequence of cascade events. */
export async function animateCascades(boardEl, frameEl, events) {
  for (const ev of events) {
    await animateCascade(boardEl, frameEl, ev);
  }
  // Safety net: after the cascade chain finishes, reconcile the DOM with the
  // engine's authoritative board state. Catches any rare sync drift (e.g. a
  // fallen piece whose CSS transition was interrupted by a viewport resize)
  // and self-heals it before the player can see an empty cell.
  if (events.length) {
    reconcile(boardEl, events[events.length - 1].nextBoard);
  }
}

/** Compare the DOM piece set to the engine's grid and patch any mismatches.
 *  Fast O(rows*cols) walk — at 49 cells this is essentially free. */
export function reconcile(boardEl, board) {
  const { rows, cols, grid } = board;

  // Index DOM pieces by their stable id
  const byId = new Map();
  const allEls = boardEl.querySelectorAll('.piece');
  for (const el of allEls) {
    if (el.classList.contains('is-clearing')) continue;
    byId.set(el.dataset.id, el);
  }

  // Walk the engine's grid and ensure every cell is represented correctly
  const seenIds = new Set();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const piece = grid[r][c];
      if (!piece) continue;
      const id = String(piece.id);
      let el = byId.get(id);
      if (!el) {
        // Engine has a piece here that the DOM doesn't — create it
        el = makePieceEl(piece, r, c);
        boardEl.appendChild(el);
      } else {
        // Element exists but may be at the wrong coords — snap into place
        if (parseInt(el.dataset.r, 10) !== r || parseInt(el.dataset.c, 10) !== c) {
          el.dataset.r = r;
          el.dataset.c = c;
          el.style.setProperty('--x', px(xFor(c)));
          el.style.setProperty('--y', px(yFor(r)));
        }
      }
      seenIds.add(id);
    }
  }

  // Remove any orphan DOM pieces the engine no longer knows about
  for (const [id, el] of byId.entries()) {
    if (!seenIds.has(id)) el.remove();
  }
}
