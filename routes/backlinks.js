const router = require('express').Router();
const { pool } = require('../config/db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { successResponse, errorResponse, asyncHandler } = require('../utils/helpers');

// Public: list active, non-expired backlinks for footer
router.get('/public', asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT id, keyword, url, site_name, category
     FROM backlinks
     WHERE is_active = 1
       AND (expires_at IS NULL OR expires_at >= CURDATE())
     ORDER BY created_at DESC`
  );
  return successResponse(res, { backlinks: rows });
}));

// Admin: list all
router.get('/', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT *, DATEDIFF(expires_at, CURDATE()) AS days_left FROM backlinks ORDER BY created_at DESC`
  );
  return successResponse(res, { backlinks: rows });
}));

// Admin: create
router.post('/', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const { keyword, url, site_name, category, expires_at } = req.body;
  if (!keyword || !url) return errorResponse(res, 'Keyword and URL are required');
  const [r] = await pool.query(
    `INSERT INTO backlinks (keyword, url, site_name, category, expires_at) VALUES (?, ?, ?, ?, ?)`,
    [keyword, url, site_name || null, category || 'general', expires_at || null]
  );
  return successResponse(res, { id: r.insertId }, 'Backlink added');
}));

// Admin: update
router.put('/:id', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const { keyword, url, site_name, category, expires_at, is_active } = req.body;
  await pool.query(
    `UPDATE backlinks SET keyword=?, url=?, site_name=?, category=?, expires_at=?, is_active=? WHERE id=?`,
    [keyword, url, site_name || null, category || 'general', expires_at || null, is_active !== undefined ? is_active : 1, req.params.id]
  );
  return successResponse(res, null, 'Backlink updated');
}));

// Admin: renew (extend expires_at by N days)
router.post('/:id/renew', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const { days = 30 } = req.body;
  await pool.query(
    `UPDATE backlinks SET expires_at = DATE_ADD(GREATEST(COALESCE(expires_at, CURDATE()), CURDATE()), INTERVAL ? DAY) WHERE id=?`,
    [parseInt(days), req.params.id]
  );
  return successResponse(res, null, `Renewed for ${days} days`);
}));

// Admin: delete
router.delete('/:id', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  await pool.query('DELETE FROM backlinks WHERE id=?', [req.params.id]);
  return successResponse(res, null, 'Backlink deleted');
}));

module.exports = router;
