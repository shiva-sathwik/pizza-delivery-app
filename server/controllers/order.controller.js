const mongoose = require('mongoose');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Inventory = require('../models/Inventory');
const {
  KEY_ID,
  isPlaceholderKey,
  createRazorpayOrder,
  verifyRazorpaySignature,
  issueRazorpayRefund,
  generateTestSignature
} = require('../config/razorpay');

/**
 * Helper to aggregate required ingredients across all items in a cart
 * @param {Array} items
 * @returns {Map<string, { category: string, item: string, requiredQty: number }>}
 */
const aggregateIngredientRequirements = (items) => {
  const reqMap = new Map();

  const add = (category, item, qty) => {
    if (!item) return;
    const key = `${category}:${item.trim().toLowerCase()}`;
    const existing = reqMap.get(key);
    if (existing) {
      existing.requiredQty += qty;
    } else {
      reqMap.set(key, {
        category,
        item: item.trim(),
        requiredQty: qty
      });
    }
  };

  for (const it of items) {
    const qty = it.quantity || 1;
    // Base
    if (it.base) add('base', it.base, qty);
    // Sauce
    if (it.sauce) add('sauce', it.sauce, qty);
    // Cheese
    if (it.cheese) add('cheese', it.cheese, qty);
    // Vegetables
    if (Array.isArray(it.vegetables)) {
      for (const veg of it.vegetables) {
        add('vegetable', veg, qty);
      }
    }
  }

  return reqMap;
};

/**
 * @desc    Create Razorpay Order after Pre-Checkout Inventory Validation
 * @route   POST /api/orders/payment/create
 * @access  Private (Authenticated User)
 */
