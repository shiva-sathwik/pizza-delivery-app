/**
 * Step 7: Orders, Razorpay Checkout & Real-time Tracking Test Suite
 * Tests 22 core Order & Checkout requirements:
 *
 * 1. Unauthenticated user cannot create payment order (401)
 * 2. Authenticated user can create Razorpay order
 * 3. Server calculates amount from cart (ignores any client price manipulation)
 * 4. Pre-checkout inventory validation: fails if required inventory is already insufficient before payment
 * 5. Payment verification rejects invalid HMAC signature (400)
 * 6. Successful payment verification creates Order with status ORDER_RECEIVED and PAID
 * 7. Successful order atomically deducts inventory for all ingredients
 * 8. Concurrent depletion edge case: If stock becomes unavailable between payment creation and verification
 * 9. Transaction rollback: verified that if any single ingredient deduction fails, zero partial deductions occur
 * 10. Cart is cleared after successful order creation
 * 11. Cart is NOT cleared if payment verification fails
 * 12. Duplicate payment verification is idempotent (returns existing order without duplicate deduction)
 * 13. User can retrieve own orders (GET /api/orders)
 * 14. User cannot retrieve another user's order (403)
 * 15. Admin can retrieve all orders (GET /api/admin/orders)
 * 16. Regular user cannot access admin orders (403)
 * 17. Admin can transition ORDER_RECEIVED -> IN_KITCHEN
 * 18. Admin can transition IN_KITCHEN -> SENT_TO_DELIVERY
 * 19. Invalid status transitions (backward or skip) are rejected with HTTP 400
 * 20. Empty cart cannot initiate checkout (400)
 * 21. Unauthenticated access to payment verification is rejected with HTTP 401
 * 22. Non-existent order ID returns HTTP 404 for order retrieval
 */

const assert = require('assert');
const crypto = require('crypto');
const mongoose = require('mongoose');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_key_12345';
process.env.RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder_key_id';
process.env.RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'placeholder_secret_never_commit_real_secret';
process.env.NODE_ENV = 'test';

const { authenticate, requireAdmin } = require('../middleware/auth.middleware');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Inventory = require('../models/Inventory');
const {
  createPaymentOrder,
  verifyPaymentAndCreateOrder,
  getUserOrders,
  getUserOrderById,
  getAdminOrders,
  getAdminOrderById,
  updateOrderStatus
} = require('../controllers/order.controller');
const { KEY_SECRET, generateTestSignature } = require('../config/razorpay');

// Helper to simulate Express req/res
const createMockReqRes = ({ body = {}, query = {}, params = {}, headers = {}, cookies = {}, user = null } = {}) => {
  const req = {
    body,
    query,
    params,
    headers,
    cookies,
    user
  };

  const res = {
    statusCode: 200,
    jsonData: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.jsonData = data;
      return this;
    }
  };

  return { req, res };
};

// In-Memory Databases for Test Harness
const inventoryDB = new Map();
const cartDB = new Map();
const orderDB = new Map();

// Transaction Session Mock
class MockSession {
  constructor() {
    this.active = false;
    this.snapshots = new Map();
  }

  startTransaction() {
    this.active = true;
    // Snapshot current inventory state for rollback
    this.snapshots.clear();
    for (const [key, val] of inventoryDB.entries()) {
      this.snapshots.set(key, JSON.parse(JSON.stringify(val)));
    }
  }

  inTransaction() {
    return this.active;
  }

  async commitTransaction() {
    this.active = false;
    this.snapshots.clear();
  }

  async abortTransaction() {
    this.active = false;
    // Restore inventory from snapshot
    inventoryDB.clear();
    for (const [key, val] of this.snapshots.entries()) {
      inventoryDB.set(key, val);
    }
    this.snapshots.clear();
  }

  endSession() {
    this.active = false;
  }
}

mongoose.startSession = async function () {
  return new MockSession();
};

// Hook into Inventory model
Inventory.findOne = async function (filter = {}) {
  for (const item of inventoryDB.values()) {
    let match = true;
    if (filter.category && item.category !== filter.category) match = false;
    if (filter.item && item.item.toLowerCase() !== filter.item.toLowerCase()) match = false;
    if (match) return JSON.parse(JSON.stringify(item));
  }
  return null;
};

