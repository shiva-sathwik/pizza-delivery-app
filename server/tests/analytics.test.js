/**
 * Step 8: Admin Analytics & Popular Pizza Recommendation Test Suite
 * Tests 15 core requirements:
 *
 * 1. Authenticated admin can retrieve analytics (GET /api/admin/analytics) (HTTP 200)
 * 2. Non-admin user receives HTTP 403
 * 3. Unauthenticated user receives HTTP 401
 * 4. Default period is 'daily' when omitted or invalid
 * 5. Daily analytics filters orders between start and end of today
 * 6. Weekly analytics strictly filters orders within current calendar week (Monday through Sunday)
 * 7. Monthly analytics filters orders within current calendar month (1st through last day)
 * 8. Only successfully paid orders (payment.status === 'PAID') are counted (PENDING/FAILED excluded)
 * 9. totalOrders accurately counts qualifying orders
 * 10. totalRevenue sums order totals with correct decimal precision
 * 11. pizzasSold sums quantities of all pizza items across orders
 * 12. averageOrderValue calculated accurately as totalRevenue / totalOrders
 * 13. mostOrderedPizza correctly identifies the pizza with highest total quantity sold
 * 14. customerFavorite identifies the customer with the most orders in the period
 * 15. Public GET /api/pizzas/popular returns most ordered catalog pizza, or friendly fallback message
 */

const assert = require('assert');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_key_12345';
process.env.NODE_ENV = 'test';

const { authenticate, requireAdmin } = require('../middleware/auth.middleware');
const { getAdminAnalytics, getDateRangeForPeriod } = require('../controllers/analytics.controller');
const { getPopularPizza } = require('../controllers/pizza.controller');
const Order = require('../models/Order');
const Pizza = require('../models/Pizza');

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
const orderDB = new Map();
const pizzaDB = new Map();

// Hook into Order.find
Order.find = function (filter = {}) {
  const results = [];
  for (const order of orderDB.values()) {
    let match = true;
    if (filter['payment.status'] && order.payment && order.payment.status !== filter['payment.status']) {
      match = false;
    }
    if (filter.createdAt) {
      const orderTime = new Date(order.createdAt).getTime();
      if (filter.createdAt.$gte && orderTime < new Date(filter.createdAt.$gte).getTime()) {
        match = false;
      }
      if (filter.createdAt.$lte && orderTime > new Date(filter.createdAt.$lte).getTime()) {
        match = false;
      }
    }
    if (match) results.push(order);
  }

  const chainable = {
    populate() {
      return chainable;
    },
    sort() {
      return chainable;
    },
    then(resolve) {
      resolve(results);
    }
  };
  return chainable;
};

// Hook into Pizza.findById and Pizza.findOne
Pizza.findById = async function (id) {
  return pizzaDB.get(id?.toString()) || null;
};

