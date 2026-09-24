const express = require('express');
const {
  getInventory,
  getInventoryByCategory,
  updateInventoryItem,
  createInventoryItem
} = require('../controllers/inventory.controller');
const { authenticate, requireAdmin } = require('../middleware/auth.middleware');

const router = express.Router();

// Step 6: All inventory routes strictly require authenticated administrator access
router.use(authenticate, requireAdmin);

// Inventory retrieval routes
router.get('/', getInventory);
router.get('/:category', getInventoryByCategory);

// Inventory update routes
router.put('/:id', updateInventoryItem);
router.patch('/:id', updateInventoryItem);

// Inventory creation route
router.post('/', createInventoryItem);

module.exports = router;
