/* ==========================================================================
 * board.js — Match-3 engine
 *
 * Pure-logic module. No DOM, no audio, no globals. The renderer reads the
 * board state and the event log this module produces and animates from there.
 *
 * State shape:
 *   board.cols, board.rows       — dimensions
 *   board.grid                   — 2D array, [row][col], top-left origin
 *   board.grid[r][c]             — Piece | null
 *   piece = { id, type, special }
 *     id     — unique number, stable across animations
 *     type   — one of TYPES (the six drinks)
 *     special — null | 'line-h' | 'line-v' | 'area' | 'color'
 *
 * Cascade results (the renderer's animation script):
 *   { matches: Match[], cleared: Position[], fallen: Move[], spawned: Spawn[],
 *     specials: SpecialSpawn[], score, cascadeLevel }
 * ========================================================================== */

export const TYPES = [
  'iced-cr',
  'streetcar',
  'cappuccino',
  'bayou-beast',
  'iced-mocha',
  'coffee-bag',
];

export const SPECIALS = {
  LINE_H: 'line-h',
  LINE_V: 'line-v',
  AREA: 'area',
  COLOR: 'color',
};

let nextId = 1;
const newId = () => nextId++;

function rand(rng) { return rng ? rng() : Math.random(); }
function pickType(rng) { return TYPES[Math.floor(rand(rng) * TYPES.length)]; }
function newPiece(type, special = null) {
  return { id: newId(), type, special };
}

/** Deep-clone the grid (pieces are reused by reference; that's fine — we
 *  treat pieces as immutable once placed). */
function cloneGrid(grid) {
  return grid.map(row => row.slice());
}

/** Generate a fresh board with NO pre-existing matches.
 *  Walks cells top-left to bottom-right, picking a type that doesn't
 *  complete a 3-in-a-row backward. Guaranteed no infinite loop. */
export function createBoard(rows = 8, cols = 8, rng = null) {
  const grid = Array.from({ length: rows }, () => Array(cols).fill(null));

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const forbidden = new Set();
      // Two-back horizontal: would create a 3-in-row?
      if (c >= 2 && grid[r][c - 1].type === grid[r][c - 2].type) {
        forbidden.add(grid[r][c - 1].type);
      }
      // Two-back vertical
      if (r >= 2 && grid[r - 1][c].type === grid[r - 2][c].type) {
        forbidden.add(grid[r - 1][c].type);
      }
      const choices = TYPES.filter(t => !forbidden.has(t));
      const type = choices[Math.floor(rand(rng) * choices.length)];
      grid[r][c] = newPiece(type);
    }
  }

  // Sanity: ensure at least one valid move exists.
  let board = { rows, cols, grid };
  let safety = 0;
  while (!findAnyValidMove(board) && safety < 50) {
    board = shuffleBoard(board, rng);
    safety++;
  }
  return board;
}

/** Find every match-run (3+ same type horizontally or vertically).
 *  Returns array of { cells: [{r,c}], type, length, axis: 'h'|'v' }.
 *  L/T shapes show up as overlapping h+v runs that share a cell — caller
 *  merges them when spawning special pieces. */
export function findMatches(board) {
  const { rows, cols, grid } = board;
  const matches = [];

  // Horizontal
  for (let r = 0; r < rows; r++) {
    let runStart = 0;
    for (let c = 1; c <= cols; c++) {
      const same =
        c < cols &&
        grid[r][c] &&
        grid[r][runStart] &&
        grid[r][c].type === grid[r][runStart].type;
      if (!same) {
        const len = c - runStart;
        if (len >= 3) {
          const cells = [];
          for (let i = runStart; i < c; i++) cells.push({ r, c: i });
          matches.push({ cells, type: grid[r][runStart].type, length: len, axis: 'h' });
        }
        runStart = c;
      }
    }
  }

  // Vertical
  for (let c = 0; c < cols; c++) {
    let runStart = 0;
    for (let r = 1; r <= rows; r++) {
      const same =
        r < rows &&
        grid[r][c] &&
        grid[runStart][c] &&
        grid[r][c].type === grid[runStart][c].type;
      if (!same) {
        const len = r - runStart;
        if (len >= 3) {
          const cells = [];
          for (let i = runStart; i < r; i++) cells.push({ r: i, c });
          matches.push({ cells, type: grid[runStart][c].type, length: len, axis: 'v' });
        }
        runStart = r;
      }
    }
  }

  return matches;
}

