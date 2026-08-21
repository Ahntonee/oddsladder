require('dotenv').config();
const {pool} = require('../config/db');

async function run() {
  const [res1] = await pool.query("SELECT result, COUNT(*) as cnt FROM predictions WHERE result IS NOT NULL GROUP BY result");
  const [res2] = await pool.query("SELECT market, category, COUNT(*) as cnt FROM predictions WHERE result IN ('won','lost') GROUP BY market, category ORDER BY cnt DESC LIMIT 20");
  const [res3] = await pool.query("SELECT COUNT(*) as cnt FROM prediction_accuracy_log");
  const [tables] = await pool.query("SHOW TABLES");
  const [leagues] = await pool.query("SELECT id, name, country FROM leagues LIMIT 10");
  const [confBands] = await pool.query(`
    SELECT b*5 as band_low, COUNT(*) as total, SUM(result='won') as won
    FROM (SELECT FLOOR(confidence_score/5) as b, result FROM predictions WHERE result IN ('won','lost') AND confidence_score IS NOT NULL) t
    GROUP BY b ORDER BY b DESC
  `);
  console.log('RESULTS:', JSON.stringify(res1));
  console.log('BY MARKET/CAT:', JSON.stringify(res2));
  console.log('PAL rows:', JSON.stringify(res3));
  console.log('TABLES:', tables.map(t=>Object.values(t)[0]).join(', '));
  console.log('LEAGUES:', JSON.stringify(leagues));
  console.log('CONF BANDS:', JSON.stringify(confBands));
  process.exit(0);
}
run().catch(e => { console.error(e.message); process.exit(1); });
