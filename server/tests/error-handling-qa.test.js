/**
 * Step 9C — Test 6: Error Handling QA Automated Integration Test Suite
 *
 * Comprehensive Error Handling, Edge Cases, and Resilience Verification:
 * 1. Task 2: Invalid Input & Boundary Validation
 * 2. Task 3: Missing Resources & Routing 404 Handlers
 * 3. Task 4: Authentication & Authorization Failures
 * 4. Task 5: Database & Backend Failure Recovery
 * 5. Task 7: Payment, Idempotency & Transaction Rollbacks
 * 6. Task 8: Confidential Data & Log Sanitization
 */

const assert = require('assert');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

// Ensure isolated test environment
process.env.JWT_SECRET = process.env.JWT_SECRET || 'error_handling_qa_secret_key_11223';
process.env.JWT_EXPIRES_IN = '1h';
process.env.CLIENT_URL = 'http://localhost:5173';
process.env.NODE_ENV = 'test';

// Middleware & Handlers
const { authenticate, requireAdmin, optionalAuthenticate } = require('../middleware/auth.middleware');
const { notFoundHandler, errorHandler } = require('../middleware/error.middleware');
const { register, login, getCurrentUser, logout } = require('../controllers/auth.controller');
const { adminLogin, adminTest } = require('../controllers/admin.controller');
const {
  getCart,
  addToCart,
  updateCartItemQuantity,
  removeCartItem,
  clearCart
} = require('../controllers/cart.controller');
const {
  getUserOrders,
  getUserOrderById,
  getAdminOrders,
  getAdminOrderById,
  updateOrderStatus,
  createPaymentOrder,
  verifyPaymentAndCreateOrder
} = require('../controllers/order.controller');
const {
  getInventory,
  getInventoryByCategory,
  updateInventoryItem,
  createInventoryItem
} = require('../controllers/inventory.controller');
const {
  getAllPizzas,
  getPizzaById,
  createPizza,
  updatePizza,
  deletePizza
} = require('../controllers/pizza.controller');
const { getAdminAnalytics } = require('../controllers/analytics.controller');

// Models
const User = require('../models/User');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Inventory = require('../models/Inventory');
const Pizza = require('../models/Pizza');

// Helper to simulate Express req/res
const createMockReqRes = ({
  body = {},
  params = {},
  query = {},
  headers = {},
  cookies = {},
  user = null
} = {}) => {
  const req = {
    body,
    params,
    query,
    headers,
    cookies,
    user
  };

  const res = {
    statusCode: 200,
    cookiesSet: {},
    cookiesCleared: {},
    jsonData: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.jsonData = data;
      return this;
    },
    cookie(name, val, opts) {
      this.cookiesSet[name] = { val, opts };
      return this;
    },
    clearCookie(name, opts) {
      this.cookiesCleared[name] = opts;
      return this;
    }
  };

  return { req, res };
};

// Helper to await async handlers behind authenticate middleware
const runWithAuth = async (req, res, handler) => {
  return new Promise((resolve, reject) => {
    let nextCalled = false;
    authenticate(req, res, async (err) => {
      nextCalled = true;
      if (err) return reject(err);
      try {
        if (handler) await handler(req, res);
        resolve();
      } catch (e) {
        reject(e);
      }
    }).then(() => {
      if (!nextCalled) resolve();
    }).catch(reject);
  });
};

// In-Memory Test Store
const store = {
  users: new Map(),
  carts: new Map(),
  orders: new Map(),
  inventory: new Map(),
  pizzas: new Map()
};

// Reset mock database
const resetStore = () => {
  store.users.clear();
  store.carts.clear();
  store.orders.clear();
  store.inventory.clear();
  store.pizzas.clear();
};

// Plain object document wrappers
function wrapUserDoc(data) {
  const doc = {
    _id: (data._id || new mongoose.Types.ObjectId()).toString(),
    name: data.name,
    email: data.email ? data.email.toLowerCase() : '',
    password: data.password,
    role: data.role || 'user',
    isEmailVerified: data.isEmailVerified !== undefined ? data.isEmailVerified : true,
    createdAt: data.createdAt || new Date()
  };
  doc.save = async function () {
    store.users.set(doc._id.toString(), doc);
    return doc;
  };
  return doc;
}

function wrapOrderDoc(data) {
  const doc = {
    _id: (data._id || new mongoose.Types.ObjectId()).toString(),
    user: (data.user?._id || data.user || '').toString(),
    items: data.items || [],
    total: data.total || 0,
    status: data.status || 'ORDER_RECEIVED',
    payment: data.payment || { status: 'PAID' },
    createdAt: data.createdAt || new Date(),
    updatedAt: data.updatedAt || new Date()
  };
  doc.save = async function () {
    doc.updatedAt = new Date();
    store.orders.set(doc._id.toString(), doc);
    return doc;
  };
  return doc;
}

function wrapCartDoc(data) {
  const doc = {
    _id: (data._id || new mongoose.Types.ObjectId()).toString(),
    user: (data.user?._id || data.user || '').toString(),
    items: data.items || [],
    createdAt: data.createdAt || new Date(),
    updatedAt: data.updatedAt || new Date()
  };
  doc.save = async function () {
    doc.updatedAt = new Date();
    store.carts.set(doc._id.toString(), doc);
    return doc;
  };
  return doc;
}

function wrapInventoryDoc(data) {
  const doc = {
    _id: (data._id || new mongoose.Types.ObjectId()).toString(),
    category: data.category,
    item: data.item,
    quantity: data.quantity || 0,
    threshold: data.threshold || 10,
    createdAt: data.createdAt || new Date(),
    updatedAt: data.updatedAt || new Date()
  };
  doc.save = async function () {
    doc.updatedAt = new Date();
    store.inventory.set(doc._id.toString(), doc);
    return doc;
  };
  return doc;
}

function wrapPizzaDoc(data) {
  const doc = {
    _id: (data._id || new mongoose.Types.ObjectId()).toString(),
    name: data.name,
    description: data.description || '',
    image: data.image || '',
    base: data.base,
    sauce: data.sauce,
    cheese: data.cheese,
    vegetables: data.vegetables || [],
    price: data.price || 0,
    isAvailable: data.isAvailable !== undefined ? data.isAvailable : true,
    createdAt: data.createdAt || new Date(),
    updatedAt: data.updatedAt || new Date()
  };
  doc.save = async function () {
    doc.updatedAt = new Date();
    store.pizzas.set(doc._id.toString(), doc);
    return doc;
  };
  return doc;
}

