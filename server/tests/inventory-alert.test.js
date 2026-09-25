/**
 * Step 8: Low-Stock Inventory Alerts Test Suite
 * Tests 9 core requirements:
 *
 * 1. Low-stock items identified when quantity <= threshold
 * 2. Out-of-stock items (quantity === 0) marked with status 'Out of Stock'
 * 3. Multiple low-stock items consolidated into a SINGLE alert email dispatch
 * 4. Spam prevention: repeated check within 24h for identical status sends NO duplicate email
 * 5. Status transition (e.g. Low Stock -> Out of Stock) triggers new email despite cooldown
 * 6. Cooldown expiration (>24h since lastAlertSentAt) triggers new alert email
 * 7. Manual test alert runs in test mode and sends email without modifying lastAlertStatus or lastAlertSentAt
 * 8. Manual test alert when zero items are low creates an IN-MEMORY ONLY demo item and does NOT insert into Inventory
 * 9. Manual test alert endpoint is rejected with HTTP 403 when NODE_ENV === 'production'
 */

const assert = require('assert');
const mongoose = require('mongoose');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_key_12345';
process.env.NODE_ENV = 'test';

const Inventory = require('../models/Inventory');
const { setCustomTransporter } = require('../services/email.service');
const { checkInventoryAndSendAlerts } = require('../utils/inventoryAlertCron');
const { testInventoryAlert } = require('../controllers/analytics.controller');

