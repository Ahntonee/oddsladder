const router = require('express').Router();
const ctrl = require('../controllers/subscriptions');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.get('/status', authenticate, ctrl.getStatus);
router.post('/paystack/verify', authenticate, ctrl.paystackVerify);
router.post('/cancel', authenticate, ctrl.cancel);
router.post('/admin/grant', authenticate, requireAdmin, ctrl.adminGrant);
router.get('/admin', authenticate, requireAdmin, ctrl.adminList);
router.put('/admin/:id/extend', authenticate, requireAdmin, ctrl.adminExtend);
router.put('/admin/:id/cancel', authenticate, requireAdmin, ctrl.adminCancel);
router.post('/admin/:id/notify-expiry', authenticate, requireAdmin, ctrl.adminNotifyExpiry);

module.exports = router;