/** Are these two coords adjacent (4-direction)? */
export function isAdjacent(a, b) {
  return Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;
}

/** Returns a NEW board with positions a and b swapped. Does not validate. */
export function applySwap(board, a, b) {
  const grid = cloneGrid(board.grid);
  const tmp = grid[a.r][a.c];
  grid[a.r][a.c] = grid[b.r][b.c];
  grid[b.r][b.c] = tmp;
  return { ...board, grid };
}

/** Would this swap produce at least one match (or activate a special)? */
export function isLegalMove(board, a, b) {
  if (!isAdjacent(a, b)) return false;
  const pa = board.grid[a.r][a.c];
  const pb = board.grid[b.r][b.c];
  if (!pa || !pb) return false;
  // Color-bomb specials always activate when swapped against any piece.
  if (pa.special === SPECIALS.COLOR || pb.special === SPECIALS.COLOR) return true;
  const next = applySwap(board, a, b);
  return findMatches(next).length > 0;
}

/** Find any legal swap on the current board. Used for hint + deadlock check. */
export function findAnyValidMove(board) {
  const { rows, cols } = board;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const here = { r, c };
      // Right neighbor
      if (c + 1 < cols && isLegalMove(board, here, { r, c: c + 1 })) {
        return [here, { r, c: c + 1 }];
      }
      // Down neighbor
      if (r + 1 < rows && isLegalMove(board, here, { r: r + 1, c })) {
        return [here, { r: r + 1, c }];
      }
    }
  }
  return null;
}

/** Reshuffle every non-special piece on the board. Preserves specials in place. */
export function shuffleBoard(board, rng = null) {
  const { rows, cols } = board;
  const grid = cloneGrid(board.grid);
  const movable = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] && !grid[r][c].special) movable.push({ r, c, type: grid[r][c].type });
    }
  }
  // Fisher-Yates on the type pool
  const types = movable.map(m => m.type);
  for (let i = types.length - 1; i > 0; i--) {
    const j = Math.floor(rand(rng) * (i + 1));
    [types[i], types[j]] = [types[j], types[i]];
  }
  movable.forEach((m, i) => {
    grid[m.r][m.c] = { ...grid[m.r][m.c], type: types[i] };
  });
  // Clear any matches we accidentally created. Single matches-then-repick
  // pass per safety iteration — avoids the old nested findMatches() that
  // was O((rows*cols)^2) and could freeze on pathological boards.
  let next = { ...board, grid };
  for (let safety = 0; safety < 30; safety++) {
    const matches = findMatches(next);
    if (matches.length === 0) break;
    const g2 = cloneGrid(next.grid);
    for (const m of matches) {
      // Re-pick a random cell from each match to a different type
      const cell = m.cells[Math.floor(rand(rng) * m.cells.length)];
      const piece = g2[cell.r][cell.c];
      if (piece && !piece.special) {
        const others = TYPES.filter(t => t !== piece.type);
        const newType = others[Math.floor(rand(rng) * others.length)];
        g2[cell.r][cell.c] = { ...piece, type: newType };
      }
    }
    next = { ...next, grid: g2 };
  }
  return next;
}

/** Score for a single match by length. */
function scoreMatch(match, cascadeLevel) {
  const base = 50 * match.length;
  const bonus =
    match.length === 4 ? 200 :
    match.length >= 5 ? 500 :
    0;
  const mult = 1 + (cascadeLevel - 1) * 0.5; // 1, 1.5, 2, 2.5...
  return Math.round((base + bonus) * mult);
}

/** Decide whether a match spawns a special piece, and which kind.
 *  Spawn position prefers the swap-target cell if the caller passed it,
 *  otherwise the middle cell of the match. Returns null if no special. */
function pickSpecial(match, swapTarget = null) {
  let position = match.cells[Math.floor(match.cells.length / 2)];
  if (swapTarget && match.cells.some(c => c.r === swapTarget.r && c.c === swapTarget.c)) {
    position = swapTarget;
  }
  if (match.length >= 5) {
    return { position, type: match.type, special: SPECIALS.COLOR };
  }
  if (match.length === 4) {
    return {
      position,
      type: match.type,
      special: match.axis === 'h' ? SPECIALS.LINE_H : SPECIALS.LINE_V,
    };
  }
  return null;
}

