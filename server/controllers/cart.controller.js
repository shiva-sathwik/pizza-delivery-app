const mongoose = require('mongoose');
const Cart = require('../models/Cart');
const Pizza = require('../models/Pizza');
const {
  validateCustomPizzaIngredients,
  calculateCustomPizzaPrice
} = require('../config/ingredients');

/**
 * Helper to compute cart subtotal and total item count
 */
const formatCartResponse = (cart) => {
  const items = cart && cart.items ? cart.items : [];
  const subtotal = items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const totalItems = items.reduce((acc, item) => acc + item.quantity, 0);

  return {
    _id: cart ? cart._id : null,
    items,
    subtotal: Math.round(subtotal * 100) / 100,
    totalItems,
    updatedAt: cart ? cart.updatedAt : null
  };
};

/**
 * Helper to check if two custom pizzas have identical configurations
 */
const areCustomPizzasEqual = (a, b) => {
  if (a.base !== b.base || a.sauce !== b.sauce || a.cheese !== b.cheese) {
    return false;
  }
  const vegsA = [...(a.vegetables || [])].sort();
  const vegsB = [...(b.vegetables || [])].sort();
  if (vegsA.length !== vegsB.length) {
    return false;
  }
  return vegsA.every((v, idx) => v === vegsB[idx]);
};

/**
 * @desc    Get current authenticated user's cart
 * @route   GET /api/cart
 * @access  Private (User)
 */
const getCart = async (req, res) => {
  try {
    const userId = req.user._id;

    let cart = await Cart.findOne({ user: userId });

    if (!cart) {
      return res.status(200).json({
        success: true,
        data: {
          items: [],
          subtotal: 0,
          totalItems: 0
        }
      });
    }

    return res.status(200).json({
      success: true,
      data: formatCartResponse(cart)
    });
  } catch (error) {
    console.error('[CartController] getCart error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve shopping cart'
    });
  }
};

/**
 * @desc    Add catalog or custom pizza to cart
 * @route   POST /api/cart
 * @access  Private (User)
 */
const addToCart = async (req, res) => {
  try {
    const userId = req.user._id;
    const { type, pizzaId, base, sauce, cheese, vegetables, quantity = 1 } = req.body;

    // Validate quantity
    const parsedQty = parseInt(quantity, 10);
    if (isNaN(parsedQty) || parsedQty < 1 || String(quantity).includes('.')) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be a positive whole integer of at least 1'
      });
    }

    // Validate cart item type
    if (!type || !['catalog', 'custom'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Cart item type must be either 'catalog' or 'custom'"
      });
    }

    // Load or initialize cart for authenticated user
    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
      cart = new Cart({ user: userId, items: [] });
    }

    // A) Catalog Pizza handling
    if (type === 'catalog') {
      if (!pizzaId || !mongoose.Types.ObjectId.isValid(pizzaId)) {
        return res.status(400).json({
          success: false,
          message: 'Valid pizzaId is required for catalog pizzas'
        });
      }

      const catalogPizza = await Pizza.findById(pizzaId);
      if (!catalogPizza || catalogPizza.isAvailable !== true) {
        return res.status(404).json({
          success: false,
          message: 'Selected pizza is not available or does not exist'
        });
      }

      // Check if identical catalog pizza already exists in cart
      const existingItem = cart.items.find(
        item => item.type === 'catalog' && item.pizza && item.pizza.toString() === pizzaId.toString()
      );

      if (existingItem) {
        existingItem.quantity += parsedQty;
      } else {
        cart.items.push({
          type: 'catalog',
          pizza: catalogPizza._id,
          name: catalogPizza.name,
          base: catalogPizza.base,
          sauce: catalogPizza.sauce,
          cheese: catalogPizza.cheese,
          vegetables: catalogPizza.vegetables || [],
          price: catalogPizza.price,
          quantity: parsedQty
        });
      }
    }

    // B) Custom Pizza handling
    if (type === 'custom') {
      const validation = validateCustomPizzaIngredients({ base, sauce, cheese, vegetables });
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: validation.error
        });
      }

      // Authoritative server-side price calculation (ignores any client-provided price)
      const calculatedPrice = calculateCustomPizzaPrice(validation.normalized);

      const newCustomItem = {
        type: 'custom',
        pizza: null,
        name: 'Custom Artisan Pizza',
        base: validation.normalized.base,
        sauce: validation.normalized.sauce,
        cheese: validation.normalized.cheese,
        vegetables: validation.normalized.vegetables,
        price: calculatedPrice,
        quantity: parsedQty
      };

      // Check for exact matching custom pizza in cart
      const matchingCustomItem = cart.items.find(
        item => item.type === 'custom' && areCustomPizzasEqual(item, newCustomItem)
      );

      if (matchingCustomItem) {
        matchingCustomItem.quantity += parsedQty;
      } else {
        cart.items.push(newCustomItem);
      }
    }

    await cart.save();

    return res.status(200).json({
      success: true,
      message: 'Pizza successfully added to cart',
      data: formatCartResponse(cart)
    });
  } catch (error) {
    console.error('[CartController] addToCart error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to add pizza to cart'
    });
  }
};

/**
 * @desc    Update quantity of an existing item in cart
 * @route   PUT /api/cart/:itemId
 * @access  Private (User)
 */
const updateCartItemQuantity = async (req, res) => {
  try {
    const userId = req.user._id;
    const { itemId } = req.params;
    const { quantity } = req.body;

    // Validate quantity
    const parsedQty = parseInt(quantity, 10);
    if (isNaN(parsedQty) || parsedQty < 1 || String(quantity).includes('.')) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be a positive integer (at least 1)'
      });
    }

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    const item = cart.items.id ? cart.items.id(itemId) : cart.items.find(i => (i._id || '').toString() === itemId);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Cart item not found in your cart'
      });
    }

    item.quantity = parsedQty;
    await cart.save();

    return res.status(200).json({
      success: true,
      message: 'Item quantity updated',
      data: formatCartResponse(cart)
    });
  } catch (error) {
    console.error('[CartController] updateCartItemQuantity error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to update item quantity'
    });
  }
};

/**
 * @desc    Remove an item from authenticated user's cart
 * @route   DELETE /api/cart/:itemId
 * @access  Private (User)
 */
const removeCartItem = async (req, res) => {
  try {
    const userId = req.user._id;
    const { itemId } = req.params;

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    const itemIndex = cart.items.findIndex(i => (i._id || '').toString() === itemId);
    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Cart item not found in your cart'
      });
    }

    cart.items.splice(itemIndex, 1);
    await cart.save();

    return res.status(200).json({
      success: true,
      message: 'Item removed from cart',
      data: formatCartResponse(cart)
    });
  } catch (error) {
    console.error('[CartController] removeCartItem error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to remove item from cart'
    });
  }
};

/**
 * @desc    Clear all items in authenticated user's cart
 * @route   DELETE /api/cart
 * @access  Private (User)
 */
const clearCart = async (req, res) => {
  try {
    const userId = req.user._id;

    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return res.status(200).json({
        success: true,
        message: 'Cart is already empty',
        data: {
          items: [],
          subtotal: 0,
          totalItems: 0
        }
      });
    }

    cart.items = [];
    await cart.save();

    return res.status(200).json({
      success: true,
      message: 'Cart cleared successfully',
      data: formatCartResponse(cart)
    });
  } catch (error) {
    console.error('[CartController] clearCart error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to clear cart'
    });
  }
};

module.exports = {
  getCart,
  addToCart,
  updateCartItemQuantity,
  removeCartItem,
  clearCart
};
