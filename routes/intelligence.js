const router = require('express').Router();
const ctrl = require('../controllers/intelligence');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.use(authenticate, requireAdmin);

router.get('/status', ctrl.getStatus);
router.get('/weights', ctrl.getWeights);
router.put('/weights', ctrl.updateWeights);
router.get('/queue', ctrl.getQueue);
router.put('/queue/:id/approve', ctrl.approveQueue);
router.put('/queue/:id/reject', ctrl.rejectQueue);
router.get('/patterns', ctrl.getPatterns);
router.get('/performance', ctrl.getPerformance);
router.post('/run', ctrl.runEngine);
router.post('/daily-specials', ctrl.runSpecials);
router.post('/backtest', ctrl.runBacktest);
router.get('/backtest/summary', ctrl.getBacktestSummary);

module.exports = router;
