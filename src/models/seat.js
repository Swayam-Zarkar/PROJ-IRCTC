const mongoose = require('mongoose');

const seatSchema = new mongoose.Schema(
  {
    train: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Train',
      required: [true, 'Train reference is required'],
      index: true,
    },
    coach: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Coach',
      required: [true, 'Coach reference is required'],
      index: true,
    },
    seatNumber: {
      type: Number,
      required: [true, 'Seat number is required'],
      min: 1,
    },
    coachType: {
      type: String,
      enum: ['1A', '2A', '3A', '3E', 'SL', 'CC', 'EC', '2S'],
      required: true,
    },
    berthType: {
      type: String,
      enum: [
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
      ],
      required: true,
    },
    isWindow: {
      type: Boolean,
      default: false,
    },
    status:
    {
      type:String,
      // RAC is a visual/operational state for a shared berth.  Keeping it on the
      // seat document lets the coach map reflect the same state as the PNR.
      enum:['AVAILABLE','LOCKED','BOOKED','RAC'],
      default:'AVAILABLE',
      required:true,
      index:true
    },
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      default: null,
      index: true,
    },
  },
  { timestamps: true }
);

// Compound Unique Index: seat 15 in coach B1 is unique
seatSchema.index({ coach: 1, seatNumber: 1 }, { unique: true });
seatSchema.index({ train: 1, coach: 1 });

const Seat = mongoose.model('Seat', seatSchema);

module.exports = Seat;

