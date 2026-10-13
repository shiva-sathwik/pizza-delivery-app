const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();

/**
 * Health check handler function
 * Returns HTTP 200 when database is connected, HTTP 503 when disconnected or degraded.
 */
const healthCheckHandler = (req, res) => {
  const dbStates = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };

  const dbState = mongoose.connection.readyState;
  const isConnected = dbState === 1;
  const dbStatus = dbStates[dbState] || 'unknown';

  if (!isConnected) {
    return res.status(503).json({
      success: false,
      message: 'Pizza Delivery & Inventory Management API is unhealthy: Database not connected',
      status: 'degraded',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      database: {
        status: dbStatus,
        connected: false
      }
    });
  }

  return res.status(200).json({
    success: true,
    message: 'Pizza Delivery & Inventory Management API is running',
    status: 'online',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    database: {
      status: dbStatus,
      connected: true
    }
  });
};

/**
 * @route   GET /api/health
 * @desc    Check API and Database health status
 * @access  Public
 */
router.get('/health', healthCheckHandler);

router.healthCheckHandler = healthCheckHandler;

module.exports = router;
