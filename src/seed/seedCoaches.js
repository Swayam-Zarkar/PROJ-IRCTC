require('dotenv').config();
const mongoose = require('mongoose');
const Train = require('../models/train');
const Coach = require('../models/coach');
const Seat = require('../models/seat');

async function seedCoachesAndSeats() {
  try {
    // Connect using your existing environment configuration
    const mongoUri = process.env.MONGO_URI || process.env.MONGO_URL;
    await mongoose.connect(mongoUri, { dbName: 'IRCTC' });
    console.log('✅ Connected to MongoDB...');

    // Clear existing coaches and seats
    await Coach.deleteMany({});
    await Seat.deleteMany({});
    console.log('🗑️ Cleared old coaches and seats.');

    const trains = await Train.find({});
    console.log(`🚆 Found ${trains.length} trains. Generating coaches and 10 seats per berth type...`);

    let coachCount = 0;
    let seatCount = 0;

    // Allowed berth types from your schema
    const berthTypes = [
      'LOWER',
      'MIDDLE',
      'UPPER',
      'SIDE_LOWER',
      'SIDE_UPPER',
      'CABIN',
      'COUPE',
      'WINDOW',
      'AISLE',
      'MIDDLE_SEAT',
    ];

    for (const train of trains) {
      if (!train.availableClasses || train.availableClasses.length === 0) continue;

      // Create 1 coach for each class available on this train
      for (const classType of train.availableClasses) {
        const coachNumber = `${classType}1`;

        const coach = await Coach.create({
          train: train._id,
          coachNumber: coachNumber,
          coachType: classType,
          totalSeats: berthTypes.length * 10, // 10 seats * 10 types = 100 seats total per coach
        });
        coachCount++;

        // Generate 10 seats for EACH of the 10 berth types
        const seatsToInsert = [];
        let globalSeatNumber = 1;

        for (const berth of berthTypes) {
          for (let i = 1; i <= 10; i++) {
            seatsToInsert.push({
              train: train._id,
              coach: coach._id,
              seatNumber: globalSeatNumber++,
              coachType: classType,
              berthType: berth,
              isWindow: berth === 'LOWER' || berth === 'SIDE_LOWER' || berth === 'WINDOW',
              status: 'AVAILABLE',
            });
          }
        }

        await Seat.insertMany(seatsToInsert);
        seatCount += seatsToInsert.length;
      }
    }

    console.log(`✅ Successfully created ${coachCount} coaches and ${seatCount} seats (10 per berth type)!`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

seedCoachesAndSeats();