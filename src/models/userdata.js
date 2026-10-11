const mongoose = require('mongoose');

const savedPassengerSchema = new mongoose.Schema(
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
  },
  { _id: true }
);

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Username cannot be empty'],
      unique: true,
      trim: true,
      lowercase: true,
    },
    fullName: {
      type: String,
      trim: true,
      default: '',
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      unique: true,
      sparse: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    password: {
      type: String,
      select: false, // Excluded from default queries for security
    },
    age: {
      type: Number,
      required: [true, 'Age cannot be empty'],
      min: [18, 'User must be 18+ to create an account'],
    },
    gender: {
      type: String,
      enum: ['MALE', 'FEMALE', 'OTHER'],
    },
    phone_no: {
      type: String,
      required: [true, 'Phone number is required'],
      unique: true,
      validate: {
        validator: function (v) {
          return /^\d{10}$/.test(v);
        },
        message: 'Phone number must be exactly 10 digits',
      },
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
      index: true,
    },
    isPhoneVerified: {
      type: Boolean,
      default: false,
    },
    // IRCTC Master Passenger List for 1-click Tatkal booking
    savedPassengers: [savedPassengerSchema],
  },
  { timestamps: true }
);

const UserModel = mongoose.model('user', userSchema);

module.exports = UserModel;