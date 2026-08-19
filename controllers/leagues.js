const { pool } = require('../config/db');
const { successResponse, errorResponse, asyncHandler } = require('../utils/helpers');

exports.list = asyncHandler(async (req, res) => {
  const { grouped } = req.query;
  const [rows] = await pool.query(
    'SELECT * FROM leagues WHERE is_active=1 ORDER BY is_popular DESC, continent, name'
  );
  if (grouped) {
    const grouped = {};
    for (const r of rows) {
      const key = r.continent || 'Other';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(r);
    }
    return successResponse(res, { leagues: grouped });
  }
  return successResponse(res, { leagues: rows });
});

exports.getOne = asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM leagues WHERE id=?', [req.params.id]);
  if (!rows.length) return errorResponse(res, 'League not found', 404);
  return successResponse(res, { league: rows[0] });
});

exports.create = asyncHandler(async (req, res) => {
  const { api_league_id, name, country, continent, logo_url, is_popular } = req.body;
  const [result] = await pool.query(
    'INSERT INTO leagues (api_league_id, name, country, continent, logo_url, is_popular) VALUES (?,?,?,?,?,?)',
    [api_league_id || null, name, country || null, continent || null, logo_url || null, is_popular ? 1 : 0]
  );
  return successResponse(res, { id: result.insertId }, 'League created', 201);
});

exports.update = asyncHandler(async (req, res) => {
  const { name, country, continent, logo_url, is_active, is_popular } = req.body;
  await pool.query(
    'UPDATE leagues SET name=?, country=?, continent=?, logo_url=?, is_active=?, is_popular=? WHERE id=?',
    [name, country, continent, logo_url, is_active ? 1 : 0, is_popular ? 1 : 0, req.params.id]
  );
  return successResponse(res, null, 'League updated');
});

exports.remove = asyncHandler(async (req, res) => {
  await pool.query('DELETE FROM leagues WHERE id=?', [req.params.id]);
  return successResponse(res, null, 'League deleted');
});
