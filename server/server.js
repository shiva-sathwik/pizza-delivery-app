// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const healthRoutes = require('./routes/health.routes');
const authRoutes = require('./routes/auth.routes');
const adminRoutes = require('./routes/admin.routes');
const pizzaRoutes = require('./routes/pizza.routes');
const cartRoutes = require('./routes/cart.routes');
const inventoryRoutes = require('./routes/inventory.routes');
const orderRoutes = require('./routes/order.routes');
const adminOrderRoutes = require('./routes/admin.order.routes');
const inventoryAlertCron = require('./utils/inventoryAlertCron');

const app = express();
const PORT = process.env.PORT || 5000;

// Normalize CLIENT_URL by trimming whitespace and removing trailing slashes
const rawClientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
const CLIENT_URL = rawClientUrl.trim().replace(/\/+$/, '');

// Configure Express reverse-proxy trust for 1 hop (Render, Railway, Heroku, AWS ALB, Nginx)
// Enables correct client IP resolution for rate limiters and req.secure identification for HTTPS cookies
app.set('trust proxy', 1);

// Security Middleware: Helmet with safe cross-origin resource sharing
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false // Disabled for REST API server to prevent interference with cross-origin clients and Razorpay SDK
  })
);

// Middleware: Enable CORS strictly restricted to configured frontend origin with credentials
app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests without Origin header (e.g. server-to-server, curl, health probes)
    if (!origin) return callback(null, true);

    const normalizedOrigin = origin.trim().replace(/\/+$/, '');
    if (normalizedOrigin === CLIENT_URL) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  credentials: true
}));

// Middleware: Parse incoming JSON requests and cookies
app.use(express.json());
app.use(cookieParser());

// API Routes
app.use('/api', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/pizzas', pizzaRoutes);
app.use('/api/admin/pizzas', pizzaRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin/orders', adminOrderRoutes);

// Root route welcome message
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to the Pizza Delivery & Inventory Management API',
    healthCheck: '/api/health',
    authEndpoints: '/api/auth',
    adminEndpoints: '/api/admin',
    pizzaEndpoints: '/api/pizzas',
    cartEndpoints: '/api/cart',
    inventoryEndpoints: '/api/inventory',
    orderEndpoints: '/api/orders',
    adminOrderEndpoints: '/api/admin/orders'
  });
});

// Import Centralized Error & 404 Handlers
const { notFoundHandler, errorHandler } = require('./middleware/error.middleware');

// JSON 404 Catch-All for undefined API routes
app.use('/api', notFoundHandler);

// Centralized Express Error-Handling Middleware
app.use(errorHandler);

// Variable to store the running HTTP server instance for graceful shutdown
let server = null;
let isShuttingDown = false;
let shutdownTimer = null;

const DEFAULT_SHUTDOWN_TIMEOUT_MS = 10000;

// Graceful HTTP Server Shutdown
const handleGracefulShutdown = async (signal = 'SIGTERM', exitCode = 0, timeoutMs = DEFAULT_SHUTDOWN_TIMEOUT_MS) => {
  if (isShuttingDown) {
    console.warn(`[Server] Shutdown already in progress. Ignoring duplicate signal: ${signal}`);
    return;
  }
  isShuttingDown = true;
  console.log(`[Server] Received ${signal}. Starting graceful shutdown with exit code ${exitCode}...`);

  // Active watchdog timer: forces process termination if cleanup hangs
  // Not relying on unref alone; this timer actively guarantees termination
  shutdownTimer = setTimeout(() => {
    console.error(`[Server] CRITICAL: Graceful shutdown timed out after ${timeoutMs / 1000}s. Forcing process exit.`);
    process.exit(1);
  }, timeoutMs);

  // 1. Stop background scheduled jobs
  try {
    inventoryAlertCron.stopInventoryAlertCron();
  } catch (cronErr) {
    console.error('[Server] Error stopping inventory alert cron:', cronErr.message);
  }

  // Cleanup helper to close MongoDB and exit
  const closeDatabaseAndExit = async () => {
    try {
      if (mongoose.connection && mongoose.connection.readyState !== 0) {
        await mongoose.connection.close(false);
        console.log('[Server] MongoDB connection closed.');
      }
    } catch (dbErr) {
      console.error('[Server] Error closing MongoDB connection:', dbErr.message);
    } finally {
      if (shutdownTimer) {
        clearTimeout(shutdownTimer);
        shutdownTimer = null;
      }
      process.exit(exitCode);
    }
  };

  // 2. Stop HTTP server from accepting new requests, then close MongoDB
  if (server) {
    server.close(async (err) => {
      if (err) {
        console.error('[Server] Error closing HTTP server:', err.message);
      } else {
        console.log('[Server] HTTP server closed.');
      }
      await closeDatabaseAndExit();
    });
  } else {
    await closeDatabaseAndExit();
  }
};

