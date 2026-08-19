/**
 * Migration: expand predictions.category from ENUM to VARCHAR(30)
 * and fix predictions.market ENUM to include all new markets.
 * Run: node config/migrate_categories.js
 */
const { pool } = require('./db');

async function run() {
  console.log('[migrate_categories] Starting…');

  // Expand category to VARCHAR so intelligence categories (dc_1x, dnb_home, etc.) are accepted
  try {
    await pool.query(`ALTER TABLE predictions MODIFY COLUMN category VARCHAR(30) NOT NULL DEFAULT 'free'`);
    console.log('[migrate_categories] category column → VARCHAR(30)');
  } catch (e) {
    console.error('[migrate_categories] category alter failed:', e.message);
  }

  // Expand market ENUM to include new markets added to intelligence engine
  try {
    await pool.query(`ALTER TABLE predictions MODIFY COLUMN market VARCHAR(30) NOT NULL DEFAULT '1X2'`);
    console.log('[migrate_categories] market column → VARCHAR(30)');
  } catch (e) {
    console.error('[migrate_categories] market alter failed:', e.message);
  }

  console.log('[migrate_categories] Done.');
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
