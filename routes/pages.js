const router = require('express').Router();
const ctrl = require('../controllers/pages');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.get('/', ctrl.listPages);
router.get('/social-links', ctrl.getSocialLinks);
router.put('/social-links', authenticate, requireAdmin, ctrl.updateSocialLinks);
router.get('/:slug', ctrl.getPage);
router.put('/:slug', authenticate, requireAdmin, ctrl.updatePage);

module.exports = router;
