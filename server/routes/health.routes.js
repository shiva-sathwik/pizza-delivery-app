const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();

/**
 * @route   GET /api/health
 * @desc    Check API and Database health status
 * @access  Public
 */
router.get('/health', (req, res) => {
  const dbStates = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };

  const dbState = mongoose.connection.readyState;
  const dbStatus = dbStates[dbState] || 'unknown';

  res.status(200).json({
    success: true,
    message: 'Pizza Delivery & Inventory Management API is running',
    status: 'online',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    database: {
      status: dbStatus,
      connected: dbState === 1
    }
  });
});

module.exports = router;
