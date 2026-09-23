const express = require('express');
const {
  getAllPizzas,
  getPizzaById,
  getBuilderIngredients
} = require('../controllers/pizza.controller');

const router = express.Router();

// Public Pizza Catalog Routes
router.get('/', getAllPizzas);
router.get('/ingredients', getBuilderIngredients);
router.get('/:id', getPizzaById);

module.exports = router;
