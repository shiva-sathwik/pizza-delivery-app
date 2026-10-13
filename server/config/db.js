const mongoose = require('mongoose');

/**
 * Connect to MongoDB database via Mongoose
 * Step 9B: Improved connection resilience and production failure handling
 */
const connectDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/pizza-delivery-app';

  try {
    const conn = await mongoose.connect(uri);
    console.log(`[Database] MongoDB connected successfully: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    // Sanitize credentials from connection string before logging
    const sanitizedUri = uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:*****@');
    console.error(`[Database] CRITICAL: Failed to connect to MongoDB at "${sanitizedUri}": ${error.message}`);

    // In production, do not run a zombie server that cannot perform database queries
    if (process.env.NODE_ENV === 'production') {
      console.error('[Database] Server terminating in production due to lack of database connectivity.');
      process.exit(1);
    }

    // In development/test mode, notify developer clearly
    console.warn('[Database] (Development Notice) The server is continuing in degraded mode. Database operations will fail until MongoDB is accessible.');
    return null;
  }
};

module.exports = connectDB;
