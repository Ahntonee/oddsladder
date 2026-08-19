const router = require('express').Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const { asyncHandler, successResponse } = require('../utils/helpers');
const { syncFixtures, syncResults, syncLiveScores, autoPredictFixtures } = require('../services/apiFootball');
const { syncOddsForTodayFixtures } = require('../services/oddsApi');
const { runForAllToday } = require('../services/intelligence');
const { logUntracked, recalculateStats, autoAdjustMarketWeights } = require('../services/accuracy');
const { syncAllTeamStats, syncCornerStats, syncH2HForUpcoming, runFullHistoricalSeed } = require('../services/historicalData');
const { refreshTeamStatistics, refreshLeagueStatistics, refreshMarketStats } = require('../services/statistics');
const { gradeFinished } = require('../services/scheduler');
const { pool } = require('../config/db');

router.use(authenticate, requireAdmin);

router.post('/fixtures', asyncHandler(async (req, res) => {
  const count = await syncFixtures(0);
  return successResponse(res, { synced: count }, `Synced ${count} fixtures`);
}));

router.post('/fixtures/tomorrow', asyncHandler(async (req, res) => {
  const count = await syncFixtures(1);
  return successResponse(res, { synced: count }, `Synced ${count} tomorrow fixtures`);
}));

router.post('/results', asyncHandler(async (req, res) => {
  const count = await syncResults();
  return successResponse(res, { updated: count }, `Updated ${count} results`);
}));

router.post('/live', asyncHandler(async (req, res) => {
  const updated = await syncLiveScores();
  await gradeFinished();
  return successResponse(res, { updated }, `Live scores synced for ${updated} predictions`);
}));

router.post('/scores', asyncHandler(async (req, res) => {
  await gradeFinished();
  return successResponse(res, null, 'Scores processed');
}));

router.post('/auto-predict', asyncHandler(async (req, res) => {
  const fixtures = await autoPredictFixtures();
  const result = await runForAllToday();
  return successResponse(res, { fixtures: fixtures.length, ...result }, 'Auto-predict complete');
}));

router.post('/odds', asyncHandler(async (req, res) => {
  const updated = await syncOddsForTodayFixtures();
  return successResponse(res, { updated }, `Updated bookie odds for ${updated} predictions`);
}));

router.post('/statistics', asyncHandler(async (req, res) => {
  await refreshTeamStatistics();
  await refreshLeagueStatistics();
  await refreshMarketStats();
  return successResponse(res, null, 'Statistics refreshed');
}));

router.post('/accuracy', asyncHandler(async (req, res) => {
  const logged = await logUntracked();
  const stats = await recalculateStats();
  return successResponse(res, { logged, ...stats }, 'Accuracy stats recalculated');
}));

// ── Historical data sync ──────────────────────────────────────────────────────

router.post('/team-stats', asyncHandler(async (req, res) => {
  const result = await syncAllTeamStats();
  return successResponse(res, result,
    `Team stats synced: ${result.teams} teams across ${result.leagues} leagues`);
}));

router.post('/corner-stats', asyncHandler(async (req, res) => {
  const updated = await syncCornerStats();
  return successResponse(res, { updated }, `Corner stats updated for ${updated} teams`);
}));

router.post('/h2h', asyncHandler(async (req, res) => {
  const updated = await syncH2HForUpcoming();
  return successResponse(res, { updated }, `H2H synced for ${updated} upcoming fixtures`);
}));

router.post('/adjust-weights', asyncHandler(async (req, res) => {
  await autoAdjustMarketWeights();
  return successResponse(res, null, 'Market weights auto-adjusted from historical win rates');
}));

// Kick off in background — returns immediately with a job ID message.
// The actual work logs to console and updates site_settings when done.
router.post('/seed-historical', asyncHandler(async (req, res) => {
  const seasons = req.body?.seasons || null;
  // Don't await — runs in background so the HTTP request doesn't time out
  setImmediate(() => {
    runFullHistoricalSeed(seasons).catch(err =>
      console.error('[SeedHistorical] background error:', err.message)
    );
  });
  const desc = seasons ? seasons.join(', ') : 'current + previous season';
  return successResponse(res, { status: 'started', seasons: desc },
    `Historical seed started in background (${desc}). Check server logs for progress.`);
}));

router.get('/status', asyncHandler(async (req, res) => {
  const keys = ['last_sync_fixtures','last_sync_results','last_intelligence_run','odds_api_calls_today'];
  const [rows] = await pool.query(
    `SELECT setting_key, setting_value FROM site_settings WHERE setting_key IN (${keys.map(() => '?').join(',')})`,
    keys
  );
  const status = {};
  rows.forEach(r => { status[r.setting_key] = r.setting_value; });
  return successResponse(res, status);
}));

module.exports = router;