// Mock request / response helper
const createMockReqRes = ({ body = {}, query = {}, user = null } = {}) => {
  const req = { body, query, user };
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

// In-Memory Inventory Database
const inventoryDB = new Map();

function deriveStatus(quantity, threshold) {
  if (quantity === 0) return 'Out of Stock';
  if (quantity <= threshold) return 'Low Stock';
  return 'In Stock';
}

function createInventoryDoc(data) {
  const doc = {
    _id: data._id || new mongoose.Types.ObjectId().toString(),
    item: data.item,
    category: data.category,
    quantity: data.quantity !== undefined ? data.quantity : 10,
    threshold: data.threshold !== undefined ? data.threshold : 5,
    lastAlertSentAt: data.lastAlertSentAt || null,
    lastAlertStatus: data.lastAlertStatus || null,
    get status() {
      return deriveStatus(this.quantity, this.threshold);
    }
  };

  doc.save = async function () {
    inventoryDB.set(doc._id.toString(), doc);
    return doc;
  };

  return doc;
}

// Hook into Inventory.find
Inventory.find = async function () {
  return Array.from(inventoryDB.values());
};

// Track all sent emails
const sentEmails = [];
setCustomTransporter({
  sendMail: async (mailOptions) => {
    sentEmails.push(mailOptions);
    return { messageId: `mock-msg-${Date.now()}` };
  }
});

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

async function runInventoryAlertTests() {
  console.log('\n====================================================');
  console.log('--- STEP 8: INVENTORY ALERT TESTS (9 TESTS) ---');
  console.log('====================================================\n');

  // Reset state before tests
  inventoryDB.clear();
  sentEmails.length = 0;

  await test('1. Low-stock items identified when quantity <= threshold', async () => {
    inventoryDB.clear();
    sentEmails.length = 0;

    const item = createInventoryDoc({
      item: 'Mozzarella',
      category: 'cheese',
      quantity: 4,
      threshold: 5
    });
    inventoryDB.set(item._id.toString(), item);

    const result = await checkInventoryAndSendAlerts({ isTestMode: false });
    assert.strictEqual(result.sent, true);
    assert.strictEqual(result.count, 1);
    assert.strictEqual(result.items[0].item, 'Mozzarella');
    assert.strictEqual(result.items[0].status, 'Low Stock');
    assert.strictEqual(sentEmails.length, 1);
  });

  await test('2. Out-of-stock items (quantity === 0) marked with status "Out of Stock"', async () => {
    inventoryDB.clear();
    sentEmails.length = 0;

    const item = createInventoryDoc({
      item: 'Tomato Basil Sauce',
      category: 'sauce',
      quantity: 0,
      threshold: 5
    });
    inventoryDB.set(item._id.toString(), item);

    const result = await checkInventoryAndSendAlerts({ isTestMode: false });
    assert.strictEqual(result.sent, true);
    assert.strictEqual(result.count, 1);
    assert.strictEqual(result.items[0].status, 'Out of Stock');
  });

  await test('3. Multiple low-stock items consolidated into a SINGLE alert email dispatch', async () => {
    inventoryDB.clear();
    sentEmails.length = 0;

    const item1 = createInventoryDoc({ item: 'Classic Dough', category: 'base', quantity: 2, threshold: 5 });
    const item2 = createInventoryDoc({ item: 'Cheddar', category: 'cheese', quantity: 1, threshold: 5 });
    const item3 = createInventoryDoc({ item: 'Bell Peppers', category: 'vegetable', quantity: 20, threshold: 5 }); // healthy

    inventoryDB.set(item1._id.toString(), item1);
    inventoryDB.set(item2._id.toString(), item2);
    inventoryDB.set(item3._id.toString(), item3);

    const result = await checkInventoryAndSendAlerts({ isTestMode: false });
    assert.strictEqual(result.sent, true);
    assert.strictEqual(result.count, 2);
    // Consolidates both items into exactly ONE email
    assert.strictEqual(sentEmails.length, 1);
    assert.match(sentEmails[0].subject, /2 Item\(s\) Require Attention/i);
    assert.match(sentEmails[0].html, /Classic Dough/);
    assert.match(sentEmails[0].html, /Cheddar/);
  });

  await test('4. Spam prevention: repeated check within 24h for identical status sends NO duplicate email', async () => {
    // Both items were alerted in test 3, their lastAlertSentAt and lastAlertStatus are now set
    sentEmails.length = 0;

    const result = await checkInventoryAndSendAlerts({ isTestMode: false });
    assert.strictEqual(result.sent, false);
    assert.strictEqual(result.count, 0);
    assert.strictEqual(sentEmails.length, 0);
  });

  await test('5. Status transition (Low Stock -> Out of Stock) triggers new email despite cooldown', async () => {
    sentEmails.length = 0;
    // item1 was 'Low Stock' with lastAlertStatus = 'Low Stock'. Now drop quantity to 0
    const allItems = Array.from(inventoryDB.values());
    const dough = allItems.find(i => i.item === 'Classic Dough');
    dough.quantity = 0; // Transitions to 'Out of Stock'

    const result = await checkInventoryAndSendAlerts({ isTestMode: false });
    assert.strictEqual(result.sent, true);
    assert.strictEqual(result.count, 1);
    assert.strictEqual(result.items[0].item, 'Classic Dough');
    assert.strictEqual(result.items[0].status, 'Out of Stock');
    assert.strictEqual(sentEmails.length, 1);
  });

  await test('6. Cooldown expiration (>24h since lastAlertSentAt) triggers new alert email', async () => {
    sentEmails.length = 0;
    // Set lastAlertSentAt to 25 hours ago
    const allItems = Array.from(inventoryDB.values());
    const cheddar = allItems.find(i => i.item === 'Cheddar');
    cheddar.lastAlertSentAt = new Date(Date.now() - 25 * 60 * 60 * 1000);
    // Cheddar is still Low Stock, but cooldown has expired

    const result = await checkInventoryAndSendAlerts({ isTestMode: false });
    assert.strictEqual(result.sent, true);
    const cheddarAlert = result.items.find(i => i.item === 'Cheddar');
    assert.ok(cheddarAlert);
    assert.strictEqual(sentEmails.length, 1);
  });

  await test('7. Manual test alert runs in test mode and sends email without modifying lastAlertStatus or lastAlertSentAt', async () => {
    inventoryDB.clear();
    sentEmails.length = 0;

    const initialDate = new Date('2025-01-01T12:00:00Z');
    const item = createInventoryDoc({
      item: 'Mushrooms',
      category: 'vegetable',
      quantity: 3,
      threshold: 5,
      lastAlertSentAt: initialDate,
      lastAlertStatus: 'Low Stock'
    });
    inventoryDB.set(item._id.toString(), item);

    const result = await checkInventoryAndSendAlerts({ isTestMode: true });
    assert.strictEqual(result.sent, true);
    assert.strictEqual(result.isTestMode, true);
    assert.strictEqual(sentEmails.length, 1);
    assert.match(sentEmails[0].subject, /\[TEST MODE\]/);

    // Verify lastAlertSentAt and lastAlertStatus were NOT modified
    const stored = inventoryDB.get(item._id.toString());
    assert.strictEqual(stored.lastAlertSentAt.toISOString(), initialDate.toISOString());
    assert.strictEqual(stored.lastAlertStatus, 'Low Stock');
  });

  await test('8. Manual test alert when zero items are low creates an IN-MEMORY ONLY demo item and does NOT insert into Inventory', async () => {
    inventoryDB.clear();
    sentEmails.length = 0;

    // All items healthy
    const item = createInventoryDoc({
      item: 'Olives',
      category: 'vegetable',
      quantity: 50,
      threshold: 5
    });
    inventoryDB.set(item._id.toString(), item);
    const originalDbSize = inventoryDB.size;

    const result = await checkInventoryAndSendAlerts({ isTestMode: true });
    assert.strictEqual(result.sent, true);
    assert.strictEqual(result.count, 1);
    assert.match(result.items[0].item, /Demo Test/i);
    assert.strictEqual(sentEmails.length, 1);
    assert.match(sentEmails[0].html, /Demo Test/i);

    // Database size MUST NOT have increased, no item inserted or persisted
    assert.strictEqual(inventoryDB.size, originalDbSize);
    assert.strictEqual(inventoryDB.has(result.items[0]._id), false);
  });

  await test('9. Manual test alert endpoint is rejected with HTTP 403 when NODE_ENV === "production"', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const { req, res } = createMockReqRes({ user: { role: 'admin' } });
    await testInventoryAlert(req, res);

    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(res.jsonData.success, false);
    assert.match(res.jsonData.message, /not available in production/i);

    // Restore test environment
    process.env.NODE_ENV = originalEnv;
  });

  console.log('\n====================================================');
  console.log(`TOTAL INVENTORY ALERT TESTS: ${passed + failed}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runInventoryAlertTests();
}

module.exports = runInventoryAlertTests;
