/**
 * Migration: add fixture_status and elapsed_minutes to predictions.
 * Run: node config/migrate_live_scores.js
 */
const { pool } = require('./db');

async function run() {
  const cols = [
    `ALTER TABLE predictions ADD COLUMN fixture_status VARCHAR(10) NULL DEFAULT NULL`,
    `ALTER TABLE predictions ADD COLUMN elapsed_minutes TINYINT NULL DEFAULT NULL`,
  ];
  for (const sql of cols) {
    const col = sql.match(/ADD COLUMN (\S+)/)[1];
    try {
      await pool.query(sql);
      console.log(`[migrate_live] Added: ${col}`);
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') console.log(`[migrate_live] Already exists (skip): ${col}`);
      else console.error(`[migrate_live] FAILED ${col}: ${e.message}`);
    }
  }
  console.log('[migrate_live] Done.');
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
