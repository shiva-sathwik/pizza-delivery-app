const mongoose = require('mongoose');

/**
 * Inventory Schema
 * Step 6: Inventory & Admin Management Database Foundation
 */
const inventorySchema = new mongoose.Schema(
  {
    item: {
      type: String,
      required: [true, 'Item name is required'],
      trim: true
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: {
        values: ['base', 'sauce', 'cheese', 'vegetable'],
        message: '{VALUE} is not a supported inventory category'
      }
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [0, 'Quantity cannot be negative'],
      default: 0
    },
    threshold: {
      type: Number,
      required: [true, 'Threshold is required'],
      min: [0, 'Threshold cannot be negative'],
      default: 5
    },
    lastAlertSentAt: {
      type: Date,
      default: null
    },
    lastAlertStatus: {
      type: String,
      enum: ['In Stock', 'Low Stock', 'Out of Stock', null],
      default: null
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Prevent duplicate inventory records for the same item + category
inventorySchema.index({ category: 1, item: 1 }, { unique: true });

// Derived stock status virtual: Out of Stock, Low Stock, or In Stock
inventorySchema.virtual('status').get(function () {
  if (this.quantity === 0) {
    return 'Out of Stock';
  }
  if (this.quantity <= this.threshold) {
    return 'Low Stock';
  }
  return 'In Stock';
});

const Inventory = mongoose.model('Inventory', inventorySchema);

module.exports = Inventory;
