require('dotenv').config();
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Train = require('../models/train');
const Coach = require('../models/coach');
const { initializeCoachInventory } = require('../services/inventoryService');

/**
 * Extracts YYYY-MM-DD string strictly using local system timezone offset
 * Prevents UTC conversion rollback (e.g., before 05:30 AM IST)
 *
 * @param {Date} date
 * @returns {string} Calendar date in YYYY-MM-DD format
 */
function formatLocalDate(date) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().split('T')[0];
}

async function seedDynamicRedisInventories() {
  try {
    // 1. Connect to MongoDB
    const mongoUri = process.env.MONGO_URI || process.env.MONGO_URL;
    await mongoose.connect(mongoUri, { dbName: 'IRCTC' });
    console.log('✅ Connected to MongoDB...');

    // 2. Fetch all active trains
    const trains = await Train.find({ isActive: true });
    console.log(`🚆 Found ${trains.length} active trains. Initializing nested Redis quota hashes...`);

    // Define journey dates for the next 7 days using local timezone offset
    const today = new Date();
    const journeyDates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      journeyDates.push(formatLocalDate(d)); // Strictly local YYYY-MM-DD
    }

    let totalKeysInitialized = 0;

    for (const train of trains) {
      if (!train.availableClasses || train.availableClasses.length === 0) continue;

      for (const classType of train.availableClasses) {
        for (const journeyDate of journeyDates) {
          // Initialize ONLY two keys (GN and TQ) with exact nested sub-quota fields:
          // GN: gn_available: 60, gn_total: 60, ld_available: 10, ld_total: 10,
          //     hp_available: 5, hp_total: 5, ss_available: 5, ss_total: 5,
          //     wl_available: 70, wl_total: 70, rac_available: 25, rac_total: 25
          // TQ: tq_available: 10, tq_total: 10, pt_available: 10, pt_total: 10
          await initializeCoachInventory(train.trainNumber, journeyDate, classType);
          totalKeysInitialized += 2;
        }
      }
    }

    console.log(`✅ Successfully initialized ${totalKeysInitialized} nested Redis inventory keys (ONLY GN & TQ keys with exact sub-quota fields)!`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Dynamic Redis inventory seeding failed:', error);
    process.exit(1);
  }
}

seedDynamicRedisInventories();