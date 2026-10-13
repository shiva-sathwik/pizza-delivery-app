const express = require('express');
const { adminLogin, adminTest } = require('../controllers/admin.controller');
const { getAdminAnalytics, testInventoryAlert } = require('../controllers/analytics.controller');
const { authenticate, requireAdmin } = require('../middleware/auth.middleware');
const { authRateLimiter } = require('../middleware/rateLimiter.middleware');

const router = express.Router();

// Admin Login endpoint with rate limiting
router.post('/login', authRateLimiter, adminLogin);

// Protected Admin Authorization Test endpoint
router.get('/test', authenticate, requireAdmin, adminTest);

// Step 8: Admin Analytics Endpoint (daily, weekly [Mon-Sun], monthly)
router.get('/analytics', authenticate, requireAdmin, getAdminAnalytics);

// Step 8: Manual Test Alert Endpoint (Non-mutating, development-only)
if (process.env.NODE_ENV !== 'production') {
  router.post('/inventory/test-alert', authenticate, requireAdmin, testInventoryAlert);
}

module.exports = router;

