const express = require('express');
const {
  createPaymentOrder,
  verifyPaymentAndCreateOrder,
  generateDevPayment,
  getUserOrders,
  getUserOrderById
} = require('../controllers/order.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

// All customer order endpoints require authentication
router.use(authenticate);

// Payment Flow Endpoints
router.post('/payment/create', createPaymentOrder);
router.post('/payment/verify', verifyPaymentAndCreateOrder);

// Dev / Sandbox Simulator Helpers (Non-Production Only)
if (process.env.NODE_ENV !== 'production') {
  router.post('/payment/generate-test-payment', generateDevPayment);
  router.post('/payment/dev-payment', generateDevPayment);
}

// Customer Order History & Tracking
router.get('/', getUserOrders);
router.get('/:id', getUserOrderById);

module.exports = router;

