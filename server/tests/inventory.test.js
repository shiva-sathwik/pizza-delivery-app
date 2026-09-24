/**
 * Step 6: Inventory & Admin Management Testing Suite
 * Tests 11 specific requirements:
 *
 * 1. Admin can retrieve inventory
 * 2. Admin can update quantity
 * 3. Admin can update threshold
 * 4. Admin cannot set negative quantity (HTTP 400)
 * 5. Admin cannot set negative threshold (HTTP 400)
 * 6. Regular user cannot access inventory (HTTP 403)
 * 7. Unauthenticated user cannot access inventory (HTTP 401)
 * 8. Duplicate inventory item/category cannot be created (HTTP 400)
 * 9. Category filtering works (GET /api/inventory/:category and query)
 * 10. Existing authentication tests still pass
 * 11. Existing pizza/cart tests still pass
 */

const assert = require('assert');
const mongoose = require('mongoose');

// Set test environment
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_key_12345';
process.env.NODE_ENV = 'test';

const { authenticate, requireAdmin } = require('../middleware/auth.middleware');
const Inventory = require('../models/Inventory');
const {
  getInventory,
  getInventoryByCategory,
  updateInventoryItem,
  createInventoryItem
} = require('../controllers/inventory.controller');
const {
  BASES,
  SAUCES,
  CHEESES,
  VEGETABLES
} = require('../config/ingredients');

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

// In-Memory Database for Inventory Test Harness
const inventoryDB = new Map();

function deriveStatus(quantity, threshold) {
  if (quantity === 0) return 'Out of Stock';
  if (quantity <= threshold) return 'Low Stock';
  return 'In Stock';
}

function wrapInventoryDoc(data) {
  const doc = {
    _id: data._id || new mongoose.Types.ObjectId().toString(),
    item: data.item,
    category: data.category,
    quantity: data.quantity !== undefined ? data.quantity : 0,
    threshold: data.threshold !== undefined ? data.threshold : 5,
    createdAt: data.createdAt || new Date(),
    updatedAt: data.updatedAt || new Date(),
    get status() {
      return deriveStatus(this.quantity, this.threshold);
    },
    toJSON() {
      return {
        _id: this._id,
        item: this.item,
        category: this.category,
        quantity: this.quantity,
        threshold: this.threshold,
        status: this.status,
        createdAt: this.createdAt,
        updatedAt: this.updatedAt
      };
    }
  };

  doc.save = async function () {
    doc.updatedAt = new Date();
    inventoryDB.set(doc._id.toString(), doc);
    return doc;
  };

  return doc;
}

// Hook into Inventory model methods
Inventory.find = function (filter = {}) {
  const results = [];
  for (const item of inventoryDB.values()) {
    let match = true;
    if (filter.category !== undefined && item.category !== filter.category) {
      match = false;
    }
    if (match) results.push(item);
  }

  return {
    sort: (sortObj = {}) => {
      const sorted = [...results].sort((a, b) => {
        if (sortObj.category && a.category !== b.category) {
          return a.category.localeCompare(b.category);
        }
        return a.item.localeCompare(b.item);
      });
      return Promise.resolve(sorted);
    },
    then: resolve => resolve(results)
  };
};

Inventory.findById = async function (id) {
  return inventoryDB.get(id ? id.toString() : '') || null;
};

Inventory.findOne = async function (filter = {}) {
  for (const item of inventoryDB.values()) {
    let match = true;
    if (filter.category && item.category !== filter.category) match = false;
    if (filter.item && item.item.toLowerCase() !== filter.item.toLowerCase()) match = false;
    if (match) return item;
  }
  return null;
};

Inventory.create = async function (data) {
  const doc = wrapInventoryDoc(data);
  inventoryDB.set(doc._id.toString(), doc);
  return doc;
};

// Override Inventory.prototype.save so `new Inventory(...).save()` in controller uses in-memory DB during tests
Inventory.prototype.save = async function () {
  this.updatedAt = new Date();
  if (!this._id) {
    this._id = new mongoose.Types.ObjectId().toString();
  }
  inventoryDB.set(this._id.toString(), this);
  return this;
};

