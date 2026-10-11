const express = require('express');
const router = express.Router();
const { triggerChartPreparation } = require('../controller/adminController');
const { optionalVerifyJWT } = require('../middleware/authMiddleware');

/**
 * @route   POST /api/admin/trains/prepare-chart
 * @desc    Instantly triggers charting algorithm and BullMQ chartQueue for on-demand upgrades
 * @access  Admin / Public
 */
router.post('/trains/prepare-chart', optionalVerifyJWT, triggerChartPreparation);

module.exports = router;

