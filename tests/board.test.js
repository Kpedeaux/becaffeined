/* ==========================================================================
 * Engine smoke tests — runnable with Node ≥18.
 *
 *   node tests/board.test.js
 *
 * Pure assertions, no test framework dependency. If anything fails the
 * process exits non-zero so CI/Cloudflare deploy hooks can pick it up.
 * ========================================================================== */

import {
  TYPES, SPECIALS,
  createBoard, findMatches, applySwap, isLegalMove,
  findAnyValidMove, shuffleBoard, resolveCascades, isAdjacent,
} from '../js/board.js';

let pass = 0, fail = 0;
function eq(actual, expected, label) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  (ok ? pass++ : fail++);
  console.log(`${ok ? '  ok' : 'FAIL'}: ${label}`);
  if (!ok) {
    console.log('    expected:', expected);
    console.log('    got     :', actual);
  }
}
function truthy(v, label) {
  const ok = !!v;
  (ok ? pass++ : fail++);
  console.log(`${ok ? '  ok' : 'FAIL'}: ${label}`);
}

/* ----- Helpers to hand-build a board for predictable tests ----- */
let id = 1000;
function piece(type, special = null) { return { id: id++, type, special }; }
function gridFromTypes(rows) {
  return rows.map(row => row.map(t => t == null ? null : piece(t)));
}
function boardOf(rows) {
  const grid = gridFromTypes(rows);
  return { rows: grid.length, cols: grid[0].length, grid };
}

/* ===== Tests ===== */

console.log('createBoard generates no pre-existing matches');
{
  for (let i = 0; i < 20; i++) {
    const b = createBoard(8, 8);
    eq(findMatches(b).length, 0, `  attempt ${i + 1}: no matches`);
    truthy(findAnyValidMove(b), `  attempt ${i + 1}: has at least one valid move`);
  }
}

console.log('isAdjacent');
eq(isAdjacent({ r: 0, c: 0 }, { r: 0, c: 1 }), true, 'right neighbor');
eq(isAdjacent({ r: 0, c: 0 }, { r: 1, c: 0 }), true, 'down neighbor');
eq(isAdjacent({ r: 0, c: 0 }, { r: 1, c: 1 }), false, 'diagonal not adjacent');
eq(isAdjacent({ r: 0, c: 0 }, { r: 0, c: 0 }), false, 'self not adjacent');

console.log('findMatches detects horizontal 3');
{
  const b = boardOf([
    ['A', 'A', 'A', 'B'],
    ['B', 'C', 'D', 'E'],
    ['F', 'G', 'H', 'A'],
  ]);
  const m = findMatches(b);
  eq(m.length, 1, 'one match found');
  eq(m[0].length, 3, 'length 3');
  eq(m[0].axis, 'h', 'axis horizontal');
}

console.log('findMatches detects vertical 4');
{
  const b = boardOf([
    ['A', 'B'],
    ['A', 'C'],
    ['A', 'D'],
    ['A', 'E'],
  ]);
  const m = findMatches(b);
  eq(m.length, 1, 'one match found');
  eq(m[0].length, 4, 'length 4');
  eq(m[0].axis, 'v', 'axis vertical');
}

console.log('isLegalMove rejects swap that produces no match');
{
  const b = boardOf([
    ['A', 'B', 'C'],
    ['D', 'E', 'F'],
    ['G', 'H', 'I'],
  ]);
  eq(isLegalMove(b, { r: 0, c: 0 }, { r: 0, c: 1 }), false,
    'no resulting match → illegal');
}

console.log('isLegalMove accepts swap that creates a match');
{
  const b = boardOf([
    ['A', 'B', 'A', 'A'],
    ['C', 'C', 'C', 'D'],
    ['E', 'F', 'G', 'H'],
  ]);
  // Swap (0,1) B with (0,2) A → row becomes A A A A — definitely a match
  eq(isLegalMove(b, { r: 0, c: 1 }, { r: 0, c: 2 }), true,
    'swap creates 4-in-a-row → legal');
}

console.log('resolveCascades returns no events for a stable board');
{
  // Genuinely no matches: every row and column has 3 different types
  const b = boardOf([
    ['A', 'B', 'C', 'D'],
    ['B', 'C', 'D', 'A'],
    ['C', 'D', 'A', 'B'],
    ['D', 'A', 'B', 'C'],
  ]);
  eq(findMatches(b).length, 0, 'sanity: no matches in fixture');
  const events = resolveCascades(b);
  eq(events.length, 0, 'no events on a stable board');
}

console.log('resolveCascades handles a real match');
{
  const b = boardOf([
    ['A', 'A', 'A', 'B'],
    ['C', 'D', 'E', 'F'],
    ['G', 'H', 'I', 'J'],
    ['K', 'L', 'M', 'N'],
  ]);
  const events = resolveCascades(b);
  truthy(events.length >= 1, 'at least one cascade event');
  truthy(events[0].cleared.length >= 3, 'at least 3 cells cleared');
  truthy(events[0].scoreDelta > 0, 'score awarded');
  truthy(events[0].nextBoard, 'returns next board state');
}

console.log('findAnyValidMove finds a move when one exists');
{
  const b = boardOf([
    ['A', 'B', 'A'],
    ['B', 'A', 'A'],
    ['C', 'D', 'E'],
  ]);
  // Swapping (0,1) B with (1,1) A makes column 1: A A A → match
  const move = findAnyValidMove(b);
  truthy(move, 'returns a valid swap');
}

console.log('shuffleBoard preserves board dimensions');
{
  const b = createBoard(8, 8);
  const s = shuffleBoard(b);
  eq(s.rows, 8, 'rows preserved');
  eq(s.cols, 8, 'cols preserved');
  eq(findMatches(s).length, 0, 'shuffled board has no immediate matches');
}

console.log('Match-4 spawns a line-bomb special');
{
  const b = boardOf([
    ['A', 'A', 'A', 'A', 'B'],
    ['C', 'D', 'E', 'F', 'G'],
    ['H', 'I', 'J', 'K', 'L'],
    ['M', 'N', 'O', 'P', 'Q'],
    ['R', 'S', 'T', 'U', 'V'],
  ]);
  const events = resolveCascades(b);
  const ev = events[0];
  truthy(ev.specialSpawns.length >= 1, 'a special was spawned');
  if (ev.specialSpawns.length >= 1) {
    eq(ev.specialSpawns[0].special, SPECIALS.LINE_H,
      'horizontal line-bomb spawned for horizontal match-4');
  }
}

console.log('Match-5 spawns a color-bomb special');
{
  const b = boardOf([
    ['A', 'A', 'A', 'A', 'A'],
    ['B', 'C', 'D', 'E', 'F'],
    ['G', 'H', 'I', 'J', 'K'],
    ['L', 'M', 'N', 'O', 'P'],
    ['Q', 'R', 'S', 'T', 'U'],
  ]);
  const events = resolveCascades(b);
  const ev = events[0];
  truthy(ev.specialSpawns.length >= 1, 'a special was spawned');
  if (ev.specialSpawns.length >= 1) {
    eq(ev.specialSpawns[0].special, SPECIALS.COLOR,
      'color-bomb spawned for match-5');
  }
}

console.log('TYPES has 6 distinct drinks');
eq(TYPES.length, 6, '6 piece types');
eq(new Set(TYPES).size, 6, 'all unique');

console.log('');
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
