const slugify = require('slugify');

function generatePredictionSlug(homeTeam, awayTeam, matchDate) {
  const date = new Date(matchDate).toISOString().split('T')[0];
  const base = `${homeTeam}-vs-${awayTeam}-${date}`;
  return slugify(base, { lower: true, strict: true });
}

function generateBlogSlug(title) {
  return slugify(title, { lower: true, strict: true });
}

function formatOdds(odds) {
  if (!odds) return 'N/A';
  return parseFloat(odds).toFixed(2);
}

function paginate(total, page, limit) {
  const totalPages = Math.ceil(total / limit);
  return {
    total,
    page,
    limit,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

function parsePagination(query) {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

function successResponse(res, data, message = 'Success', statusCode = 200) {
  return res.status(statusCode).json({ success: true, message, data });
}

function errorResponse(res, message = 'An error occurred', statusCode = 400, errors = null) {
  const body = { success: false, message };
  if (errors) body.errors = errors;
  return res.status(statusCode).json(body);
}

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function sanitiseText(input) {
  if (typeof input !== 'string') return input;
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

function formatDateTime(dt) {
  if (!dt) return null;
  return new Date(dt).toISOString();
}

function clamp(val, min, max) {
  return Math.min(max, Math.max(min, val));
}

module.exports = {
  generatePredictionSlug,
  generateBlogSlug,
  formatOdds,
  paginate,
  parsePagination,
  successResponse,
  errorResponse,
  asyncHandler,
  sanitiseText,
  formatDateTime,
  clamp,
};