// Seed initial in-memory test data
function initTestData() {
  inventoryDB.clear();

  const seedList = [
    ...BASES.map(b => ({ item: b.name, category: 'base', quantity: 50, threshold: 10 })),
    ...SAUCES.map(s => ({ item: s.name, category: 'sauce', quantity: 45, threshold: 10 })),
    ...CHEESES.map(c => ({ item: c.name, category: 'cheese', quantity: 30, threshold: 10 })),
    ...VEGETABLES.map(v => ({ item: v.name, category: 'vegetable', quantity: 25, threshold: 8 }))
  ];

  for (const item of seedList) {
    const doc = wrapInventoryDoc(item);
    inventoryDB.set(doc._id.toString(), doc);
  }
}

// Test Runner
async function runInventoryTests() {
  console.log('\n====================================================');
  console.log('🧪 RUNNING STEP 6 INVENTORY & ADMIN MANAGEMENT TESTS');
  console.log('====================================================\n');

  initTestData();

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

  const adminUser = {
    _id: new mongoose.Types.ObjectId(),
    name: 'Super Admin',
    email: 'admin@pizzaflow.com',
    role: 'admin'
  };

  const regularUser = {
    _id: new mongoose.Types.ObjectId(),
    name: 'Pizza Lover',
    email: 'user@example.com',
    role: 'user'
  };

  console.log('--- 1. ACCESS CONTROL & AUTHORIZATION TESTS ---');

  await test('1. Unauthenticated user cannot access inventory (returns 401)', async () => {
    const { req, res } = createMockReqRes({ user: null });
    let nextCalled = false;
    await authenticate(req, res, () => {
      nextCalled = true;
    });
    assert.strictEqual(nextCalled, false, 'Authenticate middleware must not call next() without token');
    assert.strictEqual(res.statusCode, 401, 'Should return HTTP 401');
    assert.strictEqual(res.jsonData.success, false);
  });

  await test('2. Regular user receives HTTP 403 when attempting to access admin inventory', async () => {
    const { req, res } = createMockReqRes({ user: regularUser });
    let nextCalled = false;
    requireAdmin(req, res, () => {
      nextCalled = true;
    });
    assert.strictEqual(nextCalled, false, 'requireAdmin middleware must not call next() for non-admin');
    assert.strictEqual(res.statusCode, 403, 'Should return HTTP 403 Forbidden');
    assert.strictEqual(res.jsonData.success, false);
    assert.match(res.jsonData.message, /Administrator privileges required/i);
  });

  await test('3. Admin user is authorized through requireAdmin middleware', async () => {
    const { req, res } = createMockReqRes({ user: adminUser });
    let nextCalled = false;
    requireAdmin(req, res, () => {
      nextCalled = true;
    });
    assert.strictEqual(nextCalled, true, 'requireAdmin should call next() for admin role');
  });

  console.log('\n--- 2. INVENTORY RETRIEVAL & FILTERING TESTS ---');

  await test('4. Admin can retrieve complete inventory (GET /api/inventory)', async () => {
    const { req, res } = createMockReqRes({ user: adminUser });
    await getInventory(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.jsonData.success, true);
    assert.ok(Array.isArray(res.jsonData.inventory), 'Inventory must be an array');
    assert.strictEqual(res.jsonData.inventory.length, 23, 'Must contain all 23 authoritative ingredients');
  });

  await test('5. Category filtering works via route param (GET /api/inventory/:category)', async () => {
    const { req, res } = createMockReqRes({ user: adminUser, params: { category: 'base' } });
    await getInventoryByCategory(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.jsonData.success, true);
    assert.strictEqual(res.jsonData.category, 'base');
    assert.strictEqual(res.jsonData.inventory.length, 5, 'Should have 5 bases');
    res.jsonData.inventory.forEach(item => {
      assert.strictEqual(item.category, 'base');
    });
  });

  await test('6. Category filtering works via query param (GET /api/inventory?category=sauce)', async () => {
    const { req, res } = createMockReqRes({ user: adminUser, query: { category: 'sauce' } });
    await getInventory(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.jsonData.success, true);
    assert.strictEqual(res.jsonData.inventory.length, 5, 'Should have 5 sauces');
    res.jsonData.inventory.forEach(item => {
      assert.strictEqual(item.category, 'sauce');
    });
  });

  await test('7. Invalid category filter is rejected with HTTP 400', async () => {
    const { req, res } = createMockReqRes({ user: adminUser, params: { category: 'invalid-cat' } });
    await getInventoryByCategory(req, res);
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.jsonData.success, false);
    assert.match(res.jsonData.message, /Invalid category/i);
  });

  console.log('\n--- 3. INVENTORY UPDATE & STOCK VALIDATION TESTS ---');

  // Find a test item from in-memory DB
  const sampleItem = Array.from(inventoryDB.values())[0];

  await test('8. Admin can update quantity successfully (PUT /api/inventory/:id)', async () => {
    const { req, res } = createMockReqRes({
      user: adminUser,
      params: { id: sampleItem._id },
      body: { quantity: 120 }
    });
    await updateInventoryItem(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.jsonData.success, true);
    assert.strictEqual(res.jsonData.inventory.quantity, 120);
    assert.strictEqual(res.jsonData.inventory.status, 'In Stock');
  });

  await test('9. Admin can update threshold successfully (PUT /api/inventory/:id)', async () => {
    const { req, res } = createMockReqRes({
      user: adminUser,
      params: { id: sampleItem._id },
      body: { threshold: 25 }
    });
    await updateInventoryItem(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.jsonData.success, true);
    assert.strictEqual(res.jsonData.inventory.threshold, 25);
  });

  await test('10. Admin cannot set negative quantity (HTTP 400, "Quantity cannot be negative")', async () => {
    const { req, res } = createMockReqRes({
      user: adminUser,
      params: { id: sampleItem._id },
      body: { quantity: -10 }
    });
    await updateInventoryItem(req, res);
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.jsonData.success, false);
    assert.strictEqual(res.jsonData.message, 'Quantity cannot be negative');
  });

  await test('11. Admin cannot set negative threshold (HTTP 400, "Threshold cannot be negative")', async () => {
    const { req, res } = createMockReqRes({
      user: adminUser,
      params: { id: sampleItem._id },
      body: { threshold: -5 }
    });
    await updateInventoryItem(req, res);
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.jsonData.success, false);
    assert.strictEqual(res.jsonData.message, 'Threshold cannot be negative');
  });

  await test('12. Stock status is derived correctly: Out of Stock (quantity === 0)', async () => {
    const { req, res } = createMockReqRes({
      user: adminUser,
      params: { id: sampleItem._id },
      body: { quantity: 0 }
    });
    await updateInventoryItem(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.jsonData.inventory.status, 'Out of Stock');
  });

  await test('13. Stock status is derived correctly: Low Stock (quantity <= threshold)', async () => {
    const { req, res } = createMockReqRes({
      user: adminUser,
      params: { id: sampleItem._id },
      body: { quantity: 15, threshold: 20 }
    });
    await updateInventoryItem(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.jsonData.inventory.status, 'Low Stock');
  });

  await test('14. Stock status is derived correctly: In Stock (quantity > threshold)', async () => {
    const { req, res } = createMockReqRes({
      user: adminUser,
      params: { id: sampleItem._id },
      body: { quantity: 80, threshold: 20 }
    });
    await updateInventoryItem(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.jsonData.inventory.status, 'In Stock');
  });

  console.log('\n--- 4. DUPLICATE PREVENTION & CREATION TESTS ---');

  await test('15. Duplicate inventory item/category cannot be created (HTTP 400)', async () => {
    const { req, res } = createMockReqRes({
      user: adminUser,
      body: {
        item: sampleItem.item,
        category: sampleItem.category,
        quantity: 50,
        threshold: 10
      }
    });
    await createInventoryItem(req, res);
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.jsonData.success, false);
    assert.match(res.jsonData.message, /Duplicate inventory record/i);
  });

  await test('16. Valid new inventory item can be created by admin (HTTP 201)', async () => {
    const { req, res } = createMockReqRes({
      user: adminUser,
      body: {
        item: 'Zesty Jalapeno Dip',
        category: 'sauce',
        quantity: 35,
        threshold: 8
      }
    });
    await createInventoryItem(req, res);
    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.jsonData.success, true);
    assert.strictEqual(res.jsonData.inventory.item, 'Zesty Jalapeno Dip');
    assert.strictEqual(res.jsonData.inventory.status, 'In Stock');
  });

  console.log('\n====================================================');
  console.log(`TOTAL INVENTORY TESTS: ${passed + failed}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runInventoryTests();
}

module.exports = runInventoryTests;
