const express = require('express');
const {
  register,
  verifyEmail,
  login,
  getCurrentUser,
  logout,
  forgotPassword,
  resetPassword
} = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authRateLimiter } = require('../middleware/rateLimiter.middleware');

const router = express.Router();

// Public routes with rate limiting on sensitive authentication operations
router.post('/register', authRateLimiter, register);
router.get('/verify-email', verifyEmail);
router.post('/login', authRateLimiter, login);
router.post('/logout', logout);
router.post('/forgot-password', authRateLimiter, forgotPassword);
router.post('/reset-password', resetPassword);

// Protected routes
router.get('/me', authenticate, getCurrentUser);

module.exports = router;
