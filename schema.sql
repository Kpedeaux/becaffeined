-- ============================================================================
-- becaffeined — D1 schema for the global top-scores leaderboard
--
-- Apply this once after creating your D1 database. From the project root:
--   npx wrangler d1 execute becaffeined --remote --file=schema.sql
--
-- The DB binding name "becaffeined" must match what's in your Pages project's
-- D1 binding. See README for full setup steps.
-- ============================================================================

CREATE TABLE IF NOT EXISTS top_scores (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT    NOT NULL,
  score           INTEGER NOT NULL,
  level_reached   INTEGER NOT NULL,
  bonus_levels    INTEGER NOT NULL DEFAULT 0,
  ip_hash         TEXT,
  user_agent      TEXT,
  created_at      TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Sorted reads ("top 10 by score") get a covering index
CREATE INDEX IF NOT EXISTS idx_top_scores_score ON top_scores(score DESC);

-- For abuse detection: count submissions per IP per hour
CREATE INDEX IF NOT EXISTS idx_top_scores_ip_recent
  ON top_scores(ip_hash, created_at);
