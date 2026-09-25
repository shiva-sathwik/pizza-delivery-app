const assert = require('assert');
const crypto = require('crypto');
const mongoose = require('mongoose');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_key_12345';
process.env.RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder_key_id';
process.env.RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'placeholder_secret_never_commit_real_secret';
process.env.NODE_ENV = 'development'; // Development mode so simulator logic is active

const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Inventory = require('../models/Inventory');
const {
  createPaymentOrder,
  generateDevPayment,
  verifyPaymentAndCreateOrder
} = require('../controllers/order.controller');
const { verifyRazorpaySignature } = require('../config/razorpay');

// In-memory data store for isolated testing
const inventoryDB = new Map();
const cartDB = new Map();
const orderDB = new Map();

// Seed initial stock
inventoryDB.set('base:thin crust', { category: 'base', item: 'Thin Crust', quantity: 20 });
inventoryDB.set('sauce:classic san marzano tomato', { category: 'sauce', item: 'Classic San Marzano Tomato', quantity: 20 });
inventoryDB.set('cheese:100% mozzarella', { category: 'cheese', item: '100% Mozzarella', quantity: 20 });
inventoryDB.set('vegetable:crisp bell peppers', { category: 'vegetable', item: 'Crisp Bell Peppers', quantity: 20 });

// Mock Mongoose models
Inventory.findOne = async function (filter = {}) {
  for (const item of inventoryDB.values()) {
    let match = true;
    if (filter.category && item.category !== filter.category) match = false;
    if (filter.item && item.item.toLowerCase() !== filter.item.toLowerCase()) match = false;
    if (match) return JSON.parse(JSON.stringify(item));
  }
  return null;
};

Inventory.findOneAndUpdate = async function (filter = {}, update = {}) {
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
      inventoryDB.set(key, doc);
      return JSON.parse(JSON.stringify(doc));
    }
  }
  return null;
};

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

Order.prototype.save = async function () {
  if (!this._id) this._id = new mongoose.Types.ObjectId().toString();
  orderDB.set(this._id.toString(), this);
  return this;
};

Order.findOne = async function (filter = {}) {
  for (const order of orderDB.values()) {
    if (filter.$or) {
      for (const cond of filter.$or) {
        if (cond['payment.razorpayPaymentId'] && order.payment?.razorpayPaymentId === cond['payment.razorpayPaymentId']) return order;
        if (cond['payment.razorpayOrderId'] && order.payment?.razorpayOrderId === cond['payment.razorpayOrderId']) return order;
      }
    }
  }
  return null;
};

const createMockReqRes = ({ body = {}, user = null } = {}) => {
  const req = { body, user };
  const res = {
    statusCode: 200,
    jsonData: null,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.jsonData = data; return this; }
  };
  return { req, res };
};

