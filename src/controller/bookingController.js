const mongoose = require('mongoose');
const Station = require('../models/station');
const Train = require('../models/train');
const Coach = require('../models/coach');
const Seat = require('../models/seat');
const Booking = require('../models/booking');
const { getSeatAvailability } = require('../services/inventoryService');
const { bookingQueue } = require('../queue/bookingQueue');

function getCoachAliases(coachStr) {
  if (!coachStr) return [];
  const s = String(coachStr).trim().toUpperCase();
  const numMatch = s.match(/\d+$/);
  const num = numMatch ? numMatch[0] : '1';
  const prefix = s.replace(/\d+$/, '');

  const map = {
    '1A': ['1A', 'H'],
    'H': ['1A', 'H'],
    '2A': ['2A', 'A'],
    'A': ['2A', 'A'],
    '3A': ['3A', 'B'],
    'B': ['3A', 'B'],
    'SL': ['SL', 'S'],
    'S': ['SL', 'S'],
    'CC': ['CC', 'C'],
    'C': ['CC', 'C'],
    'EC': ['EC', 'E'],
    'E': ['EC', 'E'],
    '3E': ['3E', 'M'],
    'M': ['3E', 'M'],
  };

  const letters = map[prefix] || [prefix];
  const set = new Set([s]);
  letters.forEach((l) => {
    set.add(`${l}${num}`);
    set.add(l);
  });
  return Array.from(set);
}

const VALID_CLASSES = ['1A', '2A', '3A', '3E', 'SL', 'CC', 'EC', '2S'];
const VALID_QUOTAS = ['GN', 'TQ', 'PT', 'LD', 'HP', 'SS'];
const MAX_PASSENGERS_PER_BOOKING = 6;

/**
 * @desc    Enqueue a high-concurrency ticket booking request
 * @route   POST /api/bookings
 * @access  Private (Requires JWT authentication)
 */
