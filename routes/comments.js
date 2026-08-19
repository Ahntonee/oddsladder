const router = require('express').Router({ mergeParams: true });
const ctrl = require('../controllers/comments');
const { authenticate } = require('../middleware/auth');

router.get('/:predictionId', ctrl.list);
router.post('/:predictionId', authenticate, ctrl.create);
router.delete('/:id', authenticate, ctrl.remove);

module.exports = router;
