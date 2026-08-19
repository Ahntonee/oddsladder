const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const ctrl = require('../controllers/auth');
const { validateRegister, validateVerification, validateLogin } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { body } = require('express-validator');
const { handleValidation } = require('../middleware/validate');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many requests, try again later.' },
  standardHeaders: true, legacyHeaders: false,
});

router.post('/register', authLimiter, validateRegister, ctrl.initiateRegister);
router.post('/register/verify', authLimiter, validateVerification, ctrl.verifyRegistration);
router.post('/login', authLimiter, validateLogin, ctrl.login);
router.post('/logout', ctrl.logout);
router.get('/me', authenticate, ctrl.me);
router.post('/forgot-password', authLimiter,
  body('email').trim().isEmail().normalizeEmail(), handleValidation,
  ctrl.forgotPassword);
router.post('/reset-password',
  body('token').notEmpty(), body('password').isLength({ min: 8 }).matches(/[A-Z]/).matches(/[0-9]/).matches(/[^A-Za-z0-9]/), handleValidation,
  ctrl.resetPassword);
router.post('/change-password', authenticate,
  body('current_password').notEmpty(), body('new_password').isLength({ min: 8 }).matches(/[A-Z]/).matches(/[0-9]/).matches(/[^A-Za-z0-9]/), handleValidation,
  ctrl.changePassword);

module.exports = router;