Inventory.findOneAndUpdate = async function (filter = {}, update = {}, options = {}) {
  for (const [key, doc] of inventoryDB.entries()) {
    let match = true;
    if (filter.category && doc.category !== filter.category) match = false;
    if (filter.item && doc.item.toLowerCase() !== filter.item.toLowerCase()) match = false;
    if (filter.quantity && filter.quantity.$gte !== undefined) {
      if (doc.quantity < filter.quantity.$gte) match = false;
    }

    if (match) {
      if (update.$inc && update.$inc.quantity !== undefined) {
        doc.quantity += update.$inc.quantity;
      }
      doc.updatedAt = new Date();
      inventoryDB.set(key, doc);
      return JSON.parse(JSON.stringify(doc));
    }
  }
  return null;
};

Inventory.updateOne = async function (filter = {}, update = {}) {
  for (const [key, doc] of inventoryDB.entries()) {
    let match = true;
    if (filter.category && doc.category !== filter.category) match = false;
    if (filter.item && doc.item.toLowerCase() !== filter.item.toLowerCase()) match = false;
    if (match) {
      if (update.$inc && update.$inc.quantity !== undefined) {
        doc.quantity += update.$inc.quantity;
      }
      inventoryDB.set(key, doc);
      return { modifiedCount: 1 };
    }
  }
  return { modifiedCount: 0 };
};

// Hook into Cart model
Cart.findOne = async function (filter = {}) {
  if (filter.user) {
    const uId = filter.user.toString();
    const cart = cartDB.get(uId);
    if (!cart) return null;
    return JSON.parse(JSON.stringify(cart));
  }
  return null;
};

Cart.findOneAndUpdate = async function (filter = {}, update = {}) {
  if (filter.user) {
    const uId = filter.user.toString();
    const cart = cartDB.get(uId) || { user: filter.user, items: [] };
    if (update.$set && update.$set.items) {
      cart.items = update.$set.items;
    }
    cartDB.set(uId, cart);
    return cart;
  }
  return null;
};

// Hook into Order model
Order.prototype.save = async function () {
  this.updatedAt = new Date();
  if (!this._id) {
    this._id = new mongoose.Types.ObjectId().toString();
  }
  orderDB.set(this._id.toString(), this);
  return this;
};

Order.findOne = async function (filter = {}) {
  for (const order of orderDB.values()) {
    if (filter.$or) {
      for (const cond of filter.$or) {
        if (cond['payment.razorpayPaymentId'] && order.payment?.razorpayPaymentId === cond['payment.razorpayPaymentId']) {
          return order;
        }
        if (cond['payment.razorpayOrderId'] && order.payment?.razorpayOrderId === cond['payment.razorpayOrderId']) {
          return order;
        }
      }
    }
  }
  return null;
};

Order.findById = async function (id) {
  const ord = orderDB.get(id ? id.toString() : '');
  if (!ord) return null;

  ord.populate = function () {
    return Promise.resolve(this);
  };
  return ord;
};

Order.find = function (filter = {}) {
  const results = [];
  for (const ord of orderDB.values()) {
    let match = true;
    if (filter.user && ord.user.toString() !== filter.user.toString()) {
      match = false;
    }
    if (match) results.push(ord);
  }

  return {
    sort: () => ({
      populate: () => Promise.resolve(results),
      then: (resolve) => resolve(results)
    }),
    populate: () => ({
      sort: () => Promise.resolve(results),
      then: (resolve) => resolve(results)
    }),
    then: (resolve) => resolve(results)
  };
};

// Setup initial in-memory data
function resetTestData() {
  inventoryDB.clear();
  cartDB.clear();
  orderDB.clear();

  // Seed inventory
  const defaultInventory = [
    { category: 'base', item: 'Thin Crust', quantity: 50, threshold: 10 },
    { category: 'base', item: 'Cheese Burst', quantity: 20, threshold: 5 },
    { category: 'sauce', item: 'Classic San Marzano Tomato', quantity: 40, threshold: 10 },
    { category: 'cheese', item: '100% Mozzarella', quantity: 35, threshold: 10 },
    { category: 'vegetable', item: 'Crisp Bell Peppers', quantity: 30, threshold: 8 },
    { category: 'vegetable', item: 'Grilled Mushrooms', quantity: 1, threshold: 5 } // Low stock item
  ];

  for (const item of defaultInventory) {
    const id = new mongoose.Types.ObjectId().toString();
    inventoryDB.set(id, { _id: id, ...item });
  }
}

