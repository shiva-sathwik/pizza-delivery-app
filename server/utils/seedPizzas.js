require('dotenv').config();
const mongoose = require('mongoose');
const Pizza = require('../models/Pizza');

/**
 * Step 5: Realistic Catalog Pizza Seeding Script
 * Usage: npm run seed:pizzas
 */
const catalogPizzas = [
  {
    name: 'Margherita Classica',
    description: 'The timeless Neapolitan favorite crafted with rich San Marzano tomato sauce, fresh buffalo mozzarella, and aromatic genovese basil.',
    image: 'https://images.unsplash.com/photo-1604382355076-af4b0eb60143?auto=format&fit=crop&w=800&q=80',
    base: 'Thin Crust',
    sauce: 'Classic San Marzano Tomato',
    cheese: '100% Mozzarella',
    vegetables: [],
    price: 299,
    isAvailable: true
  },
  {
    name: 'Rustic Farmhouse',
    description: 'A harvest of crisp bell peppers, tender grilled mushrooms, juicy sweet corn, and caramelized red onions over golden pan crust.',
    image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&q=80',
    base: 'Pan Crust',
    sauce: 'Classic San Marzano Tomato',
    cheese: '100% Mozzarella',
    vegetables: ['Crisp Bell Peppers', 'Grilled Mushrooms', 'Red Onions', 'Sweet Corn'],
    price: 399,
    isAvailable: true
  },
  {
    name: 'Spicy Veggie Volcano',
    description: 'Intense fire for spice lovers! Fiery bird\'s eye peri-peri sauce topped with tangy pickled jalapeños, crisp peppers, and sharp cheddar.',
    image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=800&q=80',
    base: 'Thin Crust',
    sauce: 'Spicy Peri-Peri',
    cheese: 'Sharp Cheddar',
    vegetables: ['Pickled Jalapeños', 'Crisp Bell Peppers', 'Red Onions', 'Black Olives'],
    price: 449,
    isAvailable: true
  },
  {
    name: 'Tuscan Pesto Verdure',
    description: 'Artisan genovese basil pesto foundation loaded with tender baby spinach leaves, juicy grilled mushrooms, and earthy black kalamata-style olives.',
    image: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=800&q=80',
    base: 'Thin Crust',
    sauce: 'Basil Pesto',
    cheese: '100% Mozzarella',
    vegetables: ['Baby Spinach', 'Grilled Mushrooms', 'Black Olives'],
    price: 469,
    isAvailable: true
  },
  {
    name: 'Royal Paneer Supreme',
    description: 'Indulgent molten cheese burst crust loaded with herb-marinated paneer cubes, creamy garlic & herb sauce, crunchy peppers, and four cheese blend.',
    image: 'https://images.unsplash.com/photo-1593560708920-61dd98c46a4e?auto=format&fit=crop&w=800&q=80',
    base: 'Cheese Burst',
    sauce: 'Creamy Garlic & Herb',
    cheese: 'Four Cheese Blend',
    vegetables: ['Paneer Cubes', 'Crisp Bell Peppers', 'Red Onions'],
    price: 479,
    isAvailable: true
  },
  {
    name: 'Green Wholesome Garden',
    description: 'Nutritious multigrain crust layered with fresh baby spinach, sweet golden corn, red onions, and 100% plant-based vegan cheese.',
    image: 'https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?auto=format&fit=crop&w=800&q=80',
    base: 'Multigrain Crust',
    sauce: 'Classic San Marzano Tomato',
    cheese: 'Vegan Dairy-Free Cheese',
    vegetables: ['Baby Spinach', 'Sweet Corn', 'Red Onions', 'Black Olives'],
    price: 429,
    isAvailable: true
  }
];

const seedPizzas = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/pizza-delivery-app';

  console.log('[SeedPizzas] Connecting to MongoDB...');
  try {
    await mongoose.connect(uri);
    console.log('[SeedPizzas] Connected to database.');

    // Remove existing catalog pizzas to allow clean idempotent re-seeding
    const deleted = await Pizza.deleteMany({});
    console.log(`[SeedPizzas] Cleared ${deleted.deletedCount} existing pizza entries.`);

    const created = await Pizza.insertMany(catalogPizzas);
    console.log(`[SeedPizzas] Successfully seeded ${created.length} catalog pizzas:`);
    created.forEach((p, idx) => {
      console.log(`  ${idx + 1}. ${p.name} - ₹${p.price} (${p.base}, ${p.sauce}, ${p.cheese})`);
    });
  } catch (error) {
    console.error('[SeedPizzas] Error seeding pizzas:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('[SeedPizzas] Disconnected from MongoDB.');
  }
};

seedPizzas();
