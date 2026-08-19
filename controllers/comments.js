const { pool } = require('../config/db');
const { successResponse, errorResponse, asyncHandler, sanitiseText } = require('../utils/helpers');

exports.list = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT c.id, c.content, c.created_at, u.name as user_name
     FROM comments c JOIN users u ON u.id=c.user_id
     WHERE c.prediction_id=? AND c.is_approved=1 ORDER BY c.created_at ASC`,
    [req.params.predictionId]
  );
  return successResponse(res, { comments: rows });
});

exports.create = asyncHandler(async (req, res) => {
  const { content } = req.body;
  if (!content?.trim()) return errorResponse(res, 'Comment cannot be empty', 400);
  const safe = sanitiseText(content.trim().slice(0, 1000));
  await pool.query(
    'INSERT INTO comments (prediction_id, user_id, content) VALUES (?,?,?)',
    [req.params.predictionId, req.user.id, safe]
  );
  return successResponse(res, null, 'Comment added', 201);
});

exports.remove = asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT user_id FROM comments WHERE id=?', [req.params.id]);
  if (!rows.length) return errorResponse(res, 'Not found', 404);
  if (rows[0].user_id !== req.user.id && req.user.role !== 'admin') {
    return errorResponse(res, 'Forbidden', 403);
  }
  await pool.query('DELETE FROM comments WHERE id=?', [req.params.id]);
  return successResponse(res, null, 'Comment deleted');
});
