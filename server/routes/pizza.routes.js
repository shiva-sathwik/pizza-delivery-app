const express = require('express');
const {
  getAllPizzas,
  getPizzaById,
  getBuilderIngredients,
  getPopularPizza
} = require('../controllers/pizza.controller');

const router = express.Router();

// Public Pizza Catalog Routes
router.get('/', getAllPizzas);
router.get('/ingredients', getBuilderIngredients);
router.get('/popular', getPopularPizza);
router.get('/:id', getPizzaById);

module.exports = router;

