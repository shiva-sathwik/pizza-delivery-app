/**
 * Step 5: Authoritative Pizza-Builder Ingredients and Pricing Configuration
 *
 * This configuration serves as the single authoritative source of truth
 * for custom pizza ingredients and their server-calculated prices.
 */

const BASES = [
  { id: 'thin-crust', name: 'Thin Crust', price: 120, description: 'Light, crispy artisan base baked to golden perfection' },
  { id: 'cheese-burst', name: 'Cheese Burst', price: 180, description: 'Crust overflowing with molten hot mozzarella' },
  { id: 'pan-crust', name: 'Pan Crust', price: 140, description: 'Fluffy, thick crust pan-baked with golden edges' },
  { id: 'multigrain-crust', name: 'Multigrain Crust', price: 160, description: 'Wholesome blend of oats, rye, and whole wheat' },
  { id: 'gluten-free-crust', name: 'Gluten-Free Crust', price: 170, description: 'Dedicated gluten-free recipe without compromising crunch' }
];

const SAUCES = [
  { id: 'san-marzano', name: 'Classic San Marzano Tomato', price: 40, description: 'Slow-simmered Italian plum tomatoes with fresh basil' },
  { id: 'spicy-peri-peri', name: 'Spicy Peri-Peri', price: 50, description: 'Fiery bird\'s eye chili infusion with smoky paprika' },
  { id: 'garlic-herb', name: 'Creamy Garlic & Herb', price: 60, description: 'Rich roasted garlic white sauce infused with oregano' },
  { id: 'smoky-bbq', name: 'Smoky Barbeque', price: 55, description: 'Sweet hickory-smoked barbeque sauce with molasses' },
  { id: 'basil-pesto', name: 'Basil Pesto', price: 65, description: 'Aromatic genovese basil, pine nuts, and extra virgin olive oil' }
];

const CHEESES = [
  { id: 'mozzarella', name: '100% Mozzarella', price: 70, description: 'Classic stringy melt, delicate milky sweetness' },
  { id: 'sharp-cheddar', name: 'Sharp Cheddar', price: 80, description: 'Aged golden cheddar with a bold, tangy kick' },
  { id: 'smoked-gouda', name: 'Smoked Gouda', price: 90, description: 'Creamy Dutch gouda gently smoked with applewood' },
  { id: 'vegan-cheese', name: 'Vegan Dairy-Free Cheese', price: 95, description: 'Plant-based melt crafted from coconut and cashews' },
  { id: 'four-cheese-blend', name: 'Four Cheese Blend', price: 110, description: 'Mozzarella, Cheddar, Gouda, and shredded Parmesan' }
];

const VEGETABLES = [
  { id: 'black-olives', name: 'Black Olives', price: 35 },
  { id: 'grilled-mushrooms', name: 'Grilled Mushrooms', price: 40 },
  { id: 'red-onions', name: 'Red Onions', price: 25 },
  { id: 'bell-peppers', name: 'Crisp Bell Peppers', price: 30 },
  { id: 'sweet-corn', name: 'Sweet Corn', price: 25 },
  { id: 'jalapenos', name: 'Pickled Jalapeños', price: 35 },
  { id: 'baby-spinach', name: 'Baby Spinach', price: 30 },
  { id: 'paneer-cubes', name: 'Paneer Cubes', price: 50 }
];

// Helper maps for O(1) lookup
const baseMap = new Map(BASES.map(b => [b.name.toLowerCase(), b]));
const sauceMap = new Map(SAUCES.map(s => [s.name.toLowerCase(), s]));
const cheeseMap = new Map(CHEESES.map(c => [c.name.toLowerCase(), c]));
const vegMap = new Map(VEGETABLES.map(v => [v.name.toLowerCase(), v]));

/**
 * Validate custom pizza ingredient selections
 * @param {Object} param0
 * @returns {{ isValid: boolean, error?: string, normalized?: Object }}
 */
function validateCustomPizzaIngredients({ base, sauce, cheese, vegetables = [] }) {
  if (!base || typeof base !== 'string') {
    return { isValid: false, error: 'Base crust selection is required' };
  }
  const matchedBase = baseMap.get(base.trim().toLowerCase());
  if (!matchedBase) {
    return { isValid: false, error: `Invalid base crust '${base}'. Must be one of: ${BASES.map(b => b.name).join(', ')}` };
  }

  if (!sauce || typeof sauce !== 'string') {
    return { isValid: false, error: 'Sauce selection is required' };
  }
  const matchedSauce = sauceMap.get(sauce.trim().toLowerCase());
  if (!matchedSauce) {
    return { isValid: false, error: `Invalid sauce '${sauce}'. Must be one of: ${SAUCES.map(s => s.name).join(', ')}` };
  }

  if (!cheese || typeof cheese !== 'string') {
    return { isValid: false, error: 'Cheese selection is required' };
  }
  const matchedCheese = cheeseMap.get(cheese.trim().toLowerCase());
  if (!matchedCheese) {
    return { isValid: false, error: `Invalid cheese '${cheese}'. Must be one of: ${CHEESES.map(c => c.name).join(', ')}` };
  }

  if (!Array.isArray(vegetables)) {
    return { isValid: false, error: 'Vegetables must be an array of selected toppings' };
  }

  const normalizedVegs = [];
  for (const veg of vegetables) {
    if (!veg || typeof veg !== 'string') {
      return { isValid: false, error: 'Each vegetable must be a valid topping name' };
    }
    const matchedVeg = vegMap.get(veg.trim().toLowerCase());
    if (!matchedVeg) {
      return { isValid: false, error: `Invalid vegetable '${veg}'. Must be one of: ${VEGETABLES.map(v => v.name).join(', ')}` };
    }
    normalizedVegs.push(matchedVeg.name);
  }

  return {
    isValid: true,
    normalized: {
      base: matchedBase.name,
      sauce: matchedSauce.name,
      cheese: matchedCheese.name,
      vegetables: normalizedVegs
    }
  };
}

/**
 * Authoritative Server Price Calculation for Custom Pizza
 * @param {Object} param0
 * @returns {number}
 */
function calculateCustomPizzaPrice({ base, sauce, cheese, vegetables = [] }) {
  const matchedBase = baseMap.get((base || '').trim().toLowerCase());
  const matchedSauce = sauceMap.get((sauce || '').trim().toLowerCase());
  const matchedCheese = cheeseMap.get((cheese || '').trim().toLowerCase());

  let total = (matchedBase ? matchedBase.price : 0) +
              (matchedSauce ? matchedSauce.price : 0) +
              (matchedCheese ? matchedCheese.price : 0);

  if (Array.isArray(vegetables)) {
    for (const veg of vegetables) {
      const matchedVeg = vegMap.get((veg || '').trim().toLowerCase());
      if (matchedVeg) {
        total += matchedVeg.price;
      }
    }
  }

  return total;
}

module.exports = {
  BASES,
  SAUCES,
  CHEESES,
  VEGETABLES,
  validateCustomPizzaIngredients,
  calculateCustomPizzaPrice
};
