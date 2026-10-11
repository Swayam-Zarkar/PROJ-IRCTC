const mongoose = require('mongoose');
const Train = require('../models/train');
const Coach = require('../models/coach');
const Seat = require('../models/seat');
const Booking = require('../models/booking');
const { normalizeDateString } = require('../utils/keyGenerator');

const BERTH_SHORT_LABELS = {
  LOWER: 'LB',
  MIDDLE: 'MB',
  UPPER: 'UB',
  CABIN: 'CB',
  COUPE: 'CP',
  WINDOW: 'WN',
  MIDDLE_SEAT: 'MS',
  AISLE: 'AS',
  SIDE_LOWER: 'SL',
  SIDE_UPPER: 'SU',
};

const BERTH_LAYOUT_ORDER = [
  'LOWER',
  'MIDDLE',
  'UPPER',
  'CABIN',
  'COUPE',
  'WINDOW',
  'MIDDLE_SEAT',
  'AISLE',
  'SIDE_LOWER',
  'SIDE_UPPER',
];

/**
 * Standard synthetic coach generator when MongoDB doesn't have pre-seeded physical seats
 */
function generateSyntheticCoachSeats(
  coachNumber,
  coachType,
  bookedSeatNumbers = new Set(),
  racSeatNumbers = new Set(),
  routeStops = [],
  tatkalSeatNumbers = new Set(),
  wlSeatNumbers = new Set()
) {
  const seats = [];

  // Generate 100 seats in 10 rows for visual grid
  BERTH_LAYOUT_ORDER.forEach((berthType, typeIndex) => {
    for (let rowIndex = 0; rowIndex < 10; rowIndex++) {
      const seatNumber = typeIndex * 10 + rowIndex + 1;
      let status = 'AVAILABLE';
      if (tatkalSeatNumbers.has(seatNumber)) {
        status = 'TQ';
      } else if (bookedSeatNumbers.has(seatNumber)) {
        status = 'BOOKED';
      } else if (racSeatNumbers.has(seatNumber)) {
        status = 'RAC';
      } else if (wlSeatNumbers.has(seatNumber)) {
        status = 'WL';
      }

      // Generate route legs for TimelineDrawer
      const journeyLegs = routeStops.length >= 2
        ? routeStops.slice(0, -1).map((stop, i) => ({
            from: stop.stationCode || `Station ${i + 1}`,
            to: routeStops[i + 1].stationCode || `Station ${i + 2}`,
            status,
          }))
        : [
            { from: 'Origin', to: 'Midway', status },
            { from: 'Midway', to: 'Destination', status },
          ];

      seats.push({
        _id: `${coachNumber}-${seatNumber}`,
        coachNumber,
        coachType,
        seatNumber,
        berthType,
        status,
        shortLabel: BERTH_SHORT_LABELS[berthType] || 'SEAT',
        journeyLegs,
      });
    }
  });

  return seats;
}

/**
 * Bidirectional Coach Alias Resolver
 * Maps between class-based coach designations (e.g. '3A1', '2A1', 'EC1') and
 * standard Indian Railways prefix letters (e.g. 'B1', 'A1', 'E1').
 */
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

/**
 * @desc    Fetch real-time seat map and booking overlay for a specific train, date, and coach
 * @route   GET /api/inventory/seats
 * @access  Public
 */
