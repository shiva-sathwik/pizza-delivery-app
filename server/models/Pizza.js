const mongoose = require('mongoose');

/**
 * Pizza Schema
 * Step 5: Pizza Catalog Database Foundation
 */
const pizzaSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Pizza name is required'],
      trim: true
    },
    description: {
      type: String,
      trim: true,
      default: ''
    },
    image: {
      type: String,
      default: ''
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
      min: [0, 'Price cannot be negative']
    },
    isAvailable: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

const Pizza = mongoose.model('Pizza', pizzaSchema);

module.exports = Pizza;
