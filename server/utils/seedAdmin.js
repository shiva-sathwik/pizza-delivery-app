require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

/**
 * Secure Development CLI Seed Script for Initial Admin Account
 * Usage: npm run seed:admin
 */
const seedAdmin = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/pizza-delivery-app';
  const adminName = process.env.ADMIN_NAME || 'Super Admin';
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@pizzaflow.com').trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || 'AdminPass123!';

  console.log(`[SeedAdmin] Connecting to MongoDB...`);
  try {
    await mongoose.connect(uri);
    console.log(`[SeedAdmin] Connected to database.`);

    let adminUser = await User.findOne({ email: adminEmail });
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(adminPassword, salt);

    if (adminUser) {
      console.log(`[SeedAdmin] Existing user found for ${adminEmail}. Updating to admin role and updating password...`);
      adminUser.name = adminName;
      adminUser.password = hashedPassword;
      adminUser.role = 'admin';
      adminUser.isEmailVerified = true;
      await adminUser.save();
      console.log(`[SeedAdmin] Admin account updated successfully.`);
    } else {
      console.log(`[SeedAdmin] Creating new admin account for ${adminEmail}...`);
      adminUser = new User({
        name: adminName,
        email: adminEmail,
        password: hashedPassword,
        role: 'admin',
        isEmailVerified: true
      });
      await adminUser.save();
      console.log(`[SeedAdmin] New admin account created successfully.`);
    }

    console.log(`[SeedAdmin] Admin Email: ${adminEmail}`);
    console.log(`[SeedAdmin] Role: ${adminUser.role}`);
  } catch (error) {
    console.error(`[SeedAdmin] Error seeding admin account:`, error.message);
  } finally {
    await mongoose.disconnect();
    console.log(`[SeedAdmin] Disconnected from MongoDB.`);
  }
};

seedAdmin();