/** Cells affected when a special activates. Recursive — chain reactions. */
function specialBlast(grid, pos, visited = new Set()) {
  const key = `${pos.r},${pos.c}`;
  if (visited.has(key)) return new Set();
  visited.add(key);
  const piece = grid[pos.r]?.[pos.c];
  if (!piece || !piece.special) return new Set([key]);

  const rows = grid.length;
  const cols = grid[0].length;
  const cells = new Set([key]);

  if (piece.special === SPECIALS.LINE_H) {
    for (let c = 0; c < cols; c++) cells.add(`${pos.r},${c}`);
  } else if (piece.special === SPECIALS.LINE_V) {
    for (let r = 0; r < rows; r++) cells.add(`${r},${pos.c}`);
  } else if (piece.special === SPECIALS.AREA) {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const r = pos.r + dr, c = pos.c + dc;
        if (r >= 0 && r < rows && c >= 0 && c < cols) cells.add(`${r},${c}`);
      }
    }
  } else if (piece.special === SPECIALS.COLOR) {
    // Clears all of the piece's type. Caller resolves what type to clear
    // based on the matching context; default to the piece's own type.
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid[r][c]?.type === piece.type) cells.add(`${r},${c}`);
      }
    }
  }

  // Chain: any specials inside the blast also activate
  for (const k of [...cells]) {
    const [r, c] = k.split(',').map(Number);
    const inner = grid[r]?.[c];
    if (inner?.special && k !== key) {
      const more = specialBlast(grid, { r, c }, visited);
      more.forEach(m => cells.add(m));
    }
  }
  return cells;
}

/** Resolve one match-clear-fall pass. Returns event for the renderer.
 *  Multiple cascades come from the caller invoking this in a loop. */
function resolveOnce(board, cascadeLevel, swapTarget = null) {
  const { rows, cols } = board;
  let grid = cloneGrid(board.grid);

  // Detect matches
  const matches = findMatches({ ...board, grid });
  if (matches.length === 0) return null;

  // Score
  let scoreDelta = 0;
  for (const m of matches) scoreDelta += scoreMatch(m, cascadeLevel);

  // Decide which cells to clear
  const clearKeys = new Set();
  for (const m of matches) {
    for (const cell of m.cells) clearKeys.add(`${cell.r},${cell.c}`);
  }

  // Activate any specials caught up in the matches (chain reactions)
  const activatedSpecials = [];
  for (const k of [...clearKeys]) {
    const [r, c] = k.split(',').map(Number);
    if (grid[r][c]?.special) {
      const more = specialBlast(grid, { r, c });
      more.forEach(x => clearKeys.add(x));
      activatedSpecials.push({ r, c });
    }
  }

  // Spawn special pieces. First, detect L/T-shaped 5+ matches by finding
  // cells that appear in BOTH a horizontal AND a vertical match — those
  // intersections are the corner of an L or center of a T. Spawn AREA
  // (3x3 bomb) at the intersection. The contributing matches don't get
  // their own line/color spawn (would double-spawn at the same cell).
  const cellMatchMap = new Map();
  for (const m of matches) {
    for (const cell of m.cells) {
      const k = `${cell.r},${cell.c}`;
      if (!cellMatchMap.has(k)) cellMatchMap.set(k, []);
      cellMatchMap.get(k).push(m);
    }
  }
  const matchesAlreadyHandled = new Set();
  const specialSpawns = [];
  for (const [k, ms] of cellMatchMap.entries()) {
    if (ms.length >= 2) {
      const [r, c] = k.split(',').map(Number);
      if (activatedSpecials.some(a => a.r === r && a.c === c)) continue;
      clearKeys.delete(k);
      specialSpawns.push({
        position: { r, c },
        type: ms[0].type,
        special: SPECIALS.AREA,
      });
      ms.forEach(m => matchesAlreadyHandled.add(m));
    }
  }
  // Now handle remaining matches with line/color specials (4+/5+).
  for (const m of matches) {
    if (matchesAlreadyHandled.has(m)) continue;
    const sp = pickSpecial(m, swapTarget);
    if (!sp) continue;
    const key = `${sp.position.r},${sp.position.c}`;
    if (activatedSpecials.some(a => a.r === sp.position.r && a.c === sp.position.c)) continue;
    clearKeys.delete(key);
    specialSpawns.push(sp);
  }

  // Clear matched cells
  const cleared = [];
  for (const k of clearKeys) {
    const [r, c] = k.split(',').map(Number);
    if (grid[r][c]) {
      cleared.push({ r, c, piece: grid[r][c] });
      grid[r][c] = null;
    }
  }

  // Place new specials
  for (const sp of specialSpawns) {
    grid[sp.position.r][sp.position.c] = newPiece(sp.type, sp.special);
  }

  // Apply gravity: per column, pull non-null pieces down
  const fallen = [];
  for (let c = 0; c < cols; c++) {
    let writeRow = rows - 1;
    for (let r = rows - 1; r >= 0; r--) {
      if (grid[r][c]) {
        if (writeRow !== r) {
          fallen.push({ from: { r, c }, to: { r: writeRow, c }, id: grid[r][c].id });
          grid[writeRow][c] = grid[r][c];
          grid[r][c] = null;
        }
        writeRow--;
      }
    }
  }

  // Spawn new pieces from the top
  const spawned = [];
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      if (!grid[r][c]) {
        const piece = newPiece(pickType());
        grid[r][c] = piece;
        spawned.push({ r, c, id: piece.id, type: piece.type });
      }
    }
  }

  return {
    matches,
    cleared,
    specialSpawns,
    activatedSpecials,
    fallen,
    spawned,
    scoreDelta,
    cascadeLevel,
    nextBoard: { ...board, grid },
  };
}

