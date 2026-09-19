const mongoose = require('mongoose');

/**
 * Connect to MongoDB database via Mongoose
 */
const connectDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/pizza-delivery-app';

  try {
    const conn = await mongoose.connect(uri);
    console.log(`[Database] MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`[Database] MongoDB connection error: ${error.message}`);
    console.warn('[Database] The server is continuing to run, but database features will be unavailable until MongoDB is connected.');
  }
};

module.exports = connectDB;
