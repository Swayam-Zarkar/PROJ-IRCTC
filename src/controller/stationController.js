const Station = require('../models/station');

/**
 * @desc    Fetch all active stations for booking-station autocomplete
 * @route   GET /api/stations
 * @access  Public
 */
async function getActiveStations(req, res) {
  try {
    const stations = await Station.find({ isActive: { $ne: false } })
      .select('name code city state zone')
      .sort({ name: 1, code: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: stations.length,
      stations,
    });
  } catch (error) {
    console.error('[StationController:getActiveStations] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve stations.',
    });
  }
}

module.exports = { getActiveStations };
