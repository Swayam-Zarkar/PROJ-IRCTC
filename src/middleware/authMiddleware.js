const jwt = require('jsonwebtoken');
const UserModel = require('../models/userdata');

/**
 * JWT Authentication Middleware
 * Extracts and verifies the Bearer token from Authorization header or cookies
 * and attaches the authenticated user to req.user.
 */
async function verifyJWT(req, res, next) {
  try {
    let token = null;

    // 1. Check Authorization Header (Bearer <token>)
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
      // 2. Fallback to HTTP-only cookie
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please provide a valid token.',
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch user from database (excluding password)
    const user = await UserModel.findById(decoded.id || decoded._id).lean();
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token: User no longer exists.',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Session expired. Please log in again.',
      });
    }
    return res.status(401).json({
      success: false,
      message: 'Invalid or malformed authentication token.',
    });
  }
}

async function optionalVerifyJWT(req, res, next) {
  try {
    let token = null;
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await UserModel.findById(decoded.id || decoded._id).lean();
    if (user) {
      req.user = user;
    }
    return next();
  } catch (_) {
    return next();
  }
}

module.exports = {
  verifyJWT,
  optionalVerifyJWT,
  protect: verifyJWT,
};

