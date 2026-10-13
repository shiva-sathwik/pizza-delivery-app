const express = require('express');
const {
  getAllPizzas,
  getPizzaById,
  getBuilderIngredients,
  getPopularPizza,
  createPizza,
  updatePizza,
  deletePizza
} = require('../controllers/pizza.controller');
const { authenticate, requireAdmin, optionalAuthenticate } = require('../middleware/auth.middleware');

const router = express.Router();

// Public Pizza Catalog Routes (with optional auth so admins can view all)
router.get('/', optionalAuthenticate, getAllPizzas);
router.get('/ingredients', getBuilderIngredients);
router.get('/popular', getPopularPizza);
router.get('/:id', optionalAuthenticate, getPizzaById);

// Admin Pizza Catalog Management Routes
router.post('/', authenticate, requireAdmin, createPizza);
router.put('/:id', authenticate, requireAdmin, updatePizza);
router.patch('/:id', authenticate, requireAdmin, updatePizza);
router.delete('/:id', authenticate, requireAdmin, deletePizza);

module.exports = router;

