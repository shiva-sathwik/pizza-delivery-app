const mongoose = require('mongoose');
const Pizza = require('../models/Pizza');
const Order = require('../models/Order');
const { BASES, SAUCES, CHEESES, VEGETABLES } = require('../config/ingredients');

/**
 * @desc    Get all available catalog pizzas
 * @route   GET /api/pizzas
 * @access  Public
 */
const getAllPizzas = async (req, res) => {
  try {
    const isAdmin = req.user && req.user.role === 'admin';
    const filter = {};

    if (!isAdmin || (req.query.includeUnavailable !== 'true' && req.query.all !== 'true')) {
      filter.isAvailable = true;
    }

    // Support optional search query
    if (req.query.search && typeof req.query.search === 'string' && req.query.search.trim()) {
      const searchRegex = new RegExp(req.query.search.trim(), 'i');
      filter.$or = [
        { name: searchRegex },
        { description: searchRegex }
      ];
    }

    const pizzas = await Pizza.find(filter).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: pizzas.length,
      data: pizzas
    });
  } catch (error) {
    console.error('[PizzaController] getAllPizzas error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve pizza catalog'
    });
  }
};

/**
 * @desc    Get single catalog pizza by ID
 * @route   GET /api/pizzas/:id
 * @access  Public
 */
const getPizzaById = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate MongoDB ObjectId format
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid pizza ID format'
      });
    }

    const pizza = await Pizza.findById(id);

    const isAdmin = req.user && req.user.role === 'admin';
    if (!pizza || (pizza.isAvailable !== true && !isAdmin)) {
      return res.status(404).json({
        success: false,
        message: 'Pizza not found or currently unavailable'
      });
    }

    return res.status(200).json({
      success: true,
      data: pizza
    });
  } catch (error) {
    console.error('[PizzaController] getPizzaById error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve pizza'
    });
  }
};

/**
 * @desc    Get available custom pizza builder ingredients and pricing
 * @route   GET /api/pizzas/ingredients
 * @access  Public
 */
const getBuilderIngredients = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      data: {
        bases: BASES,
        sauces: SAUCES,
        cheeses: CHEESES,
        vegetables: VEGETABLES
      }
    });
  } catch (error) {
    console.error('[PizzaController] getBuilderIngredients error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve builder ingredients'
    });
  }
};

/**
 * @desc    Get the most popular / most ordered catalog pizza
 * @route   GET /api/pizzas/popular
 * @access  Public
 */
const getPopularPizza = async (req, res) => {
  try {
    const paidOrders = await Order.find({ 'payment.status': 'PAID' });

    if (!paidOrders || paidOrders.length === 0) {
      return res.status(200).json({
        success: true,
        data: null,
        message: 'Popular picks will appear after customers place orders.'
      });
    }

    // Tally pizza quantities
    const pizzaTally = {};
    for (const order of paidOrders) {
      if (Array.isArray(order.items)) {
        for (const item of order.items) {
          const key = item.pizzaId ? item.pizzaId.toString() : item.name;
          if (!pizzaTally[key]) {
            pizzaTally[key] = {
              pizzaId: item.pizzaId,
              name: item.name,
              count: 0
            };
          }
          pizzaTally[key].count += item.quantity || 1;
        }
      }
    }

    const tallyList = Object.values(pizzaTally).sort((a, b) => b.count - a.count);

    if (tallyList.length === 0) {
      return res.status(200).json({
        success: true,
        data: null,
        message: 'Popular picks will appear after customers place orders.'
      });
    }

    let topPizzaDoc = null;
    let orderCount = 0;

    for (const topItem of tallyList) {
      let pizza = null;
      if (topItem.pizzaId && mongoose.Types.ObjectId.isValid(topItem.pizzaId)) {
        pizza = await Pizza.findById(topItem.pizzaId);
      }
      if (!pizza && topItem.name) {
        pizza = await Pizza.findOne({
          name: new RegExp(`^${topItem.name.trim()}$`, 'i'),
          isAvailable: true
        });
      }
      if (pizza && pizza.isAvailable) {
        topPizzaDoc = pizza;
        orderCount = topItem.count;
        break;
      }
    }

    if (!topPizzaDoc) {
      return res.status(200).json({
        success: true,
        data: null,
        message: 'Popular picks will appear after customers place orders.'
      });
    }

    return res.status(200).json({
      success: true,
      data: topPizzaDoc,
      orderCount
    });
  } catch (error) {
    console.error('[PizzaController] getPopularPizza error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve popular pizza recommendation'
    });
  }
};

