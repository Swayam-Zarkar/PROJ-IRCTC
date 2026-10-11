const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const usermodel = require('../models/userdata');
const redis = require('../config/redis');

/**
 * Generates Redis key for OTP storage
 */
function generateOTPKey(username, phone_no) {
  return `otp:${String(username).trim().toLowerCase()}:${String(phone_no).trim()}`;
}

/**
 * Generates a signed JWT token for authenticated user sessions
 */
function generateToken(user) {
  return jwt.sign(
    {
      id: user._id,
      _id: user._id,
      username: user.username,
      phone_no: user.phone_no,
      role: user.role || 'user',
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

/**
 * @desc    Step 1: Register User & Send 6-Digit OTP
 * @route   POST /api/auth/register
 * @access  Public
 */
async function registerUser(req, res) {
  try {
    const {
      username,
      fullName,
      email,
      password,
      age,
      gender,
      phone_no,
      role,
    } = req.body;

    if (!username || !age || !phone_no) {
      return res.status(400).json({
        success: false,
        message: 'username, age, and phone_no are required.',
      });
    }

    // Check if user with same username or phone_no already exists in MongoDB
    const existingUser = await usermodel.findOne({
      $or: [
        { username: String(username).trim().toLowerCase() },
        { phone_no: String(phone_no).trim() },
      ],
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'User with this username or phone number already exists. Please login.',
      });
    }

    const OTP_KEY = generateOTPKey(username, phone_no);

    // Generate a 6-digit OTP (100000 to 999999)
    const otp = Math.floor(100000 + Math.random() * 900000);

    // Hash password if provided
    let hashedPassword = undefined;
    if (password) {
      hashedPassword = await bcrypt.hash(String(password), 10);
    }

    // Store OTP along with pending registration metadata in Redis (TTL: 120 seconds)
    const pendingUserPayload = JSON.stringify({
      otp: String(otp),
      username: String(username).trim().toLowerCase(),
      fullName: fullName || '',
      email: email || undefined,
      password: hashedPassword,
      age: Number(age),
      gender: gender || undefined,
      phone_no: String(phone_no).trim(),
      role: role === 'admin' ? 'admin' : 'user',
    });

    await redis.set(OTP_KEY, pendingUserPayload, { ex: 120 });

    return res.status(201).json({
      success: true,
      message: 'User credentials saved successfully. Proceed to OTP Verification.',
      OTP: otp,
      expiresInSeconds: 120,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to initiate user registration.',
    });
  }
}

/**
 * @desc    Step 2: Verify OTP, Create User in MongoDB & Issue JWT Token
 * @route   POST /api/auth/verify-OTP
 * @access  Public
 */
async function verifyOTP(req, res) {
  try {
    const { username, phone_no, age, fullName, email, gender, password, entered_otp } = req.body;

    if (!username || !phone_no || !entered_otp) {
      return res.status(400).json({
        success: false,
        message: 'username, phone_no, and entered_otp are required.',
      });
    }

    const OTP_KEY = generateOTPKey(username, phone_no);

    if (!(await redis.exists(OTP_KEY))) {
      return res.status(410).json({
        success: false,
        message: 'OTP expired!! Click on resend',
      });
    }

    const rawStoredData = await redis.get(OTP_KEY);

    // Support both JSON payload and plain OTP string from Redis
    let storedOTP = rawStoredData;
    let cachedUser = {};

    if (typeof rawStoredData === 'object' && rawStoredData !== null) {
      storedOTP = rawStoredData.otp;
      cachedUser = rawStoredData;
    } else if (typeof rawStoredData === 'string' && rawStoredData.startsWith('{')) {
      try {
        cachedUser = JSON.parse(rawStoredData);
        storedOTP = cachedUser.otp;
      } catch (_) {
        storedOTP = rawStoredData;
      }
    }

    if (String(entered_otp).trim() !== String(storedOTP).trim()) {
      return res.status(401).json({
        success: false,
        message: 'OTP is incorrect.',
      });
    }

    // Hash password if passed directly during verifyOTP and not yet hashed
    let finalPassword = cachedUser.password;
    if (!finalPassword && password) {
      finalPassword = await bcrypt.hash(String(password), 10);
    }

    const newUser = await usermodel.create({
      username: cachedUser.username || String(username).trim().toLowerCase(),
      fullName: fullName || cachedUser.fullName || '',
      email: email || cachedUser.email || undefined,
      password: finalPassword,
      age: Number(age || cachedUser.age),
      gender: gender || cachedUser.gender || undefined,
      phone_no: cachedUser.phone_no || String(phone_no).trim(),
      role: cachedUser.role || 'user',
      isPhoneVerified: true,
    });

    await redis.del(OTP_KEY);

    // Generate JWT Token & set cookie so the user is immediately logged in for Booking APIs
    const token = generateToken(newUser);

    res.cookie('token', token, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return res.status(201).json({
      success: true,
      message: 'OTP verified successfully.',
      token,
      data: newUser,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}

/**
 * @desc    Resend 6-digit OTP
 * @route   POST /api/auth/resend-otp
 * @access  Public
 */
async function resendOTP(req, res) {
  try {
    const { username, phone_no, age } = req.body;

    if (!username || !phone_no) {
      return res.status(400).json({
        success: false,
        message: 'username and phone_no are required to resend OTP.',
      });
    }

    const OTP_KEY = generateOTPKey(username, phone_no);
    const otp = Math.floor(100000 + Math.random() * 900000);

    const payload = JSON.stringify({
      otp: String(otp),
      username: String(username).trim().toLowerCase(),
      phone_no: String(phone_no).trim(),
      age: age ? Number(age) : 18,
    });

    await redis.set(OTP_KEY, payload, { ex: 120 });

    return res.status(200).json({
      success: true,
      message: 'New OTP generated and sent successfully.',
      OTP: otp,
      expiresInSeconds: 120,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}

/**
 * @desc    Login existing user (supports password login or phone/username verification)
 * @route   POST /api/auth/login
 * @access  Public
 */
async function loginUser(req, res) {
  try {
    const { username, phone_no, password } = req.body;

    if (!username && !phone_no) {
      return res.status(400).json({
        success: false,
        message: 'Please provide username or phone_no to login.',
      });
    }

    const query = username
      ? { username: String(username).trim().toLowerCase() }
      : { phone_no: String(phone_no).trim() };

    const user = await usermodel.findOne(query).select('+password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Account not found. Please register first.',
      });
    }

    // If user has set a password, verify it
    if (user.password) {
      if (!password) {
        return res.status(400).json({
          success: false,
          message: 'Password is required for this account.',
        });
      }

      const isMatch = await bcrypt.compare(String(password), user.password);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials.',
        });
      }
    }

    const token = generateToken(user);

    res.cookie('token', token, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // Remove password before sending response
    const userObj = user.toObject();
    delete userObj.password;

    return res.status(200).json({
      success: true,
      message: 'Logged in successfully.',
      token,
      data: userObj,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}

/**
 * @desc    Logout user & clear JWT cookie
 * @route   POST /api/auth/logout
 * @access  Private / Public
 */
async function logoutUser(req, res) {
  res.clearCookie('token');
  return res.status(200).json({
    success: true,
    message: 'Logged out successfully.',
  });
}

/**
 * @desc    Get currently logged-in user profile & Master Passenger List
 * @route   GET /api/auth/me
 * @access  Private
 */
async function getCurrentUser(req, res) {
  try {
    const user = await usermodel.findById(req.user._id || req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    return res.status(200).json({
      success: true,
      data: user,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}

/**
 * @desc    Add passenger to IRCTC Master Passenger List (savedPassengers)
 * @route   POST /api/auth/passengers
 * @access  Private
 */
async function addSavedPassenger(req, res) {
  try {
    const { name, age, gender, berthPreference } = req.body;

    if (!name || !age || !gender) {
      return res.status(400).json({
        success: false,
        message: 'Passenger name, age, and gender are required.',
      });
    }

    const user = await usermodel.findById(req.user._id || req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    user.savedPassengers.push({
      name,
      age: Number(age),
      gender,
      berthPreference: berthPreference || 'NO_PREFERENCE',
    });

    await user.save();

    return res.status(201).json({
      success: true,
      message: 'Passenger added to Master List.',
      savedPassengers: user.savedPassengers,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}

/**
 * @desc    Remove passenger from Master Passenger List
 * @route   DELETE /api/auth/passengers/:passengerId
 * @access  Private
 */
async function removeSavedPassenger(req, res) {
  try {
    const { passengerId } = req.params;
    const user = await usermodel.findById(req.user._id || req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    const passenger = user.savedPassengers.id(passengerId);
    if (!passenger) {
      return res.status(404).json({
        success: false,
        message: 'Saved passenger not found in Master List.',
      });
    }

    passenger.deleteOne();
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Passenger removed from Master List.',
      savedPassengers: user.savedPassengers,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}

module.exports = {
  registerUser,
  verifyOTP,
  resendOTP,
  loginUser,
  logoutUser,
  getCurrentUser,
  addSavedPassenger,
  removeSavedPassenger,
};