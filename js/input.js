/* ==========================================================================
 * input.js — Touch + mouse + keyboard input for the board
 *
 * Two interaction patterns, both supported:
 *   1. Tap-tap: tap a piece to select it; tap an adjacent piece to swap.
 *   2. Drag: press on a piece, drag in a direction; release to swap.
 *
 * The input layer doesn't know about game rules — it just emits two events:
 *   onSelect(pos)   — a piece was tapped (renderer pulses it)
 *   onSwap(a, b)    — the player wants to swap a and b (game decides)
 * ========================================================================== */

const SWIPE_THRESHOLD = 18; // px before we lock a direction

function pointerPos(e) {
  if (e.touches && e.touches.length) {
    return { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
  if (e.changedTouches && e.changedTouches.length) {
    return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
  }
  return { x: e.clientX, y: e.clientY };
}

function pieceFrom(target) {
  return target.closest && target.closest('.piece');
}
function rcOf(el) {
  return { r: parseInt(el.dataset.r, 10), c: parseInt(el.dataset.c, 10) };
}
function isAdjacent(a, b) {
  return Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;
}

export function attachInput(boardEl, { onSelect, onSwap, isInteractive }) {
  let dragOrigin = null;     // { pos, screen: {x,y} }
  let selected = null;       // { r, c } — sticky selection for tap-tap

  function reset() {
    dragOrigin = null;
  }

  function startGesture(e) {
    if (!isInteractive()) return;
    const el = pieceFrom(e.target);
    if (!el) return;
    const p = pointerPos(e);
    dragOrigin = { pos: rcOf(el), screen: p };
    e.preventDefault();
  }

  function moveGesture(e) {
    if (!dragOrigin || !isInteractive()) return;
    const p = pointerPos(e);
    const dx = p.x - dragOrigin.screen.x;
    const dy = p.y - dragOrigin.screen.y;
    if (Math.hypot(dx, dy) < SWIPE_THRESHOLD) return;
    // Decide direction
    let dr = 0, dc = 0;
    if (Math.abs(dx) > Math.abs(dy)) {
      dc = dx > 0 ? 1 : -1;
    } else {
      dr = dy > 0 ? 1 : -1;
    }
    const target = { r: dragOrigin.pos.r + dr, c: dragOrigin.pos.c + dc };
    onSwap(dragOrigin.pos, target);
    dragOrigin = null; // consume — only one swap per drag
  }

  function endGesture(e) {
    if (!dragOrigin || !isInteractive()) { reset(); return; }
    // No drag detected → treat as a tap
    const el = pieceFrom(e.target) ||
               (document.elementFromPoint &&
                document.elementFromPoint(pointerPos(e).x, pointerPos(e).y) &&
                pieceFrom(document.elementFromPoint(pointerPos(e).x, pointerPos(e).y)));
    if (el) {
      const pos = rcOf(el);
      if (selected && isAdjacent(selected, pos)) {
        const from = selected;
        selected = null;
        onSwap(from, pos);
      } else {
        // New selection
        selected = pos;
        onSelect(pos);
      }
    }
    reset();
  }

  function cancel() {
    selected = null;
    reset();
  }

  // Mouse
  boardEl.addEventListener('mousedown', startGesture);
  window.addEventListener('mousemove', moveGesture);
  window.addEventListener('mouseup', endGesture);

  // Touch
  boardEl.addEventListener('touchstart', startGesture, { passive: false });
  boardEl.addEventListener('touchmove', moveGesture, { passive: false });
  boardEl.addEventListener('touchend', endGesture);
  boardEl.addEventListener('touchcancel', cancel);

  // Cleanup
  return function detach() {
    boardEl.removeEventListener('mousedown', startGesture);
    window.removeEventListener('mousemove', moveGesture);
    window.removeEventListener('mouseup', endGesture);
    boardEl.removeEventListener('touchstart', startGesture);
    boardEl.removeEventListener('touchmove', moveGesture);
    boardEl.removeEventListener('touchend', endGesture);
    boardEl.removeEventListener('touchcancel', cancel);
  };
}

/** Reset any sticky tap-tap selection. */
export function clearTapSelection() {
  // Selection is closure-local in attachInput; this is a hook for future
  // expansion. For now the selection clears on next valid swap or cancel.
}
