const mongoose = require('mongoose');

const passengerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Passenger name is required'],
      trim: true,
    },
    age: {
      type: Number,
      required: [true, 'Passenger age is required'],
      min: [1, 'Age must be at least 1'],
      max: [120, 'Age must be at most 120'],
    },
    gender: {
      type: String,
      enum: ['MALE', 'FEMALE', 'OTHER'],
      required: [true, 'Gender is required'],
    },
    berthPreference: {
      type: String,
      enum: ['LOWER', 'MIDDLE', 'UPPER', 'SIDE_LOWER', 'SIDE_UPPER', 'WINDOW', 'NO_PREFERENCE'],
      default: 'NO_PREFERENCE',
    },
    bookingStatus: {
      type: String,
      enum: ['CNF', 'RAC', 'WL'],
      required: true, // Status at the time of booking
    },
    currentStatus: {
      type: String,
      enum: ['CNF', 'RAC', 'WL', 'CAN'],
      required: true, // Dynamic status (updates upon chart preparation or cancellation)
    },
    allocatedCoach: {
      type: String, // e.g., "B1"
      default: null,
    },
    allocatedSeatNumber: {
      type: Number,
      default: null,
    },
    allocatedBerth: {
      type: String, // e.g., "LOWER"
      default: null,
    },
    waitingNumber: {
      type: Number, // e.g., 12 if WL 12 or RAC 3
      default: null,
    },
  },
  { _id: true }
);

const bookingSchema = new mongoose.Schema(
  {
    pnr: {
      type: String,
      required: [true, 'PNR is required'],
      unique: true,
      length: 10,
      trim: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'user', // References user model in src/models/userdata.js
      required: true,
      index: true,
    },
    train: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Train',
      required: true,
      index: true,
    },
    journeyDate: {
      type: Date,
      required: [true, 'Journey date is required'],
      index: true,
    },
    fromStation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Station',
      required: true,
    },
    toStation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Station',
      required: true,
    },
    fromStationCode: {
      type: String,
      required: true,
      uppercase: true,
    },
    toStationCode: {
      type: String,
      required: true,
      uppercase: true,
    },
    classType: {
      type: String,
      enum: ['1A', '2A', '3A', '3E', 'SL', 'CC', 'EC', '2S'],
      required: true,
    },
    quota: {
      type: String,
      enum: ['GN', 'TQ', 'PT', 'LD', 'HP', 'SS'],
      required: [true, 'Quota is required'],
      uppercase: true,
      trim: true,
    },
    passengers: [passengerSchema],
    fareDetails: {
      baseFare: { type: Number, required: true },
      tatkalCharge: { type: Number, default: 0 },
      gst: { type: Number, default: 0 },
      totalFare: { type: Number, required: true },
    },
    paymentDetails: {
      transactionId: { type: String },
      paymentStatus: {
        type: String,
        enum: ['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED'],
        default: 'PENDING',
        index: true,
      },
      paidAt: { type: Date },
    },
    bookingStatus: {
      type: String,
      enum: ['CONFIRMED', 'WAITLISTED', 'RAC', 'PARTIALLY_CANCELLED', 'CANCELLED', 'FAILED'],
      default: 'CONFIRMED',
      index: true,
    },
    chartStatus: {
      type: String,
      enum: ['CHART NOT PREPARED', 'CHART PREPARED'],
      default: 'CHART NOT PREPARED',
      index: true,
    },
  },
  { timestamps: true }
);

// High-performance query indexes
bookingSchema.index({ user: 1, createdAt: -1 });
bookingSchema.index({ train: 1, journeyDate: 1 });
bookingSchema.index({ bookingStatus: 1, journeyDate: 1 });

const Booking = mongoose.model('Booking', bookingSchema);

module.exports = Booking;
