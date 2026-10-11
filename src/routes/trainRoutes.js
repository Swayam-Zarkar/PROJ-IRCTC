const express = require('express');
const router = express.Router();
const {
  searchTrains,
  getAllTrains,
  getTrainByNumber,
  getTrainById,
} = require('../controller/trainController');

/**
 * @route   GET /api/trains/search
 * @desc    Search trains between two stations on a specific date (sequence validated)
 * @access  Public
 */
router.get('/search', searchTrains);
router.get('/trains/search', searchTrains); // Alias for flexible route mounting

/**
 * @route   GET /api/trains/number/:trainNumber
 * @desc    Fetch train details by train number (e.g., 12951)
 * @access  Public
 */
router.get('/number/:trainNumber', getTrainByNumber);

/**
 * @route   GET /api/trains/:id
 * @desc    Fetch train details by MongoDB ObjectId
 * @access  Public
 */
router.get('/:id', getTrainById);

/**
 * @route   GET /api/trains
 * @desc    Fetch all active trains
 * @access  Public
 */
router.get('/', getAllTrains);

module.exports = router;