async function runOrderTests() {
  console.log('\n====================================================');
  console.log('🧪 RUNNING STEP 7 ORDERS & CHECKOUT TEST SUITE');
  console.log('====================================================\n');

  resetTestData();

  let passed = 0;
  let failed = 0;

  const test = async (name, fn) => {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}`);
      console.error(`    Error: ${err.message}`);
      failed++;
    }
  };

  const userA = {
    _id: new mongoose.Types.ObjectId(),
    name: 'Customer Alice',
    email: 'alice@example.com',
    role: 'user'
  };

  const userB = {
    _id: new mongoose.Types.ObjectId(),
    name: 'Customer Bob',
    email: 'bob@example.com',
    role: 'user'
  };

  const adminUser = {
    _id: new mongoose.Types.ObjectId(),
    name: 'Admin Boss',
    email: 'admin@pizzaflow.com',
    role: 'admin'
  };

  // Helper to set up user cart
  const setUserCart = (userId, items) => {
    cartDB.set(userId.toString(), {
      user: userId,
      items: items.map(it => ({
        _id: new mongoose.Types.ObjectId().toString(),
        ...it
      }))
    });
  };

  console.log('--- 1. PAYMENT ORDER CREATION & PRE-CHECKOUT INVENTORY TESTS ---');

  await test('1. Unauthenticated user cannot create payment order (401)', async () => {
    const { req, res } = createMockReqRes({ user: null });
    let nextCalled = false;
    await authenticate(req, res, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res.statusCode, 401);
  });

  await test('2. Authenticated user can create Razorpay order with valid cart', async () => {
    setUserCart(userA._id, [
      {
        name: 'Margherita Classica',
        base: 'Thin Crust',
        sauce: 'Classic San Marzano Tomato',
        cheese: '100% Mozzarella',
        vegetables: ['Crisp Bell Peppers'],
        price: 299,
        quantity: 2
      }
    ]);

    const { req, res } = createMockReqRes({ user: userA });
    await createPaymentOrder(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.jsonData.success, true);
    assert.ok(res.jsonData.razorpayOrderId);
    assert.strictEqual(res.jsonData.amount, 59800); // ₹598 in paise
  });

  await test('3. Server calculates amount from cart (ignores client manipulation)', async () => {
    setUserCart(userA._id, [
      {
        name: 'Custom Pizza',
        base: 'Thin Crust',
        sauce: 'Classic San Marzano Tomato',
        cheese: '100% Mozzarella',
        vegetables: [],
        price: 230,
        quantity: 1
      }
    ]);

    // Client passes manipulated amount in request body
    const { req, res } = createMockReqRes({
      user: userA,
      body: { amount: 10, total: 10 }
    });
    await createPaymentOrder(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.jsonData.amount, 23000); // Strictly server 230 * 100 paise
  });

  await test('4. Pre-checkout inventory validation: fails if required inventory is insufficient before payment', async () => {
    // Mushrooms only has 1 in stock, user requests quantity: 3
    setUserCart(userA._id, [
      {
        name: 'Mushroom Delight',
        base: 'Thin Crust',
        sauce: 'Classic San Marzano Tomato',
        cheese: '100% Mozzarella',
        vegetables: ['Grilled Mushrooms'],
        price: 350,
        quantity: 3
      }
    ]);

    const { req, res } = createMockReqRes({ user: userA });
    await createPaymentOrder(req, res);
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.jsonData.success, false);
    assert.match(res.jsonData.message, /Insufficient stock/i);
    assert.ok(res.jsonData.insufficientItems.length > 0);
  });

  await test('20. Empty cart cannot initiate checkout (400)', async () => {
    setUserCart(userA._id, []);
    const { req, res } = createMockReqRes({ user: userA });
    await createPaymentOrder(req, res);
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.jsonData.success, false);
    assert.match(res.jsonData.message, /Cart is empty/i);
  });

  console.log('\n--- 2. PAYMENT SIGNATURE VERIFICATION TESTS ---');

  await test('21. Unauthenticated access to payment verification is rejected with HTTP 401', async () => {
    const { req, res } = createMockReqRes({ user: null });
    let nextCalled = false;
    await authenticate(req, res, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res.statusCode, 401);
  });

  await test('5. Payment verification rejects invalid HMAC signature (400)', async () => {
    setUserCart(userA._id, [
      {
        name: 'Margherita Classica',
        base: 'Thin Crust',
        sauce: 'Classic San Marzano Tomato',
        cheese: '100% Mozzarella',
        vegetables: [],
        price: 299,
        quantity: 1
      }
    ]);

    const { req, res } = createMockReqRes({
      user: userA,
      body: {
        razorpay_order_id: 'order_test_12345',
        razorpay_payment_id: 'pay_test_67890',
        razorpay_signature: 'fake_tampered_signature_abc'
      }
    });
    await verifyPaymentAndCreateOrder(req, res);
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.jsonData.success, false);
    assert.match(res.jsonData.message, /Invalid Razorpay signature/i);
  });

  await test('11. Cart is NOT cleared if payment verification fails', async () => {
    const cart = cartDB.get(userA._id.toString());
    assert.ok(cart && cart.items.length > 0, 'Cart must remain intact after verification failure');
  });

  console.log('\n--- 3. TRANSACTION-SAFE INVENTORY DEDUCTION & ORDER CREATION ---');

  const validOrderId = `order_test_${Date.now()}`;
  const validPaymentId = `pay_test_${Date.now()}`;
  const validSignature = crypto
    .createHmac('sha256', KEY_SECRET)
    .update(`${validOrderId}|${validPaymentId}`)
    .digest('hex');

  let initialThinCrustStock = 0;
  for (const it of inventoryDB.values()) {
    if (it.item === 'Thin Crust') initialThinCrustStock = it.quantity;
  }

  await test('6. Successful payment verification creates Order with status ORDER_RECEIVED and PAID', async () => {
    setUserCart(userA._id, [
      {
        name: 'Margherita Classica',
        base: 'Thin Crust',
        sauce: 'Classic San Marzano Tomato',
        cheese: '100% Mozzarella',
        vegetables: ['Crisp Bell Peppers'],
        price: 299,
        quantity: 2
      }
    ]);

    const { req, res } = createMockReqRes({
      user: userA,
      body: {
        razorpay_order_id: validOrderId,
        razorpay_payment_id: validPaymentId,
        razorpay_signature: validSignature
      }
    });

    await verifyPaymentAndCreateOrder(req, res);
    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.jsonData.success, true);
    assert.strictEqual(res.jsonData.order.status, 'ORDER_RECEIVED');
    assert.strictEqual(res.jsonData.order.payment.status, 'PAID');
    assert.strictEqual(res.jsonData.order.total, 598);
  });

  await test('7. Successful order atomically deducts inventory for all ingredients', async () => {
    let currentThinCrustStock = 0;
    for (const it of inventoryDB.values()) {
      if (it.item === 'Thin Crust') currentThinCrustStock = it.quantity;
    }
    // 2 pizzas ordered, Thin Crust stock should have decreased by 2
    assert.strictEqual(currentThinCrustStock, initialThinCrustStock - 2);
  });

  await test('10. Cart is cleared after successful order creation', async () => {
    const cart = cartDB.get(userA._id.toString());
    assert.ok(cart, 'Cart should exist');
    assert.strictEqual(cart.items.length, 0, 'Cart items must be empty after order creation');
  });

  await test('12. Duplicate payment verification is idempotent (returns existing order without duplicate deduction)', async () => {
    let stockBefore = 0;
    for (const it of inventoryDB.values()) {
      if (it.item === 'Thin Crust') stockBefore = it.quantity;
    }

    const { req, res } = createMockReqRes({
      user: userA,
      body: {
        razorpay_order_id: validOrderId,
        razorpay_payment_id: validPaymentId,
        razorpay_signature: validSignature
      }
    });

    await verifyPaymentAndCreateOrder(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.jsonData.success, true);
    assert.match(res.jsonData.message, /already processed/i);

    let stockAfter = 0;
    for (const it of inventoryDB.values()) {
      if (it.item === 'Thin Crust') stockAfter = it.quantity;
    }
    assert.strictEqual(stockBefore, stockAfter, 'Stock must not be deducted again on duplicate verification');
  });

  console.log('\n--- 4. POST-CAPTURE STOCK DEPLETION & TRANSACTION ROLLBACK TESTS ---');

  await test('8. Concurrent depletion edge case: Stock unavailable post-capture aborts transaction & flags REFUND_REQUIRED', async () => {
    // Setup cart with Cheese Burst (currently 20 in stock)
    setUserCart(userA._id, [
      {
        name: 'Cheese Burst Pizza',
        base: 'Cheese Burst',
        sauce: 'Classic San Marzano Tomato',
        cheese: '100% Mozzarella',
        vegetables: ['Grilled Mushrooms'], // Mushrooms has only 1 in stock
        price: 450,
        quantity: 1
      }
    ]);

    // Simulate concurrent depletion: someone buys the last mushroom right before verification
    for (const it of inventoryDB.values()) {
      if (it.item === 'Grilled Mushrooms') {
        it.quantity = 0;
      }
    }

    const depOrderId = `order_dep_${Date.now()}`;
    const depPaymentId = `pay_dep_${Date.now()}`;
    const depSignature = crypto
      .createHmac('sha256', KEY_SECRET)
      .update(`${depOrderId}|${depPaymentId}`)
      .digest('hex');

    const { req, res } = createMockReqRes({
      user: userA,
      body: {
        razorpay_order_id: depOrderId,
        razorpay_payment_id: depPaymentId,
        razorpay_signature: depSignature
      }
    });

    await verifyPaymentAndCreateOrder(req, res);
    assert.strictEqual(res.statusCode, 409);
    assert.strictEqual(res.jsonData.success, false);
    assert.strictEqual(res.jsonData.refundRequired, true);
    assert.match(res.jsonData.message, /refund has been initiated/i);
  });

  await test('9. Transaction rollback: verified that if any single ingredient deduction fails, zero partial deductions occur', async () => {
    // Verify that Cheese Burst was NOT partially decremented because Mushrooms failed
    let cheeseBurstStock = 0;
    for (const it of inventoryDB.values()) {
      if (it.item === 'Cheese Burst') cheeseBurstStock = it.quantity;
    }
    assert.strictEqual(cheeseBurstStock, 20, 'Cheese Burst must remain at 20 due to transaction rollback');
  });

  console.log('\n--- 5. USER ORDER RETRIEVAL & ISOLATION TESTS ---');

  let createdOrderId = null;
  for (const ord of orderDB.values()) {
    if (ord.user.toString() === userA._id.toString() && ord.payment.status === 'PAID') {
      createdOrderId = ord._id;
    }
  }

  await test('13. User can retrieve own orders (GET /api/orders)', async () => {
    const { req, res } = createMockReqRes({ user: userA });
    await getUserOrders(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.jsonData.success, true);
    assert.ok(res.jsonData.orders.length > 0);
    res.jsonData.orders.forEach(o => {
      assert.strictEqual(o.user.toString(), userA._id.toString());
    });
  });

  await test('14. User cannot retrieve another user\'s order (403)', async () => {
    const { req, res } = createMockReqRes({
      user: userB,
      params: { id: createdOrderId }
    });
    await getUserOrderById(req, res);
    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(res.jsonData.success, false);
    assert.match(res.jsonData.message, /Access denied/i);
  });

  await test('22. Non-existent order ID returns HTTP 404 for order retrieval', async () => {
    const nonExistentId = new mongoose.Types.ObjectId().toString();
    const { req, res } = createMockReqRes({
      user: userA,
      params: { id: nonExistentId }
    });
    await getUserOrderById(req, res);
    assert.strictEqual(res.statusCode, 404);
  });

  console.log('\n--- 6. ADMIN ORDER MANAGEMENT & STATUS TRANSITION TESTS ---');

  await test('15. Admin can retrieve all orders (GET /api/admin/orders)', async () => {
    const { req, res } = createMockReqRes({ user: adminUser });
    await getAdminOrders(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.jsonData.success, true);
    assert.ok(res.jsonData.orders.length > 0);
  });

  await test('16. Regular user cannot access admin orders (403 Forbidden)', async () => {
    const { req, res } = createMockReqRes({ user: userA });
    let nextCalled = false;
    requireAdmin(req, res, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res.statusCode, 403);
  });

  await test('17. Admin can transition ORDER_RECEIVED -> IN_KITCHEN', async () => {
    const { req, res } = createMockReqRes({
      user: adminUser,
      params: { id: createdOrderId },
      body: { status: 'IN_KITCHEN' }
    });
    await updateOrderStatus(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.jsonData.success, true);
    assert.strictEqual(res.jsonData.order.status, 'IN_KITCHEN');
  });

  await test('18. Admin can transition IN_KITCHEN -> SENT_TO_DELIVERY', async () => {
    const { req, res } = createMockReqRes({
      user: adminUser,
      params: { id: createdOrderId },
      body: { status: 'SENT_TO_DELIVERY' }
    });
    await updateOrderStatus(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.jsonData.success, true);
    assert.strictEqual(res.jsonData.order.status, 'SENT_TO_DELIVERY');
  });

  await test('19. Invalid status transitions (backward or skip) are rejected with HTTP 400', async () => {
    // Order is now SENT_TO_DELIVERY. Backward transition to ORDER_RECEIVED must be rejected
    const { req, res } = createMockReqRes({
      user: adminUser,
      params: { id: createdOrderId },
      body: { status: 'ORDER_RECEIVED' }
    });
    await updateOrderStatus(req, res);
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.jsonData.success, false);
    assert.match(res.jsonData.message, /Invalid order status transition/i);
  });

  console.log('\n====================================================');
  console.log(`TOTAL ORDER & CHECKOUT TESTS: ${passed + failed}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runOrderTests();
}

module.exports = runOrderTests;
