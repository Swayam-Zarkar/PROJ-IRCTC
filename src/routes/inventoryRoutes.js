const express = require('express');
const router = express.Router();
const { getCoachSeats } = require('../controller/inventoryController');

/**
 * @route   GET /api/inventory/seats
 * @desc    Fetch physical and real-time booked seats for a train, date, and coach
 * @access  Public
 */
router.get('/seats', getCoachSeats);

module.exports = router;

