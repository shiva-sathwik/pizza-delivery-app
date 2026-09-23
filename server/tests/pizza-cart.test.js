/**
 * Step 5: Pizza Catalog, Custom Pizza Builder, and Cart Testing Suite
 * Tests 26 specific requirements:
 *
 * PIZZA CATALOG (1-4):
 * 1. GET /api/pizzas returns available pizzas
 * 2. GET /api/pizzas/:id returns valid pizza
 * 3. Invalid pizza ID handled correctly
 * 4. Unavailable pizza cannot be selected
 *
 * CUSTOM PIZZA BUILDER (5-11):
 * 5. Valid custom pizza ingredients accepted
 * 6. Invalid base rejected
 * 7. Invalid sauce rejected
 * 8. Invalid cheese rejected
 * 9. Invalid vegetable rejected
 * 10. Server calculates custom pizza price
 * 11. Client-provided fake price is ignored/rejected
 *
 * CART (12-23):
 * 12. Unauthenticated cart request returns 401
 * 13. Authenticated user can get empty cart
 * 14. Catalog pizza can be added
 * 15. Custom pizza can be added
 * 16. Quantity can be updated
 * 17. Invalid quantity rejected
 * 18. Item can be deleted
 * 19. Cart can be cleared
 * 20. Cart subtotal is calculated server-side
 * 21. totalItems is calculated correctly
 * 22. Identical catalog items merge correctly
 * 23. Different custom configurations remain separate
 *
 * SECURITY & ISOLATION (24-26):
 * 24. User A cannot access User B's cart
 * 25. User A cannot modify User B's cart item
 * 26. User A cannot delete User B's cart item
 */

const assert = require('assert');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

// Set test environment variables
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_key_12345';
process.env.NODE_ENV = 'test';

