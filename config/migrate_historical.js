/**
 * One-time migration: adds historical data columns to team_statistics
 * and creates h2h_history table.
 * Safe to run multiple times — uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS.
 *
 * Run: node config/migrate_historical.js
 */
const { pool } = require('./db');

async function run() {
  console.log('[migrate_historical] Starting…');

  // Add columns one-by-one; silently skip if already present (ER_DUP_FIELDNAME)
  const newColumns = [
    `ALTER TABLE team_statistics ADD COLUMN home_goals_scored_avg   DECIMAL(5,2) NULL`,
    `ALTER TABLE team_statistics ADD COLUMN away_goals_scored_avg   DECIMAL(5,2) NULL`,
    `ALTER TABLE team_statistics ADD COLUMN home_goals_conceded_avg DECIMAL(5,2) NULL`,
    `ALTER TABLE team_statistics ADD COLUMN away_goals_conceded_avg DECIMAL(5,2) NULL`,
    `ALTER TABLE team_statistics ADD COLUMN home_form               VARCHAR(20)  NULL`,
    `ALTER TABLE team_statistics ADD COLUMN away_form               VARCHAR(20)  NULL`,
    `ALTER TABLE team_statistics ADD COLUMN corners_avg             DECIMAL(5,2) NULL`,
    `ALTER TABLE team_statistics ADD COLUMN home_corners_avg        DECIMAL(5,2) NULL`,
    `ALTER TABLE team_statistics ADD COLUMN away_corners_avg        DECIMAL(5,2) NULL`,
  ];

  for (const sql of newColumns) {
    const col = sql.match(/ADD COLUMN (\S+)/)[1];
    try {
      await pool.query(sql);
      console.log(`[migrate_historical] Added column: ${col}`);
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        console.log(`[migrate_historical] Column already exists (skipped): ${col}`);
      } else {
        console.error(`[migrate_historical] FAILED adding ${col}: ${e.message}`);
      }
    }
  }

  // Create h2h_history table
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS h2h_history (
      id              INT AUTO_INCREMENT PRIMARY KEY,
      home_api_id     INT          NOT NULL,
      away_api_id     INT          NOT NULL,
      fixture_api_id  INT          NOT NULL,
      match_date      DATETIME     NOT NULL,
      home_team       VARCHAR(100) NULL,
      away_team       VARCHAR(100) NULL,
      home_score      TINYINT      NULL,
      away_score      TINYINT      NULL,
      league_api_id   INT          NULL,
      season          VARCHAR(10)  NULL,
      created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_fixture (fixture_api_id),
      INDEX idx_pair (home_api_id, away_api_id)
    )`);
    console.log('[migrate_historical] h2h_history table ready');
  } catch (e) {
    console.error('[migrate_historical] h2h_history failed:', e.message);
  }

  await pool.end();
  console.log('[migrate_historical] Done.');
}

run().catch(err => { console.error(err); process.exit(1); });
