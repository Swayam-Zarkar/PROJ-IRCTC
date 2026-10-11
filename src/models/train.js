const mongoose = require('mongoose');
require('./station');

const stopSchema = new mongoose.Schema(
  {
    station: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Station',
      required: true,
    },
    stationCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    stopNumber: {
      type: Number,
      required: true, // 1 for origin, 2, 3...
    },
    sequence: {
      type: Number, // Sequence number alias/compatible with stopNumber
    },
    arrivalTime: {
      type: String, // "HH:mm" 24-hr format (null for origin station)
      default: null,
    },
    departureTime: {
      type: String, // "HH:mm" 24-hr format (null for destination)
      default: null,
    },
    haltMinutes: {
      type: Number,
      default: 0,
    },
    distanceFromOriginKm: {
      type: Number,
      required: true,
      default: 0,
    },
    dayNumber: {
      type: Number,
      default: 1, // Day 1, Day 2 for overnight/multi-day runs
    },
  },
  { _id: false }
);

const trainSchema = new mongoose.Schema(
  {
    trainNumber: {
      type: String,
      required: [true, 'Train number is required'],
      unique: true,
      trim: true,
    },
    trainName: {
      type: String,
      required: [true, 'Train name is required'],
      trim: true,
    },
    trainType: {
      type: String,
      enum: ['VANDE_BHARAT', 'RAJDHANI', 'SHATABDI', 'DURONTO', 'SUPERFAST', 'EXPRESS', 'MAIL', 'PASSENGER'],
      default: 'EXPRESS',
    },
    originStation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Station',
      required: true,
    },
    destinationStation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Station',
      required: true,
    },
    runsOnDays: {
      type: [String],
      enum: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
      default: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
    },
    route: [stopSchema],
    availableClasses: {
      type: [String],
      enum: ['1A', '2A', '3A', '3E', 'SL', 'CC', 'EC', '2S'],
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    // This is deliberately a run-independent safety flag for the existing
    // model. Production systems with multiple concurrent dates should move
    // this to a TrainRun collection keyed by train + journeyDate.
    chartPrepared: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

// Indexes for fast querying
trainSchema.index({ 'route.station': 1 });
trainSchema.index({ 'route.stationCode': 1 });
trainSchema.index({ originStation: 1, destinationStation: 1 });

const Train = mongoose.model('Train', trainSchema);

module.exports = Train;
