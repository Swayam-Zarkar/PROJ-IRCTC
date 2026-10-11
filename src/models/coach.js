const mongoose = require('mongoose');

const coachSchema = new mongoose.Schema(
  {
    train: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Train',
      required: [true, 'Train reference is required'],
      index: true,
    },
    coachNumber: {
      type: String, // e.g. "B1", "B2", "A1", "S1", "C1"
      required: [true, 'Coach number is required'],
      uppercase: true,
      trim: true,
    },
    coachType: {
      type: String,
      enum: ['1A', '2A', '3A', '3E', 'SL', 'CC', 'EC', '2S'],
      required: [true, 'Coach type is required'],
    },
    totalSeats: {
      type: Number,
      required: true,
      default: 72,
      min: 1,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Compound Unique Index: coach "B1" is unique per train
coachSchema.index({ train: 1, coachNumber: 1 }, { unique: true });
coachSchema.index({ train: 1, coachType: 1 });

const Coach = mongoose.model('Coach', coachSchema);

module.exports = Coach;