async function testSimulatorE2E() {
  console.log('====================================================');
  console.log('🧪 TESTING DEVELOPMENT SIMULATOR END-TO-END FLOW:');
  console.log('Cart → Create Payment Order → Generate Test Payment → Verify Signature → Create Order');
  console.log('====================================================\n');

  const testUser = {
    _id: new mongoose.Types.ObjectId(),
    name: 'Simulator Customer',
    email: 'sim@example.com',
    role: 'user'
  };

  // 1. Setup Cart
  console.log('Step 1: User Cart setup with 1 pizza (₹350)');
  cartDB.set(testUser._id.toString(), {
    user: testUser._id,
    items: [
      {
        name: 'Veggie Supreme',
        base: 'Thin Crust',
        sauce: 'Classic San Marzano Tomato',
        cheese: '100% Mozzarella',
        vegetables: ['Crisp Bell Peppers'],
        price: 350,
        quantity: 1
      }
    ]
  });

  // 2. Create Payment Order (POST /api/orders/payment/create)
  console.log('\nStep 2: Calling createPaymentOrder...');
  const { req: reqCreate, res: resCreate } = createMockReqRes({ user: testUser });
  await createPaymentOrder(reqCreate, resCreate);

  assert.strictEqual(resCreate.statusCode, 200, 'createPaymentOrder must return HTTP 200');
  assert.strictEqual(resCreate.jsonData.success, true);
  assert.ok(resCreate.jsonData.razorpayOrderId, 'Must return razorpayOrderId');
  assert.ok(resCreate.jsonData.devTestPaymentId, 'Must return devTestPaymentId for simulator');
  assert.ok(resCreate.jsonData.devTestSignature, 'Must return devTestSignature for simulator');
  console.log('  ✓ Created Razorpay Order ID:', resCreate.jsonData.razorpayOrderId);
  console.log('  ✓ Generated Dev Payment ID:', resCreate.jsonData.devTestPaymentId);
  console.log('  ✓ Generated Dev Signature:', resCreate.jsonData.devTestSignature.slice(0, 16) + '...');

  const orderId = resCreate.jsonData.razorpayOrderId;
  const payId = resCreate.jsonData.devTestPaymentId;
  const sig = resCreate.jsonData.devTestSignature;

  // 3. Test Generate Test Payment endpoint (POST /api/orders/payment/generate-test-payment)
  console.log('\nStep 3: Calling generateDevPayment endpoint with razorpay_order_id...');
  const { req: reqGen, res: resGen } = createMockReqRes({
    user: testUser,
    body: { razorpay_order_id: orderId }
  });
  await generateDevPayment(reqGen, resGen);

  assert.strictEqual(resGen.statusCode, 200, 'generateDevPayment must return HTTP 200');
  assert.strictEqual(resGen.jsonData.success, true);
  assert.strictEqual(resGen.jsonData.razorpay_order_id, orderId);
  assert.ok(resGen.jsonData.razorpay_payment_id, 'Must return razorpay_payment_id');
  assert.ok(resGen.jsonData.razorpay_signature, 'Must return razorpay_signature');
  console.log('  ✓ Standalone Generate Test Payment returns valid payload');
  console.log('  ✓ Fresh Payment ID:', resGen.jsonData.razorpay_payment_id);
  console.log('  ✓ Fresh Signature:', resGen.jsonData.razorpay_signature.slice(0, 16) + '...');

  // Verify that verifyRazorpaySignature returns true for both pairs!
  const isSig1Valid = verifyRazorpaySignature({
    razorpay_order_id: orderId,
    razorpay_payment_id: payId,
    razorpay_signature: sig
  });
  assert.strictEqual(isSig1Valid, true, 'devTestSignature from createPaymentOrder must verify to true');
  console.log('  ✓ Signature from createPaymentOrder verified by verifyRazorpaySignature: TRUE');

  const isSig2Valid = verifyRazorpaySignature({
    razorpay_order_id: orderId,
    razorpay_payment_id: resGen.jsonData.razorpay_payment_id,
    razorpay_signature: resGen.jsonData.razorpay_signature
  });
  assert.strictEqual(isSig2Valid, true, 'Signature from generateDevPayment must verify to true');
  console.log('  ✓ Signature from generateDevPayment verified by verifyRazorpaySignature: TRUE');

  // 4. Verify Signature & Create Order (POST /api/orders/payment/verify)
  console.log('\nStep 4: Calling verifyPaymentAndCreateOrder with simulator credentials...');
  const { req: reqVerify, res: resVerify } = createMockReqRes({
    user: testUser,
    body: {
      razorpay_order_id: orderId,
      razorpay_payment_id: payId,
      razorpay_signature: sig
    }
  });

  await verifyPaymentAndCreateOrder(reqVerify, resVerify);

  console.log('  >>> Verification HTTP Status:', resVerify.statusCode);
  console.log('  >>> Verification Message:', resVerify.jsonData.message);
  assert.strictEqual(resVerify.statusCode, 201, 'verifyPaymentAndCreateOrder must return HTTP 201 on success');
  assert.strictEqual(resVerify.jsonData.success, true);
  assert.strictEqual(resVerify.jsonData.order.payment.status, 'PAID');
  assert.strictEqual(resVerify.jsonData.order.status, 'ORDER_RECEIVED');
  assert.strictEqual(resVerify.jsonData.order.total, 350);

  // 5. Verify Cart was cleared
  const cartAfter = cartDB.get(testUser._id.toString());
  assert.strictEqual(cartAfter.items.length, 0, 'Cart must be cleared after order creation');
  console.log('  ✓ Cart cleared in database: TRUE');

  // 6. Verify inventory was decremented
  const thinCrust = inventoryDB.get('base:thin crust');
  assert.strictEqual(thinCrust.quantity, 19, 'Thin Crust stock must be decremented from 20 to 19');
  console.log('  ✓ Inventory decremented: TRUE');

  console.log('\n====================================================');
  console.log('🎉 SIMULATOR END-TO-END FLOW PASSED WITH 100% SUCCESS!');
  console.log('====================================================');
}

testSimulatorE2E().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
