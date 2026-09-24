const Inventory = require('../models/Inventory');

const ALLOWED_CATEGORIES = ['base', 'sauce', 'cheese', 'vegetable'];

/**
 * @desc    Get all inventory items (optional query filtering by category)
 * @route   GET /api/inventory
 * @access  Private (Admin only)
 */
const getInventory = async (req, res) => {
  try {
    const filter = {};

    if (req.query.category) {
      const normalizedCategory = req.query.category.toLowerCase().trim();
      if (!ALLOWED_CATEGORIES.includes(normalizedCategory)) {
        return res.status(400).json({
          success: false,
          message: `Invalid category filter '${req.query.category}'. Must be one of: ${ALLOWED_CATEGORIES.join(', ')}`
        });
      }
      filter.category = normalizedCategory;
    }

    const inventory = await Inventory.find(filter).sort({ category: 1, item: 1 });

    return res.status(200).json({
      success: true,
      count: inventory.length,
      inventory
    });
  } catch (error) {
    console.error('[InventoryController] Error fetching inventory:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching inventory items'
    });
  }
};

/**
 * @desc    Get inventory items filtered by category route parameter
 * @route   GET /api/inventory/:category
 * @access  Private (Admin only)
 */
const getInventoryByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const normalizedCategory = (category || '').toLowerCase().trim();

    if (!ALLOWED_CATEGORIES.includes(normalizedCategory)) {
      return res.status(400).json({
        success: false,
        message: `Invalid category '${category}'. Must be one of: ${ALLOWED_CATEGORIES.join(', ')}`
      });
    }

    const inventory = await Inventory.find({ category: normalizedCategory }).sort({ item: 1 });

    return res.status(200).json({
      success: true,
      category: normalizedCategory,
      count: inventory.length,
      inventory
    });
  } catch (error) {
    console.error('[InventoryController] Error fetching inventory by category:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching category inventory'
    });
  }
};

/**
 * @desc    Update quantity and/or threshold of an inventory item
 * @route   PUT /api/inventory/:id, PATCH /api/inventory/:id
 * @access  Private (Admin only)
 */
const updateInventoryItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity, threshold } = req.body;

    // Validate quantity if provided
    if (quantity !== undefined) {
      if (typeof quantity !== 'number' || isNaN(quantity) || quantity < 0) {
        return res.status(400).json({
          success: false,
          message: 'Quantity cannot be negative'
        });
      }
    }

    // Validate threshold if provided
    if (threshold !== undefined) {
      if (typeof threshold !== 'number' || isNaN(threshold) || threshold < 0) {
        return res.status(400).json({
          success: false,
          message: 'Threshold cannot be negative'
        });
      }
    }

    // Ensure at least one updatable field is provided
    if (quantity === undefined && threshold === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Quantity or threshold must be provided for update'
      });
    }

    const inventoryItem = await Inventory.findById(id);

    if (!inventoryItem) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found'
      });
    }

    // Apply updates strictly to quantity and threshold (disallow altering item name or category)
    if (quantity !== undefined) {
      inventoryItem.quantity = quantity;
    }

    if (threshold !== undefined) {
      inventoryItem.threshold = threshold;
    }

    await inventoryItem.save();

    return res.status(200).json({
      success: true,
      message: 'Inventory updated successfully',
      inventory: inventoryItem
    });
  } catch (error) {
    console.error('[InventoryController] Error updating inventory item:', error.message);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid inventory item ID format'
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Server error while updating inventory item'
    });
  }
};

/**
 * @desc    Create a new inventory item
 * @route   POST /api/inventory
 * @access  Private (Admin only)
 */
const createInventoryItem = async (req, res) => {
  try {
    const { item, category, quantity, threshold } = req.body;

    if (!item || typeof item !== 'string' || !item.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Item name is required'
      });
    }

    if (!category || typeof category !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Category is required'
      });
    }

    const normalizedCategory = category.toLowerCase().trim();
    if (!ALLOWED_CATEGORIES.includes(normalizedCategory)) {
      return res.status(400).json({
        success: false,
        message: `Invalid category '${category}'. Must be one of: ${ALLOWED_CATEGORIES.join(', ')}`
      });
    }

    if (quantity !== undefined) {
      if (typeof quantity !== 'number' || isNaN(quantity) || quantity < 0) {
        return res.status(400).json({
          success: false,
          message: 'Quantity cannot be negative'
        });
      }
    }

    if (threshold !== undefined) {
      if (typeof threshold !== 'number' || isNaN(threshold) || threshold < 0) {
        return res.status(400).json({
          success: false,
          message: 'Threshold cannot be negative'
        });
      }
    }

    // Check for existing item + category duplicate
    const existing = await Inventory.findOne({
      category: normalizedCategory,
      item: item.trim()
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Duplicate inventory record for '${item.trim()}' in category '${normalizedCategory}' already exists`
      });
    }

    const newItem = new Inventory({
      item: item.trim(),
      category: normalizedCategory,
      quantity: quantity !== undefined ? quantity : 0,
      threshold: threshold !== undefined ? threshold : 5
    });

    await newItem.save();

    return res.status(201).json({
      success: true,
      message: 'Inventory item created successfully',
      inventory: newItem
    });
  } catch (error) {
    console.error('[InventoryController] Error creating inventory item:', error.message);
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Duplicate inventory item for this category already exists'
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Server error while creating inventory item'
    });
  }
};

module.exports = {
  getInventory,
  getInventoryByCategory,
  updateInventoryItem,
  createInventoryItem
};
