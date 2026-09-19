// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/db');
const healthRoutes = require('./routes/health.routes');
const authRoutes = require('./routes/auth.routes');
const adminRoutes = require('./routes/admin.routes');

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// Connect to MongoDB
connectDB();

// Middleware: Enable CORS for React frontend with credentials
app.use(cors({
  origin: CLIENT_URL,
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

// Root route welcome message
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to the Pizza Delivery & Inventory Management API',
    healthCheck: '/api/health',
    authEndpoints: '/api/auth',
    adminEndpoints: '/api/admin'
  });
});

// Start Express Server
app.listen(PORT, () => {
  console.log(`[Server] Server is running on port ${PORT}`);
  console.log(`[Server] Health check available at: http://localhost:${PORT}/api/health`);
  console.log(`[Server] Auth routes registered at: http://localhost:${PORT}/api/auth`);
  console.log(`[Server] Admin routes registered at: http://localhost:${PORT}/api/admin`);
  console.log(`[Server] Accepting CORS requests from: ${CLIENT_URL}`);
});

module.exports = app;
