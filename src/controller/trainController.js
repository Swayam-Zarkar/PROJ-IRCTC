const mongoose = require('mongoose');
const Train = require('../models/train');
const Station = require('../models/station');
const Booking = require('../models/booking');
const Coach = require('../models/coach');
const { redisConnection } = require('../config/redisClient');
const { getInventoryKey, normalizeDateString } = require('../utils/keyGenerator');

const VALID_QUOTAS = ['GN', 'TQ', 'LD', 'SS', 'HP', 'PT'];

/**
 * Calculates duration between departure and arrival stations
 * considering day offsets.
 */
function calculateDuration(depTime, arrTime, fromDay = 1, toDay = 1) {
  if (!depTime || !arrTime) return 'N/A';

  const [depH, depM] = depTime.split(':').map(Number);
  const [arrH, arrM] = arrTime.split(':').map(Number);

  if (isNaN(depH) || isNaN(depM) || isNaN(arrH) || isNaN(arrM)) return 'N/A';

  const depMinutes = depH * 60 + depM;
  const arrMinutes = arrH * 60 + arrM;

  const dayDiff = Math.max(0, (toDay || 1) - (fromDay || 1));
  let totalMinutes = dayDiff * 24 * 60 + (arrMinutes - depMinutes);

  if (totalMinutes < 0) {
    totalMinutes += 24 * 60;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours}h ${minutes}m`;
}

/**
 * @desc    Search trains between two stations on a specific date with quota
 * @route   GET /api/trains/search
 * @access  Public
 * @query   from (Station Code, e.g. 'NDLS')
 * @query   to (Station Code, e.g. 'MMCT')
 * @query   date (YYYY-MM-DD)
 * @query   quota (Optional: 'GN', 'TQ', etc. Default: 'GN')
 */
async function searchTrains(req, res) {
  try {
    const { from, to, date, quota } = req.query;

    // 1. Validate required query parameters
    if (!from || !to || !date) {
      return res.status(400).json({
        success: false,
        message: 'Missing required query parameters: "from", "to", and "date" are required.',
      });
    }

    const fromStationCode = String(from).trim().toUpperCase();
    const toStationCode = String(to).trim().toUpperCase();
    const selectedQuota = quota ? String(quota).trim().toUpperCase() : 'GN';

    if (fromStationCode === toStationCode) {
      return res.status(400).json({
        success: false,
        message: 'Origin and destination station codes cannot be identical.',
      });
    }

    const journeyDateObj = new Date(date);
    if (isNaN(journeyDateObj.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Please provide a valid date string (e.g. YYYY-MM-DD).',
      });
    }

    if (quota && !VALID_QUOTAS.includes(selectedQuota)) {
      return res.status(400).json({
        success: false,
        message: `Invalid quota "${quota}". Allowed quotas: ${VALID_QUOTAS.join(', ')}`,
      });
    }

    // 2. Query MongoDB to find trains where both stations exist in the route
    const query = {
      isActive: { $ne: false },
      'route.stationCode': { $all: [fromStationCode, toStationCode] },
    };

    const candidateTrains = await Train.find(query)
      .populate('originStation', 'name code city state zone')
      .populate('destinationStation', 'name code city state zone')
      .populate('route.station', 'name code city state zone')
      .lean();

    // 3. Station Sequence & Direction Validation Logic
    // Strictly verify that fromStop.sequence < toStop.sequence
    const validTrains = [];

    for (const train of candidateTrains) {
      if (!Array.isArray(train.route) || train.route.length === 0) continue;

      const fromStop = train.route.find(
        (stop) => stop.stationCode?.toUpperCase() === fromStationCode
      );
      const toStop = train.route.find(
        (stop) => stop.stationCode?.toUpperCase() === toStationCode
      );

      if (!fromStop || !toStop) continue;

      // Extract sequence (supports both sequence and stopNumber)
      const fromSeq =
        fromStop.sequence !== undefined && fromStop.sequence !== null
          ? Number(fromStop.sequence)
          : Number(fromStop.stopNumber);

      const toSeq =
        toStop.sequence !== undefined && toStop.sequence !== null
          ? Number(toStop.sequence)
          : Number(toStop.stopNumber);

      // Filter out trains moving in opposite/reverse direction
      if (fromSeq >= toSeq) {
        continue;
      }

      // Calculate journey time and distance between the two stops
      const segmentDuration = calculateDuration(
        fromStop.departureTime,
        toStop.arrivalTime,
        fromStop.dayNumber,
        toStop.dayNumber
      );

      const distanceKm = Math.max(
        0,
        (toStop.distanceFromOriginKm || 0) - (fromStop.distanceFromOriginKm || 0)
      );

      // Normalize all stops to guarantee both sequence and stopNumber are present
      const normalizedRoute = train.route.map((stop) => {
        const seq =
          stop.sequence !== undefined && stop.sequence !== null
            ? Number(stop.sequence)
            : Number(stop.stopNumber);
        return {
          ...stop,
          sequence: seq,
          stopNumber: seq,
        };
      });

      const normalizedFromStop = {
        ...fromStop,
        sequence: fromSeq,
        stopNumber: fromSeq,
      };

      const normalizedToStop = {
        ...toStop,
        sequence: toSeq,
        stopNumber: toSeq,
      };

      validTrains.push({
        ...train,
        route: normalizedRoute,
        fromStation: normalizedFromStop,
        toStation: normalizedToStop,
        departureTime: fromStop.departureTime,
        arrivalTime: toStop.arrivalTime,
        duration: segmentDuration,
        distanceKm,
        journeyDate: String(date).split('T')[0],
        quota: selectedQuota,
      });
    }

    // 4. Handle empty search results using standard error handling / status codes
    if (validTrains.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No trains found operating from ${fromStationCode} to ${toStationCode} on the specified date.`,
        count: 0,
        trains: [],
      });
    }

    // 5. Dynamically calculate real-time availability from Redis GN & TQ hashes for each train and class on journeyDate
    const journeyDateStr = normalizeDateString(date);

    const baseRates = {
      '1A': 2.8,
      '2A': 1.8,
      '3A': 1.25,
      '3E': 1.05,
      'CC': 0.98,
      'EC': 2.1,
      'SL': 0.42,
      '2S': 0.22,
    };

    // Parallel Redis HGETALL batch for all candidate trains and their classes
    const redisHashQueries = [];
    const classMapping = [];

    validTrains.forEach((train) => {
      const classList = Array.isArray(train.availableClasses) && train.availableClasses.length > 0
        ? train.availableClasses
        : ['CC', 'EC'];

      classList.forEach((cType) => {
        const gnKey = getInventoryKey(train.trainNumber, journeyDateStr, cType, 'GN');
        const tqKey = getInventoryKey(train.trainNumber, journeyDateStr, cType, 'TQ');

        classMapping.push({ trainNumber: train.trainNumber, cType });
        redisHashQueries.push(
          Promise.all([
            redisConnection.hgetall(gnKey).catch(() => ({})),
            redisConnection.hgetall(tqKey).catch(() => ({})),
          ])
        );
      });
    });

    const redisHashResults = await Promise.all(redisHashQueries);
    const redisInventoryMap = new Map();

    classMapping.forEach((item, index) => {
      const [gnHash, tqHash] = redisHashResults[index] || [{}, {}];
      redisInventoryMap.set(`${item.trainNumber}:${item.cType}`, {
        gnHash: gnHash || {},
        tqHash: tqHash || {},
      });
    });

    const trainsWithRealTimeAvailability = validTrains.map((train) => {
      const classList = Array.isArray(train.availableClasses) && train.availableClasses.length > 0
        ? train.availableClasses
        : ['CC', 'EC'];

      const classes = classList.map((cType) => {
        const redisData = redisInventoryMap.get(`${train.trainNumber}:${cType}`) || { gnHash: {}, tqHash: {} };
        const gnHash = redisData.gnHash;
        const tqHash = redisData.tqHash;

        // Extract exact live fields from Redis nested hashes (with unseeded fallback defaults)
        const gn_available = gnHash && gnHash.gn_available !== undefined ? Number(gnHash.gn_available) : 60;
        const gn_total = gnHash && gnHash.gn_total !== undefined ? Number(gnHash.gn_total) : 60;

        const ld_available = gnHash && gnHash.ld_available !== undefined ? Number(gnHash.ld_available) : 10;
        const ld_total = gnHash && gnHash.ld_total !== undefined ? Number(gnHash.ld_total) : 10;

        const hp_available = gnHash && gnHash.hp_available !== undefined ? Number(gnHash.hp_available) : 5;
        const hp_total = gnHash && gnHash.hp_total !== undefined ? Number(gnHash.hp_total) : 5;

        const ss_available = gnHash && gnHash.ss_available !== undefined ? Number(gnHash.ss_available) : 5;
        const ss_total = gnHash && gnHash.ss_total !== undefined ? Number(gnHash.ss_total) : 5;

        const rac_available = gnHash && gnHash.rac_available !== undefined ? Number(gnHash.rac_available) : 25;
        const rac_total = gnHash && gnHash.rac_total !== undefined ? Number(gnHash.rac_total) : 25;

        const wl_available = gnHash && gnHash.wl_available !== undefined ? Number(gnHash.wl_available) : 70;
        const wl_total = gnHash && gnHash.wl_total !== undefined ? Number(gnHash.wl_total) : 70;

        const tq_available = tqHash && tqHash.tq_available !== undefined ? Number(tqHash.tq_available) : 10;
        const tq_total = tqHash && tqHash.tq_total !== undefined ? Number(tqHash.tq_total) : 10;

        const pt_available = tqHash && tqHash.pt_available !== undefined ? Number(tqHash.pt_available) : 10;
        const pt_total = tqHash && tqHash.pt_total !== undefined ? Number(tqHash.pt_total) : 10;

        const totalCapacity = gn_total + ld_total + hp_total + ss_total + tq_total + pt_total;
        const totalLiveAvailable = gn_available + ld_available + hp_available + ss_available + tq_available + pt_available;
        const totalBooked = Math.max(0, totalCapacity - totalLiveAvailable);

        // Strict Quota Field Extraction based on req.query.quota
        let specificQuotaAvailable = gn_available;
        if (selectedQuota === 'SS') specificQuotaAvailable = ss_available;
        else if (selectedQuota === 'LD') specificQuotaAvailable = ld_available;
        else if (selectedQuota === 'HP') specificQuotaAvailable = hp_available;
        else if (selectedQuota === 'TQ') specificQuotaAvailable = tq_available;
        else if (selectedQuota === 'PT') specificQuotaAvailable = pt_available;
        else specificQuotaAvailable = gn_available;

        const rate = baseRates[cType] || 1.0;
        const fare = Math.round((train.distanceKm || 500) * rate + 100);

        const gnStatus = gn_available > 0 ? 'AVAILABLE' : (rac_available > 0 ? 'RAC' : (wl_available > 0 ? 'WL' : 'REGRET'));
        const tqStatus = tq_available > 0 ? 'AVAILABLE' : 'REGRET';
        const ptStatus = pt_available > 0 ? 'AVAILABLE' : 'REGRET';
        const ldStatus = ld_available > 0 ? 'AVAILABLE' : 'WL';
        const ssStatus = ss_available > 0 ? 'AVAILABLE' : 'WL';
        const hpStatus = hp_available > 0 ? 'AVAILABLE' : 'WL';

        return {
          classType: cType,
          fare,
          totalCapacity,
          totalBooked,
          availableSeats: specificQuotaAvailable, // Specific live Redis count matching requested quota
          availability: {
            GN: {
              status: gnStatus,
              seats: gn_available,
              available_seats: gn_available,
              rac_seats: rac_available,
              wl_seats: wl_available,
              updateTime: 'Live PRS Status',
            },
            TQ: {
              status: tqStatus,
              seats: tq_available,
              available_seats: tq_available,
              rac_seats: 0,
              wl_seats: 0,
              updateTime: 'Tatkal Quota',
            },
            PT: {
              status: ptStatus,
              seats: pt_available,
              available_seats: pt_available,
              rac_seats: 0,
              wl_seats: 0,
              updateTime: 'Premium Tatkal',
            },
            LD: {
              status: ldStatus,
              seats: ld_available,
              available_seats: ld_available,
              updateTime: 'Ladies Quota',
            },
            SS: {
              status: ssStatus,
              seats: ss_available,
              available_seats: ss_available,
              updateTime: 'Sr. Citizen',
            },
            HP: {
              status: hpStatus,
              seats: hp_available,
              available_seats: hp_available,
              updateTime: 'Divyangjan',
            },
          },
        };
      });

      return {
        ...train,
        classes,
      };
    });

    // 6. Return matched trains with standardized response structure
    return res.status(200).json({
      success: true,
      count: trainsWithRealTimeAvailability.length,
      trains: trainsWithRealTimeAvailability,
    });
  } catch (error) {
    console.error('❌ [TrainController:searchTrains] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while searching for trains.',
      error: error.message,
    });
  }
}

