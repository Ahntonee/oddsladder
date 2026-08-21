const router = require('express').Router();
const ctrl = require('../controllers/statistics');

router.get('/teams/highest-scoring', ctrl.teamsHighestScoring);
router.get('/teams/lowest-scoring', ctrl.teamsLowestScoring);
router.get('/teams/reliable', ctrl.teamsReliable);
router.get('/teams/effective', ctrl.teamsEffective);
router.get('/leagues/highest-scoring', ctrl.leaguesHighestScoring);
router.get('/leagues/lowest-scoring', ctrl.leaguesLowestScoring);
router.get('/leagues/reliable', ctrl.leaguesReliable);
router.get('/leagues/effective', ctrl.leaguesEffective);
router.get('/markets/reliable', ctrl.marketsReliable);
router.get('/markets/cross', ctrl.marketsCross);
router.get('/summary', ctrl.summary);

router.get('/accuracy/summary', ctrl.accuracySummary);
router.get('/accuracy/by-market', ctrl.accuracyByMarket);
router.get('/accuracy/by-confidence', ctrl.accuracyByConfidence);
router.get('/accuracy/by-tip', ctrl.accuracyByTip);
router.get('/accuracy/by-league-market', ctrl.accuracyByLeagueMarket);
router.get('/accuracy/calibration', ctrl.accuracyCalibration);
router.get('/accuracy/frequency', ctrl.predictionFrequency);
router.get('/accuracy/leagues', ctrl.accuracyLeagues);

module.exports = router;