/**
 * Registers process-level resilience handlers.
 * Executed ONLY when server.js is run directly, preventing pollution of test runners.
 */
const registerFatalProcessHandlers = () => {
  process.on('unhandledRejection', (reason) => {
    const errorMsg = reason instanceof Error ? reason.message : String(reason);
    console.error(`[Process] FATAL: Unhandled Promise Rejection: ${errorMsg}`);
    handleGracefulShutdown('unhandledRejection', 1);
  });

  process.on('uncaughtException', (error) => {
    console.error(`[Process] FATAL: Uncaught Exception: ${error.message}`);
    // Best-effort cleanup and termination with exit code 1; do not resume normal request handling
    handleGracefulShutdown('uncaughtException', 1);
  });

  process.once('SIGINT', () => handleGracefulShutdown('SIGINT', 0));
  process.once('SIGTERM', () => handleGracefulShutdown('SIGTERM', 0));
};

/**
 * Asynchronous Server Initialization Function
 * Awaits MongoDB connection before starting the HTTP server and background cron jobs.
 */
const startServer = async () => {
  try {
    // 1. Await database connection before accepting traffic
    const conn = await connectDB();
    if (!conn) {
      console.error('[Server] CRITICAL: Database connection failed. HTTP server startup aborted.');
      process.exit(1);
    }

    // 2. Initialize automated low-stock inventory alert cron after DB connection is established
    inventoryAlertCron.startInventoryAlertCron();

    // 3. Start Express HTTP Server
    server = app.listen(PORT, () => {
      console.log(`[Server] Server is running on port ${PORT}`);
      console.log(`[Server] Health check available at: http://localhost:${PORT}/api/health`);
      console.log(`[Server] Auth routes registered at: http://localhost:${PORT}/api/auth`);
      console.log(`[Server] Admin routes registered at: http://localhost:${PORT}/api/admin`);
      console.log(`[Server] Inventory routes registered at: http://localhost:${PORT}/api/inventory`);
      console.log(`[Server] Order routes registered at: http://localhost:${PORT}/api/orders`);
      console.log(`[Server] Admin Order routes registered at: http://localhost:${PORT}/api/admin/orders`);
      console.log(`[Server] Accepting CORS requests from: ${CLIENT_URL}`);
    });
  } catch (error) {
    console.error('[Server] CRITICAL: Unexpected error during server initialization:', error.message);
    process.exit(1);
  }
};

// Start Server when executed directly (node server.js or npm start / dev)
if (require.main === module) {
  registerFatalProcessHandlers();
  startServer();
}

// Testing hooks attached to app object for isolated verification without side effects
app.handleGracefulShutdown = handleGracefulShutdown;
app.getIsShuttingDown = () => isShuttingDown;
app.getIsServerRunning = () => Boolean(server && server.listening);
app.setServerInstanceForTesting = (mockServer) => {
  server = mockServer;
};
app.resetShutdownStateForTesting = () => {
  isShuttingDown = false;
  if (shutdownTimer) {
    clearTimeout(shutdownTimer);
    shutdownTimer = null;
  }
};

module.exports = app;

