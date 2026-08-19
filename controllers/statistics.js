const { successResponse, asyncHandler } = require('../utils/helpers');
const svc = require('../services/statistics');

exports.teamsHighestScoring = asyncHandler(async (req, res) => {
  const data = await svc.getHighestScoringTeams(parseInt(req.query.limit) || 20);
  return successResponse(res, { teams: data });
});

exports.teamsLowestScoring = asyncHandler(async (req, res) => {
  const data = await svc.getLowestScoringTeams(parseInt(req.query.limit) || 20);
  return successResponse(res, { teams: data });
});

exports.teamsReliable = asyncHandler(async (req, res) => {
  const data = await svc.getMostReliableTeamsByMarket(req.query.market || 'Over/Under', parseInt(req.query.limit) || 20);
  return successResponse(res, { teams: data });
});

exports.teamsEffective = asyncHandler(async (req, res) => {
  const data = await svc.getMostEffectivePredictionsByTeam(req.query.team || '');
  return successResponse(res, { results: data });
});

exports.leaguesHighestScoring = asyncHandler(async (req, res) => {
  const data = await svc.getHighestScoringLeagues(parseInt(req.query.limit) || 20);
  return successResponse(res, { leagues: data });
});

exports.leaguesLowestScoring = asyncHandler(async (req, res) => {
  const data = await svc.getLowestScoringLeagues(parseInt(req.query.limit) || 20);
  return successResponse(res, { leagues: data });
});

exports.leaguesReliable = asyncHandler(async (req, res) => {
  const data = await svc.getMostReliableLeaguesByMarket(req.query.market || 'Over/Under', parseInt(req.query.limit) || 20);
  return successResponse(res, { leagues: data });
});

exports.leaguesEffective = asyncHandler(async (req, res) => {
  const data = await svc.getMostEffectivePredictionsByLeague(parseInt(req.query.league_id));
  return successResponse(res, { results: data });
});

exports.marketsReliable = asyncHandler(async (req, res) => {
  const data = await svc.getMostReliableMarkets();
  return successResponse(res, { markets: data });
});

exports.marketsCross = asyncHandler(async (req, res) => {
  const data = await svc.getCrossMarketLeagueStats();
  return successResponse(res, { data });
});

exports.summary = asyncHandler(async (req, res) => {
  const data = await svc.getSummary();
  return successResponse(res, data);
});
