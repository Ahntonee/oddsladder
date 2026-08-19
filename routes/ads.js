const router = require('express').Router();
const { pool } = require('../config/db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { successResponse, errorResponse, asyncHandler } = require('../utils/helpers');

// Public: get active ads for a position
router.get('/position/:pos', asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT id, name, type, position, code, image_url, link_url, alt_text, width, height
     FROM ads
     WHERE is_active = 1
       AND position = ?
       AND (starts_at IS NULL OR starts_at <= NOW())
       AND (ends_at IS NULL OR ends_at >= NOW())
     ORDER BY created_at DESC`,
    [req.params.pos]
  );
  // Track impression
  if (rows.length) {
    const ids = rows.map(r => r.id);
    pool.query(`UPDATE ads SET impressions = impressions + 1 WHERE id IN (${ids.map(()=>'?').join(',')})`, ids).catch(()=>{});
  }
  return successResponse(res, { ads: rows });
}));

// Public: track click
router.post('/:id/click', asyncHandler(async (req, res) => {
  await pool.query('UPDATE ads SET clicks = clicks + 1 WHERE id = ?', [req.params.id]);
  return successResponse(res, null, 'Tracked');
}));

// Admin: list all ads
router.get('/', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM ads ORDER BY created_at DESC');
  return successResponse(res, { ads: rows });
}));

// Admin: create
router.post('/', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const { name, type, position, code, image_url, link_url, alt_text, width, height, is_active, starts_at, ends_at } = req.body;
  if (!name || !position) return errorResponse(res, 'Name and position are required');
  const [r] = await pool.query(
    `INSERT INTO ads (name, type, position, code, image_url, link_url, alt_text, width, height, is_active, starts_at, ends_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, type||'banner', position, code||null, image_url||null, link_url||null, alt_text||null, width||null, height||null, is_active!==false?1:0, starts_at||null, ends_at||null]
  );
  return successResponse(res, { id: r.insertId }, 'Ad created');
}));

// Admin: update
router.put('/:id', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const { name, type, position, code, image_url, link_url, alt_text, width, height, is_active, starts_at, ends_at } = req.body;
  await pool.query(
    `UPDATE ads SET name=?, type=?, position=?, code=?, image_url=?, link_url=?, alt_text=?, width=?, height=?, is_active=?, starts_at=?, ends_at=? WHERE id=?`,
    [name, type||'banner', position, code||null, image_url||null, link_url||null, alt_text||null, width||null, height||null, is_active!==false?1:0, starts_at||null, ends_at||null, req.params.id]
  );
  return successResponse(res, null, 'Ad updated');
}));

// Admin: toggle active
router.post('/:id/toggle', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  await pool.query('UPDATE ads SET is_active = NOT is_active WHERE id=?', [req.params.id]);
  return successResponse(res, null, 'Toggled');
}));

// Admin: delete
router.delete('/:id', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  await pool.query('DELETE FROM ads WHERE id=?', [req.params.id]);
  return successResponse(res, null, 'Ad deleted');
}));

module.exports = router;
