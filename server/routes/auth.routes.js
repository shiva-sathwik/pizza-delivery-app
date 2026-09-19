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

const router = express.Router();

// Public routes
router.post('/register', register);
router.get('/verify-email', verifyEmail);
router.post('/login', login);
router.post('/logout', logout);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Protected routes
router.get('/me', authenticate, getCurrentUser);

module.exports = router;
