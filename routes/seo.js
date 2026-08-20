const router = require('express').Router();
const { pool } = require('../config/db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { successResponse, errorResponse, asyncHandler } = require('../utils/helpers');

const SEO_DEFAULTS = {
  home:        ['Predictvilla — Football Intelligence Predictions', 'Data-driven football predictions with an AI-powered Intelligence Engine. Free and VIP tips daily.', 'football predictions, free tips, VIP picks, banker of the day'],
  predictions: ['Football Predictions & Tips — Predictvilla', "Browse today's free and VIP football predictions. Filter by league, market, or category.", 'football tips today, free predictions, over 2.5 tips'],
  statistics:  ['Football Statistics & Analytics — Predictvilla', 'Front-tested football statistics: scoring averages, market reliability, and prediction track records.', 'football statistics, prediction accuracy, market analysis'],
  blog:        ['Football Blog — Predictvilla', 'Football analysis, betting guides, and expert insights from the Predictvilla team.', 'football blog, betting tips, match analysis'],
  pricing:     ['VIP Subscription — Predictvilla', 'Unlock VIP football tips, AI-powered picks, and access to the Telegram VIP channel.', 'VIP football tips, subscription, premium predictions'],
  about:       ['About Predictvilla', "Learn about Predictvilla's AI-powered football prediction platform.", 'about predictvilla, football prediction platform'],
  contact:     ['Contact Predictvilla', 'Get in touch with the Predictvilla team.', 'contact predictvilla'],
  terms:       ['Terms of Service — Predictvilla', 'Predictvilla terms of service and usage policy.', ''],
  privacy:     ['Privacy Policy — Predictvilla', 'Predictvilla privacy policy and data handling practices.', ''],
};

// GET all SEO settings
router.get('/', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  // Discover what columns exist
  const [colRows] = await pool.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'seo_settings'`
  );
  const existing = new Set(colRows.map(c => c.COLUMN_NAME.toLowerCase()));

  // Add missing OG columns one by one
  if (!existing.has('og_title'))       await pool.query(`ALTER TABLE seo_settings ADD COLUMN og_title VARCHAR(255) DEFAULT NULL`);
  if (!existing.has('og_description')) await pool.query(`ALTER TABLE seo_settings ADD COLUMN og_description TEXT DEFAULT NULL`);
  if (!existing.has('og_image'))       await pool.query(`ALTER TABLE seo_settings ADD COLUMN og_image VARCHAR(500) DEFAULT NULL`);

  // Seed defaults if table is empty
  const [[{ cnt }]] = await pool.query('SELECT COUNT(*) as cnt FROM seo_settings');
  if (cnt === 0) {
    for (const [page, [title, desc, keywords]] of Object.entries(SEO_DEFAULTS)) {
      await pool.query(
        `INSERT IGNORE INTO seo_settings (page_key, title, description, keywords) VALUES (?, ?, ?, ?)`,
        [page, title, desc, keywords]
      );
    }
  }

  const [rows] = await pool.query(
    `SELECT id, page_key,
            title AS meta_title,
            description AS meta_description,
            keywords,
            og_title, og_description, og_image
     FROM seo_settings ORDER BY page_key`
  );
  return successResponse(res, { seo: rows });
}));

// PUT update a single SEO entry
router.put('/:id', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const { meta_title, meta_description, keywords, og_title, og_description, og_image } = req.body;
  const [rows] = await pool.query('SELECT id FROM seo_settings WHERE id = ?', [req.params.id]);
  if (!rows.length) return errorResponse(res, 'SEO entry not found', 404);
  await pool.query(
    `UPDATE seo_settings SET title=?, description=?, keywords=?, og_title=?, og_description=?, og_image=? WHERE id=?`,
    [meta_title || null, meta_description || null, keywords || null, og_title || null, og_description || null, og_image || null, req.params.id]
  );
  return successResponse(res, null, 'SEO settings saved');
}));

module.exports = router;