/** Run the full cascade chain from one swap. Returns array of cascade
 *  events, each one a frame for the renderer to animate sequentially. */
export function resolveCascades(board, swapTarget = null) {
  const events = [];
  let current = board;
  let level = 1;
  while (true) {
    const ev = resolveOnce(current, level, level === 1 ? swapTarget : null);
    if (!ev) break;
    events.push(ev);
    current = ev.nextBoard;
    level++;
  }

  // Anti-deadlock: if no moves left, queue a shuffle event
  if (events.length > 0 && !findAnyValidMove(current)) {
    const shuffled = shuffleBoard(current);
    events.push({
      shuffle: true,
      cleared: [],
      fallen: [],
      spawned: [],
      matches: [],
      specialSpawns: [],
      activatedSpecials: [],
      scoreDelta: 0,
      cascadeLevel: 0,
      nextBoard: shuffled,
    });
  }

  return events;
}

/** Activate a color-bomb when a player swaps it against a regular piece.
 *  The color-bomb clears all pieces of the swapped-against type.
 *  Returns the same event shape as resolveCascades(). */
export function activateColorBomb(board, bombPos, targetType) {
  const { rows, cols } = board;
  let grid = cloneGrid(board.grid);

  const clearKeys = new Set();
  clearKeys.add(`${bombPos.r},${bombPos.c}`);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c]?.type === targetType) clearKeys.add(`${r},${c}`);
    }
  }

  const cleared = [];
  for (const k of clearKeys) {
    const [r, c] = k.split(',').map(Number);
    if (grid[r][c]) {
      cleared.push({ r, c, piece: grid[r][c] });
      grid[r][c] = null;
    }
  }

  const fallen = [];
  for (let c = 0; c < cols; c++) {
    let writeRow = rows - 1;
    for (let r = rows - 1; r >= 0; r--) {
      if (grid[r][c]) {
        if (writeRow !== r) {
          fallen.push({ from: { r, c }, to: { r: writeRow, c }, id: grid[r][c].id });
          grid[writeRow][c] = grid[r][c];
          grid[r][c] = null;
        }
        writeRow--;
      }
    }
  }

  const spawned = [];
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      if (!grid[r][c]) {
        const piece = newPiece(pickType());
        grid[r][c] = piece;
        spawned.push({ r, c, id: piece.id, type: piece.type });
      }
    }
  }

  const score = 100 * cleared.length;
  const events = [{
    matches: [],
    cleared,
    specialSpawns: [],
    activatedSpecials: [{ r: bombPos.r, c: bombPos.c }],
    fallen,
    spawned,
    scoreDelta: score,
    cascadeLevel: 1,
    nextBoard: { ...board, grid },
  }];

  // Continue cascades from the resulting board
  const more = resolveCascades({ ...board, grid });
  return events.concat(more);
}

/** Convenience: return the legal swap if a hint should be shown. */
export function getHint(board) {
  return findAnyValidMove(board);
}
