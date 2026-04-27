/* ==========================================================================
 * /api/scores — Cloudflare Pages Function backed by D1
 *
 * GET  → returns the current top 10 scores as JSON.
 * POST → submits a new score; validates + inserts; returns the refreshed
 *        top 10.
 *
 * D1 binding name: env.DB
 * Set this binding in the Cloudflare Pages project Settings → Functions →
 * D1 database bindings → variable name "DB", database "becaffeined".
 *
 * Anti-cheat is intentionally lightweight. This is a marketing/social
 * leaderboard, not a competitive ranking. We:
 *   - cap absolute score (no 9-digit numbers)
 *   - cap score per level reached (a Level-3 player can't have a 200k score)
 *   - cap submissions per IP per hour
 *   - sanitize the name (printable characters only, 12 chars max)
 *   - hash the IP rather than storing it raw
 * ========================================================================== */

const TOP_LIMIT = 10;
const ABSOLUTE_MAX_SCORE = 500_000;
const MAX_SUBMISSIONS_PER_HOUR = 12;

// Roughly the maximum score a legitimate player could plausibly score by
// reaching each level. Indexed by level reached (1–10). Generous to allow
// for big cascade chains and powerup chains, but still catches obvious
// inflated submissions from someone who never made it past Level 2.
const MAX_SCORE_FOR_LEVEL = [
  0,        // 0 — never used
  6_000,    // L1
  14_000,   // L2
  25_000,   // L3
  40_000,   // L4
  60_000,   // L5
  85_000,   // L6
  115_000,  // L7
  150_000,  // L8
  220_000,  // L9 (2x scoring)
  320_000,  // L10 (2x scoring)
];

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

async function sha256Hex(text) {
  const enc = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function fetchTopN(db, n = TOP_LIMIT) {
  const result = await db
    .prepare(
      `SELECT name, score, level_reached AS levelReached,
              bonus_levels AS bonusLevels, created_at AS createdAt
         FROM top_scores
         ORDER BY score DESC, id ASC
         LIMIT ?`
    )
    .bind(n)
    .all();
  return result.results || [];
}

export async function onRequestGet({ env }) {
  if (!env.DB) {
    return jsonResponse({ scores: [], error: 'D1 not bound' }, 503);
  }
  try {
    const scores = await fetchTopN(env.DB);
    return jsonResponse({ scores });
  } catch (err) {
    return jsonResponse({ scores: [], error: String(err) }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) {
    return jsonResponse({ error: 'D1 not bound' }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Bad JSON' }, 400);
  }

  // ----- validate -----
  const { name, score, levelReached = 0, bonusLevels = 0 } = body || {};
  if (typeof score !== 'number' || !Number.isFinite(score) || score < 0) {
    return jsonResponse({ error: 'Invalid score' }, 400);
  }
  if (score > ABSOLUTE_MAX_SCORE) {
    return jsonResponse({ error: 'Score exceeds absolute cap' }, 400);
  }
  const lvl = parseInt(levelReached, 10);
  if (!Number.isFinite(lvl) || lvl < 1 || lvl > 10) {
    return jsonResponse({ error: 'Invalid levelReached' }, 400);
  }
  if (score > MAX_SCORE_FOR_LEVEL[lvl]) {
    return jsonResponse({ error: 'Score too high for level reached' }, 400);
  }
  const bonus = parseInt(bonusLevels, 10) || 0;
  if (bonus < 0 || bonus > 2) {
    return jsonResponse({ error: 'Invalid bonusLevels' }, 400);
  }

  // ----- sanitize name -----
  const safeName = (name || 'Player')
    .toString()
    .replace(/[^\p{L}\p{N} '_-]/gu, '')
    .trim()
    .slice(0, 12) || 'Player';

  // ----- hash IP for rate limiting + dedup -----
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const ipHash = await sha256Hex('becaffeined-salt-' + ip);
  const ua = (request.headers.get('User-Agent') || '').slice(0, 200);

  // ----- rate-limit by IP -----
  try {
    const recent = await env.DB
      .prepare(
        `SELECT COUNT(*) AS n
           FROM top_scores
           WHERE ip_hash = ? AND created_at > datetime('now', '-1 hour')`
      )
      .bind(ipHash)
      .first();
    if (recent && recent.n >= MAX_SUBMISSIONS_PER_HOUR) {
      return jsonResponse(
        { error: 'Too many submissions, please slow down' },
        429
      );
    }
  } catch (err) {
    // If the rate-limit query itself fails, fail closed and try the insert
  }

  // ----- insert -----
  try {
    await env.DB
      .prepare(
        `INSERT INTO top_scores
           (name, score, level_reached, bonus_levels, ip_hash, user_agent)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(safeName, Math.round(score), lvl, bonus, ipHash, ua)
      .run();
  } catch (err) {
    return jsonResponse({ error: 'Insert failed: ' + err.message }, 500);
  }

  // ----- return refreshed top -----
  const scores = await fetchTopN(env.DB);
  return jsonResponse({ scores });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
