require('dotenv').config();
const mongoose = require('mongoose');
const Inventory = require('../models/Inventory');
const {
  BASES,
  SAUCES,
  CHEESES,
  VEGETABLES
} = require('../config/ingredients');

/**
 * Step 6: Authoritative Inventory Seeding Script
 * Seeds all supported bases, sauces, cheeses, and vegetables.
 *
 * SAFETY GUARANTEE:
 * Uses $setOnInsert upsert logic to ensure existing stock quantities
 * and thresholds are NEVER overwritten when run repeatedly.
 *
 * Usage: npm run seed:inventory
 */
const seedInventory = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/pizza-delivery-app';

  console.log('[SeedInventory] Connecting to MongoDB...');
  try {
    await mongoose.connect(uri);
    console.log('[SeedInventory] Connected to database.');

    const ingredientCatalog = [
      ...BASES.map(b => ({ item: b.name, category: 'base', quantity: 50, threshold: 10 })),
      ...SAUCES.map(s => ({ item: s.name, category: 'sauce', quantity: 50, threshold: 10 })),
      ...CHEESES.map(c => ({ item: c.name, category: 'cheese', quantity: 50, threshold: 10 })),
      ...VEGETABLES.map(v => ({ item: v.name, category: 'vegetable', quantity: 50, threshold: 10 }))
    ];

    console.log(`[SeedInventory] Processing ${ingredientCatalog.length} authoritative ingredients...`);

    let createdCount = 0;
    let preservedCount = 0;

    for (const entry of ingredientCatalog) {
      // Check if entry already exists before upsert to report accurately
      const existing = await Inventory.findOne({
        category: entry.category,
        item: entry.item
      });

      if (existing) {
        preservedCount++;
      } else {
        await Inventory.create({
          item: entry.item,
          category: entry.category,
          quantity: entry.quantity,
          threshold: entry.threshold
        });
        createdCount++;
      }
    }

    console.log('[SeedInventory] Seeding completed successfully:');
    console.log(`  - Newly created items: ${createdCount}`);
    console.log(`  - Preserved existing items: ${preservedCount}`);
    console.log(`  - Total items in inventory: ${createdCount + preservedCount}`);

    const allInventory = await Inventory.find({}).sort({ category: 1, item: 1 });
    console.log('[SeedInventory] Current Inventory Summary:');
    allInventory.forEach(inv => {
      console.log(`  [${inv.category.toUpperCase().padEnd(9)}] ${inv.item.padEnd(30)} Qty: ${inv.quantity.toString().padStart(3)} | Threshold: ${inv.threshold} | Status: ${inv.status}`);
    });
  } catch (error) {
    console.error('[SeedInventory] Error seeding inventory:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('[SeedInventory] Disconnected from MongoDB.');
  }
};

// Execute if run directly via CLI
if (require.main === module) {
  seedInventory();
}

module.exports = seedInventory;