async function createBooking(req, res) {
  try {
    // 1. Extract authenticated user ID from req.user or request body (with fallback)
    const userId =
      req.user?._id ||
      req.user?.id ||
      req.body?.userId ||
      new mongoose.Types.ObjectId('000000000000000000000001');

    // 2. Extract and validate incoming request payload
    const {
      trainId,
      journeyDate,
      fromStation,
      toStation,
      fromStationCode,
      toStationCode,
      classType,
      passengers,
      fareDetails,
      paymentDetails,
    } = req.body;

    // Explicitly extract and sanitize quota from request body
    const rawQuota = req.body.quota || req.body.bookingContext?.quota || 'GN';
    const quota = String(rawQuota).trim().toUpperCase();

    if (
      !trainId ||
      !journeyDate ||
      !fromStation ||
      !toStation ||
      !fromStationCode ||
      !toStationCode ||
      !classType ||
      !fareDetails
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Missing required booking fields (trainId, journeyDate, fromStation, toStation, fromStationCode, toStationCode, classType, fareDetails).',
      });
    }

    if (!mongoose.Types.ObjectId.isValid(trainId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid trainId format.',
      });
    }

    if (!VALID_CLASSES.includes(classType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid classType. Must be one of: ${VALID_CLASSES.join(', ')}`,
      });
    }

    if (!VALID_QUOTAS.includes(quota)) {
      return res.status(400).json({
        success: false,
        message: `Invalid quota. Must be one of: ${VALID_QUOTAS.join(', ')}`,
      });
    }

    if (!Array.isArray(passengers) || passengers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one passenger must be provided.',
      });
    }

    if (passengers.length > MAX_PASSENGERS_PER_BOOKING) {
      return res.status(400).json({
        success: false,
        message: `Maximum ${MAX_PASSENGERS_PER_BOOKING} passengers allowed per booking.`,
      });
    }

    // Validate individual passenger details
    for (const passenger of passengers) {
      if (!passenger.name || !passenger.age || !passenger.gender) {
        return res.status(400).json({
          success: false,
          message: 'Each passenger must have a valid name, age, and gender.',
        });
      }
    }

    // 3. Query MongoDB to verify Train and retrieve official trainNumber
    const train = await Train.findById(trainId).select('trainNumber trainName availableClasses isActive').lean();
    if (!train) {
      return res.status(404).json({
        success: false,
        message: 'Train not found.',
      });
    }

    if (!train.isActive) {
      return res.status(400).json({
        success: false,
        message: `Train ${train.trainNumber} (${train.trainName}) is currently not active.`,
      });
    }

    if (Array.isArray(train.availableClasses) && !train.availableClasses.includes(classType)) {
      return res.status(400).json({
        success: false,
        message: `Class ${classType} is not available on Train ${train.trainNumber}.`,
      });
    }

    const trainNumber=train.trainNumber
    const passengerCount = passengers.length;

    // 4. Quick Redis Safety Pre-check via getSeatAvailability (with automatic seeding fallback)
    let inventory = await getSeatAvailability(trainNumber, journeyDate, classType, quota);

    if (!inventory) {
      console.log(`ℹ️ [BookingController:createBooking] Inventory null in Redis for ${trainNumber} on ${journeyDate}. Initializing...`);
      const { initializeInventory } = require('../services/inventoryService');
      await initializeInventory(trainNumber, journeyDate, classType, quota);
      inventory = await getSeatAvailability(trainNumber, journeyDate, classType, quota);
    }

    if (!inventory) {
      return res.status(400).json({
        success: false,
        status: 'REGRET',
        inventory: null,
        message: 'Seat inventory is not initialized or closed for the selected train, date, and class.',
      });
    }

    const totalAvailableCapacity =
      (inventory.availableSeats || 0) +
      (inventory.racSeatsRemaining || 0) +
      (inventory.wlSeatsRemaining || 0);

    if (totalAvailableCapacity < passengerCount) {
      return res.status(400).json({
        success: false,
        status: 'REGRET',
        message: 'Booking rejected: Insufficient capacity across Confirmed, RAC, and Waitlist pools.',
        availableCapacity: totalAvailableCapacity,
        requestedPassengers: passengerCount,
      });
    }

    // 5. Assign dynamic BullMQ job priority (Tatkal = 1, General/Others = 5)
    const priority = quota === 'TQ' ? 1 : 5;

    // 6. Construct job payload & enqueue to BullMQ
    const bookingPayload = {
      userId: String(userId),
      trainId: String(trainId),
      pnr: req.body.pnr ? String(req.body.pnr).trim() : undefined,
      trainNumber,
      journeyDate,
      fromStation: String(fromStation),
      toStation: String(toStation),
      fromStationCode: fromStationCode.trim().toUpperCase(),
      toStationCode: toStationCode.trim().toUpperCase(),
      classType,
      quota,
      passengers,
      fareDetails,
      paymentDetails: paymentDetails || {
        paymentStatus: 'SUCCESS',
        paidAt: new Date().toISOString(),
      },
      requestedAt: new Date().toISOString(),
    };

    console.log(`⏳ [BookingController:createBooking] Ready to enqueue job to BullMQ queue: '${bookingQueue.name}'`);
    console.log(`📋 [BookingController:createBooking] Details: Train=${trainNumber}, Date=${journeyDate}, Class=${classType}, Quota=${quota}, Passengers=${passengerCount}, Priority=${priority}`);

    const job = await bookingQueue.add('process-booking', bookingPayload, {
      priority,
      removeOnComplete: { age: 3600, count: 1000 },
      removeOnFail: false,
    });

    console.log(`✅ [BookingController:createBooking] bookingQueue.add() SUCCESS! Assigned Job ID: ${job.id}`);

    // 7. Return 202 Accepted response with jobId and QUEUED status
    return res.status(202).json({
      success: true,
      message: 'Booking request passed pre-check and has been queued for processing.',
      jobId: job.id,
      status: 'QUEUED',
      data: {
        trainNumber,
        journeyDate,
        classType,
        quota,
        passengerCount,
        priority,
      },
    });
  } catch (error) {
    console.error('❌ [BookingController:createBooking] Caught exception while enqueueing booking:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while processing booking request.',
      error: error.message || 'Unknown server error',
    });
  }
}

/**
 * Helper to normalize passenger status strings (e.g. "WL 8" -> { status: "WL", waitingNumber: 8 })
 */
function normalizePassengerStatus(rawStatus, fallbackWaitingNumber = null) {
  const str = String(rawStatus || 'CNF').trim().toUpperCase();
  if (str.startsWith('WL')) {
    const match = str.match(/\d+/);
    return { status: 'WL', waitingNumber: match ? Number(match[0]) : fallbackWaitingNumber };
  }
  if (str.startsWith('RAC')) {
    const match = str.match(/\d+/);
    return { status: 'RAC', waitingNumber: match ? Number(match[0]) : fallbackWaitingNumber };
  }
  if (str === 'CAN' || str === 'CANCELLED') {
    return { status: 'CAN', waitingNumber: null };
  }
  return { status: 'CNF', waitingNumber: null };
}

const BERTH_PREF_MAP = {
  WS: 'WINDOW',
  WINDOW: 'WINDOW',
  WINDOW_SEAT: 'WINDOW',
  WN: 'WINDOW',
  UB: 'UPPER',
  UPPER: 'UPPER',
  UPPER_BERTH: 'UPPER',
  LB: 'LOWER',
  LOWER: 'LOWER',
  LOWER_BERTH: 'LOWER',
  MB: 'MIDDLE',
  MIDDLE: 'MIDDLE',
  MIDDLE_BERTH: 'MIDDLE',
  MIDDLE_SEAT: 'MIDDLE',
  MS: 'MIDDLE',
  SL: 'SIDE_LOWER',
  SIDE_LOWER: 'SIDE_LOWER',
  SU: 'SIDE_UPPER',
  SIDE_UPPER: 'SIDE_UPPER',
  CB: 'CABIN',
  CABIN: 'CABIN',
  CP: 'COUPE',
  COUPE: 'COUPE',
  AS: 'AISLE',
  AISLE: 'AISLE',
};

function normalizeBerthPreference(pref) {
  if (!pref) return 'NO_PREFERENCE';
  const clean = String(pref).trim().toUpperCase().replace(/\s+/g, '_');
  return BERTH_PREF_MAP[clean] || (['LOWER', 'MIDDLE', 'UPPER', 'SIDE_LOWER', 'SIDE_UPPER', 'WINDOW'].includes(clean) ? clean : 'NO_PREFERENCE');
}

function seatMatchesPreference(seat, pref) {
  if (!pref || pref === 'NO_PREFERENCE') return false;
  const targetPref = normalizeBerthPreference(pref);
  if (targetPref === 'NO_PREFERENCE') return false;

  const seatBerth = normalizeBerthPreference(seat.berthType);
  const isWindow = seat.isWindow === true || seatBerth === 'WINDOW' || String(seat.berthType || '').toUpperCase() === 'WS';

  if (targetPref === 'WINDOW') {
    return isWindow;
  }
  if (targetPref === 'MIDDLE') {
    return seatBerth === 'MIDDLE';
  }
  return seatBerth === targetPref;
}

/**
 * @desc    Directly persist/confirm a completed booking in MongoDB so PNR lookup & cancellation work
 * @route   POST /api/bookings/confirm
 * @access  Public / Private (optionalVerifyJWT)
 */
async function confirmDirectBooking(req, res) {
  try {
    const {
      pnr,
      userId,
      trainId,
      trainNumber,
      trainName,
      trainType,
      journeyDate,
      fromStation,
      fromStationName,
      fromStationCode,
      toStation,
      toStationName,
      toStationCode,
      departureTime,
      arrivalTime,
      classType = '3A',
      quota = 'GN',
      passengers = [],
      fareDetails = {},
      paymentDetails = {},
    } = req.body;

    const cleanPnr = String(pnr || Math.floor(1000000000 + Math.random() * 9000000000)).trim();

    // Idempotency check: if booking with this PNR already exists in MongoDB, return it
    const existing = await Booking.findOne({ pnr: cleanPnr });
    if (existing) {
      return res.status(200).json({
        success: true,
        message: 'Booking already persisted.',
        data: existing,
      });
    }

    const originCode = String(fromStationCode || fromStation || 'NDLS').trim().toUpperCase();
    const destCode = String(toStationCode || toStation || 'MMCT').trim().toUpperCase();

    // 1. Resolve or upsert Origin & Destination Stations
    let originStationDoc =
      (mongoose.Types.ObjectId.isValid(fromStation) ? await Station.findById(fromStation) : null) ||
      (await Station.findOne({ code: originCode }));

    if (!originStationDoc) {
      originStationDoc = await Station.create({
        name: fromStationName || originCode,
        code: originCode,
        city: fromStationName || originCode,
        state: 'India',
      });
    }

    let destStationDoc =
      (mongoose.Types.ObjectId.isValid(toStation) ? await Station.findById(toStation) : null) ||
      (await Station.findOne({ code: destCode }));

    if (!destStationDoc) {
      destStationDoc = await Station.create({
        name: toStationName || destCode,
        code: destCode,
        city: toStationName || destCode,
        state: 'India',
      });
    }

    // 2. Resolve or upsert Train
    const cleanTrainNo = String(trainNumber || '12952').trim();
    let trainDoc =
      (mongoose.Types.ObjectId.isValid(trainId) ? await Train.findById(trainId) : null) ||
      (await Train.findOne({ trainNumber: cleanTrainNo }));

    if (!trainDoc) {
      const allowedTrainTypes = [
        'VANDE_BHARAT',
        'RAJDHANI',
        'SHATABDI',
        'DURONTO',
        'SUPERFAST',
        'EXPRESS',
        'MAIL',
        'PASSENGER',
      ];
      const normalizedType = allowedTrainTypes.includes(String(trainType || '').toUpperCase())
        ? String(trainType).toUpperCase()
        : 'EXPRESS';

      trainDoc = await Train.create({
        trainNumber: cleanTrainNo,
        trainName: trainName || `Express ${cleanTrainNo}`,
        trainType: normalizedType,
        originStation: originStationDoc._id,
        destinationStation: destStationDoc._id,
        availableClasses: VALID_CLASSES,
        isActive: true,
        chartPrepared: false,
        route: [
          {
            station: originStationDoc._id,
            stationCode: originCode,
            stopNumber: 1,
            sequence: 1,
            arrivalTime: null,
            departureTime: departureTime || '23:55',
            haltMinutes: 0,
            distanceFromOriginKm: 0,
            dayNumber: 1,
          },
          {
            station: destStationDoc._id,
            stationCode: destCode,
            stopNumber: 2,
            sequence: 2,
            arrivalTime: arrivalTime || '08:30',
            departureTime: null,
            haltMinutes: 0,
            distanceFromOriginKm: 500,
            dayNumber: 2,
          },
        ],
      });
    }

    const resolvedClassType = VALID_CLASSES.includes(classType) ? classType : '3A';
    const defaultCoachPrefix = { '1A': 'H1', '2A': 'A1', '3A': 'B1', 'SL': 'S1', 'CC': 'C1' }[resolvedClassType] || 'B1';

    // 3. Resolve physical seat availability and match passengers' berth preferences
    let physicalClassSeats = [];
    if (trainDoc) {
      physicalClassSeats = await Seat.find({
        train: trainDoc._id,
        coachType: resolvedClassType,
      }).populate('coach', 'coachNumber').sort({ seatNumber: 1 });
    }

    const unassignedPool = [...physicalClassSeats];
    const assignedSeatSet = new Set();

    const rawPassengerList = Array.isArray(passengers) && passengers.length > 0
      ? passengers
      : [{ name: 'Passenger 1', age: 30, gender: 'MALE', bookingStatus: 'CNF', currentStatus: 'CNF' }];

    const normalizedPassengers = rawPassengerList.map((p, idx) => {
      const bNorm = normalizePassengerStatus(p.bookingStatus, p.waitingNumber);
      const cNorm = normalizePassengerStatus(p.currentStatus || p.bookingStatus, p.waitingNumber || bNorm.waitingNumber);
      const genderUpper = String(p.gender || 'MALE').trim().toUpperCase();
      const validGender = ['MALE', 'FEMALE', 'OTHER'].includes(genderUpper) ? genderUpper : 'MALE';

      const rawPref = p.berthPreference;
      const prefNorm = normalizeBerthPreference(rawPref);
      let assignedSeatObj = null;

      if (cNorm.status === 'CNF') {
        if (p.allocatedSeatNumber && p.allocatedBerth) {
          assignedSeatObj = {
            seatNumber: Number(p.allocatedSeatNumber),
            allocatedBerth: p.allocatedBerth,
            allocatedCoach: p.allocatedCoach || defaultCoachPrefix,
          };
        } else {
          // Priority 1: Match requested preference (WS, UB, LB, MB, etc.)
          if (prefNorm !== 'NO_PREFERENCE') {
            const mIdx = unassignedPool.findIndex((s) => {
              if (assignedSeatSet.has(String(s._id || s.seatNumber))) return false;
              return seatMatchesPreference(s, rawPref);
            });
            if (mIdx !== -1) {
              const matched = unassignedPool.splice(mIdx, 1)[0];
              assignedSeatSet.add(String(matched._id || matched.seatNumber));
              assignedSeatObj = {
                seatNumber: matched.seatNumber,
                allocatedBerth: matched.berthType,
                allocatedCoach: matched.coach?.coachNumber || defaultCoachPrefix,
              };
            }
          }

          // Priority 2: Fallback to next sequential seat
          if (!assignedSeatObj) {
            const fallback = unassignedPool.shift();
            if (fallback) {
              assignedSeatSet.add(String(fallback._id || fallback.seatNumber));
              assignedSeatObj = {
                seatNumber: fallback.seatNumber,
                allocatedBerth: fallback.berthType,
                allocatedCoach: fallback.coach?.coachNumber || defaultCoachPrefix,
              };
            } else {
              const fallbackBerth = prefNorm !== 'NO_PREFERENCE' ? prefNorm : 'LOWER';
              assignedSeatObj = {
                seatNumber: idx + 1,
                allocatedBerth: fallbackBerth,
                allocatedCoach: defaultCoachPrefix,
              };
            }
          }
        }
      }

      return {
        name: String(p.name || `Passenger ${idx + 1}`).trim(),
        age: Math.min(120, Math.max(1, Number(p.age) || 30)),
        gender: validGender,
        berthPreference: prefNorm,
        bookingStatus: ['CNF', 'RAC', 'WL'].includes(bNorm.status) ? bNorm.status : 'CNF',
        currentStatus: ['CNF', 'RAC', 'WL', 'CAN'].includes(cNorm.status) ? cNorm.status : 'CNF',
        allocatedCoach: cNorm.status === 'CNF' ? (assignedSeatObj?.allocatedCoach || 'B1') : null,
        allocatedSeatNumber: cNorm.status === 'CNF' ? (assignedSeatObj?.seatNumber || idx + 1) : null,
        allocatedBerth: cNorm.status === 'CNF' ? (assignedSeatObj?.allocatedBerth || 'LOWER') : null,
        waitingNumber: cNorm.waitingNumber,
      };
    });

    // 4. Determine user ObjectId
    const resolvedUserId =
      req.user?._id ||
      req.user?.id ||
      (mongoose.Types.ObjectId.isValid(userId) ? userId : new mongoose.Types.ObjectId('000000000000000000000001'));

    // 5. Determine overall booking status
    const allStatuses = normalizedPassengers.map((p) => p.currentStatus);
    let overallStatus = 'CONFIRMED';
    if (allStatuses.every((s) => s === 'CAN')) overallStatus = 'CANCELLED';
    else if (allStatuses.every((s) => s === 'WL')) overallStatus = 'WAITLISTED';
    else if (allStatuses.every((s) => s === 'RAC')) overallStatus = 'RAC';

    const rawDirectQuota = req.body.quota || req.body.bookingContext?.quota || req.body.selectedClass?.quota || quota || 'GN';
    const cleanDirectQuota = String(rawDirectQuota).trim().toUpperCase();
    const resolvedQuota = VALID_QUOTAS.includes(cleanDirectQuota) ? cleanDirectQuota : 'GN';

    const bookingDoc = await Booking.create({
      pnr: cleanPnr,
      user: resolvedUserId,
      train: trainDoc._id,
      journeyDate: new Date(journeyDate || Date.now() + 86400000),
      fromStation: originStationDoc._id,
      toStation: destStationDoc._id,
      fromStationCode: originCode,
      toStationCode: destCode,
      classType: resolvedClassType,
      quota: resolvedQuota,
      passengers: normalizedPassengers,
      fareDetails: {
        baseFare: Number(fareDetails.baseFare) || 1000,
        tatkalCharge: Number(fareDetails.tatkalCharge) || 0,
        gst: Number(fareDetails.gst || fareDetails.convenienceFee) || 0,
        totalFare: Number(fareDetails.totalFare) || Number(fareDetails.baseFare) || 1000,
      },
      paymentDetails: {
        transactionId: paymentDetails.transactionId || `TXN${Date.now()}`,
        paymentStatus: 'SUCCESS',
        paidAt: paymentDetails.paidAt ? new Date(paymentDetails.paidAt) : new Date(),
      },
      bookingStatus: overallStatus,
    });

    // 6. Live Physical Seat Linkage in MongoDB
    if (trainDoc) {
      for (const p of normalizedPassengers) {
        if (p.currentStatus === 'CNF' && (p.allocatedCoach || p.coachNumber) && (p.allocatedSeatNumber || p.berthNumber)) {
          const cNum = p.allocatedCoach || p.coachNumber;
          const sNum = Number(p.allocatedSeatNumber || p.berthNumber);
          const coachAliases = getCoachAliases(cNum);
          const coach = await Coach.findOne({ train: trainDoc._id, coachNumber: { $in: coachAliases } });
          if (coach) {
            await Seat.findOneAndUpdate(
              { coach: coach._id, seatNumber: sNum },
              { $set: { status: 'BOOKED', booking: bookingDoc._id } }
            );
          }
        }
      }
    }

    // 7. Decrement Redis inventory counters using nested-hash HINCRBY
    try {
      const { decrementQuotaInventory } = require('../services/inventoryService');
      const decrementResult = await decrementQuotaInventory(
        cleanTrainNo,
        journeyDate,
        resolvedClassType,
        resolvedQuota,
        normalizedPassengers.length
      );
      console.log(`📉 [BookingController:confirmDirectBooking] Decremented Redis for quota ${resolvedQuota}:`, decrementResult);
    } catch (redisErr) {
      console.warn(`⚠️ [BookingController:confirmDirectBooking] Non-fatal Redis sync warning:`, redisErr.message);
    }

    // Requirement 5: The exact moment a booking is successfully saved to MongoDB,
    // automatically enqueue the prepare-chart BullMQ job for that train/date.
    try {
      const { chartPreparationQueue } = require('../queue/chartQueue');
      const { normalizeDateString } = require('../utils/keyGenerator');
      const chartJob = await chartPreparationQueue.add(
        'prepare-chart',
        {
          trainId: String(trainDoc._id),
          trainNumber: cleanTrainNo,
          journeyDate: normalizeDateString(journeyDate || Date.now() + 86400000),
        },
        {
          priority: 1,
          removeOnComplete: { age: 3600, count: 1000 },
          removeOnFail: false,
        }
      );
      console.log(`🚀 [BookingController] Automatically enqueued prepare-chart job ${chartJob.id} for Train ${cleanTrainNo}`);
    } catch (chartErr) {
      console.warn(`⚠️ [BookingController] Non-blocking prepare-chart trigger warning:`, chartErr.message);
    }

    return res.status(201).json({
      success: true,
      message: 'Booking confirmed and saved to database.',
      data: bookingDoc,
    });
  } catch (error) {
    console.error('❌ [BookingController:confirmDirectBooking] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to persist booking.',
      error: error.message,
    });
  }
}

/**
 * @desc    Check status of a queued BullMQ booking job
 * @route   GET /api/bookings/job/:jobId
 * @access  Private
 */
async function getBookingJobStatus(req, res) {
  try {
    const { jobId } = req.params;
    const job = await bookingQueue.getJob(jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Booking job not found or already completed and pruned.',
      });
    }

    const state = await job.getState();

    return res.status(200).json({
      success: true,
      jobId: job.id,
      state, // 'waiting', 'active', 'completed', 'failed', 'delayed'
      result: job.returnvalue || null,
      failedReason: job.failedReason || null,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve booking job status.',
      error: error.message,
    });
  }
}

/**
 * @desc    Fetch booking details by 10-digit PNR
 * @route   GET /api/bookings/pnr/:pnr
 * @access  Public / Private
 */
async function getBookingByPNR(req, res) {
  try {
    const { pnr } = req.params;
    const booking = await Booking.findOne({ pnr })
      .populate('train', 'trainNumber trainName trainType chartPrepared')
      .populate('fromStation', 'name code city')
      .populate('toStation', 'name code city')
      .lean();

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: `No booking found with PNR ${pnr}`,
      });
    }

    // Dynamic live chartStatus resolution
    const isChartPrepared = booking.chartStatus === 'CHART PREPARED' || Boolean(booking.train?.chartPrepared);
    booking.chartStatus = isChartPrepared ? 'CHART PREPARED' : 'CHART NOT PREPARED';

    return res.status(200).json({
      success: true,
      data: booking,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch PNR details.',
      error: error.message,
    });
  }
}

module.exports = {
  createBooking,
  confirmDirectBooking,
  getBookingJobStatus,
  getBookingByPNR,
};