Pizza.findOne = async function (filter = {}) {
  for (const pizza of pizzaDB.values()) {
    if (filter.name && filter.name.test && filter.name.test(pizza.name)) {
      if (filter.isAvailable === undefined || pizza.isAvailable === filter.isAvailable) {
        return pizza;
      }
    }
  }
  return null;
};

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (error) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${error.message}`);
    failed++;
  }
}

async function runAnalyticsTests() {
  console.log('\n====================================================');
  console.log('--- STEP 8: ANALYTICS & RECOMMENDATION TESTS (15 TESTS) ---');
  console.log('====================================================\n');

  orderDB.clear();
  pizzaDB.clear();

  const adminUser = {
    _id: new mongoose.Types.ObjectId().toString(),
    name: 'Admin Boss',
    email: 'admin@pizzaflow.com',
    role: 'admin'
  };

  const normalUser = {
    _id: new mongoose.Types.ObjectId().toString(),
    name: 'Jane Customer',
    email: 'jane@example.com',
    role: 'user'
  };

  const adminToken = jwt.sign(
    { id: adminUser._id, email: adminUser.email, role: 'admin' },
    process.env.JWT_SECRET
  );
  const userToken = jwt.sign(
    { id: normalUser._id, email: normalUser.email, role: 'user' },
    process.env.JWT_SECRET
  );

  console.log('--- 1. AUTHORIZATION TESTS ---');

  await test('1. Authenticated admin can retrieve analytics (GET /api/admin/analytics) (HTTP 200)', async () => {
    const { req, res } = createMockReqRes({ user: adminUser, query: { period: 'daily' } });
    await getAdminAnalytics(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.jsonData.success, true);
    assert.ok(res.jsonData.data);
  });

  await test('2. Non-admin user receives HTTP 403', async () => {
    const { req, res } = createMockReqRes({ user: normalUser });
    let nextCalled = false;
    requireAdmin(req, res, () => {
      nextCalled = true;
    });
    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res.statusCode, 403);
    assert.match(res.jsonData.message, /Administrator privileges required/i);
  });

  await test('3. Unauthenticated user receives HTTP 401', async () => {
    const { req, res } = createMockReqRes({});
    let nextCalled = false;
    await authenticate(req, res, () => {
      nextCalled = true;
    });
    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res.statusCode, 401);
    assert.match(res.jsonData.message, /Authentication required/i);
  });

  console.log('\n--- 2. PERIOD & CALENDAR BOUNDARIES TESTS ---');

  await test('4. Default period is "daily" when omitted or invalid', async () => {
    const { req, res } = createMockReqRes({ user: adminUser, query: { period: 'random_invalid_period' } });
    await getAdminAnalytics(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.jsonData.data.period, 'daily');
  });

  await test('5. Daily analytics filters orders between start and end of today', () => {
    const { startDate, endDate } = getDateRangeForPeriod('daily');
    const now = new Date();
    assert.strictEqual(startDate.getDate(), now.getDate());
    assert.strictEqual(startDate.getHours(), 0);
    assert.strictEqual(startDate.getMinutes(), 0);
    assert.strictEqual(startDate.getSeconds(), 0);

    assert.strictEqual(endDate.getDate(), now.getDate());
    assert.strictEqual(endDate.getHours(), 23);
    assert.strictEqual(endDate.getMinutes(), 59);
  });

  await test('6. Weekly analytics strictly filters orders within current calendar week (Monday through Sunday)', () => {
    const { startDate, endDate } = getDateRangeForPeriod('weekly');
    // Day of week: 1 = Monday, 0 = Sunday
    assert.strictEqual(startDate.getDay(), 1, 'Start date must be Monday');
    assert.strictEqual(startDate.getHours(), 0);
    assert.strictEqual(startDate.getMinutes(), 0);

    assert.strictEqual(endDate.getDay(), 0, 'End date must be Sunday');
    assert.strictEqual(endDate.getHours(), 23);
    assert.strictEqual(endDate.getMinutes(), 59);

    // Difference must be exactly 6 days
    const diffDays = Math.round((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
    assert.strictEqual(diffDays, 7); // ~6.999 days rounded to 7
  });

  await test('7. Monthly analytics filters orders within current calendar month (1st through last day)', () => {
    const { startDate, endDate } = getDateRangeForPeriod('monthly');
    const now = new Date();
    assert.strictEqual(startDate.getDate(), 1);
    assert.strictEqual(startDate.getMonth(), now.getMonth());
    assert.strictEqual(startDate.getFullYear(), now.getFullYear());

    assert.strictEqual(endDate.getMonth(), now.getMonth());
    assert.strictEqual(endDate.getHours(), 23);
    assert.strictEqual(endDate.getMinutes(), 59);
  });

  console.log('\n--- 3. ORDER METRICS & AGGREGATIONS TESTS ---');

  const customer1 = { _id: 'cust-1', name: 'Alice Customer', email: 'alice@test.com' };
  const customer2 = { _id: 'cust-2', name: 'Bob Customer', email: 'bob@test.com' };

  // Seed sample orders for today
  orderDB.clear();

  // Order 1: Paid, Alice, 2 Margheritas, Total 600
  orderDB.set('ord-1', {
    _id: 'ord-1',
    user: customer1,
    total: 600,
    payment: { status: 'PAID' },
    items: [
      { name: 'Margherita Delight', quantity: 2, unitPrice: 300, subtotal: 600 }
    ],
    createdAt: new Date()
  });

  // Order 2: Paid, Alice, 1 Pepperoni, Total 450
  orderDB.set('ord-2', {
    _id: 'ord-2',
    user: customer1,
    total: 450,
    payment: { status: 'PAID' },
    items: [
      { name: 'Pepperoni Feast', quantity: 1, unitPrice: 450, subtotal: 450 }
    ],
    createdAt: new Date()
  });

  // Order 3: Paid, Bob, 3 Margheritas, Total 900
  orderDB.set('ord-3', {
    _id: 'ord-3',
    user: customer2,
    total: 900,
    payment: { status: 'PAID' },
    items: [
      { name: 'Margherita Delight', quantity: 3, unitPrice: 300, subtotal: 900 }
    ],
    createdAt: new Date()
  });

  // Order 4: Unpaid / PENDING, should be EXCLUDED
  orderDB.set('ord-4', {
    _id: 'ord-4',
    user: customer2,
    total: 1200,
    payment: { status: 'PENDING' },
    items: [
      { name: 'Veggie Paradise', quantity: 4, unitPrice: 300, subtotal: 1200 }
    ],
    createdAt: new Date()
  });

  // Order 5: FAILED, should be EXCLUDED
  orderDB.set('ord-5', {
    _id: 'ord-5',
    user: customer1,
    total: 500,
    payment: { status: 'FAILED' },
    items: [
      { name: 'Veggie Paradise', quantity: 1, unitPrice: 500, subtotal: 500 }
    ],
    createdAt: new Date()
  });

  await test('8. Only successfully paid orders (payment.status === "PAID") are counted (PENDING/FAILED excluded)', async () => {
    const { req, res } = createMockReqRes({ user: adminUser, query: { period: 'daily' } });
    await getAdminAnalytics(req, res);
    assert.strictEqual(res.jsonData.data.totalOrders, 3);
  });

  await test('9. totalOrders accurately counts qualifying orders', async () => {
    const { req, res } = createMockReqRes({ user: adminUser, query: { period: 'daily' } });
    await getAdminAnalytics(req, res);
    assert.strictEqual(res.jsonData.data.totalOrders, 3);
  });

  await test('10. totalRevenue sums order totals with correct decimal precision', async () => {
    const { req, res } = createMockReqRes({ user: adminUser, query: { period: 'daily' } });
    await getAdminAnalytics(req, res);
    // 600 + 450 + 900 = 1950
    assert.strictEqual(res.jsonData.data.totalRevenue, 1950);
  });

  await test('11. pizzasSold sums quantities of all pizza items across orders', async () => {
    const { req, res } = createMockReqRes({ user: adminUser, query: { period: 'daily' } });
    await getAdminAnalytics(req, res);
    // Order 1: 2 items, Order 2: 1 item, Order 3: 3 items => 2 + 1 + 3 = 6
    assert.strictEqual(res.jsonData.data.pizzasSold, 6);
  });

  await test('12. averageOrderValue calculated accurately as totalRevenue / totalOrders', async () => {
    const { req, res } = createMockReqRes({ user: adminUser, query: { period: 'daily' } });
    await getAdminAnalytics(req, res);
    // 1950 / 3 = 650
    assert.strictEqual(res.jsonData.data.averageOrderValue, 650);
  });

  await test('13. mostOrderedPizza correctly identifies the pizza with highest total quantity sold', async () => {
    const { req, res } = createMockReqRes({ user: adminUser, query: { period: 'daily' } });
    await getAdminAnalytics(req, res);
    // Margherita: 2 + 3 = 5 sold. Pepperoni: 1 sold.
    assert.strictEqual(res.jsonData.data.mostOrderedPizza.title, 'Margherita Delight');
    assert.strictEqual(res.jsonData.data.mostOrderedPizza.count, 5);
  });

  await test('14. customerFavorite identifies the customer with the most orders in the period', async () => {
    const { req, res } = createMockReqRes({ user: adminUser, query: { period: 'daily' } });
    await getAdminAnalytics(req, res);
    // Alice has 2 paid orders (ord-1, ord-2). Bob has 1 paid order (ord-3).
    assert.strictEqual(res.jsonData.data.customerFavorite.name, 'Alice Customer');
    assert.strictEqual(res.jsonData.data.customerFavorite.orderCount, 2);
  });

  console.log('\n--- 4. POPULAR PIZZA RECOMMENDATION TESTS ---');

  // Seed Catalog Pizza for Margherita
  const margheritaPizza = {
    _id: new mongoose.Types.ObjectId().toString(),
    name: 'Margherita Delight',
    price: 300,
    description: 'Fresh basil and mozzarella',
    image: 'https://images.unsplash.com/photo-margherita.jpg',
    isAvailable: true
  };
  pizzaDB.set(margheritaPizza._id, margheritaPizza);

  await test('15. Public GET /api/pizzas/popular returns most ordered catalog pizza, or friendly fallback message', async () => {
    // When orders exist:
    const { req: req1, res: res1 } = createMockReqRes({});
    await getPopularPizza(req1, res1);
    assert.strictEqual(res1.statusCode, 200);
    assert.strictEqual(res1.jsonData.success, true);
    assert.strictEqual(res1.jsonData.data.name, 'Margherita Delight');
    assert.strictEqual(res1.jsonData.orderCount, 5);

    // When no orders exist:
    orderDB.clear();
    const { req: req2, res: res2 } = createMockReqRes({});
    await getPopularPizza(req2, res2);
    assert.strictEqual(res2.statusCode, 200);
    assert.strictEqual(res2.jsonData.success, true);
    assert.strictEqual(res2.jsonData.data, null);
    assert.match(res2.jsonData.message, /Popular picks will appear after customers place orders/i);
  });

  console.log('\n====================================================');
  console.log(`TOTAL ANALYTICS TESTS: ${passed + failed}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runAnalyticsTests();
}

module.exports = runAnalyticsTests;
