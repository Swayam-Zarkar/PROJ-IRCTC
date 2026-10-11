const mongoose = require('mongoose');

const stationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Station name is required'],
      trim: true,
    },
    code: {
      type: String,
      required: [true, 'Station code is required'],
      unique: true,
      uppercase: true,
      trim: true,
      maxlength: [6, 'Station code must be at most 6 characters'],
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true,
      index: true,
    },
    state: {
      type: String,
      required: [true, 'State is required'],
      trim: true,
    },
    zone: {
      type: String,
      trim: true, // e.g., NR, WR, CR, SR, ER
    },
    numberOfPlatforms: {
      type: Number,
      default: 1,
      min: 1,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

// Optimize searches: compound text search for autocompletion
stationSchema.index({ name: 'text', code: 'text', city: 'text' });

const Station = mongoose.model('Station', stationSchema);

module.exports = Station;