// Backup original Mongoose methods
const originalMethods = {
  userFindById: User.findById,
  userFindOne: User.findOne,
  userSave: User.prototype.save,
  orderFindById: Order.findById,
  orderFind: Order.find,
  orderFindOne: Order.findOne,
  orderSave: Order.prototype.save,
  cartFindOne: Cart.findOne,
  cartFindOneAndUpdate: Cart.findOneAndUpdate,
  cartSave: Cart.prototype.save,
  inventoryFindOne: Inventory.findOne,
  inventoryFind: Inventory.find,
  inventoryFindById: Inventory.findById,
  inventoryFindOneAndUpdate: Inventory.findOneAndUpdate,
  inventorySave: Inventory.prototype.save,
  pizzaFindById: Pizza.findById,
  pizzaFindOne: Pizza.findOne,
  pizzaFind: Pizza.find,
  pizzaSave: Pizza.prototype.save,
  pizzaFindByIdAndDelete: Pizza.findByIdAndDelete
};

// Setup In-Memory Mongoose Mock Adapters
const setupMocks = () => {
  // --- USER MOCKS ---
  User.findById = function (id) {
    const idStr = (id?._id || id || '').toString();
    const u = store.users.get(idStr);
    if (!u) {
      return {
        select: () => Promise.resolve(null),
        then: (resolve) => resolve(null)
      };
    }
    return {
      ...u,
      select: function () {
        return Promise.resolve(u);
      },
      then: (resolve) => resolve(u)
    };
  };

  User.findOne = async function (query) {
    for (const u of store.users.values()) {
      if (query.email && u.email.toLowerCase() === query.email.toLowerCase()) return u;
      if (query._id && u._id.toString() === query._id.toString()) return u;
    }
    return null;
  };

  User.prototype.save = async function () {
    if (!this._id) {
      this._id = new mongoose.Types.ObjectId().toString();
    }
    const doc = {
      _id: this._id.toString(),
      name: this.name,
      email: this.email ? this.email.toLowerCase() : '',
      password: this.password,
      role: this.role || 'user',
      isEmailVerified: this.isEmailVerified !== undefined ? this.isEmailVerified : false,
      createdAt: this.createdAt || new Date()
    };
    store.users.set(this._id.toString(), doc);
    return this;
  };

  // --- CART MOCKS ---
  Cart.findOne = async function (query) {
    if (query.user) {
      const uId = query.user.toString();
      for (const c of store.carts.values()) {
        if (c.user.toString() === uId) {
          return c;
        }
      }
    }
    return null;
  };

  Cart.findOneAndUpdate = async function (query, update) {
    const cart = await Cart.findOne(query);
    if (!cart) return null;
    if (update.$set && update.$set.items) {
      cart.items = update.$set.items;
    }
    return cart;
  };

  Cart.prototype.save = async function () {
    if (!this._id) {
      this._id = new mongoose.Types.ObjectId().toString();
    }
    store.carts.set(this._id.toString(), this);
    return this;
  };

  // --- ORDER MOCKS ---
  Order.findById = function (id) {
    const idStr = (id?._id || id || '').toString();
    const ord = store.orders.get(idStr) || null;
    return {
      populate: () => Promise.resolve(ord),
      then: (resolve) => resolve(ord)
    };
  };

  Order.findOne = async function (filter = {}) {
    for (const ord of store.orders.values()) {
      if (filter['payment.razorpayPaymentId'] && ord.payment?.razorpayPaymentId === filter['payment.razorpayPaymentId']) {
        return ord;
      }
      if (filter['payment.razorpayOrderId'] && ord.payment?.razorpayOrderId === filter['payment.razorpayOrderId']) {
        return ord;
      }
      if (filter.$or) {
        for (const cond of filter.$or) {
          if (cond['payment.razorpayPaymentId'] && ord.payment?.razorpayPaymentId === cond['payment.razorpayPaymentId']) {
            return ord;
          }
          if (cond['payment.razorpayOrderId'] && ord.payment?.razorpayOrderId === cond['payment.razorpayOrderId']) {
            return ord;
          }
        }
      }
    }
    return null;
  };

  Order.find = function (query = {}) {
    let list = Array.from(store.orders.values());
    if (query.user) {
      list = list.filter(o => o.user.toString() === query.user.toString());
    }
    return {
      sort: () => ({
        populate: () => Promise.resolve(list),
        then: (resolve) => resolve(list)
      }),
      populate: () => ({
        sort: () => Promise.resolve(list),
        then: (resolve) => resolve(list)
      }),
      then: (resolve) => resolve(list)
    };
  };

  Order.prototype.save = async function () {
    if (!this._id) {
      this._id = new mongoose.Types.ObjectId().toString();
    }
    store.orders.set(this._id.toString(), this);
    return this;
  };

  // --- INVENTORY MOCKS ---
  Inventory.findOne = async function (query) {
    for (const inv of store.inventory.values()) {
      if (query.category && query.item) {
        if (inv.category.toLowerCase() === query.category.toLowerCase() &&
            inv.item.toLowerCase() === query.item.toLowerCase()) {
          return inv;
        }
      }
    }
    return null;
  };

  Inventory.findById = async function (id) {
    const idStr = (id?._id || id || '').toString();
    return store.inventory.get(idStr) || null;
  };

  Inventory.find = function (query = {}) {
    let list = Array.from(store.inventory.values());
    if (query.category) {
      list = list.filter(i => i.category === query.category);
    }
    return {
      sort: () => Promise.resolve(list),
      then: (resolve) => resolve(list)
    };
  };

  Inventory.findOneAndUpdate = async function (query, update) {
    for (const inv of store.inventory.values()) {
      if (query.category === inv.category && query.item === inv.item) {
        if (query.quantity && query.quantity.$gte && inv.quantity < query.quantity.$gte) {
          return null;
        }
        if (update.$inc && update.$inc.quantity) {
          inv.quantity += update.$inc.quantity;
        }
        return inv;
      }
    }
    return null;
  };

  Inventory.prototype.save = async function () {
    if (!this._id) {
      this._id = new mongoose.Types.ObjectId().toString();
    }
    store.inventory.set(this._id.toString(), this);
    return this;
  };

  // --- PIZZA MOCKS ---
  Pizza.findById = async function (id) {
    const idStr = (id?._id || id || '').toString();
    return store.pizzas.get(idStr) || null;
  };

  Pizza.findOne = async function (query) {
    for (const p of store.pizzas.values()) {
      if (query.name) {
        if (query.name instanceof RegExp) {
          if (query.name.test(p.name)) return p;
        } else if (p.name.toLowerCase() === query.name.toLowerCase()) {
          return p;
        }
      }
    }
    return null;
  };

  Pizza.find = function (query = {}) {
    let list = Array.from(store.pizzas.values());
    if (query.isAvailable !== undefined) {
      list = list.filter(p => p.isAvailable === query.isAvailable);
    }
    return {
      sort: () => Promise.resolve(list),
      then: (resolve) => resolve(list)
    };
  };

  Pizza.findByIdAndDelete = async function (id) {
    const idStr = (id?._id || id || '').toString();
    const existing = store.pizzas.get(idStr);
    store.pizzas.delete(idStr);
    return existing || null;
  };

  Pizza.prototype.save = async function () {
    if (!this._id) {
      this._id = new mongoose.Types.ObjectId().toString();
    }
    store.pizzas.set(this._id.toString(), this);
    return this;
  };
};