async function getCoachSeats(req, res) {
  try {
    const { train: trainParam, date: dateParam, coach: coachParam } = req.query;

    if (!trainParam || !String(trainParam).trim()) {
      return res.status(400).json({
        success: false,
        message: 'train query parameter is required (trainNumber or trainId).',
      });
    }

    const cleanTrain = String(trainParam).trim();
    const journeyDateStr = normalizeDateString(dateParam);
    const [y, m, d] = journeyDateStr.split('-').map(Number);
    // Expand window by 12 hours on both sides to safely absorb any UTC / IST timezone serialization offset
    const dateStart = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0) - 12 * 3600 * 1000);
    const dateEnd = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999) + 12 * 3600 * 1000);

    // 1. Explicitly resolve Train document from MongoDB
    let trainDoc = null;
    if (mongoose.Types.ObjectId.isValid(cleanTrain)) {
      trainDoc = await Train.findById(cleanTrain).lean();
    }
    if (!trainDoc) {
      trainDoc = await Train.findOne({ trainNumber: cleanTrain }).lean();
    }

    if (!trainDoc) {
      return res.status(404).json({
        success: false,
        message: `Train not found with identifier: "${cleanTrain}". Please provide a valid trainNumber or trainId.`,
      });
    }

    // 2. Resolve available coaches strictly for this train
    let availableCoaches = await Coach.find({ train: trainDoc._id, isActive: true })
      .select('coachNumber coachType totalSeats')
      .lean();

    // Fallback coach list derived from train's available classes if not yet populated in DB
    if (!availableCoaches || availableCoaches.length === 0) {
      const trainClasses = trainDoc.availableClasses || ['3A', '2A', 'SL'];
      const defaultPrefixes = { '1A': 'H', '2A': 'A', '3A': 'B', 'SL': 'S', 'CC': 'C', 'EC': 'E', '3E': 'M' };
      availableCoaches = trainClasses.map(cls => ({
        coachNumber: `${defaultPrefixes[cls] || 'B'}1`,
        coachType: cls,
        totalSeats: cls === '2A' ? 54 : 72,
      }));
    }

    // Resolve target coach using bidirectional aliases
    const targetCoachParam = String(coachParam || availableCoaches[0]?.coachNumber || 'B1').trim().toUpperCase();
    const initialAliases = getCoachAliases(targetCoachParam);

    const currentCoachMeta =
      availableCoaches.find((c) => initialAliases.includes(String(c.coachNumber).toUpperCase())) ||
      availableCoaches[0];

    const selectedCoachNumber = currentCoachMeta?.coachNumber || targetCoachParam;
    const allQueryCoachAliases = Array.from(new Set([...initialAliases, ...getCoachAliases(selectedCoachNumber)]));

    // 3. Perform HGETALL on the GN and TQ keys (Completely remove MongoDB Booking queries for seat counting)
    const { redisConnection } = require('../config/redisClient');
    const { getInventoryKey } = require('../utils/keyGenerator');

    const gnKey = getInventoryKey(cleanTrain, journeyDateStr, currentCoachMeta.coachType, 'GN');
    const tqKey = getInventoryKey(cleanTrain, journeyDateStr, currentCoachMeta.coachType, 'TQ');

    const [gnHash, tqHash] = await Promise.all([
      redisConnection.hgetall(gnKey).catch(() => ({})),
      redisConnection.hgetall(tqKey).catch(() => ({})),
    ]);

    // Parse exact nested fields with fallback defaults
    const gn_available = gnHash && gnHash.gn_available !== undefined ? Number(gnHash.gn_available) : 60;
    const gn_total = gnHash && gnHash.gn_total !== undefined ? Number(gnHash.gn_total) : 60;

    const ld_available = gnHash && gnHash.ld_available !== undefined ? Number(gnHash.ld_available) : 10;
    const ld_total = gnHash && gnHash.ld_total !== undefined ? Number(gnHash.ld_total) : 10;

    const hp_available = gnHash && gnHash.hp_available !== undefined ? Number(gnHash.hp_available) : 5;
    const hp_total = gnHash && gnHash.hp_total !== undefined ? Number(gnHash.hp_total) : 5;

    const ss_available = gnHash && gnHash.ss_available !== undefined ? Number(gnHash.ss_available) : 5;
    const ss_total = gnHash && gnHash.ss_total !== undefined ? Number(gnHash.ss_total) : 5;

    const wl_available = gnHash && gnHash.wl_available !== undefined ? Number(gnHash.wl_available) : 70;
    const wl_total = gnHash && gnHash.wl_total !== undefined ? Number(gnHash.wl_total) : 70;

    const rac_available = gnHash && gnHash.rac_available !== undefined ? Number(gnHash.rac_available) : 25;
    const rac_total = gnHash && gnHash.rac_total !== undefined ? Number(gnHash.rac_total) : 25;

    const tq_available = tqHash && tqHash.tq_available !== undefined ? Number(tqHash.tq_available) : 10;
    const tq_total = tqHash && tqHash.tq_total !== undefined ? Number(tqHash.tq_total) : 10;

    const pt_available = tqHash && tqHash.pt_available !== undefined ? Number(tqHash.pt_available) : 10;
    const pt_total = tqHash && tqHash.pt_total !== undefined ? Number(tqHash.pt_total) : 10;

    // Total confirmed physical capacity = 100
    const totalPhysicalSeats = gn_total + ld_total + hp_total + ss_total + tq_total + pt_total;
    const totalLiveAvailable = gn_available + ld_available + hp_available + ss_available + tq_available + pt_available;
    const totalLiveBooked = Math.max(0, totalPhysicalSeats - totalLiveAvailable);
    const racBookedCount = Math.max(0, rac_total - rac_available);
    const wlBookedCount = Math.max(0, wl_total - wl_available);

    const quotas = {
      GN: {
        name: 'General',
        available: gn_available,
        total: gn_total,
        max: gn_total,
      },
      LD: {
        name: 'Ladies',
        available: ld_available,
        total: ld_total,
        max: ld_total,
      },
      HP: {
        name: 'Divyangjan',
        available: hp_available,
        total: hp_total,
        max: hp_total,
      },
      SS: {
        name: 'Senior Citizen',
        available: ss_available,
        total: ss_total,
        max: ss_total,
      },
      TQ: {
        name: 'Tatkal',
        available: tq_available,
        total: tq_total,
        max: tq_total,
      },
      PT: {
        name: 'Premium Tatkal',
        available: pt_available,
        total: pt_total,
        max: pt_total,
      },
      RAC: {
        name: 'RAC',
        available: rac_available,
        total: rac_total,
        max: rac_total,
        booked: racBookedCount,
      },
      WL: {
        name: 'Waitlist',
        available: wl_available,
        total: wl_total,
        max: wl_total,
        booked: wlBookedCount,
      },
    };

    // 4. Query physical Seat documents if they exist for this coach or its aliases
    let physicalSeats = [];
    if (trainDoc) {
      const coachDoc = await Coach.findOne({
        train: trainDoc._id,
        coachNumber: { $in: allQueryCoachAliases },
      }).lean();
      if (coachDoc) {
        physicalSeats = await Seat.find({ coach: coachDoc._id, train: trainDoc._id }).sort({ seatNumber: 1 }).lean();
      }
    }

    // Query active confirmed bookings for this train strictly on this journeyDate (fixes Date Bleed bug)
    const [yDate, mDate, dDate] = journeyDateStr.split('-').map(Number);
    const dateQueryStart = new Date(Date.UTC(yDate, mDate - 1, dDate - 1, 12, 0, 0, 0));
    const dateQueryEnd = new Date(Date.UTC(yDate, mDate - 1, dDate + 1, 12, 0, 0, 0));

    const bookingsOnTrain = await Booking.find({
      train: trainDoc._id,
      journeyDate: { $gte: dateQueryStart, $lte: dateQueryEnd },
      bookingStatus: { $ne: 'CANCELLED' },
    }).lean();

    // Strictly filter by matching normalized journeyDateStr
    const exactDayBookings = bookingsOnTrain.filter(
      (b) => normalizeDateString(b.journeyDate) === journeyDateStr
    );

    // Map confirmed seat occupancy for this coach on this exact journeyDate
    const occupiedSeatInfoMap = new Map(); // seatNumber -> { isBooked: true, status: 'BOOKED'|'TQ'|'PT', quota: b.quota, ... }

    exactDayBookings.forEach((b) => {
      (b.passengers || []).forEach((p) => {
        if (p.currentStatus === 'CNF' || p.bookingStatus === 'CNF') {
          const pCoach = String(p.allocatedCoach || '').toUpperCase();
          if (allQueryCoachAliases.includes(pCoach)) {
            const sNum = Number(p.allocatedSeatNumber);
            if (sNum && sNum > 0) {
              const status = b.quota === 'TQ' ? 'TQ' : b.quota === 'PT' ? 'PT' : 'BOOKED';
              occupiedSeatInfoMap.set(sNum, {
                isBooked: true,
                status,
                quota: b.quota || 'GN',
                passengerName: p.name,
                allocatedBerth: p.allocatedBerth,
              });
            }
          }
        }
      });
    });

    let finalSeats = [];
    const routeStops = trainDoc?.route || [];

    if (physicalSeats.length > 0) {
      finalSeats = physicalSeats.map((seat) => {
        const bookedInfo = occupiedSeatInfoMap.get(seat.seatNumber);
        const isBooked = !!bookedInfo;
        const status = bookedInfo ? bookedInfo.status : 'AVAILABLE';

        const journeyLegs = routeStops.length >= 2
          ? routeStops.slice(0, -1).map((stop, i) => ({
              from: stop.stationCode || `Station ${i + 1}`,
              to: routeStops[i + 1].stationCode || `Station ${i + 2}`,
              status,
            }))
          : [
              { from: 'Origin', to: 'Midway', status },
              { from: 'Midway', to: 'Destination', status },
            ];

        return {
          _id: seat._id,
          coachNumber: selectedCoachNumber,
          coachType: currentCoachMeta.coachType,
          seatNumber: seat.seatNumber,
          berthType: seat.berthType,
          status,
          isBooked,
          shortLabel: BERTH_SHORT_LABELS[seat.berthType] || 'SEAT',
          journeyLegs,
        };
      });
    } else {
      // Use synthetic layout generator based on active bookings for this date and Redis live counts
      const bookedSeatNumbers = new Set();
      const tatkalSeatNumbers = new Set();

      occupiedSeatInfoMap.forEach((info, seatNum) => {
        if (info.status === 'TQ' || info.status === 'PT') {
          tatkalSeatNumbers.add(seatNum);
        } else {
          bookedSeatNumbers.add(seatNum);
        }
      });

      // If Redis indicates additional booked seats beyond MongoDB records (e.g. concurrent in-flight bookings)
      const tqLiveBooked = (tq_total - tq_available) + (pt_total - pt_available);
      let tqFill = 1;
      while (tatkalSeatNumbers.size < tqLiveBooked && tqFill <= totalPhysicalSeats) {
        if (!bookedSeatNumbers.has(tqFill)) {
          tatkalSeatNumbers.add(tqFill);
        }
        tqFill++;
      }

      let gnFill = tqLiveBooked + 1;
      while (bookedSeatNumbers.size + tatkalSeatNumbers.size < totalLiveBooked && gnFill <= totalPhysicalSeats) {
        if (!tatkalSeatNumbers.has(gnFill)) {
          bookedSeatNumbers.add(gnFill);
        }
        gnFill++;
      }

      finalSeats = generateSyntheticCoachSeats(
        selectedCoachNumber,
        currentCoachMeta.coachType,
        bookedSeatNumbers,
        new Set(),
        routeStops,
        tatkalSeatNumbers,
        new Set()
      ).map((s) => ({
        ...s,
        isBooked: s.status === 'BOOKED' || s.status === 'TQ' || s.status === 'PT',
      }));
    }

    // Disable caching so client always gets fresh real-time numbers
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    return res.status(200).json({
      success: true,
      trainNumber: trainDoc?.trainNumber || trainParam,
      trainName: trainDoc?.trainName || `Express ${trainParam}`,
      journeyDate: journeyDateStr,
      selectedCoach: selectedCoachNumber,
      coachType: currentCoachMeta.coachType,
      availableCoaches: availableCoaches.map((c) => ({
        coachNumber: c.coachNumber,
        coachType: c.coachType,
      })),
      totalSeats: totalPhysicalSeats,
      bookedCount: totalLiveBooked,
      racCount: racBookedCount,
      wlCount: wlBookedCount,
      availableCount: totalLiveAvailable,
      quotas,
      seats: finalSeats,
    });
  } catch (error) {
    console.error('❌ [InventoryController:getCoachSeats] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve coach seat layout.',
      error: error.message,
    });
  }
}

module.exports = {
  getCoachSeats,
};

