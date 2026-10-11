require('dotenv').config({ path: '../../.env' });
const { Worker } = require('bullmq');
const { redisConnection } = require('../config/redisClient');
const { BOOKING_QUEUE_NAME } = require('../queue/bookingQueue');
const Booking = require('../models/booking');
const Seat = require('../models/seat');
const Coach = require('../models/coach');
const Train = require('../models/train');
const Station = require('../models/station');
const { reserveSeatsAtomically, rollbackReservation, normalizeDateString } = require('../services/inventoryService');
const mongoose = require('mongoose');
const WORKER_CONCURRENCY = Number(process.env.BOOKING_WORKER_CONCURRENCY) || 10;

/**
 * Generates a unique 10-digit PNR number
 */
function generatePNR() {
  return Math.floor(1000000000 + Math.random() * 9000000000).toString();
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

/**
 * Helper to normalize berth preference to schema enum (supporting WS, UB, LB, MB, SL, SU, etc.)
 */
function normalizeBerthPreference(preference) {
  if (!preference) return 'NO_PREFERENCE';
  const clean = String(preference).trim().toUpperCase().replace(/\s+/g, '_');
  return BERTH_PREF_MAP[clean] || (['LOWER', 'MIDDLE', 'UPPER', 'SIDE_LOWER', 'SIDE_UPPER', 'WINDOW'].includes(clean) ? clean : 'NO_PREFERENCE');
}

/**
 * Checks if a physical seat matches the passenger's requested berth preference
 */
function seatMatchesPreference(seat, preference) {
  if (!preference || preference === 'NO_PREFERENCE') return false;
  const targetPref = normalizeBerthPreference(preference);
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
 * BullMQ Job Processor for handling high-concurrency ticket bookings with cascading tiers
 */
async function processBookingJob(job) {
  const {
    userId,
    trainId,
    trainNumber,
    journeyDate,
    fromStation,
    toStation,
    fromStationCode,
    toStationCode,
    classType,
    quota = 'GN',
    passengers,
    fareDetails,
    paymentDetails,
  } = job.data;

  // Step 1: Strict Input Sanitization
  const sanitizedTrainNumber = String(trainNumber || '').trim();
  if (!sanitizedTrainNumber) {
    throw new Error('TRAIN_NUMBER_REQUIRED: trainNumber must be explicitly provided.');
  }

  if (!journeyDate) {
    throw new Error('JOURNEY_DATE_REQUIRED: journeyDate must be explicitly provided.');
  }

  // Convert journeyDate strictly to YYYY-MM-DD string matching Upstash Redis key format
  const formattedDate = normalizeDateString(journeyDate);

  const VALID_WORKER_QUOTAS = ['GN', 'TQ', 'PT', 'LD', 'HP', 'SS'];
  const rawQuota = job.data.quota || quota || 'GN';
  const sanitizedQuota = String(rawQuota).trim().toUpperCase();
  const validQuota = VALID_WORKER_QUOTAS.includes(sanitizedQuota) ? sanitizedQuota : 'GN';

  if (!Array.isArray(passengers) || passengers.length === 0) {
    throw new Error('PASSENGERS_REQUIRED: Booking must contain at least one passenger.');
  }

  console.log(`⚡ [BullMQ:Worker] Processing booking job ${job.id} for Train: ${sanitizedTrainNumber} on ${formattedDate} (${passengers.length} passengers, Quota: ${validQuota})`);

  // Track reservation and seat IDs for atomic rollback
  let reservationResult = null;
  const bookedSeatIds = [];
  const bookingId = new mongoose.Types.ObjectId();

  // Atomic cascading seat reservation in Redis
  reservationResult = await reserveSeatsAtomically(
    sanitizedTrainNumber,
    formattedDate,
    classType,
    validQuota,
    passengers.length
  );

  if (!reservationResult || reservationResult.status === 'REGRET') {
    throw new Error('BOOKING_REJECTED_NO_SEATS: No seats or waitlist available for this request.');
  }

  const { cnfCount = 0, rac = { count: 0, start: 0 }, wl = { count: 0, start: 0 } } = reservationResult;
  console.log(`🎯 [BullMQ:Worker] Allocation plan for job ${job.id}: CNF=${cnfCount}, RAC=${rac.count} (starts at ${rac.start}), WL=${wl.count} (starts at ${wl.start})`);

  try {
    // Step 2: Query physical Seat documents for CNF passengers and match berth preferences
    let resolvedTrainId = trainId;

    if (!mongoose.Types.ObjectId.isValid(resolvedTrainId)) {
      const trainDoc = await Train.findOne({ trainNumber: sanitizedTrainNumber }).select('_id').lean();
      if (trainDoc) {
        resolvedTrainId = trainDoc._id;
      }
    }

    const assignedSeatsMap = new Map(); // passengerIndex -> seatDoc
    const defaultCoachPrefix = { '1A': 'H1', '2A': 'A1', '3A': 'B1', 'SL': 'S1', 'CC': 'C1' }[classType] || 'B1';

    if (cnfCount > 0 && resolvedTrainId) {
      // Fetch physical seats for this train and class
      let physicalClassSeats = await Seat.find({
        train: resolvedTrainId,
        coachType: classType,
      })
        .populate('coach', 'coachNumber')
        .sort({ seatNumber: 1 });

      // Determine already booked seats specifically on this journeyDate
      const [yJ, mJ, dJ] = formattedDate.split('-').map(Number);
      const dateStart = new Date(Date.UTC(yJ, mJ - 1, dJ - 1, 12, 0, 0, 0));
      const dateEnd = new Date(Date.UTC(yJ, mJ - 1, dJ + 1, 12, 0, 0, 0));

      const existingBookingsOnDate = await Booking.find({
        train: resolvedTrainId,
        journeyDate: { $gte: dateStart, $lte: dateEnd },
        bookingStatus: { $ne: 'CANCELLED' },
      }).lean();

      const bookedKeysOnDate = new Set();
      existingBookingsOnDate.forEach((b) => {
        if (normalizeDateString(b.journeyDate) === formattedDate) {
          (b.passengers || []).forEach((p) => {
            if (p.currentStatus === 'CNF' || p.bookingStatus === 'CNF') {
              const c = String(p.allocatedCoach || '').toUpperCase();
              const s = Number(p.allocatedSeatNumber);
              if (c && s) bookedKeysOnDate.add(`${c}:${s}`);
            }
          });
        }
      });

      // Filter available physical seats on this journey date
      let availableSeats = physicalClassSeats.filter((seat) => {
        const cNum = String(seat.coach?.coachNumber || '').toUpperCase();
        return !bookedKeysOnDate.has(`${cNum}:${seat.seatNumber}`);
      });

      // If no physical Seat documents exist in DB, synthesize seats with authentic berth types
      if (availableSeats.length === 0) {
        const defaultCap = classType === 'CC' ? 100 : classType === '2A' ? 54 : 72;
        const berthCycle = classType === 'CC'
          ? ['WINDOW', 'MIDDLE_SEAT', 'AISLE', 'AISLE', 'MIDDLE_SEAT', 'WINDOW']
          : ['LOWER', 'MIDDLE', 'UPPER', 'LOWER', 'MIDDLE', 'UPPER', 'SIDE_LOWER', 'SIDE_UPPER'];

        availableSeats = [];
        for (let sNum = 1; sNum <= defaultCap; sNum++) {
          const bType = berthCycle[(sNum - 1) % berthCycle.length];
          const isWin = bType === 'WINDOW';
          if (!bookedKeysOnDate.has(`${defaultCoachPrefix}:${sNum}`)) {
            availableSeats.push({
              _id: new mongoose.Types.ObjectId(),
              seatNumber: sNum,
              coach: { coachNumber: defaultCoachPrefix },
              coachType: classType,
              berthType: bType,
              isWindow: isWin,
            });
          }
        }
      }

      const unassignedSeatPool = [...availableSeats];
      const assignedSeatIds = new Set();
      const cnfPassengers = passengers.slice(0, cnfCount);

      // Pass 1: Prioritized matching for passengers with specific berth preferences (WS, UB, LB, MB, etc.)
      cnfPassengers.forEach((p, idx) => {
        const pref = normalizeBerthPreference(p.berthPreference);
        if (pref !== 'NO_PREFERENCE') {
          const matchIdx = unassignedSeatPool.findIndex((seat) => {
            if (assignedSeatIds.has(String(seat._id || seat.seatNumber))) return false;
            return seatMatchesPreference(seat, p.berthPreference);
          });

          if (matchIdx !== -1) {
            const matchedSeat = unassignedSeatPool.splice(matchIdx, 1)[0];
            assignedSeatIds.add(String(matchedSeat._id || matchedSeat.seatNumber));
            assignedSeatsMap.set(idx, matchedSeat);
            console.log(
              `🎯 [BullMQ:Worker] Allocated preferred berth '${pref}' (${p.berthPreference}) to passenger '${p.name}': Coach ${matchedSeat.coach?.coachNumber || defaultCoachPrefix} - Seat ${matchedSeat.seatNumber} (${matchedSeat.berthType})`
            );
          } else {
            console.log(
              `ℹ️ [BullMQ:Worker] Preferred berth '${pref}' (${p.berthPreference}) unavailable for passenger '${p.name}'. Will fallback to next available sequential seat.`
            );
          }
        }
      });

      // Pass 2: Fallback allocation for passengers with NO_PREFERENCE or whose preference couldn't be fulfilled
      cnfPassengers.forEach((p, idx) => {
        if (!assignedSeatsMap.has(idx)) {
          const fallbackSeat = unassignedSeatPool.shift();
          if (fallbackSeat) {
            assignedSeatIds.add(String(fallbackSeat._id || fallbackSeat.seatNumber));
            assignedSeatsMap.set(idx, fallbackSeat);
            console.log(
              `💺 [BullMQ:Worker] Allocated fallback sequential seat to passenger '${p.name}': Coach ${fallbackSeat.coach?.coachNumber || defaultCoachPrefix} - Seat ${fallbackSeat.seatNumber} (${fallbackSeat.berthType})`
            );
          }
        }
      });

      // Mark assigned physical seats as BOOKED in MongoDB if they exist
      const realSeatIdsToUpdate = Array.from(assignedSeatIds).filter(
        (id) => physicalClassSeats.some((s) => String(s._id) === String(id))
      );
      if (realSeatIdsToUpdate.length > 0) {
        await Seat.updateMany(
          { _id: { $in: realSeatIdsToUpdate } },
          { $set: { status: 'BOOKED', booking: bookingId } }
        );
        bookedSeatIds.push(...realSeatIdsToUpdate);
      }
    }

    // Step 3: Distribute passengers across CNF, RAC, and WL tiers
    let cnfAssigned = 0;
    let racAssigned = 0;
    let wlAssigned = 0;

    const updatedPassengers = passengers.map((p, idx) => {
      let bStatus = 'CNF';
      let cStatus = 'CNF';
      let waitingNumber = null;
      let allocatedCoach = null;
      let allocatedSeatNumber = null;
      let allocatedBerth = null;

      if (cnfAssigned < cnfCount) {
        // Confirmed Passenger: Assign mapped physical berth
        bStatus = 'CNF';
        cStatus = 'CNF';
        const assignedSeat = assignedSeatsMap.get(cnfAssigned);
        allocatedCoach = assignedSeat?.coach?.coachNumber || defaultCoachPrefix;
        allocatedSeatNumber = assignedSeat ? assignedSeat.seatNumber : cnfAssigned + 1;
        allocatedBerth = assignedSeat ? assignedSeat.berthType : (normalizeBerthPreference(p.berthPreference) === 'NO_PREFERENCE' ? 'LOWER' : normalizeBerthPreference(p.berthPreference));
        cnfAssigned++;
      } else if (racAssigned < rac.count) {
        // RAC Passenger: No physical berth until chart preparation
        bStatus = 'RAC';
        cStatus = 'RAC';
        waitingNumber = (rac.start || 1) + racAssigned;
        allocatedCoach = null;
        allocatedSeatNumber = null;
        allocatedBerth = null;
        racAssigned++;
      } else {
        // Waitlist Passenger: No physical berth
        bStatus = 'WL';
        cStatus = 'WL';
        waitingNumber = (wl.start || 1) + wlAssigned;
        allocatedCoach = null;
        allocatedSeatNumber = null;
        allocatedBerth = null;
        wlAssigned++;
      }

      return {
        name: p.name,
        age: p.age,
        gender: p.gender,
        berthPreference: normalizeBerthPreference(p.berthPreference),
        bookingStatus: bStatus,
        currentStatus: cStatus,
        waitingNumber,
        allocatedCoach,
        allocatedSeatNumber,
        allocatedBerth,
      };
    });

    // Step 4: Determine overall booking status
    let overallBookingStatus = 'CONFIRMED';
    if (cnfCount === 0 && rac.count > 0) {
      overallBookingStatus = 'RAC';
    } else if (cnfCount === 0 && rac.count === 0 && wl.count > 0) {
      overallBookingStatus = 'WAITLISTED';
    }

    // Step 5: Resolve station ObjectIds and commit composite booking document to MongoDB
    const pnr = (job.data.pnr && String(job.data.pnr).trim().length === 10) ? String(job.data.pnr).trim() : generatePNR();

    let resolvedFromStation = fromStation;
    if (!mongoose.Types.ObjectId.isValid(resolvedFromStation)) {
      const code = String(fromStationCode || fromStation || 'NDLS').toUpperCase();
      const stn = await Station.findOne({ code });
      if (stn) {
        resolvedFromStation = stn._id;
      } else {
        const newStn = await Station.findOneAndUpdate(
          { code },
          { $setOnInsert: { name: code, code, city: 'Unknown', state: 'Unknown' } },
          { upsert: true, new: true }
        );
        resolvedFromStation = newStn._id;
      }
    }

    let resolvedToStation = toStation;
    if (!mongoose.Types.ObjectId.isValid(resolvedToStation)) {
      const code = String(toStationCode || toStation || 'MMCT').toUpperCase();
      const stn = await Station.findOne({ code });
      if (stn) {
        resolvedToStation = stn._id;
      } else {
        const newStn = await Station.findOneAndUpdate(
          { code },
          { $setOnInsert: { name: code, code, city: 'Unknown', state: 'Unknown' } },
          { upsert: true, new: true }
        );
        resolvedToStation = newStn._id;
      }
    }

    const resolvedUserId = mongoose.Types.ObjectId.isValid(userId)
      ? userId
      : new mongoose.Types.ObjectId('000000000000000000000001');

    const normalizedFareDetails = {
      baseFare: Number(fareDetails?.baseFare || fareDetails?.totalFare) || 1000,
      tatkalCharge: Number(fareDetails?.tatkalCharge) || 0,
      convenienceFee: Number(fareDetails?.convenienceFee) || 0,
      insurance: Number(fareDetails?.insurance) || 0,
      gst: Number(fareDetails?.gst) || 0,
      totalFare: Number(fareDetails?.totalFare || fareDetails?.baseFare) || 1000,
    };

    const booking = await Booking.create({
      _id: bookingId,
      pnr,
      user: resolvedUserId,
      train: resolvedTrainId,
      trainNumber: sanitizedTrainNumber,
      journeyDate: new Date(`${formattedDate}T00:00:00.000Z`),
      fromStation: resolvedFromStation,
      toStation: resolvedToStation,
      fromStationCode: String(fromStationCode || 'NDLS').toUpperCase(),
      toStationCode: String(toStationCode || 'MMCT').toUpperCase(),
      classType,
      quota: validQuota,
      passengers: updatedPassengers,
      fareDetails: normalizedFareDetails,
      paymentDetails: paymentDetails || {
        paymentStatus: 'SUCCESS',
        paidAt: new Date(),
      },
      bookingStatus: overallBookingStatus,
    });

    console.log(`✅ [BullMQ:Worker] Booking created successfully: PNR ${pnr}, Status: ${overallBookingStatus}`);

    // Requirement 5: The exact moment a booking is successfully saved to MongoDB,
    // automatically enqueue the prepare-chart BullMQ job for that train/date.
    try {
      const { chartPreparationQueue } = require('../queue/chartQueue');
      const chartJob = await chartPreparationQueue.add(
        'prepare-chart',
        {
          trainId: String(resolvedTrainId),
          trainNumber: sanitizedTrainNumber,
          journeyDate: formattedDate,
        },
        {
          priority: 1,
          removeOnComplete: { age: 3600, count: 1000 },
          removeOnFail: false,
        }
      );
      console.log(`🚀 [BullMQ:Worker] Automatically enqueued prepare-chart job ${chartJob.id} for Train ${sanitizedTrainNumber} on ${formattedDate}`);
    } catch (chartErr) {
      console.warn(`⚠️ [BullMQ:Worker] Non-blocking prepare-chart trigger warning:`, chartErr.message);
    }

    return {
      success: true,
      pnr: booking.pnr,
      bookingId: booking._id,
      bookingStatus: booking.bookingStatus,
      allocationSummary: {
        cnfCount,
        racCount: rac.count,
        wlCount: wl.count,
      },
      passengers: booking.passengers,
      processedAt: new Date().toISOString(),
    };
  } catch (error) {
    // Compensating Transaction: Roll back physical seats & Redis reservation on failure
    console.error(`💥 [BullMQ:Worker] Failed saving booking to MongoDB for job ${job.id}: ${error.message}. Initiating rollback...`);

    if (bookedSeatIds.length > 0) {
      try {
        await Seat.updateMany({ _id: { $in: bookedSeatIds } }, { status: 'AVAILABLE', booking: null });
        console.log(`🔄 [BullMQ:Worker] Reverted ${bookedSeatIds.length} physical seats back to AVAILABLE`);
      } catch (seatErr) {
        console.error(`❌ [BullMQ:Worker] Failed to revert physical seats: ${seatErr.message}`);
      }
    }

    // Step 3: Rollback Redis counters atomically using the EXACT same sanitized trainNumber and formattedDate
    if (reservationResult && reservationResult.status === 'SUCCESS') {
      await rollbackReservation(sanitizedTrainNumber, formattedDate, classType, validQuota, reservationResult);
    }

    throw error;
  }
}

async function startWorker() {
  try {
    await mongoose.connect(`${process.env.MONGO_URL}/${process.env.MONGO_DATABASE}`);
    console.log('✅ [Worker] Connected to MongoDB successfully.');

    const bookingWorker = new Worker(BOOKING_QUEUE_NAME, processBookingJob, {
      connection: redisConnection,
      concurrency: WORKER_CONCURRENCY,
    });

    bookingWorker.on('active', (job) => {
      console.log(`▶️ [BullMQ:Worker] Job ${job.id} started execution.`);
    });

    bookingWorker.on('completed', (job, result) => {
      console.log(`✅ [BullMQ:Worker] Job ${job.id} completed. PNR: ${result.pnr}, Status: ${result.bookingStatus}`);
    });

    bookingWorker.on('failed', (job, err) => {
      console.error(`❌ [BullMQ:Worker] Job ${job?.id} failed: ${err.message}`);
    });

    bookingWorker.on('error', (err) => {
      console.error(`⚠️ [BullMQ:Worker] Internal worker error: ${err.message}`);
    });

    return bookingWorker;
  } catch (error) {
    console.error('❌ [Worker] Failed to start worker:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  startWorker();
}

module.exports = { startWorker, processBookingJob };