/**
 * @desc    Create a new catalog pizza
 * @route   POST /api/pizzas
 * @access  Private (Admin only)
 */
const createPizza = async (req, res) => {
  try {
    const { name, description = '', image = '', base, sauce, cheese, vegetables = [], price, isAvailable = true } = req.body;

    // Validate required fields
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Pizza name is required'
      });
    }

    if (!base || typeof base !== 'string' || !base.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Base crust is required'
      });
    }

    if (!sauce || typeof sauce !== 'string' || !sauce.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Sauce is required'
      });
    }

    if (!cheese || typeof cheese !== 'string' || !cheese.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Cheese is required'
      });
    }

    // Validate price
    if (price === undefined || typeof price !== 'number' || isNaN(price) || price < 0) {
      return res.status(400).json({
        success: false,
        message: 'Price must be a valid non-negative number'
      });
    }

    // Check for duplicate pizza name
    const existing = await Pizza.findOne({ name: new RegExp(`^${name.trim()}$`, 'i') });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `A pizza with the name '${name.trim()}' already exists`
      });
    }

    const newPizza = new Pizza({
      name: name.trim(),
      description: typeof description === 'string' ? description.trim() : '',
      image: typeof image === 'string' ? image.trim() : '',
      base: base.trim(),
      sauce: sauce.trim(),
      cheese: cheese.trim(),
      vegetables: Array.isArray(vegetables) ? vegetables : [],
      price,
      isAvailable: isAvailable !== false
    });

    await newPizza.save();

    return res.status(201).json({
      success: true,
      message: 'Pizza created successfully',
      data: newPizza
    });
  } catch (error) {
    console.error('[PizzaController] createPizza error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error while creating pizza'
    });
  }
};

/**
 * @desc    Update an existing catalog pizza
 * @route   PUT /api/pizzas/:id, PATCH /api/pizzas/:id
 * @access  Private (Admin only)
 */
const updatePizza = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid pizza ID format'
      });
    }

    const pizza = await Pizza.findById(id);
    if (!pizza) {
      return res.status(404).json({
        success: false,
        message: 'Pizza not found'
      });
    }

    const { name, description, image, base, sauce, cheese, vegetables, price, isAvailable } = req.body;

    if (price !== undefined) {
      if (typeof price !== 'number' || isNaN(price) || price < 0) {
        return res.status(400).json({
          success: false,
          message: 'Price must be a valid non-negative number'
        });
      }
      pizza.price = price;
    }

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Pizza name cannot be empty'
        });
      }
      pizza.name = name.trim();
    }

    if (description !== undefined) pizza.description = typeof description === 'string' ? description.trim() : '';
    if (image !== undefined) pizza.image = typeof image === 'string' ? image.trim() : '';
    if (base !== undefined) pizza.base = typeof base === 'string' ? base.trim() : pizza.base;
    if (sauce !== undefined) pizza.sauce = typeof sauce === 'string' ? sauce.trim() : pizza.sauce;
    if (cheese !== undefined) pizza.cheese = typeof cheese === 'string' ? cheese.trim() : pizza.cheese;
    if (vegetables !== undefined) pizza.vegetables = Array.isArray(vegetables) ? vegetables : pizza.vegetables;
    if (isAvailable !== undefined) pizza.isAvailable = Boolean(isAvailable);

    await pizza.save();

    return res.status(200).json({
      success: true,
      message: 'Pizza updated successfully',
      data: pizza
    });
  } catch (error) {
    console.error('[PizzaController] updatePizza error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error while updating pizza'
    });
  }
};

/**
 * @desc    Delete or disable a catalog pizza
 * @route   DELETE /api/pizzas/:id
 * @access  Private (Admin only)
 */
const deletePizza = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid pizza ID format'
      });
    }

    const pizza = await Pizza.findById(id);
    if (!pizza) {
      return res.status(404).json({
        success: false,
        message: 'Pizza not found'
      });
    }

    if (req.query.mode === 'disable') {
      pizza.isAvailable = false;
      await pizza.save();
      return res.status(200).json({
        success: true,
        message: 'Pizza disabled successfully',
        data: pizza
      });
    }

    await Pizza.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: 'Pizza deleted successfully'
    });
  } catch (error) {
    console.error('[PizzaController] deletePizza error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error while deleting pizza'
    });
  }
};

module.exports = {
  getAllPizzas,
  getPizzaById,
  getBuilderIngredients,
  getPopularPizza,
  createPizza,
  updatePizza,
  deletePizza
};

