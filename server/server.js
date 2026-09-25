// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/db');
const healthRoutes = require('./routes/health.routes');
const authRoutes = require('./routes/auth.routes');
const adminRoutes = require('./routes/admin.routes');
const pizzaRoutes = require('./routes/pizza.routes');
const cartRoutes = require('./routes/cart.routes');
const inventoryRoutes = require('./routes/inventory.routes');
const orderRoutes = require('./routes/order.routes');
const adminOrderRoutes = require('./routes/admin.order.routes');
const { startInventoryAlertCron } = require('./utils/inventoryAlertCron');

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// Connect to MongoDB
connectDB();

// Initialize automated low-stock inventory alert cron
startInventoryAlertCron();

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
app.use('/api/pizzas', pizzaRoutes);
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

// Start Express Server
app.listen(PORT, () => {
  console.log(`[Server] Server is running on port ${PORT}`);
  console.log(`[Server] Health check available at: http://localhost:${PORT}/api/health`);
  console.log(`[Server] Auth routes registered at: http://localhost:${PORT}/api/auth`);
  console.log(`[Server] Admin routes registered at: http://localhost:${PORT}/api/admin`);
  console.log(`[Server] Inventory routes registered at: http://localhost:${PORT}/api/inventory`);
  console.log(`[Server] Order routes registered at: http://localhost:${PORT}/api/orders`);
  console.log(`[Server] Admin Order routes registered at: http://localhost:${PORT}/api/admin/orders`);
  console.log(`[Server] Accepting CORS requests from: ${CLIENT_URL}`);
});

module.exports = app;