const restoreMocks = () => {
  User.findById = originalMethods.userFindById;
  User.findOne = originalMethods.userFindOne;
  User.prototype.save = originalMethods.userSave;
  Order.findById = originalMethods.orderFindById;
  Order.find = originalMethods.orderFind;
  Order.findOne = originalMethods.orderFindOne;
  Order.prototype.save = originalMethods.orderSave;
  Cart.findOne = originalMethods.cartFindOne;
  Cart.findOneAndUpdate = originalMethods.cartFindOneAndUpdate;
  Cart.prototype.save = originalMethods.cartSave;
  Inventory.findOne = originalMethods.inventoryFindOne;
  Inventory.find = originalMethods.inventoryFind;
  Inventory.findById = originalMethods.inventoryFindById;
  Inventory.findOneAndUpdate = originalMethods.inventoryFindOneAndUpdate;
  Inventory.prototype.save = originalMethods.inventorySave;
  Pizza.findById = originalMethods.pizzaFindById;
  Pizza.findOne = originalMethods.pizzaFindOne;
  Pizza.find = originalMethods.pizzaFind;
  Pizza.findByIdAndDelete = originalMethods.pizzaFindByIdAndDelete;
  Pizza.prototype.save = originalMethods.pizzaSave;
};

// Test Suite Runner
async function runErrorHandlingQASuite() {
  console.log('\n====================================================');
  console.log('🛡️  STEP 9C — TEST 6: ERROR HANDLING QA AUDIT');
  console.log('====================================================\n');

  setupMocks();
  resetStore();

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

  // Helper to generate signed test token
  const createTestToken = (userId, role = 'user', secret = process.env.JWT_SECRET, expiresIn = '1h') => {
    return jwt.sign({ userId, role }, secret, { expiresIn });
  };

  // Seed Isolated Test Users
  const customerA = wrapUserDoc({
    name: 'Customer Alice',
    email: 'alice.test@example.com',
    password: await bcrypt.hash('AlicePass123!', 10),
    role: 'user',
    isEmailVerified: true
  });
  await customerA.save();

  const customerB = wrapUserDoc({
    name: 'Customer Bob',
    email: 'bob.test@example.com',
    password: await bcrypt.hash('BobPass123!', 10),
    role: 'user',
    isEmailVerified: true
  });
  await customerB.save();

  const adminUser = wrapUserDoc({
    name: 'Admin System',
    email: 'admin.qa@example.com',
    password: await bcrypt.hash('AdminPass123!', 10),
    role: 'admin',
    isEmailVerified: true
  });
  await adminUser.save();

  const tokenA = createTestToken(customerA._id, 'user');
  const tokenB = createTestToken(customerB._id, 'user');
  const tokenAdmin = createTestToken(adminUser._id, 'admin');

  // Seed Catalog item
  const testPizza = wrapPizzaDoc({
    name: 'Margherita Classic',
    base: 'Thin Crust',
    sauce: 'Classic San Marzano Tomato',
    cheese: '100% Mozzarella',
    price: 399,
    isAvailable: true
  });
  await testPizza.save();

  // Seed Inventory items
  const baseStock = wrapInventoryDoc({ category: 'base', item: 'Thin Crust', quantity: 50, threshold: 10 });
  await baseStock.save();
  const sauceStock = wrapInventoryDoc({ category: 'sauce', item: 'Classic San Marzano Tomato', quantity: 50, threshold: 10 });
  await sauceStock.save();
  const cheeseStock = wrapInventoryDoc({ category: 'cheese', item: '100% Mozzarella', quantity: 50, threshold: 10 });
  await cheeseStock.save();

  // Seed Customer A Order
  const orderA = wrapOrderDoc({
    user: customerA._id,
    items: [{ name: 'Margherita Classic', price: 399, quantity: 1 }],
    total: 399,
    status: 'ORDER_RECEIVED',
    payment: { status: 'PAID', razorpayOrderId: 'ord_qa_alice', razorpayPaymentId: 'pay_qa_alice' }
  });
  await orderA.save();

  // Seed Customer A Cart
  const cartA = wrapCartDoc({
    user: customerA._id,
    items: [{
      _id: new mongoose.Types.ObjectId().toString(),
      type: 'catalog',
      pizza: testPizza._id,
      name: testPizza.name,
      base: testPizza.base,
      sauce: testPizza.sauce,
      cheese: testPizza.cheese,
      price: 399,
      quantity: 1
    }]
  });
  await cartA.save();

  // =========================================================================
  // TASK 2: INVALID INPUT HANDLING
  // =========================================================================
  console.log('\n--- 1. INVALID INPUT HANDLING TESTS (TASK 2) ---');

  await test('1. Registration rejects missing name (HTTP 400)', async () => {
    const { req, res } = createMockReqRes({
      body: { email: 'noname@test.com', password: 'Password123!' }
    });
    await register(req, res);
    assert.strictEqual(res.statusCode, 400);
    assert.match(res.jsonData.message, /Full name is required/i);
  });

  await test('2. Registration rejects missing email (HTTP 400)', async () => {
    const { req, res } = createMockReqRes({
      body: { name: 'John Doe', password: 'Password123!' }
    });
    await register(req, res);
    assert.strictEqual(res.statusCode, 400);
    assert.match(res.jsonData.message, /valid email address/i);
  });

  await test('3. Registration rejects invalid email formats (HTTP 400)', async () => {
    for (const badEmail of ['invalid-email', 'user@', '@domain.com', 'user@.com']) {
      const { req, res } = createMockReqRes({
        body: { name: 'John Doe', email: badEmail, password: 'Password123!' }
      });
      await register(req, res);
      assert.strictEqual(res.statusCode, 400, `Expected 400 for bad email '${badEmail}'`);
    }
  });

  await test('4. Registration rejects password shorter than 6 characters (HTTP 400)', async () => {
    const { req, res } = createMockReqRes({
      body: { name: 'John Doe', email: 'shortpw@test.com', password: '123' }
    });
    await register(req, res);
    assert.strictEqual(res.statusCode, 400);
    assert.match(res.jsonData.message, /at least 6 characters/i);
  });

  await test('5. Pizza creation rejects missing name (HTTP 400)', async () => {
    const { req, res } = createMockReqRes({
      cookies: { token: tokenAdmin },
      body: { base: 'Thin Crust', sauce: 'San Marzano', cheese: 'Mozzarella', price: 299 }
    });
    await runWithAuth(req, res, (q, s) => requireAdmin(q, s, () => createPizza(q, s)));
    assert.strictEqual(res.statusCode, 400);
    assert.match(res.jsonData.message, /Pizza name is required/i);
  });

  await test('6. Pizza creation rejects missing base, sauce, or cheese (HTTP 400)', async () => {
    for (const missingField of ['base', 'sauce', 'cheese']) {
      const body = { name: 'Test Pizza', base: 'Thin Crust', sauce: 'Red', cheese: 'Mozzarella', price: 299 };
      delete body[missingField];
      const { req, res } = createMockReqRes({ cookies: { token: tokenAdmin }, body });
      await runWithAuth(req, res, (q, s) => requireAdmin(q, s, () => createPizza(q, s)));
      assert.strictEqual(res.statusCode, 400);
    }
  });

  await test('7. Pizza creation rejects negative or non-numeric price (HTTP 400)', async () => {
    for (const badPrice of [-50, 'free', NaN]) {
      const { req, res } = createMockReqRes({
        cookies: { token: tokenAdmin },
        body: { name: 'Bad Price Pizza', base: 'Thin', sauce: 'Red', cheese: 'Mozzarella', price: badPrice }
      });
      await runWithAuth(req, res, (q, s) => requireAdmin(q, s, () => createPizza(q, s)));
      assert.strictEqual(res.statusCode, 400);
      assert.match(res.jsonData.message, /non-negative number/i);
    }
  });

  await test('8. Pizza update rejects negative price (HTTP 400)', async () => {
    const { req, res } = createMockReqRes({
      cookies: { token: tokenAdmin },
      params: { id: testPizza._id },
      body: { price: -10 }
    });
    await runWithAuth(req, res, (q, s) => requireAdmin(q, s, () => updatePizza(q, s)));
    assert.strictEqual(res.statusCode, 400);
  });

  await test('9. Cart operations reject non-positive or decimal quantities (HTTP 400)', async () => {
    for (const badQty of [0, -1, 1.5, 'two']) {
      const { req, res } = createMockReqRes({
        cookies: { token: tokenA },
        body: { type: 'catalog', pizzaId: testPizza._id, quantity: badQty }
      });
      await runWithAuth(req, res, addToCart);
      assert.strictEqual(res.statusCode, 400, `Expected 400 for bad cart quantity: ${badQty}`);
    }
  });

  await test('10. Inventory updates reject negative quantities and thresholds (HTTP 400)', async () => {
    // Negative quantity
    const { req: req1, res: res1 } = createMockReqRes({
      cookies: { token: tokenAdmin },
      params: { id: baseStock._id },
      body: { quantity: -5 }
    });
    await runWithAuth(req1, res1, (q, s) => requireAdmin(q, s, () => updateInventoryItem(q, s)));
    assert.strictEqual(res1.statusCode, 400);

    // Negative threshold
    const { req: req2, res: res2 } = createMockReqRes({
      cookies: { token: tokenAdmin },
      params: { id: baseStock._id },
      body: { threshold: -1 }
    });
    await runWithAuth(req2, res2, (q, s) => requireAdmin(q, s, () => updateInventoryItem(q, s)));
    assert.strictEqual(res2.statusCode, 400);
  });

  await test('11. Malformed MongoDB IDs are rejected with HTTP 400 across all endpoints', async () => {
    const invalidId = '123-not-an-objectid';

    // Pizza GET
    const { req: r1, res: s1 } = createMockReqRes({ params: { id: invalidId } });
    await getPizzaById(r1, s1);
    assert.strictEqual(s1.statusCode, 400);

    // Order GET
    const { req: r2, res: s2 } = createMockReqRes({ cookies: { token: tokenA }, params: { id: invalidId } });
    await runWithAuth(r2, s2, getUserOrderById);
    assert.strictEqual(s2.statusCode, 400);

    // Admin Order Status PATCH
    const { req: r3, res: s3 } = createMockReqRes({
      cookies: { token: tokenAdmin },
      params: { id: invalidId },
      body: { status: 'IN_KITCHEN' }
    });
    await runWithAuth(r3, s3, (q, s) => requireAdmin(q, s, () => updateOrderStatus(q, s)));
    assert.strictEqual(s3.statusCode, 400);
  });

  await test('12. Invalid order status value rejected with HTTP 400', async () => {
    const { req, res } = createMockReqRes({
      cookies: { token: tokenAdmin },
      params: { id: orderA._id },
      body: { status: 'CANCELLED_INVALID' }
    });
    await runWithAuth(req, res, (q, s) => requireAdmin(q, s, () => updateOrderStatus(q, s)));
    assert.strictEqual(res.statusCode, 400);
    assert.match(res.jsonData.message, /Invalid status/i);
  });

  await test('13. Invalid order status backwards progression rejected with HTTP 400', async () => {
    // Attempt backwards transition from ORDER_RECEIVED to SENT_TO_DELIVERY (skipping IN_KITCHEN)
    const { req, res } = createMockReqRes({
      cookies: { token: tokenAdmin },
      params: { id: orderA._id },
      body: { status: 'SENT_TO_DELIVERY' }
    });
    await runWithAuth(req, res, (q, s) => requireAdmin(q, s, () => updateOrderStatus(q, s)));
    assert.strictEqual(res.statusCode, 400);
    assert.match(res.jsonData.message, /Invalid order status transition/i);
  });

  await test('14. Empty cart checkout attempt rejected with HTTP 400', async () => {
    // Bob has empty cart
    const { req, res } = createMockReqRes({ cookies: { token: tokenB } });
    await runWithAuth(req, res, createPaymentOrder);
    assert.strictEqual(res.statusCode, 400);
    assert.match(res.jsonData.message, /Cart is empty/i);
  });

  await test('15. Invalid payment verification signature rejected with HTTP 400', async () => {
    const { req, res } = createMockReqRes({
      cookies: { token: tokenA },
      body: {
        razorpay_order_id: 'ord_fake_123',
        razorpay_payment_id: 'pay_fake_123',
        razorpay_signature: 'forged_fake_signature_hex'
      }
    });
    await runWithAuth(req, res, verifyPaymentAndCreateOrder);
    assert.strictEqual(res.statusCode, 400);
    assert.match(res.jsonData.message, /Payment verification failed/i);
  });

  await test('16. Centralized error handler captures Express body-parser malformed JSON SyntaxError (HTTP 400)', async () => {
    const syntaxErr = new SyntaxError('Unexpected token in JSON');
    syntaxErr.status = 400;
    syntaxErr.body = '{"bad_json:';

    const { req, res } = createMockReqRes();
    errorHandler(syntaxErr, req, res, () => {});
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.jsonData.success, false);
    assert.strictEqual(res.jsonData.message, 'Malformed JSON in request body');
  });

  // =========================================================================
  // TASK 3: MISSING RESOURCES AND ROUTING ERRORS
  // =========================================================================
  console.log('\n--- 2. MISSING RESOURCES AND ROUTING ERRORS (TASK 3) ---');

  const ghostId = new mongoose.Types.ObjectId().toString();

  await test('17. Non-existent pizza ID returns HTTP 404', async () => {
    const { req, res } = createMockReqRes({ params: { id: ghostId } });
    await getPizzaById(req, res);
    assert.strictEqual(res.statusCode, 404);
    assert.match(res.jsonData.message, /Pizza not found/i);
  });

  await test('18. Non-existent customer order ID returns HTTP 404', async () => {
    const { req, res } = createMockReqRes({ cookies: { token: tokenA }, params: { id: ghostId } });
    await runWithAuth(req, res, getUserOrderById);
    assert.strictEqual(res.statusCode, 404);
    assert.match(res.jsonData.message, /Order not found/i);
  });

  await test('19. Non-existent admin order ID returns HTTP 404', async () => {
    const { req, res } = createMockReqRes({ cookies: { token: tokenAdmin }, params: { id: ghostId } });
    await runWithAuth(req, res, (q, s) => requireAdmin(q, s, () => getAdminOrderById(q, s)));
    assert.strictEqual(res.statusCode, 404);
  });

  await test('20. Non-existent cart item ID on update returns HTTP 404', async () => {
    const { req, res } = createMockReqRes({ cookies: { token: tokenA }, params: { itemId: ghostId }, body: { quantity: 2 } });
    await runWithAuth(req, res, updateCartItemQuantity);
    assert.strictEqual(res.statusCode, 404);
    assert.match(res.jsonData.message, /Cart item not found/i);
  });

  await test('21. Non-existent cart item ID on delete returns HTTP 404', async () => {
    const { req, res } = createMockReqRes({ cookies: { token: tokenA }, params: { itemId: ghostId } });
    await runWithAuth(req, res, removeCartItem);
    assert.strictEqual(res.statusCode, 404);
  });

  await test('22. Non-existent inventory item on update returns HTTP 404', async () => {
    const { req, res } = createMockReqRes({ cookies: { token: tokenAdmin }, params: { id: ghostId }, body: { quantity: 10 } });
    await runWithAuth(req, res, (q, s) => requireAdmin(q, s, () => updateInventoryItem(q, s)));
    assert.strictEqual(res.statusCode, 404);
    assert.match(res.jsonData.message, /Inventory item not found/i);
  });

  await test('23. Non-existent pizza ID on update returns HTTP 404', async () => {
    const { req, res } = createMockReqRes({ cookies: { token: tokenAdmin }, params: { id: ghostId }, body: { price: 499 } });
    await runWithAuth(req, res, (q, s) => requireAdmin(q, s, () => updatePizza(q, s)));
    assert.strictEqual(res.statusCode, 404);
  });

  await test('24. Non-existent pizza ID on delete returns HTTP 404', async () => {
    const { req, res } = createMockReqRes({ cookies: { token: tokenAdmin }, params: { id: ghostId } });
    await runWithAuth(req, res, (q, s) => requireAdmin(q, s, () => deletePizza(q, s)));
    assert.strictEqual(res.statusCode, 404);
  });

  await test('25. Undefined API endpoint caught by notFoundHandler returns HTTP 404 JSON', async () => {
    const { req, res } = createMockReqRes();
    notFoundHandler(req, res);
    assert.strictEqual(res.statusCode, 404);
    assert.strictEqual(res.jsonData.success, false);
    assert.strictEqual(res.jsonData.message, 'Resource not found');
  });

  await test('26. Cross-customer order access attempt returns HTTP 403 Forbidden', async () => {
    const { req, res } = createMockReqRes({ cookies: { token: tokenB }, params: { id: orderA._id } });
    await runWithAuth(req, res, getUserOrderById);
    assert.strictEqual(res.statusCode, 403);
    assert.match(res.jsonData.message, /Access denied/i);
  });

  // =========================================================================
  // TASK 4: AUTHENTICATION AND AUTHORIZATION ERRORS
  // =========================================================================
  console.log('\n--- 3. AUTHENTICATION & AUTHORIZATION ERRORS (TASK 4) ---');

  await test('27. Missing token on protected endpoint returns HTTP 401', async () => {
    const { req, res } = createMockReqRes();
    await runWithAuth(req, res, getCurrentUser);
    assert.strictEqual(res.statusCode, 401);
    assert.match(res.jsonData.message, /No token provided/i);
  });

  await test('28. Malformed token string returns HTTP 401', async () => {
    const { req, res } = createMockReqRes({ cookies: { token: 'corrupted.jwt.payload' } });
    await runWithAuth(req, res, getCurrentUser);
    assert.strictEqual(res.statusCode, 401);
    assert.match(res.jsonData.message, /Invalid authentication token/i);
  });

  await test('29. Tampered token signature returns HTTP 401', async () => {
    const fakeToken = jwt.sign({ userId: customerA._id }, 'wrong_secret');
    const { req, res } = createMockReqRes({ cookies: { token: fakeToken } });
    await runWithAuth(req, res, getCurrentUser);
    assert.strictEqual(res.statusCode, 401);
  });

  await test('30. Expired token triggers TokenExpiredError with HTTP 401', async () => {
    const expiredToken = jwt.sign({ userId: customerA._id }, process.env.JWT_SECRET, { expiresIn: '-1s' });
    const { req, res } = createMockReqRes({ cookies: { token: expiredToken } });
    await runWithAuth(req, res, getCurrentUser);
    assert.strictEqual(res.statusCode, 401);
    assert.match(res.jsonData.message, /session has expired/i);
  });

  await test('31. Regular customer accessing admin test endpoint returns HTTP 403', async () => {
    const { req, res } = createMockReqRes({ cookies: { token: tokenA } });
    await runWithAuth(req, res, (q, s) => requireAdmin(q, s, () => adminTest(q, s)));
    assert.strictEqual(res.statusCode, 403);
    assert.match(res.jsonData.message, /Administrator privileges required/i);
  });

  await test('32. Regular customer credentials to admin login endpoint returns HTTP 403', async () => {
    const { req, res } = createMockReqRes({ body: { email: customerA.email, password: 'AlicePass123!' } });
    await adminLogin(req, res);
    assert.strictEqual(res.statusCode, 403);
  });

  await test('33. Request made after logout (cleared cookie) returns HTTP 401', async () => {
    const { req, res } = createMockReqRes({ cookies: { token: '' } });
    await runWithAuth(req, res, getCurrentUser);
    assert.strictEqual(res.statusCode, 401);
  });

  // =========================================================================
  // TASK 5: DATABASE AND BACKEND FAILURES
  // =========================================================================
  console.log('\n--- 4. DATABASE & BACKEND FAILURE RECOVERY (TASK 5) ---');

  await test('34. Centralized error handler maps Mongoose CastError to HTTP 400', async () => {
    const castErr = new mongoose.Error.CastError('ObjectId', 'bad-id', '_id');
    const { req, res } = createMockReqRes();
    errorHandler(castErr, req, res, () => {});
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.jsonData.success, false);
    assert.match(res.jsonData.message, /Invalid format for/i);
  });

  await test('35. Centralized error handler maps Mongoose ValidationError to HTTP 400', async () => {
    const validationErr = new mongoose.Error.ValidationError();
    validationErr.errors = {
      name: { message: 'Name is required' },
      price: { message: 'Price must be positive' }
    };
    const { req, res } = createMockReqRes();
    errorHandler(validationErr, req, res, () => {});
    assert.strictEqual(res.statusCode, 400);
    assert.match(res.jsonData.message, /Name is required/i);
  });

  await test('36. Centralized error handler maps MongoDB duplicate key (code 11000) to HTTP 400', async () => {
    const dupErr = new Error('E11000 duplicate key error');
    dupErr.code = 11000;
    dupErr.keyValue = { email: 'alice.test@example.com' };

    const { req, res } = createMockReqRes();
    errorHandler(dupErr, req, res, () => {});
    assert.strictEqual(res.statusCode, 400);
    assert.match(res.jsonData.message, /Duplicate value entered for email/i);
  });

  await test('37. Centralized error handler maps generic 500 exceptions safely without server crash', async () => {
    const internalErr = new Error('Database connection dropped unexpectedly');
    const { req, res } = createMockReqRes();
    errorHandler(internalErr, req, res, () => {});
    assert.strictEqual(res.statusCode, 500);
    assert.strictEqual(res.jsonData.success, false);
    assert.strictEqual(res.jsonData.message, 'Database connection dropped unexpectedly');
  });

  await test('38. Production mode error response omits stack trace completely', async () => {
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const testErr = new Error('Production error scenario');
    testErr.stack = 'Error: Production error scenario\n    at /secret/path/server.js:99:9';

    const { req, res } = createMockReqRes();
    errorHandler(testErr, req, res, () => {});
    assert.strictEqual(res.jsonData.stack, undefined, 'Stack trace must be strictly undefined in production');

    process.env.NODE_ENV = prevEnv;
  });

  await test('39. Non-production mode includes stack trace for developer debugging', async () => {
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const testErr = new Error('Dev error scenario');
    testErr.stack = 'Error: Dev error scenario\n    at test.js:1:1';

    const { req, res } = createMockReqRes();
    errorHandler(testErr, req, res, () => {});
    assert.ok(res.jsonData.stack !== undefined, 'Stack trace should be provided in development');

    process.env.NODE_ENV = prevEnv;
  });

  // =========================================================================
  // TASK 7: PAYMENT, IDEMPOTENCY & TRANSACTION ROLLBACKS
  // =========================================================================
  console.log('\n--- 5. PAYMENT, IDEMPOTENCY & ROLLBACK TESTS (TASK 7) ---');

  await test('40. Payment verification with forged signature fails with HTTP 400 and creates NO order', async () => {
    const ordersCountBefore = store.orders.size;
    const { req, res } = createMockReqRes({
      cookies: { token: tokenA },
      body: {
        razorpay_order_id: 'ord_forged_999',
        razorpay_payment_id: 'pay_forged_999',
        razorpay_signature: 'invalid_fraudulent_sig'
      }
    });
    await runWithAuth(req, res, verifyPaymentAndCreateOrder);
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(store.orders.size, ordersCountBefore, 'No order document should be recorded');
  });

  await test('41. Forged payment verification does NOT deduct any inventory stock', async () => {
    const cheeseQtyBefore = cheeseStock.quantity;
    const { req, res } = createMockReqRes({
      cookies: { token: tokenA },
      body: {
        razorpay_order_id: 'ord_forged_888',
        razorpay_payment_id: 'pay_forged_888',
        razorpay_signature: 'bad_signature'
      }
    });
    await runWithAuth(req, res, verifyPaymentAndCreateOrder);
    assert.strictEqual(cheeseStock.quantity, cheeseQtyBefore, 'Inventory stock must remain untouched on bad signature');
  });

  await test('42. Duplicate payment verification is idempotent (returns existing order without double-deduction)', async () => {
    // orderA was seeded with razorpayOrderId: 'ord_qa_alice' and paymentId: 'pay_qa_alice'
    const cheeseQtyBefore = cheeseStock.quantity;
    const { req, res } = createMockReqRes({
      cookies: { token: tokenA },
      body: {
        razorpay_order_id: 'ord_qa_alice',
        razorpay_payment_id: 'pay_qa_alice',
        razorpay_signature: 'simulated_sig'
      }
    });
    await runWithAuth(req, res, verifyPaymentAndCreateOrder);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.jsonData.order._id.toString(), orderA._id.toString());
    assert.strictEqual(cheeseStock.quantity, cheeseQtyBefore, 'Stock must not be double-deducted on idempotent replay');
  });

  await test('43. Pre-checkout stock insufficiency halts checkout creation and reports depleted items', async () => {
    // Deplete cheese stock to 0
    cheeseStock.quantity = 0;

    const { req, res } = createMockReqRes({ cookies: { token: tokenA } });
    await runWithAuth(req, res, createPaymentOrder);

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.jsonData.success, false);
    assert.ok(Array.isArray(res.jsonData.insufficientItems));
    assert.ok(res.jsonData.insufficientItems.some(i => i.item.toLowerCase().includes('mozzarella')));

    // Restore cheese stock
    cheeseStock.quantity = 50;
  });

  // =========================================================================
  // TASK 8: CONFIDENTIAL DATA & LOG SANITIZATION
  // =========================================================================
  console.log('\n--- 6. CONFIDENTIAL DATA & LOG SANITIZATION (TASK 8) ---');

  await test('44. Registration response never exposes plain password or hash', async () => {
    const { req, res } = createMockReqRes({
      body: { name: 'Safe User', email: 'safe.reg@example.com', password: 'SecretPassword999!' }
    });
    await register(req, res);
    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.jsonData.user.password, undefined);
    assert.strictEqual(JSON.stringify(res.jsonData).includes('SecretPassword999!'), false);
  });

  await test('45. Login response never exposes plain password or hash', async () => {
    const { req, res } = createMockReqRes({
      body: { email: customerA.email, password: 'AlicePass123!' }
    });
    await login(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.jsonData.user.password, undefined);
  });

  await test('46. GET /api/auth/me response excludes password field', async () => {
    const { req, res } = createMockReqRes({ cookies: { token: tokenA } });
    await runWithAuth(req, res, getCurrentUser);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.jsonData.user.password, undefined);
  });

  await test('47. JWT payload never contains user password', async () => {
    const decoded = jwt.decode(tokenA);
    assert.strictEqual(decoded.password, undefined);
    assert.strictEqual(decoded.role, 'user');
    assert.strictEqual(decoded.userId, customerA._id.toString());
  });

  await test('48. Database URI credentials sanitization helper scrubs passwords', () => {
    const rawUri = 'mongodb+srv://admin_user:SuperSecretPassword123@cluster0.mongodb.net/pizzadb';
    const sanitized = rawUri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:*****@');
    assert.strictEqual(sanitized, 'mongodb+srv://admin_user:*****@cluster0.mongodb.net/pizzadb');
    assert.strictEqual(sanitized.includes('SuperSecretPassword123'), false);
  });

  await test('49. Express trust proxy is configured to 1 for reverse proxy deployments', () => {
    const app = require('../server');
    assert.strictEqual(app.get('trust proxy'), 1);
  });

  await test('50. CLIENT_URL normalization strips trailing slashes', () => {
    const normalize = (url) => (url || '').trim().replace(/\/+$/, '');
    assert.strictEqual(normalize('http://localhost:5173/'), 'http://localhost:5173');
    assert.strictEqual(normalize('https://pizzaflow.vercel.app///'), 'https://pizzaflow.vercel.app');
    assert.strictEqual(normalize('https://pizzaflow.vercel.app'), 'https://pizzaflow.vercel.app');
  });

  await test('51. CORS middleware origin validator permits configured origin and rejects rogue origin', () => {
    const configuredOrigin = 'http://localhost:5173';
    const validateOrigin = (origin) => {
      if (!origin) return true;
      return origin.trim().replace(/\/+$/, '') === configuredOrigin;
    };
    assert.strictEqual(validateOrigin('http://localhost:5173'), true);
    assert.strictEqual(validateOrigin('http://localhost:5173/'), true);
    assert.strictEqual(validateOrigin('https://attacker-origin.com'), false);
    assert.strictEqual(validateOrigin(null), true);
  });

  await test('52. GET /api/health returns HTTP 200 when database is connected (readyState === 1)', () => {
    const healthRoutes = require('../routes/health.routes');
    const origReadyState = mongoose.connection.readyState;
    Object.defineProperty(mongoose.connection, 'readyState', { value: 1, configurable: true });
    const { req, res } = createMockReqRes();
    healthRoutes.healthCheckHandler(req, res);
    Object.defineProperty(mongoose.connection, 'readyState', { value: origReadyState, configurable: true });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.jsonData.success, true);
    assert.strictEqual(res.jsonData.status, 'online');
    assert.strictEqual(res.jsonData.database.connected, true);
    assert.strictEqual(res.jsonData.database.status, 'connected');
  });

  await test('53. GET /api/health returns HTTP 503 when database is disconnected (readyState === 0)', () => {
    const healthRoutes = require('../routes/health.routes');
    const origReadyState = mongoose.connection.readyState;
    Object.defineProperty(mongoose.connection, 'readyState', { value: 0, configurable: true });
    const { req, res } = createMockReqRes();
    healthRoutes.healthCheckHandler(req, res);
    Object.defineProperty(mongoose.connection, 'readyState', { value: origReadyState, configurable: true });
    assert.strictEqual(res.statusCode, 503);
    assert.strictEqual(res.jsonData.success, false);
    assert.strictEqual(res.jsonData.status, 'degraded');
    assert.strictEqual(res.jsonData.database.connected, false);
    assert.strictEqual(res.jsonData.database.status, 'disconnected');
  });

  await test('54. GET /api/health returns HTTP 503 when database is connecting (readyState === 2)', () => {
    const healthRoutes = require('../routes/health.routes');
    const origReadyState = mongoose.connection.readyState;
    Object.defineProperty(mongoose.connection, 'readyState', { value: 2, configurable: true });
    const { req, res } = createMockReqRes();
    healthRoutes.healthCheckHandler(req, res);
    Object.defineProperty(mongoose.connection, 'readyState', { value: origReadyState, configurable: true });
    assert.strictEqual(res.statusCode, 503);
    assert.strictEqual(res.jsonData.success, false);
    assert.strictEqual(res.jsonData.database.connected, false);
    assert.strictEqual(res.jsonData.database.status, 'connecting');
  });

  await test('55. Generic HTTP 500 error in production returns "Internal Server Error" and suppresses stack trace', () => {
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const secretInternalErr = new Error('Sensitive MongoDB Atlas host connection error: cluster0.mongodb.net');
    secretInternalErr.stack = 'Error: Sensitive MongoDB error\n    at internal/db.js:10:1';

    const { req, res } = createMockReqRes();
    errorHandler(secretInternalErr, req, res, () => {});

    process.env.NODE_ENV = prevEnv;

    assert.strictEqual(res.statusCode, 500);
    assert.strictEqual(res.jsonData.success, false);
    assert.strictEqual(res.jsonData.message, 'Internal Server Error');
    assert.strictEqual(res.jsonData.stack, undefined);
    assert.strictEqual(JSON.stringify(res.jsonData).includes('cluster0.mongodb.net'), false);
  });

  await test('56. Importing the Express app does not register fatal process handlers or start the server', () => {
    const app = require('../server');
    assert.ok(app && typeof app.use === 'function', 'app must be an Express application');
    assert.strictEqual(app.getIsServerRunning(), false, 'HTTP server must not be running upon import');
    assert.notStrictEqual(require.main.filename, require.resolve('../server'), 'Server must not be the main module when imported in tests');
  });

  await test('57. Graceful shutdown invokes cron stop, closes database, and exits with requested exit code', async () => {
    const app = require('../server');
    const origExit = process.exit;
    let capturedExitCode = null;
    process.exit = (code) => { capturedExitCode = code; };

    let cronStopped = false;
    const cronModule = require('../utils/inventoryAlertCron');
    const origStopCron = cronModule.stopInventoryAlertCron;
    cronModule.stopInventoryAlertCron = () => { cronStopped = true; origStopCron(); };

    try {
      app.resetShutdownStateForTesting();
      await app.handleGracefulShutdown('SIGTERM', 0);
      assert.strictEqual(cronStopped, true);
      assert.strictEqual(capturedExitCode, 0);
    } finally {
      process.exit = origExit;
      cronModule.stopInventoryAlertCron = origStopCron;
      app.resetShutdownStateForTesting();
    }
  });

  await test('58. Graceful shutdown handles fatal failures with exit code 1', async () => {
    const app = require('../server');
    const origExit = process.exit;
    let capturedExitCode = null;
    process.exit = (code) => { capturedExitCode = code; };

    try {
      app.resetShutdownStateForTesting();
      await app.handleGracefulShutdown('unhandledRejection', 1);
      assert.strictEqual(capturedExitCode, 1);
    } finally {
      process.exit = origExit;
      app.resetShutdownStateForTesting();
    }
  });

  await test('59. Graceful shutdown is idempotent and ignores duplicate concurrent signals', async () => {
    const app = require('../server');
    const origExit = process.exit;
    let exitCallCount = 0;
    process.exit = (code) => { exitCallCount++; };

    try {
      app.resetShutdownStateForTesting();
      const p1 = app.handleGracefulShutdown('SIGTERM', 0);
      const p2 = app.handleGracefulShutdown('SIGINT', 0);
      await Promise.all([p1, p2]);
      assert.strictEqual(exitCallCount, 1);
      assert.strictEqual(app.getIsShuttingDown(), true);
    } finally {
      process.exit = origExit;
      app.resetShutdownStateForTesting();
    }
  });

  await test('60. Graceful shutdown watchdog timer fallback forces process.exit(1) when HTTP server closure hangs', async () => {
    const app = require('../server');
    const origExit = process.exit;
    let fallbackExitCode = null;
    const exitPromise = new Promise((resolve) => {
      process.exit = (code) => {
        fallbackExitCode = code;
        resolve(code);
      };
    });

    // Mock hanging server whose close callback is intentionally never invoked
    const hangingServer = {
      close: () => {
        // Deliberately stall callback
      }
    };

    try {
      app.resetShutdownStateForTesting();
      app.setServerInstanceForTesting(hangingServer);

      // Trigger shutdown with short 50ms watchdog timeout
      app.handleGracefulShutdown('SIGTERM', 0, 50);

      const exitCode = await exitPromise;
      assert.strictEqual(exitCode, 1);
      assert.strictEqual(fallbackExitCode, 1);
    } finally {
      process.exit = origExit;
      app.setServerInstanceForTesting(null);
      app.resetShutdownStateForTesting();
    }
  });

  restoreMocks();

  console.log('\n====================================================');
  console.log(`TOTAL ERROR HANDLING QA TESTS: ${passed + failed}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

// Execute suite directly
if (require.main === module) {
  runErrorHandlingQASuite().catch(err => {
    console.error('Fatal error in Error Handling QA Suite:', err);
    process.exit(1);
  });
}

module.exports = runErrorHandlingQASuite;
