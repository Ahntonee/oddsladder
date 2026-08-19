const router = require('express').Router();
const ctrl = require('../controllers/tokens');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);
router.get('/balance', ctrl.getBalance);
router.get('/checkin', ctrl.getCheckinStatus);
router.post('/checkin', ctrl.checkin);
router.get('/transactions', ctrl.getTransactions);
router.post('/bet', ctrl.placeBet);
router.get('/bets', ctrl.getUserBets);
router.get('/bets/prediction/:predictionId', ctrl.getPredictionBets);

module.exports = router;
