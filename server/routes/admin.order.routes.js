const express = require('express');
const {
  getAdminOrders,
  getAdminOrderById,
  updateOrderStatus
} = require('../controllers/order.controller');
const { authenticate, requireAdmin } = require('../middleware/auth.middleware');

const router = express.Router();

// All admin order endpoints require administrator authorization
router.use(authenticate, requireAdmin);

// Order list and detail
router.get('/', getAdminOrders);
router.get('/:id', getAdminOrderById);

// Order status progression
router.patch('/:id/status', updateOrderStatus);

module.exports = router;
