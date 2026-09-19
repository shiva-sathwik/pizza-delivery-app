const express = require('express');
const { adminLogin, adminTest } = require('../controllers/admin.controller');
const { authenticate, requireAdmin } = require('../middleware/auth.middleware');

const router = express.Router();

// Admin Login endpoint
router.post('/login', adminLogin);

// Protected Admin Authorization Test endpoint
router.get('/test', authenticate, requireAdmin, adminTest);

module.exports = router;
