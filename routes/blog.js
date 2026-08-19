const router = require('express').Router();
const ctrl = require('../controllers/blog');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.get('/', ctrl.list);
router.get('/:slug', ctrl.getBySlug);
router.post('/admin', authenticate, requireAdmin, ctrl.create);
router.put('/admin/:id', authenticate, requireAdmin, ctrl.update);
router.delete('/admin/:id', authenticate, requireAdmin, ctrl.remove);
router.post('/admin/:id/publish', authenticate, requireAdmin, ctrl.publish);
router.post('/admin/upload-image', authenticate, requireAdmin, ctrl.uploadImage);

module.exports = router;