const createPaymentOrder = async (req, res) => {
  try {
    const userId = req.user._id;

    // 1. Retrieve user's cart
    const cart = await Cart.findOne({ user: userId });
    if (!cart || !cart.items || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cart is empty. Please add items before checking out.'
      });
    }

    // 2. Authoritative server-side price calculation
    const calculatedTotal = cart.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    if (calculatedTotal <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid cart total amount.'
      });
    }

    // 3. Pre-checkout inventory verification:
    // Check that all required ingredients exist with quantity >= requiredQuantity
    const requirements = aggregateIngredientRequirements(cart.items);
    const insufficientItems = [];

    for (const reqItem of requirements.values()) {
      const inventoryDoc = await Inventory.findOne({
        category: reqItem.category,
        item: reqItem.item
      });

      if (!inventoryDoc || inventoryDoc.quantity < reqItem.requiredQty) {
        insufficientItems.push({
          item: reqItem.item,
          category: reqItem.category,
          required: reqItem.requiredQty,
          available: inventoryDoc ? inventoryDoc.quantity : 0
        });
      }
    }

    if (insufficientItems.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot initiate checkout: Insufficient stock for one or more ingredients',
        insufficientItems
      });
    }

    // 4. Generate Razorpay order for server-calculated amount
    const amountInPaise = Math.round(calculatedTotal * 100);
    const receipt = `rcpt_${Date.now()}_${userId.toString().slice(-4)}`;

    const razorpayOrder = await createRazorpayOrder({
      amount: amountInPaise,
      currency: 'INR',
      receipt
    });

    // Provide matching test payment ID and signature in dev mode for simulator
    let devTestPaymentId = null;
    let devTestSignature = null;
    if (process.env.NODE_ENV !== 'production' && (razorpayOrder.isSimulated || isPlaceholderKey())) {
      devTestPaymentId = `pay_test_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      devTestSignature = generateTestSignature({
        razorpay_order_id: razorpayOrder.id,
        razorpay_payment_id: devTestPaymentId
      });
    }

    return res.status(200).json({
      success: true,
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency || 'INR',
      keyId: KEY_ID,
      isSimulated: !!razorpayOrder.isSimulated,
      devTestPaymentId,
      devTestSignature
    });
  } catch (error) {
    console.error('[OrderController] Error creating payment order:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to create payment order'
    });
  }
};

/**
 * @desc    Verify Razorpay Payment Signature, Atomically Deduct Inventory & Finalize Order
 * @route   POST /api/orders/payment/verify
 * @access  Private (Authenticated User)
 */
const verifyPaymentAndCreateOrder = async (req, res) => {
  let session = null;
  try {
    const userId = req.user._id;
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed: Missing required payment verification parameters'
      });
    }

    // 1. Idempotency Check: Prevent duplicate order creation on retry
    const existingOrder = await Order.findOne({
      $or: [
        { 'payment.razorpayPaymentId': razorpay_payment_id },
        { 'payment.razorpayOrderId': razorpay_order_id }
      ]
    });

    if (existingOrder) {
      console.log(`[OrderController] Idempotent request: Order ${existingOrder._id} already created for payment ${razorpay_payment_id}`);
      return res.status(200).json({
        success: true,
        message: 'Order already processed for this payment',
        order: existingOrder
      });
    }

    // 2. Server-side HMAC-SHA256 signature verification
    const isValidSignature = verifyRazorpaySignature({
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    });

    if (!isValidSignature) {
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed: Invalid Razorpay signature'
      });
    }

    // 3. Retrieve user's cart
    const cart = await Cart.findOne({ user: userId });
    if (!cart || !cart.items || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Payment verified, but cart is empty or expired'
      });
    }

    // Create immutable order items snapshot
    const orderItems = cart.items.map(item => ({
      pizzaId: item.pizza || null,
      name: item.name,
      image: item.image || '',
      base: item.base,
      sauce: item.sauce,
      cheese: item.cheese,
      vegetables: item.vegetables || [],
      quantity: item.quantity,
      unitPrice: item.price,
      subtotal: item.price * item.quantity
    }));

    const orderTotal = orderItems.reduce((sum, it) => sum + it.subtotal, 0);
    const requirements = aggregateIngredientRequirements(cart.items);

    // 4. Atomic Inventory Deduction & Order Creation via MongoDB Session Transaction
    let transactionActive = false;
    try {
      session = await mongoose.startSession();
      session.startTransaction();
      transactionActive = true;
    } catch (sessionErr) {
      console.warn('[OrderController] MongoDB transactions not supported on this deployment, using atomic conditional updates:', sessionErr.message);
      session = null;
      transactionActive = false;
    }

    const deductedItems = [];
    let stockDepletedItem = null;

    try {
      // Re-read and atomically decrement every required ingredient
      for (const reqItem of requirements.values()) {
        const queryOptions = { new: true };
        if (session && transactionActive) {
          queryOptions.session = session;
        }

        const updatedDoc = await Inventory.findOneAndUpdate(
          {
            category: reqItem.category,
            item: reqItem.item,
            quantity: { $gte: reqItem.requiredQty }
          },
          {
            $inc: { quantity: -reqItem.requiredQty }
          },
          queryOptions
        );

        if (!updatedDoc) {
          stockDepletedItem = reqItem;
          break;
        }

        deductedItems.push({
          category: reqItem.category,
          item: reqItem.item,
          quantity: reqItem.requiredQty
        });
      }

      // If any ingredient stock failed:
      if (stockDepletedItem) {
        if (session && transactionActive) {
          await session.abortTransaction();
        } else {
          // Compensate any non-transactional atomic deductions
          for (const item of deductedItems) {
            await Inventory.updateOne(
              { category: item.category, item: item.item },
              { $inc: { quantity: item.quantity } }
            );
          }
        }

        // Handle Post-Payment Stock Depletion Edge Case:
        // Payment was captured, but inventory became unavailable between checkout creation and payment verification.
        // Never discard payment; issue/record refund and notify customer.
        const refundResult = await issueRazorpayRefund({
          paymentId: razorpay_payment_id,
          amount: Math.round(orderTotal * 100),
          notes: {
            reason: 'INSUFFICIENT_INVENTORY_POST_PAYMENT',
            depletedItem: stockDepletedItem.item,
            userId: userId.toString()
          }
        });

        // Record order attempt flagged as REFUND_REQUIRED for admin audit
        const refundOrder = new Order({
          user: userId,
          items: orderItems,
          total: orderTotal,
          payment: {
            status: refundResult.status === 'processed' ? 'REFUNDED' : 'REFUND_REQUIRED',
            razorpayOrderId: razorpay_order_id,
            razorpayPaymentId: razorpay_payment_id,
            razorpaySignature: razorpay_signature,
            refundReason: `INSUFFICIENT_INVENTORY_POST_PAYMENT: ${stockDepletedItem.item}`,
            refundId: refundResult.id || null
          },
          status: 'ORDER_RECEIVED'
        });
        await refundOrder.save();

        return res.status(409).json({
          success: false,
          refundRequired: true,
          message: 'Payment was captured, but stock was depleted by a concurrent order. A full refund has been initiated.',
          depletedItem: stockDepletedItem.item,
          refundStatus: refundResult.status
        });
      }

      // 5. Create final Order document inside session
      const newOrder = new Order({
        user: userId,
        items: orderItems,
        total: orderTotal,
        payment: {
          status: 'PAID',
          razorpayOrderId: razorpay_order_id,
          razorpayPaymentId: razorpay_payment_id,
          razorpaySignature: razorpay_signature
        },
        status: 'ORDER_RECEIVED'
      });

      await newOrder.save(session && transactionActive ? { session } : undefined);

      // 6. Clear user cart inside session
      await Cart.findOneAndUpdate(
        { user: userId },
        { $set: { items: [] } },
        session && transactionActive ? { session } : undefined
      );

      // 7. Commit transaction
      if (session && transactionActive) {
        await session.commitTransaction();
      }

      return res.status(201).json({
        success: true,
        message: 'Order created and paid successfully',
        order: newOrder
      });
    } catch (txErr) {
      if (session && transactionActive) {
        await session.abortTransaction();
      } else {
        for (const item of deductedItems) {
          await Inventory.updateOne(
            { category: item.category, item: item.item },
            { $inc: { quantity: item.quantity } }
          );
        }
      }
      throw txErr;
    }
  } catch (error) {
    console.error('[OrderController] Error verifying payment and creating order:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error during payment verification'
    });
  } finally {
    if (session) {
      session.endSession();
    }
  }
};

/**
 * @desc    Get authenticated customer's order history
 * @route   GET /api/orders
 * @access  Private (Authenticated User)
 */
const getUserOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
    return res.status(200).json({
      success: true,
      count: orders.length,
      orders
    });
  } catch (error) {
    console.error('[OrderController] Error retrieving user orders:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve order history'
    });
  }
};

/**
 * @desc    Get details of a single user order
 * @route   GET /api/orders/:id
 * @access  Private (Authenticated User)
 */
const getUserOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID format'
      });
    }

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Security Isolation: User can only access their own order
    if (order.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You do not have permission to view this order'
      });
    }

    return res.status(200).json({
      success: true,
      order
    });
  } catch (error) {
    console.error('[OrderController] Error retrieving order details:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve order details'
    });
  }
};

/**
 * @desc    Get all orders for Admin Management
 * @route   GET /api/admin/orders
 * @access  Private (Admin Only)
 */
const getAdminOrders = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate('user', 'name email')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: orders.length,
      orders
    });
  } catch (error) {
    console.error('[OrderController] Error retrieving admin orders:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve orders for administration'
    });
  }
};

/**
 * @desc    Get detailed order for Admin
 * @route   GET /api/admin/orders/:id
 * @access  Private (Admin Only)
 */
const getAdminOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID format'
      });
    }

    const order = await Order.findById(id).populate('user', 'name email');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    return res.status(200).json({
      success: true,
      order
    });
  } catch (error) {
    console.error('[OrderController] Error retrieving admin order by ID:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve order'
    });
  }
};

/**
 * @desc    Update Order Status with Strict Transition Validation
 *          ORDER_RECEIVED -> IN_KITCHEN -> SENT_TO_DELIVERY
 * @route   PATCH /api/admin/orders/:id/status
 * @access  Private (Admin Only)
 */
const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID format'
      });
    }

    const VALID_STATUSES = ['ORDER_RECEIVED', 'IN_KITCHEN', 'SENT_TO_DELIVERY'];
    if (!status || !VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status '${status}'. Must be one of: ${VALID_STATUSES.join(', ')}`
      });
    }

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Validate Status Transitions:
    // ORDER_RECEIVED -> IN_KITCHEN
    // IN_KITCHEN -> SENT_TO_DELIVERY
    const currentStatus = order.status;

    let isAllowed = false;
    if (currentStatus === 'ORDER_RECEIVED' && status === 'IN_KITCHEN') {
      isAllowed = true;
    } else if (currentStatus === 'IN_KITCHEN' && status === 'SENT_TO_DELIVERY') {
      isAllowed = true;
    } else if (currentStatus === status) {
      // No-op
      isAllowed = true;
    }

    if (!isAllowed) {
      return res.status(400).json({
        success: false,
        message: `Invalid order status transition from '${currentStatus}' to '${status}'. Allowed flow: ORDER_RECEIVED → IN_KITCHEN → SENT_TO_DELIVERY.`
      });
    }

    order.status = status;
    await order.save();

    return res.status(200).json({
      success: true,
      message: `Order status successfully updated to '${status}'`,
      order
    });
  } catch (error) {
    console.error('[OrderController] Error updating order status:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to update order status'
    });
  }
};

/**
 * @desc    Generate a valid test payment ID & signature for the development simulator
 * @route   POST /api/orders/payment/generate-test-payment
 * @access  Private (Authenticated User, Non-Production Only)
 */
const generateDevPayment = async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      success: false,
      message: 'Test payment generation is disabled in production'
    });
  }

  const { razorpay_order_id } = req.body;
  if (!razorpay_order_id) {
    return res.status(400).json({
      success: false,
      message: 'razorpay_order_id is required'
    });
  }

  const razorpay_payment_id =
    req.body.razorpay_payment_id ||
    `pay_test_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const razorpay_signature = generateTestSignature({
    razorpay_order_id,
    razorpay_payment_id
  });

  return res.status(200).json({
    success: true,
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature
  });
};

module.exports = {
  createPaymentOrder,
  verifyPaymentAndCreateOrder,
  generateDevPayment,
  getUserOrders,
  getUserOrderById,
  getAdminOrders,
  getAdminOrderById,
  updateOrderStatus
};

