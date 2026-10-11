const express = require('express');
const router = express.Router();
const {
  createBooking,
  confirmDirectBooking,
  getBookingJobStatus,
  getBookingByPNR,
} = require('../controller/bookingController');
const { verifyJWT, optionalVerifyJWT } = require('../middleware/authMiddleware');

/**
 * @route   POST /api/bookings
 * @desc    Create a new ticket booking (validates pre-checks & pushes to BullMQ)
 * @access  Private
 */
router.post('/', optionalVerifyJWT, createBooking);

/**
 * @route   POST /api/bookings/confirm
 * @desc    Directly confirm & persist a booking in MongoDB with its PNR
 * @access  Public / Private (optionalVerifyJWT)
 */
router.post('/confirm', optionalVerifyJWT, confirmDirectBooking);

/**
 * @route   GET /api/bookings/job/:jobId
 * @desc    Poll BullMQ job status ('waiting', 'active', 'completed', 'failed')
 * @access  Private
 */
router.get('/job/:jobId', verifyJWT, getBookingJobStatus);

/**
 * @route   GET /api/bookings/pnr/:pnr
 * @desc    Get booking details by 10-digit PNR number
 * @access  Public / Private
 */
router.get('/pnr/:pnr', getBookingByPNR);

module.exports = router;

