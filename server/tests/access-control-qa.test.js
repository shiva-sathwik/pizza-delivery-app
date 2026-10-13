/**
 * Step 9C — Test 5: Access Control QA Automated Integration Test Suite
 *
 * Comprehensive Access Control & Security Audit:
 * 1. Task 2: Unauthenticated Access Rejection (HTTP 401 across protected routes)
 * 2. Task 3: Customer vs Admin Role Authorization (HTTP 403 enforcement)
 * 3. Task 4: Authentication Invalidation, Token Tampering & Session Termination
 * 4. Task 5: Customer Data Isolation & Insecure Direct Object References (IDOR)
 * 5. Task 6: Direct API & Privilege Escalation Defenses (role & price tampering)
 * 6. Task 7: Route Guards and Identity Derivation Consistency
 */

const assert = require('assert');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

// Ensure isolated test environment
process.env.JWT_SECRET = process.env.JWT_SECRET || 'access_control_qa_secret_key_98765';
process.env.JWT_EXPIRES_IN = '1h';
process.env.CLIENT_URL = 'http://localhost:5173';
process.env.NODE_ENV = 'test';

// Middleware & Controllers
const { authenticate, requireAdmin, optionalAuthenticate } = require('../middleware/auth.middleware');
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
      if (query.name && p.name.toLowerCase() === query.name.toLowerCase()) return p;
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
async function runAccessControlQASuite() {
  console.log('\n====================================================');
  console.log('🛡️  STEP 9C — TEST 5: ACCESS CONTROL QA AUDIT');
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

  // Seed Inventory & Catalog items
  const testStockItem = wrapInventoryDoc({
    category: 'cheese',
    item: 'Mozzarella',
    quantity: 100,
    threshold: 20
  });
  await testStockItem.save();

  const testPizza = wrapPizzaDoc({
    name: 'Margherita Classic',
    base: 'Thin Crust',
    sauce: 'Classic San Marzano Tomato',
    cheese: '100% Mozzarella',
    price: 399,
    isAvailable: true
  });
  await testPizza.save();

  // Seed Customer A Order
  const orderA = wrapOrderDoc({
    user: customerA._id,
    items: [{ name: 'Margherita Classic', price: 399, quantity: 1 }],
    total: 399,
    status: 'ORDER_RECEIVED',
    payment: { status: 'PAID', razorpayOrderId: 'order_alice_1', razorpayPaymentId: 'pay_alice_1' }
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
      quantity: 2
    }]
  });
  await cartA.save();

  // =========================================================================
  // TASK 2: UNAUTHENTICATED ACCESS REJECTION (HTTP 401)
  // =========================================================================
  console.log('\n--- 1. UNAUTHENTICATED ACCESS TESTS (TASK 2) ---');

  await test('1. Unauthenticated request to authenticate middleware returns HTTP 401', async () => {
    const { req, res } = createMockReqRes();
    let nextCalled = false;
    await authenticate(req, res, () => { nextCalled = true; });
    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(res.jsonData.success, false);
    assert.strictEqual(nextCalled, false);
  });

  await test('2. Unauthenticated GET /api/auth/me is blocked with HTTP 401', async () => {
    const { req, res } = createMockReqRes();
    await runWithAuth(req, res, getCurrentUser);
    assert.strictEqual(res.statusCode, 401);
  });

  await test('3. Unauthenticated GET /api/cart is blocked with HTTP 401', async () => {
    const { req, res } = createMockReqRes();
    await runWithAuth(req, res, getCart);
    assert.strictEqual(res.statusCode, 401);
  });

  await test('4. Unauthenticated POST /api/cart is blocked with HTTP 401', async () => {
    const { req, res } = createMockReqRes({ body: { type: 'catalog', pizzaId: testPizza._id } });
    await runWithAuth(req, res, addToCart);
    assert.strictEqual(res.statusCode, 401);
  });

  await test('5. Unauthenticated PUT /api/cart/:itemId is blocked with HTTP 401', async () => {
    const { req, res } = createMockReqRes({ params: { itemId: 'item_123' }, body: { quantity: 3 } });
    await runWithAuth(req, res, updateCartItemQuantity);
    assert.strictEqual(res.statusCode, 401);
  });

  await test('6. Unauthenticated DELETE /api/cart/:itemId is blocked with HTTP 401', async () => {
    const { req, res } = createMockReqRes({ params: { itemId: 'item_123' } });
    await runWithAuth(req, res, removeCartItem);
    assert.strictEqual(res.statusCode, 401);
  });

  await test('7. Unauthenticated DELETE /api/cart is blocked with HTTP 401', async () => {
    const { req, res } = createMockReqRes();
    await runWithAuth(req, res, clearCart);
    assert.strictEqual(res.statusCode, 401);
  });

  await test('8. Unauthenticated GET /api/orders is blocked with HTTP 401', async () => {
    const { req, res } = createMockReqRes();
    await runWithAuth(req, res, getUserOrders);
    assert.strictEqual(res.statusCode, 401);
  });

  await test('9. Unauthenticated GET /api/orders/:id is blocked with HTTP 401', async () => {
    const { req, res } = createMockReqRes({ params: { id: orderA._id } });
    await runWithAuth(req, res, getUserOrderById);
    assert.strictEqual(res.statusCode, 401);
  });

  await test('10. Unauthenticated POST /api/orders/payment/create is blocked with HTTP 401', async () => {
    const { req, res } = createMockReqRes();
    await runWithAuth(req, res, createPaymentOrder);
    assert.strictEqual(res.statusCode, 401);
  });

  await test('11. Unauthenticated POST /api/orders/payment/verify is blocked with HTTP 401', async () => {
    const { req, res } = createMockReqRes({
      body: { razorpay_order_id: 'ord_1', razorpay_payment_id: 'pay_1', razorpay_signature: 'sig_1' }
    });
    await runWithAuth(req, res, verifyPaymentAndCreateOrder);
    assert.strictEqual(res.statusCode, 401);
  });

  await test('12. Unauthenticated GET /api/admin/test is blocked with HTTP 401', async () => {
    const { req, res } = createMockReqRes();
    await runWithAuth(req, res, (q, s) => requireAdmin(q, s, () => adminTest(q, s)));
    assert.strictEqual(res.statusCode, 401);
  });

  await test('13. Unauthenticated GET /api/admin/orders is blocked with HTTP 401', async () => {
    const { req, res } = createMockReqRes();
    await runWithAuth(req, res, (q, s) => requireAdmin(q, s, () => getAdminOrders(q, s)));
    assert.strictEqual(res.statusCode, 401);
  });

  await test('14. Unauthenticated PATCH /api/admin/orders/:id/status is blocked with HTTP 401', async () => {
    const { req, res } = createMockReqRes({ params: { id: orderA._id }, body: { status: 'IN_KITCHEN' } });
    await runWithAuth(req, res, (q, s) => requireAdmin(q, s, () => updateOrderStatus(q, s)));
    assert.strictEqual(res.statusCode, 401);
  });

  await test('15. Unauthenticated GET /api/admin/analytics is blocked with HTTP 401', async () => {
    const { req, res } = createMockReqRes({ query: { period: 'daily' } });
    await runWithAuth(req, res, (q, s) => requireAdmin(q, s, () => getAdminAnalytics(q, s)));
    assert.strictEqual(res.statusCode, 401);
  });

  await test('16. Unauthenticated GET /api/inventory is blocked with HTTP 401', async () => {
    const { req, res } = createMockReqRes();
    await runWithAuth(req, res, (q, s) => requireAdmin(q, s, () => getInventory(q, s)));
    assert.strictEqual(res.statusCode, 401);
  });

  await test('17. Unauthenticated PUT /api/inventory/:id is blocked with HTTP 401', async () => {
    const { req, res } = createMockReqRes({ params: { id: testStockItem._id }, body: { quantity: 50 } });
    await runWithAuth(req, res, (q, s) => requireAdmin(q, s, () => updateInventoryItem(q, s)));
    assert.strictEqual(res.statusCode, 401);
  });

  await test('18. Unauthenticated POST /api/inventory is blocked with HTTP 401', async () => {
    const { req, res } = createMockReqRes({ body: { category: 'sauce', item: 'Pesto', quantity: 20, threshold: 5 } });
    await runWithAuth(req, res, (q, s) => requireAdmin(q, s, () => createInventoryItem(q, s)));
    assert.strictEqual(res.statusCode, 401);
  });

  await test('19. Unauthenticated POST /api/pizzas is blocked with HTTP 401', async () => {
    const { req, res } = createMockReqRes({ body: { name: 'Veggie Supreme', base: 'Thin', sauce: 'Red', cheese: 'Mozzarella', price: 450 } });
    await runWithAuth(req, res, (q, s) => requireAdmin(q, s, () => createPizza(q, s)));
    assert.strictEqual(res.statusCode, 401);
  });

  await test('20. Unauthenticated PUT /api/pizzas/:id is blocked with HTTP 401', async () => {
    const { req, res } = createMockReqRes({ params: { id: testPizza._id }, body: { price: 500 } });
    await runWithAuth(req, res, (q, s) => requireAdmin(q, s, () => updatePizza(q, s)));
    assert.strictEqual(res.statusCode, 401);
  });

  await test('21. Unauthenticated DELETE /api/pizzas/:id is blocked with HTTP 401', async () => {
    const { req, res } = createMockReqRes({ params: { id: testPizza._id } });
    await runWithAuth(req, res, (q, s) => requireAdmin(q, s, () => deletePizza(q, s)));
    assert.strictEqual(res.statusCode, 401);
  });

  // =========================================================================
  // TASK 3: CUSTOMER VERSUS ADMIN AUTHORIZATION (HTTP 403)
  // =========================================================================
  console.log('\n--- 2. CUSTOMER VS ADMIN ROLE AUTHORIZATION TESTS (TASK 3) ---');

  await test('22. Customer accessing GET /api/admin/test is rejected with HTTP 403 Forbidden', async () => {
    const { req, res } = createMockReqRes({ cookies: { token: tokenA } });
    await runWithAuth(req, res, (q, s) => requireAdmin(q, s, () => adminTest(q, s)));
    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(res.jsonData.success, false);
    assert.match(res.jsonData.message, /Administrator privileges required/i);
  });

  await test('23. Customer accessing GET /api/admin/orders is rejected with HTTP 403', async () => {
    const { req, res } = createMockReqRes({ cookies: { token: tokenA } });
    await runWithAuth(req, res, (q, s) => requireAdmin(q, s, () => getAdminOrders(q, s)));
    assert.strictEqual(res.statusCode, 403);
  });

  await test('24. Customer accessing GET /api/admin/orders/:id is rejected with HTTP 403', async () => {
    const { req, res } = createMockReqRes({ cookies: { token: tokenA }, params: { id: orderA._id } });
    await runWithAuth(req, res, (q, s) => requireAdmin(q, s, () => getAdminOrderById(q, s)));
    assert.strictEqual(res.statusCode, 403);
  });

  await test('25. Customer attempting PATCH /api/admin/orders/:id/status is rejected with HTTP 403', async () => {
    const { req, res } = createMockReqRes({
      cookies: { token: tokenA },
      params: { id: orderA._id },
      body: { status: 'IN_KITCHEN' }
    });
    await runWithAuth(req, res, (q, s) => requireAdmin(q, s, () => updateOrderStatus(q, s)));
    assert.strictEqual(res.statusCode, 403);
    // Verify order status was NOT changed
    assert.strictEqual(orderA.status, 'ORDER_RECEIVED');
  });

  await test('26. Customer accessing GET /api/admin/analytics is rejected with HTTP 403', async () => {
    const { req, res } = createMockReqRes({ cookies: { token: tokenA }, query: { period: 'daily' } });
    await runWithAuth(req, res, (q, s) => requireAdmin(q, s, () => getAdminAnalytics(q, s)));
    assert.strictEqual(res.statusCode, 403);
  });

  await test('27. Customer accessing GET /api/inventory is rejected with HTTP 403', async () => {
    const { req, res } = createMockReqRes({ cookies: { token: tokenA } });
    await runWithAuth(req, res, (q, s) => requireAdmin(q, s, () => getInventory(q, s)));
    assert.strictEqual(res.statusCode, 403);
  });

  await test('28. Customer attempting PUT /api/inventory/:id is rejected with HTTP 403 (Zero DB change)', async () => {
    const initialQty = testStockItem.quantity;
    const { req, res } = createMockReqRes({
      cookies: { token: tokenA },
      params: { id: testStockItem._id },
      body: { quantity: 9999 }
    });
    await runWithAuth(req, res, (q, s) => requireAdmin(q, s, () => updateInventoryItem(q, s)));
    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(testStockItem.quantity, initialQty, 'Stock quantity must remain completely unmodified');
  });

  await test('29. Customer attempting POST /api/inventory is rejected with HTTP 403', async () => {
    const countBefore = store.inventory.size;
    const { req, res } = createMockReqRes({
      cookies: { token: tokenA },
      body: { category: 'sauce', item: 'Spicy Arrabbiata', quantity: 50, threshold: 10 }
    });
    await runWithAuth(req, res, (q, s) => requireAdmin(q, s, () => createInventoryItem(q, s)));
    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(store.inventory.size, countBefore, 'No item should be added to inventory');
  });

  await test('30. Customer attempting POST /api/pizzas is rejected with HTTP 403', async () => {
    const countBefore = store.pizzas.size;
    const { req, res } = createMockReqRes({
      cookies: { token: tokenA },
      body: { name: 'Customer Pizza Attempt', base: 'Thin', sauce: 'Red', cheese: 'Cheddar', price: 299 }
    });
    await runWithAuth(req, res, (q, s) => requireAdmin(q, s, () => createPizza(q, s)));
    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(store.pizzas.size, countBefore);
  });

  await test('31. Customer attempting PUT /api/pizzas/:id is rejected with HTTP 403', async () => {
    const initialPrice = testPizza.price;
    const { req, res } = createMockReqRes({
      cookies: { token: tokenA },
      params: { id: testPizza._id },
      body: { price: 10 } // Malicious attempt to change price to 10
    });
    await runWithAuth(req, res, (q, s) => requireAdmin(q, s, () => updatePizza(q, s)));
    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(testPizza.price, initialPrice, 'Pizza price must not be modified');
  });

  await test('32. Customer attempting DELETE /api/pizzas/:id is rejected with HTTP 403', async () => {
    const { req, res } = createMockReqRes({
      cookies: { token: tokenA },
      params: { id: testPizza._id }
    });
    await runWithAuth(req, res, (q, s) => requireAdmin(q, s, () => deletePizza(q, s)));
    assert.strictEqual(res.statusCode, 403);
    assert.ok(store.pizzas.has(testPizza._id.toString()), 'Pizza must not be deleted');
  });

  await test('33. Admin accessing GET /api/admin/test succeeds with HTTP 200', async () => {
    const { req, res } = createMockReqRes({ cookies: { token: tokenAdmin } });
    await runWithAuth(req, res, (q, s) => requireAdmin(q, s, () => adminTest(q, s)));
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.jsonData.success, true);
    assert.strictEqual(res.jsonData.admin.role, 'admin');
  });

  await test('34. Admin accessing GET /api/admin/orders succeeds with HTTP 200', async () => {
    const { req, res } = createMockReqRes({ cookies: { token: tokenAdmin } });
    await runWithAuth(req, res, (q, s) => requireAdmin(q, s, () => getAdminOrders(q, s)));
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.jsonData.success, true);
    assert.ok(Array.isArray(res.jsonData.orders));
  });

  await test('35. Admin accessing GET /api/admin/analytics succeeds with HTTP 200', async () => {
    const { req, res } = createMockReqRes({ cookies: { token: tokenAdmin }, query: { period: 'daily' } });
    await runWithAuth(req, res, (q, s) => requireAdmin(q, s, () => getAdminAnalytics(q, s)));
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.jsonData.success, true);
  });

  await test('36. Admin accessing GET /api/inventory succeeds with HTTP 200', async () => {
    const { req, res } = createMockReqRes({ cookies: { token: tokenAdmin } });
    await runWithAuth(req, res, (q, s) => requireAdmin(q, s, () => getInventory(q, s)));
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.jsonData.success, true);
    assert.ok(Array.isArray(res.jsonData.inventory));
  });

  // =========================================================================
  // TASK 4: AUTHENTICATION INVALIDATION & TOKEN TAMPERING (TASK 4)
  // =========================================================================
  console.log('\n--- 3. AUTHENTICATION INVALIDATION & TOKEN SECURITY TESTS (TASK 4) ---');

  await test('37. Malformed token string is rejected with HTTP 401', async () => {
    const { req, res } = createMockReqRes({ cookies: { token: 'invalid_malformed_token_string' } });
    await authenticate(req, res, () => {});
    assert.strictEqual(res.statusCode, 401);
    assert.match(res.jsonData.message, /Invalid authentication token/i);
  });

  await test('38. Tampered token signature (signed with incorrect secret) is rejected with HTTP 401', async () => {
    const fakeSecretToken = jwt.sign(
      { userId: customerA._id, role: 'admin' }, // Attacker trying to claim admin role with rogue secret
      'completely_different_rogue_secret_key'
    );
    const { req, res } = createMockReqRes({ cookies: { token: fakeSecretToken } });
    await authenticate(req, res, () => {});
    assert.strictEqual(res.statusCode, 401);
    assert.match(res.jsonData.message, /Invalid authentication token/i);
  });

  await test('39. Expired token triggers TokenExpiredError and is rejected with HTTP 401', async () => {
    // Generate token that expired 10 minutes ago
    const expiredToken = jwt.sign(
      { userId: customerA._id, role: 'user' },
      process.env.JWT_SECRET,
      { expiresIn: '-10m' }
    );
    const { req, res } = createMockReqRes({ cookies: { token: expiredToken } });
    await authenticate(req, res, () => {});
    assert.strictEqual(res.statusCode, 401);
    assert.match(res.jsonData.message, /session has expired/i);
  });

  await test('40. Token with non-existent user ID in DB is rejected with HTTP 401', async () => {
    const deletedUserId = new mongoose.Types.ObjectId().toString();
    const tokenGhost = createTestToken(deletedUserId, 'user');
    const { req, res } = createMockReqRes({ cookies: { token: tokenGhost } });
    await authenticate(req, res, () => {});
    assert.strictEqual(res.statusCode, 401);
    assert.match(res.jsonData.message, /User account no longer exists/i);
  });

  await test('41. Logout clears the token cookie', async () => {
    const { req, res } = createMockReqRes();
    logout(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.jsonData.success, true);
    assert.ok(res.cookiesCleared['token'] !== undefined, 'token cookie must be cleared on logout');
  });

  await test('42. Reusing logged-out session (empty/cleared cookie) rejects access to protected routes with 401', async () => {
    // Simulate request sent after cookie was cleared
    const { req, res } = createMockReqRes({ cookies: { token: '' } });
    await authenticate(req, res, () => {});
    assert.strictEqual(res.statusCode, 401);
  });

  await test('43. Customer credentials to admin login (POST /api/admin/login) are rejected with HTTP 403', async () => {
    const { req, res } = createMockReqRes({
      body: { email: customerA.email, password: 'AlicePass123!' }
    });
    await adminLogin(req, res);
    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(res.jsonData.success, false);
    assert.match(res.jsonData.message, /Access denied/i);
  });

  // =========================================================================
  // TASK 5: CUSTOMER DATA ISOLATION & IDOR DEFENSE (TASK 5)
  // =========================================================================
  console.log('\n--- 4. CUSTOMER DATA ISOLATION & IDOR DEFENSE TESTS (TASK 5) ---');

  await test('44. Customer B cannot view Customer A\'s order (GET /api/orders/:orderA_id returns HTTP 403)', async () => {
    const { req, res } = createMockReqRes({
      cookies: { token: tokenB },
      params: { id: orderA._id.toString() }
    });
    await runWithAuth(req, res, getUserOrderById);
    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(res.jsonData.success, false);
    assert.match(res.jsonData.message, /Access denied/i);
  });

  await test('45. Customer B cannot view Customer A\'s cart items (GET /api/cart strictly returns B\'s cart)', async () => {
    const { req, res } = createMockReqRes({ cookies: { token: tokenB } });
    await runWithAuth(req, res, getCart);
    assert.strictEqual(res.statusCode, 200);
    // Bob has not added items yet, so items array is empty
    assert.strictEqual(res.jsonData.data.items.length, 0);
    assert.strictEqual(res.jsonData.data.subtotal, 0);
  });

  await test('46. Customer B cannot update an item in Customer A\'s cart (PUT /api/cart/:itemA_id returns HTTP 404)', async () => {
    const itemA_id = cartA.items[0]._id.toString();
    const { req, res } = createMockReqRes({
      cookies: { token: tokenB },
      params: { itemId: itemA_id },
      body: { quantity: 10 }
    });
    await runWithAuth(req, res, updateCartItemQuantity);
    // Bob has no cart yet or does not have this item in his cart
    assert.strictEqual(res.statusCode, 404);
    // Verify Customer A's item quantity is untouched
    assert.strictEqual(cartA.items[0].quantity, 2);
  });

  await test('47. Customer B cannot delete an item from Customer A\'s cart (DELETE /api/cart/:itemA_id returns HTTP 404)', async () => {
    const itemA_id = cartA.items[0]._id.toString();
    const { req, res } = createMockReqRes({
      cookies: { token: tokenB },
      params: { itemId: itemA_id }
    });
    await runWithAuth(req, res, removeCartItem);
    assert.strictEqual(res.statusCode, 404);
    // Verify Customer A's cart items are untouched
    assert.strictEqual(cartA.items.length, 1);
  });

  await test('48. Customer A\'s cart and order integrity preserved after Customer B\'s unauthorized attacks', async () => {
    assert.strictEqual(cartA.items.length, 1);
    assert.strictEqual(cartA.items[0].quantity, 2);
    assert.strictEqual(orderA.status, 'ORDER_RECEIVED');
  });

  await test('49. Admin can view Customer A\'s order via GET /api/admin/orders/:id (Authorized Cross-User Access)', async () => {
    const { req, res } = createMockReqRes({
      cookies: { token: tokenAdmin },
      params: { id: orderA._id.toString() }
    });
    await runWithAuth(req, res, (q, s) => requireAdmin(q, s, () => getAdminOrderById(q, s)));
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.jsonData.success, true);
    assert.strictEqual(res.jsonData.order._id.toString(), orderA._id.toString());
  });

  // =========================================================================
  // TASK 6: DIRECT API & PRIVILEGE ESCALATION ATTACKS (TASK 6)
  // =========================================================================
  console.log('\n--- 5. DIRECT API & PRIVILEGE ESCALATION DEFENSE TESTS (TASK 6) ---');

  await test('50. User registration ignores client-supplied role: "admin" and strictly creates role: "user"', async () => {
    const { req, res } = createMockReqRes({
      body: {
        name: 'Attacker Attempting Escalation',
        email: 'attacker.priv@example.com',
        password: 'Password123!',
        role: 'admin' // Attempting privilege escalation during registration
      }
    });
    await register(req, res);
    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.jsonData.user.role, 'user', 'Server must ignore body role and enforce "user"');

    // Also verify in database
    const savedUser = await User.findOne({ email: 'attacker.priv@example.com' });
    assert.strictEqual(savedUser.role, 'user');
  });

  await test('51. Custom pizza price tampering in POST /api/cart is ignored (price calculated strictly server-side)', async () => {
    // Customer attempts to add a custom pizza specifying price = 1 (instead of 300+)
    const { req, res } = createMockReqRes({
      cookies: { token: tokenA },
      body: {
        type: 'custom',
        base: 'Thin Crust',
        sauce: 'Classic San Marzano Tomato',
        cheese: '100% Mozzarella',
        vegetables: ['Grilled Mushrooms', 'Red Onions'],
        price: 1 // Malicious price tampering attempt
      }
    });
    await runWithAuth(req, res, addToCart);
    assert.strictEqual(res.statusCode, 200);
    // Find newly added item in Alice's cart
    const customItem = cartA.items.find(i => i.type === 'custom');
    assert.ok(customItem, 'Custom pizza item must exist');
    assert.notStrictEqual(customItem.price, 1, 'Client-specified price 1 must be discarded');
    assert.ok(customItem.price >= 200, `Calculated price should reflect ingredient pricing, got ${customItem.price}`);
  });

  await test('52. POST /api/orders/payment/create strictly derives identity from JWT, ignoring rogue userId in body', async () => {
    // Bob attempts to checkout by passing Alice's userId in request body
    const { req, res } = createMockReqRes({
      cookies: { token: tokenB }, // Authenticated as Bob
      body: { userId: customerA._id.toString() } // Attempting to checkout Alice's cart
    });
    await runWithAuth(req, res, createPaymentOrder);
    // Bob's cart is empty, so checkout rejects with HTTP 400 'Cart is empty'
    // It must NOT check Alice's non-empty cart!
    assert.strictEqual(res.statusCode, 400);
    assert.match(res.jsonData.message, /Cart is empty/i);
  });

  await test('53. OptionalAuthenticate middleware safely attaches user if token valid, or continues cleanly if omitted', async () => {
    // 1. With valid token
    const { req: req1, res: res1 } = createMockReqRes({ cookies: { token: tokenAdmin } });
    let next1 = false;
    await optionalAuthenticate(req1, res1, () => { next1 = true; });
    assert.strictEqual(next1, true);
    assert.ok(req1.user, 'Admin user should be attached');
    assert.strictEqual(req1.user.role, 'admin');

    // 2. Without token
    const { req: req2, res: res2 } = createMockReqRes();
    let next2 = false;
    await optionalAuthenticate(req2, res2, () => { next2 = true; });
    assert.strictEqual(next2, true);
    assert.strictEqual(req2.user, null);
  });

  await test('54. Catalog isolation: unauthenticated/customer cannot view disabled pizza, while admin can', async () => {
    // Create disabled pizza
    const hiddenPizza = wrapPizzaDoc({
      name: 'Secret Inactive Recipe',
      base: 'Thin Crust',
      sauce: 'Classic San Marzano Tomato',
      cheese: '100% Mozzarella',
      price: 550,
      isAvailable: false
    });
    await hiddenPizza.save();

    // 1. Customer query
    const { req: reqCust, res: resCust } = createMockReqRes({ cookies: { token: tokenA } });
    await optionalAuthenticate(reqCust, resCust, async () => {
      await getAllPizzas(reqCust, resCust);
    });
    assert.strictEqual(resCust.statusCode, 200);
    const custVisible = resCust.jsonData.data.some(p => p._id.toString() === hiddenPizza._id.toString());
    assert.strictEqual(custVisible, false, 'Disabled pizza must NOT be visible to customer');

    // 2. Admin query (with includeUnavailable=true or all=true)
    const { req: reqAdmin, res: resAdmin } = createMockReqRes({ cookies: { token: tokenAdmin }, query: { all: 'true' } });
    await optionalAuthenticate(reqAdmin, resAdmin, async () => {
      await getAllPizzas(reqAdmin, resAdmin);
    });
    assert.strictEqual(resAdmin.statusCode, 200);
    const adminVisible = resAdmin.jsonData.data.some(p => p._id.toString() === hiddenPizza._id.toString());
    assert.strictEqual(adminVisible, true, 'Disabled pizza MUST be visible to admin');
  });

  restoreMocks();

  console.log('\n====================================================');
  console.log(`TOTAL ACCESS CONTROL QA TESTS: ${passed + failed}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

// Execute suite directly
if (require.main === module) {
  runAccessControlQASuite().catch(err => {
    console.error('Fatal error in Access Control QA Suite:', err);
    process.exit(1);
  });
}

module.exports = runAccessControlQASuite;
