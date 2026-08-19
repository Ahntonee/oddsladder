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

module.exports = router;
