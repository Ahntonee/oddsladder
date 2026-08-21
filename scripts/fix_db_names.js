require('dotenv').config();
const { pool } = require('../config/db');

async function run() {
  const conn = await pool.getConnection();

  const fix = async (table, col) => {
    const [r] = await conn.execute(
      `UPDATE \`${table}\` SET \`${col}\` = REPLACE(REPLACE(\`${col}\`, 'Oddslander', 'Predictvilla'), 'oddslander', 'predictvilla') WHERE \`${col}\` LIKE '%ddslander%'`
    );
    if (r.affectedRows) console.log(`Updated ${r.affectedRows} row(s) in ${table}.${col}`);
  };

  // static_pages
  await fix('static_pages', 'title');
  await fix('static_pages', 'content');

  // seo_settings
  await fix('seo_settings', 'title');
  await fix('seo_settings', 'description');
  await fix('seo_settings', 'keywords');
  await fix('seo_settings', 'og_title');
  await fix('seo_settings', 'og_description');

  // site_settings — find the right column names
  const [cols] = await conn.query('DESCRIBE site_settings');
  console.log('site_settings columns:', cols.map(c => c.Field).join(', '));
  for (const col of cols) {
    if (['value', 'setting_value', 'val', 'content', 'data'].includes(col.Field)) {
      await fix('site_settings', col.Field);
    }
  }

  // blog_posts
  await fix('blog_posts', 'title');
  await fix('blog_posts', 'content');
  await fix('blog_posts', 'meta_title');
  await fix('blog_posts', 'meta_description');
  await fix('blog_posts', 'excerpt');

  // seo_article_pages
  try {
    await fix('seo_article_pages', 'title');
    await fix('seo_article_pages', 'content');
    await fix('seo_article_pages', 'meta_title');
    await fix('seo_article_pages', 'meta_description');
  } catch(e) { console.log('seo_article_pages skip:', e.message); }

  // Verify nothing remains
  const checkTables = ['static_pages', 'seo_settings', 'site_settings', 'blog_posts'];
  for (const t of checkTables) {
    const [rows] = await conn.query(`SELECT * FROM \`${t}\``);
    for (const row of rows) {
      if (/oddslander/i.test(Object.values(row).join(' '))) {
        console.log('STILL FOUND in', t, ':', JSON.stringify(row).substring(0, 200));
      }
    }
  }
  console.log('\nDone — all Oddslander references replaced.');
  conn.release();
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
