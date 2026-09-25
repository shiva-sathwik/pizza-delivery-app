const mongoose = require('mongoose');

/**
 * Order Item Snapshot Sub-schema
 * Preserves immutable snapshot of items and selected ingredients at time of purchase.
 */
const orderItemSchema = new mongoose.Schema(
  {
    pizzaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Pizza',
      default: null
    },
    name: {
      type: String,
      required: [true, 'Item name is required'],
      trim: true
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
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [1, 'Quantity must be at least 1']
    },
    unitPrice: {
      type: Number,
      required: [true, 'Unit price is required'],
      min: [0, 'Unit price cannot be negative']
    },
    subtotal: {
      type: Number,
      required: [true, 'Subtotal is required'],
      min: [0, 'Subtotal cannot be negative']
    }
  },
  {
    _id: true,
    timestamps: true
  }
);

/**
 * Order Schema
 * Step 7: Order Management, Payments, and Real-Time Tracking Foundation
 */
const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      index: true
    },
    items: {
      type: [orderItemSchema],
      required: [true, 'Order items are required'],
      validate: {
        validator: function (items) {
          return Array.isArray(items) && items.length > 0;
        },
        message: 'Order must contain at least one item'
      }
    },
    total: {
      type: Number,
      required: [true, 'Total amount is required'],
      min: [0, 'Total cannot be negative']
    },
    payment: {
      status: {
        type: String,
        enum: ['PENDING', 'PAID', 'FAILED', 'REFUND_REQUIRED', 'REFUNDED'],
        default: 'PENDING'
      },
      razorpayOrderId: {
        type: String,
        default: null,
        index: true
      },
      razorpayPaymentId: {
        type: String,
        default: null,
        index: true
      },
      razorpaySignature: {
        type: String,
        default: null
      },
      refundReason: {
        type: String,
        default: null
      },
      refundId: {
        type: String,
        default: null
      }
    },
    status: {
      type: String,
      enum: ['ORDER_RECEIVED', 'IN_KITCHEN', 'SENT_TO_DELIVERY'],
      default: 'ORDER_RECEIVED'
    }
  },
  {
    timestamps: true
  }
);

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