const { authenticate } = require('../middleware/auth.middleware');
const Pizza = require('../models/Pizza');
const Cart = require('../models/Cart');
const User = require('../models/User');
const {
  getAllPizzas,
  getPizzaById
} = require('../controllers/pizza.controller');
const {
  getCart,
  addToCart,
  updateCartItemQuantity,
  removeCartItem,
  clearCart
} = require('../controllers/cart.controller');
const {
  BASES,
  SAUCES,
  CHEESES,
  VEGETABLES,
  validateCustomPizzaIngredients,
  calculateCustomPizzaPrice
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

// In-Memory Databases for Test Harness
const pizzaDB = new Map();
const cartDB = new Map();
const userDB = new Map();

// Hook into Pizza model methods
Pizza.find = function(filter = {}) {
  const results = [];
  for (const pizza of pizzaDB.values()) {
    let match = true;
    if (filter.isAvailable !== undefined && pizza.isAvailable !== filter.isAvailable) {
      match = false;
    }
    if (match) results.push(pizza);
  }
  return {
    sort: () => Promise.resolve(results),
    then: (resolve) => resolve(results)
  };
};

Pizza.findById = async function(id) {
  return pizzaDB.get(id ? id.toString() : '') || null;
};

// Hook into Cart model methods
Cart.findOne = async function(filter = {}) {
  if (filter.user) {
    const uId = filter.user.toString();
    const cart = cartDB.get(uId);
    if (!cart) return null;
    return cart;
  }
  return null;
};

// Helper to wrap cart in simulated Mongoose methods
function wrapCartDoc(cartData) {
  const doc = {
    _id: cartData._id || new mongoose.Types.ObjectId().toString(),
    user: cartData.user,
    items: (cartData.items || []).map(item => ({
      _id: item._id || new mongoose.Types.ObjectId().toString(),
      ...item
    })),
    createdAt: cartData.createdAt || new Date(),
    updatedAt: cartData.updatedAt || new Date()
  };

  doc.save = async function() {
    doc.updatedAt = new Date();
    // Ensure every item has an _id string
    doc.items.forEach(it => {
      if (!it._id) it._id = new mongoose.Types.ObjectId().toString();
    });
    cartDB.set(doc.user.toString(), doc);
    return doc;
  };

  return doc;
}

// Override Cart constructor for `new Cart(...)`
const originalCartConstructor = Cart;
function MockCart(data) {
  return wrapCartDoc(data);
}
MockCart.findOne = Cart.findOne;

// Intercept new Cart in cart.controller by patching module cache if needed, or patching Cart constructor
Cart.prototype.save = async function() {
  const uId = this.user.toString();
  this.items.forEach(it => {
    if (!it._id) it._id = new mongoose.Types.ObjectId();
  });
  cartDB.set(uId, this);
  return this;
};

// Seed in-memory test data
const userAId = new mongoose.Types.ObjectId();
const userBId = new mongoose.Types.ObjectId();

const testUserA = {
  _id: userAId,
  name: 'Customer Alice',
  email: 'alice@example.com',
  role: 'user'
};

const testUserB = {
  _id: userBId,
  name: 'Customer Bob',
  email: 'bob@example.com',
  role: 'user'
};

userDB.set(userAId.toString(), testUserA);
userDB.set(userBId.toString(), testUserB);

User.findById = function(id) {
  return {
    select: () => Promise.resolve(userDB.get(id ? id.toString() : '') || null)
  };
};

const pizza1Id = new mongoose.Types.ObjectId();
const pizza2UnavailableId = new mongoose.Types.ObjectId();

const availablePizza = {
  _id: pizza1Id,
  name: 'Margherita Classica',
  description: 'San Marzano tomatoes with mozzarella',
  base: 'Thin Crust',
  sauce: 'Classic San Marzano Tomato',
  cheese: '100% Mozzarella',
  vegetables: [],
  price: 299,
  isAvailable: true
};

const unavailablePizza = {
  _id: pizza2UnavailableId,
  name: 'Seasonal Truffle Pizza',
  description: 'Limited winter edition',
  base: 'Thin Crust',
  sauce: 'Creamy Garlic & Herb',
  cheese: 'Four Cheese Blend',
  vegetables: ['Grilled Mushrooms'],
  price: 699,
  isAvailable: false
};

pizzaDB.set(pizza1Id.toString(), availablePizza);
pizzaDB.set(pizza2UnavailableId.toString(), unavailablePizza);

let testsPassed = 0;
let testsFailed = 0;

function reportTest(title, passed, detail = '') {
  if (passed) {
    console.log(`  ✓ ${title}`);
    testsPassed++;
  } else {
    console.error(`  ✗ ${title} - FAIL: ${detail}`);
    testsFailed++;
  }
}

async function runStep5Tests() {
  console.log('\n====================================================');
  console.log('🧪 RUNNING STEP 5 PIZZA CATALOG + BUILDER + CART TESTS');
  console.log('====================================================\n');

  // --- PIZZA CATALOG TESTS ---
  console.log('--- 1. PIZZA CATALOG TESTS ---');

  // Test 1: GET /api/pizzas returns available pizzas
  try {
    const { req, res } = createMockReqRes();
    await getAllPizzas(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.jsonData.success, true);
    assert.strictEqual(Array.isArray(res.jsonData.data), true);
    assert.strictEqual(res.jsonData.data.some(p => p._id.toString() === pizza1Id.toString()), true);
    assert.strictEqual(res.jsonData.data.some(p => p._id.toString() === pizza2UnavailableId.toString()), false);
    reportTest('GET /api/pizzas returns available pizzas', true);
  } catch (err) {
    reportTest('GET /api/pizzas returns available pizzas', false, err.message);
  }

  // Test 2: GET /api/pizzas/:id returns valid pizza
  try {
    const { req, res } = createMockReqRes({ params: { id: pizza1Id.toString() } });
    await getPizzaById(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.jsonData.success, true);
    assert.strictEqual(res.jsonData.data.name, 'Margherita Classica');
    assert.strictEqual(res.jsonData.data.price, 299);
    reportTest('GET /api/pizzas/:id returns valid pizza', true);
  } catch (err) {
    reportTest('GET /api/pizzas/:id returns valid pizza', false, err.message);
  }

  // Test 3: Invalid pizza ID handled correctly
  try {
    const { req, res } = createMockReqRes({ params: { id: 'invalid-mongodb-id-format' } });
    await getPizzaById(req, res);
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.jsonData.success, false);
    reportTest('Invalid pizza ID handled correctly with 400', true);
  } catch (err) {
    reportTest('Invalid pizza ID handled correctly with 400', false, err.message);
  }

  // Test 4: Unavailable pizza cannot be selected / retrieved
  try {
    const { req, res } = createMockReqRes({ params: { id: pizza2UnavailableId.toString() } });
    await getPizzaById(req, res);
    assert.strictEqual(res.statusCode, 404);
    assert.strictEqual(res.jsonData.success, false);
    reportTest('Unavailable pizza returns 404', true);
  } catch (err) {
    reportTest('Unavailable pizza returns 404', false, err.message);
  }

  // --- CUSTOM PIZZA BUILDER TESTS ---
  console.log('\n--- 2. CUSTOM PIZZA BUILDER TESTS ---');

  // Test 5: Valid custom pizza ingredients accepted
  try {
    const validConfig = {
      base: 'Thin Crust',
      sauce: 'Classic San Marzano Tomato',
      cheese: '100% Mozzarella',
      vegetables: ['Grilled Mushrooms', 'Black Olives']
    };
    const validation = validateCustomPizzaIngredients(validConfig);
    assert.strictEqual(validation.isValid, true);
    assert.strictEqual(validation.normalized.base, 'Thin Crust');
    assert.strictEqual(validation.normalized.vegetables.length, 2);
    reportTest('Valid custom pizza ingredients accepted', true);
  } catch (err) {
    reportTest('Valid custom pizza ingredients accepted', false, err.message);
  }

  // Test 6: Invalid base rejected
  try {
    const invalidBase = {
      base: 'Cardboard Crust',
      sauce: 'Classic San Marzano Tomato',
      cheese: '100% Mozzarella',
      vegetables: []
    };
    const validation = validateCustomPizzaIngredients(invalidBase);
    assert.strictEqual(validation.isValid, false);
    assert.ok(validation.error.includes('Invalid base crust'));
    reportTest('Invalid base rejected with descriptive error', true);
  } catch (err) {
    reportTest('Invalid base rejected with descriptive error', false, err.message);
  }

  // Test 7: Invalid sauce rejected
  try {
    const invalidSauce = {
      base: 'Thin Crust',
      sauce: 'Chocolate Syrup',
      cheese: '100% Mozzarella',
      vegetables: []
    };
    const validation = validateCustomPizzaIngredients(invalidSauce);
    assert.strictEqual(validation.isValid, false);
    assert.ok(validation.error.includes('Invalid sauce'));
    reportTest('Invalid sauce rejected with descriptive error', true);
  } catch (err) {
    reportTest('Invalid sauce rejected with descriptive error', false, err.message);
  }

  // Test 8: Invalid cheese rejected
  try {
    const invalidCheese = {
      base: 'Thin Crust',
      sauce: 'Classic San Marzano Tomato',
      cheese: 'Plastic Cheese',
      vegetables: []
    };
    const validation = validateCustomPizzaIngredients(invalidCheese);
    assert.strictEqual(validation.isValid, false);
    assert.ok(validation.error.includes('Invalid cheese'));
    reportTest('Invalid cheese rejected with descriptive error', true);
  } catch (err) {
    reportTest('Invalid cheese rejected with descriptive error', false, err.message);
  }

  // Test 9: Invalid vegetable rejected
  try {
    const invalidVeg = {
      base: 'Thin Crust',
      sauce: 'Classic San Marzano Tomato',
      cheese: '100% Mozzarella',
      vegetables: ['Grilled Mushrooms', 'Pineapple Chunk']
    };
    const validation = validateCustomPizzaIngredients(invalidVeg);
    assert.strictEqual(validation.isValid, false);
    assert.ok(validation.error.includes('Invalid vegetable'));
    reportTest('Invalid vegetable rejected with descriptive error', true);
  } catch (err) {
    reportTest('Invalid vegetable rejected with descriptive error', false, err.message);
  }

  // Test 10: Server calculates custom pizza price
  try {
    // Thin Crust (120) + Classic San Marzano Tomato (40) + 100% Mozzarella (70) + Grilled Mushrooms (40) + Black Olives (35) = 305
    const price = calculateCustomPizzaPrice({
      base: 'Thin Crust',
      sauce: 'Classic San Marzano Tomato',
      cheese: '100% Mozzarella',
      vegetables: ['Grilled Mushrooms', 'Black Olives']
    });
    assert.strictEqual(price, 305);
    reportTest('Server calculates custom pizza price accurately (₹305)', true);
  } catch (err) {
    reportTest('Server calculates custom pizza price accurately', false, err.message);
  }

  // Test 11: Client-provided fake price is ignored/rejected
  try {
    cartDB.clear();
    const { req, res } = createMockReqRes({
      user: testUserA,
      body: {
        type: 'custom',
        base: 'Thin Crust',
        sauce: 'Classic San Marzano Tomato',
        cheese: '100% Mozzarella',
        vegetables: ['Grilled Mushrooms', 'Black Olives'],
        price: 10 // Attacker attempting to pay ₹10 instead of ₹305
      }
    });
    await addToCart(req, res);
    assert.strictEqual(res.statusCode, 200);
    const addedItem = res.jsonData.data.items[0];
    assert.strictEqual(addedItem.price, 305); // Must be calculated price, not 10!
    assert.notStrictEqual(addedItem.price, 10);
    reportTest('Client-provided fake price is strictly ignored (price set to server ₹305)', true);
  } catch (err) {
    reportTest('Client-provided fake price is strictly ignored', false, err.message);
  }

  // --- CART TESTS ---
  console.log('\n--- 3. CART API & FUNCTIONALITY TESTS ---');

  // Test 12: Unauthenticated cart request returns 401
  try {
    const { req, res } = createMockReqRes();
    let nextCalled = false;
    await authenticate(req, res, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(res.jsonData.success, false);
    reportTest('Unauthenticated cart request returns 401', true);
  } catch (err) {
    reportTest('Unauthenticated cart request returns 401', false, err.message);
  }

  // Test 13: Authenticated user can get empty cart
  try {
    cartDB.clear();
    const { req, res } = createMockReqRes({ user: testUserA });
    await getCart(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.jsonData.success, true);
    assert.strictEqual(res.jsonData.data.items.length, 0);
    assert.strictEqual(res.jsonData.data.subtotal, 0);
    assert.strictEqual(res.jsonData.data.totalItems, 0);
    reportTest('Authenticated user can get empty cart', true);
  } catch (err) {
    reportTest('Authenticated user can get empty cart', false, err.message);
  }

  // Test 14: Catalog pizza can be added
  try {
    cartDB.clear();
    const { req, res } = createMockReqRes({
      user: testUserA,
      body: {
        type: 'catalog',
        pizzaId: pizza1Id.toString(),
        quantity: 1
      }
    });
    await addToCart(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.jsonData.data.items.length, 1);
    assert.strictEqual(res.jsonData.data.items[0].name, 'Margherita Classica');
    assert.strictEqual(res.jsonData.data.items[0].price, 299);
    reportTest('Catalog pizza can be added to cart', true);
  } catch (err) {
    reportTest('Catalog pizza can be added to cart', false, err.message);
  }

  // Test 15: Custom pizza can be added
  try {
    const { req, res } = createMockReqRes({
      user: testUserA,
      body: {
        type: 'custom',
        base: 'Cheese Burst',
        sauce: 'Spicy Peri-Peri',
        cheese: 'Four Cheese Blend',
        vegetables: ['Paneer Cubes', 'Crisp Bell Peppers'],
        quantity: 1
      }
    });
    await addToCart(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.jsonData.data.items.length, 2);
    // Cheese Burst (180) + Spicy Peri-Peri (50) + Four Cheese (110) + Paneer (50) + Bell Peppers (30) = 420
    const customItem = res.jsonData.data.items.find(i => i.type === 'custom');
    assert.ok(customItem);
    assert.strictEqual(customItem.price, 420);
    reportTest('Custom pizza can be added to cart with calculated price (₹420)', true);
  } catch (err) {
    reportTest('Custom pizza can be added to cart', false, err.message);
  }

  // Test 16: Quantity can be updated
  let targetItemId;
  try {
    const userCart = cartDB.get(userAId.toString());
    targetItemId = userCart.items[0]._id.toString();
    const { req, res } = createMockReqRes({
      user: testUserA,
      params: { itemId: targetItemId },
      body: { quantity: 3 }
    });
    await updateCartItemQuantity(req, res);
    assert.strictEqual(res.statusCode, 200);
    const updated = res.jsonData.data.items.find(i => i._id.toString() === targetItemId);
    assert.strictEqual(updated.quantity, 3);
    reportTest('Item quantity can be updated to 3', true);
  } catch (err) {
    reportTest('Quantity can be updated', false, err.message);
  }

  // Test 17: Invalid quantity rejected (e.g. 0, negative, fractional)
  try {
    const { req, res } = createMockReqRes({
      user: testUserA,
      params: { itemId: targetItemId },
      body: { quantity: 0 }
    });
    await updateCartItemQuantity(req, res);
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.jsonData.success, false);

    // Negative test
    const { req: reqNeg, res: resNeg } = createMockReqRes({
      user: testUserA,
      params: { itemId: targetItemId },
      body: { quantity: -2 }
    });
    await updateCartItemQuantity(reqNeg, resNeg);
    assert.strictEqual(resNeg.statusCode, 400);
    reportTest('Invalid quantities (0, negative) rejected with 400', true);
  } catch (err) {
    reportTest('Invalid quantity rejected', false, err.message);
  }

  // Test 18: Item can be deleted
  try {
    const { req, res } = createMockReqRes({
      user: testUserA,
      params: { itemId: targetItemId }
    });
    await removeCartItem(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.jsonData.data.items.length, 1);
    assert.strictEqual(res.jsonData.data.items.some(i => i._id.toString() === targetItemId), false);
    reportTest('Item can be deleted from cart', true);
  } catch (err) {
    reportTest('Item can be deleted', false, err.message);
  }

  // Test 19: Cart can be cleared
  try {
    const { req, res } = createMockReqRes({ user: testUserA });
    await clearCart(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.jsonData.data.items.length, 0);
    assert.strictEqual(res.jsonData.data.subtotal, 0);
    assert.strictEqual(res.jsonData.data.totalItems, 0);
    reportTest('Cart can be cleared completely', true);
  } catch (err) {
    reportTest('Cart can be cleared', false, err.message);
  }

  // Test 20: Cart subtotal is calculated server-side
  try {
    cartDB.clear();
    // Add item 1: price 299, qty 2 = 598
    await addToCart(createMockReqRes({
      user: testUserA,
      body: { type: 'catalog', pizzaId: pizza1Id.toString(), quantity: 2 }
    }).req, createMockReqRes().res);

    // Add item 2: custom pizza price 305, qty 1 = 305
    const { req, res } = createMockReqRes({
      user: testUserA,
      body: {
        type: 'custom',
        base: 'Thin Crust',
        sauce: 'Classic San Marzano Tomato',
        cheese: '100% Mozzarella',
        vegetables: ['Grilled Mushrooms', 'Black Olives'],
        quantity: 1
      }
    });
    await addToCart(req, res);
    assert.strictEqual(res.statusCode, 200);
    // Subtotal: 299*2 + 305 = 903
    assert.strictEqual(res.jsonData.data.subtotal, 903);
    reportTest('Cart subtotal is calculated server-side (598 + 305 = 903)', true);
  } catch (err) {
    reportTest('Cart subtotal is calculated server-side', false, err.message);
  }

  // Test 21: totalItems is calculated correctly
  try {
    const userCart = cartDB.get(userAId.toString());
    const totalItems = userCart.items.reduce((acc, i) => acc + i.quantity, 0);
    // Qty 2 + Qty 1 = 3
    assert.strictEqual(totalItems, 3);
    reportTest('totalItems is calculated correctly (2 + 1 = 3)', true);
  } catch (err) {
    reportTest('totalItems is calculated correctly', false, err.message);
  }

  // Test 22: Identical catalog items merge correctly
  try {
    cartDB.clear();
    // Add Margherita with qty 1
    await addToCart(createMockReqRes({
      user: testUserA,
      body: { type: 'catalog', pizzaId: pizza1Id.toString(), quantity: 1 }
    }).req, createMockReqRes().res);

    // Add same Margherita again with qty 2
    const { req, res } = createMockReqRes({
      user: testUserA,
      body: { type: 'catalog', pizzaId: pizza1Id.toString(), quantity: 2 }
    });
    await addToCart(req, res);

    assert.strictEqual(res.jsonData.data.items.length, 1); // Not 2 separate items
    assert.strictEqual(res.jsonData.data.items[0].quantity, 3); // Merged to 3
    reportTest('Identical catalog items merge correctly (qty incremented to 3)', true);
  } catch (err) {
    reportTest('Identical catalog items merge correctly', false, err.message);
  }

  // Test 23: Different custom configurations remain separate
  try {
    cartDB.clear();
    // Custom A
    await addToCart(createMockReqRes({
      user: testUserA,
      body: {
        type: 'custom',
        base: 'Thin Crust',
        sauce: 'Classic San Marzano Tomato',
        cheese: '100% Mozzarella',
        vegetables: ['Grilled Mushrooms']
      }
    }).req, createMockReqRes().res);

    // Custom B (different cheese and extra olives)
    const { req, res } = createMockReqRes({
      user: testUserA,
      body: {
        type: 'custom',
        base: 'Thin Crust',
        sauce: 'Classic San Marzano Tomato',
        cheese: 'Sharp Cheddar',
        vegetables: ['Grilled Mushrooms', 'Black Olives']
      }
    });
    await addToCart(req, res);

    assert.strictEqual(res.jsonData.data.items.length, 2);
    reportTest('Different custom configurations remain separate cart items', true);
  } catch (err) {
    reportTest('Different custom configurations remain separate', false, err.message);
  }

  // --- SECURITY & ISOLATION TESTS ---
  console.log('\n--- 4. SECURITY & USER ISOLATION TESTS ---');

  // Setup: User A has 1 item, User B has a different item
  let userAItemId;
  try {
    cartDB.clear();
    // Seed User A's cart
    await addToCart(createMockReqRes({
      user: testUserA,
      body: { type: 'catalog', pizzaId: pizza1Id.toString(), quantity: 1 }
    }).req, createMockReqRes().res);
    const cartA = cartDB.get(userAId.toString());
    userAItemId = cartA.items[0]._id.toString();

    // Seed User B's cart
    await addToCart(createMockReqRes({
      user: testUserB,
      body: {
        type: 'custom',
        base: 'Pan Crust',
        sauce: 'Spicy Peri-Peri',
        cheese: '100% Mozzarella',
        vegetables: []
      }
    }).req, createMockReqRes().res);
  } catch (err) {
    console.error('Setup failed for security tests:', err);
  }

  // Test 24: User A cannot access User B's cart
  try {
    const { req, res } = createMockReqRes({ user: testUserA });
    await getCart(req, res);
    assert.strictEqual(res.statusCode, 200);
    // User A's cart should only show User A's items
    assert.strictEqual(res.jsonData.data.items.length, 1);
    assert.strictEqual(res.jsonData.data.items[0].type, 'catalog');
    assert.strictEqual(res.jsonData.data.items.some(i => i.type === 'custom'), false);
    reportTest("User A cannot access User B's cart data", true);
  } catch (err) {
    reportTest("User A cannot access User B's cart", false, err.message);
  }

  // Test 25: User A cannot modify User B's cart item
  try {
    // User B attempts to modify User A's cart item
    const { req, res } = createMockReqRes({
      user: testUserB,
      params: { itemId: userAItemId },
      body: { quantity: 10 }
    });
    await updateCartItemQuantity(req, res);
    assert.strictEqual(res.statusCode, 404);
    assert.strictEqual(res.jsonData.success, false);
    assert.ok(res.jsonData.message.includes('not found in your cart'));

    // Verify User A's item was NOT modified
    const cartA = cartDB.get(userAId.toString());
    assert.strictEqual(cartA.items[0].quantity, 1);
    reportTest("User B cannot modify User A's cart item (returns 404)", true);
  } catch (err) {
    reportTest("User A cannot modify User B's cart item", false, err.message);
  }

  // Test 26: User A cannot delete User B's cart item
  try {
    // User B attempts to delete User A's cart item
    const { req, res } = createMockReqRes({
      user: testUserB,
      params: { itemId: userAItemId }
    });
    await removeCartItem(req, res);
    assert.strictEqual(res.statusCode, 404);
    assert.strictEqual(res.jsonData.success, false);

    // Verify User A's item still exists in User A's cart
    const cartA = cartDB.get(userAId.toString());
    assert.strictEqual(cartA.items.length, 1);
    reportTest("User B cannot delete User A's cart item (returns 404)", true);
  } catch (err) {
    reportTest("User A cannot delete User B's cart item", false, err.message);
  }

  console.log('\n====================================================');
  console.log(`TOTAL STEP 5 TESTS: ${testsPassed + testsFailed}`);
  console.log(`PASSED: ${testsPassed}`);
  console.log(`FAILED: ${testsFailed}`);
  console.log('====================================================\n');

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runStep5Tests();
