const mongoose = require('mongoose');
const Pizza = require('../models/Pizza');
const { BASES, SAUCES, CHEESES, VEGETABLES } = require('../config/ingredients');

/**
 * @desc    Get all available catalog pizzas
 * @route   GET /api/pizzas
 * @access  Public
 */
const getAllPizzas = async (req, res) => {
  try {
    const filter = { isAvailable: true };

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

    if (!pizza || pizza.isAvailable !== true) {
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

module.exports = {
  getAllPizzas,
  getPizzaById,
  getBuilderIngredients
};
