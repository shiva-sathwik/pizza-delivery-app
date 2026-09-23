const mongoose = require('mongoose');

/**
 * Cart Item Sub-schema
 */
const cartItemSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['catalog', 'custom'],
      required: [true, 'Cart item type must be either catalog or custom']
    },
    pizza: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Pizza',
      default: null
    },
    name: {
      type: String,
      required: [true, 'Item name is required'],
      trim: true
    },
    base: {
      type: String,
      required: [true, 'Base crust is required']
    },
    sauce: {
      type: String,
      required: [true, 'Sauce is required']
    },
    cheese: {
      type: String,
      required: [true, 'Cheese is required']
    },
    vegetables: {
      type: [String],
      default: []
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Item price cannot be negative']
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [1, 'Quantity must be at least 1'],
      default: 1
    }
  },
  {
    _id: true,
    timestamps: true
  }
);

/**
 * Cart Schema
 * Step 5: User-Specific Cart Architecture
 */
const cartSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },
    items: {
      type: [cartItemSchema],
      default: []
    }
  },
  {
    timestamps: true
  }
);

const Cart = mongoose.model('Cart', cartSchema);

module.exports = Cart;