/**
 * @desc    Fetch all active trains
 * @route   GET /api/trains
 * @access  Public
 */
async function getAllTrains(req, res) {
  try {
    const trains = await Train.find({ isActive: { $ne: false } })
      .populate('originStation', 'name code city state zone')
      .populate('destinationStation', 'name code city state zone')
      .lean();

    return res.status(200).json({
      success: true,
      count: trains.length,
      trains,
    });
  } catch (error) {
    console.error('❌ [TrainController:getAllTrains] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve trains.',
      error: error.message,
    });
  }
}

/**
 * @desc    Fetch train details by train number (e.g., '12951')
 * @route   GET /api/trains/number/:trainNumber
 * @access  Public
 */
async function getTrainByNumber(req, res) {
  try {
    const { trainNumber } = req.params;
    const train = await Train.findOne({ trainNumber: String(trainNumber).trim() })
      .populate('originStation', 'name code city state zone')
      .populate('destinationStation', 'name code city state zone')
      .populate('route.station', 'name code city state zone')
      .lean();

    if (!train) {
      return res.status(404).json({
        success: false,
        message: `Train with number "${trainNumber}" not found.`,
      });
    }

    return res.status(200).json({
      success: true,
      train,
    });
  } catch (error) {
    console.error('❌ [TrainController:getTrainByNumber] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve train details.',
      error: error.message,
    });
  }
}

/**
 * @desc    Fetch train details by MongoDB ObjectId
 * @route   GET /api/trains/:id
 * @access  Public
 */
async function getTrainById(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid train ID format.',
      });
    }

    const train = await Train.findById(id)
      .populate('originStation', 'name code city state zone')
      .populate('destinationStation', 'name code city state zone')
      .populate('route.station', 'name code city state zone')
      .lean();

    if (!train) {
      return res.status(404).json({
        success: false,
        message: 'Train not found.',
      });
    }

    return res.status(200).json({
      success: true,
      train,
    });
  } catch (error) {
    console.error('❌ [TrainController:getTrainById] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve train details.',
      error: error.message,
    });
  }
}

module.exports = {
  searchTrains,
  getAllTrains,
  getTrainByNumber,
  getTrainById,
  calculateDuration,
};
