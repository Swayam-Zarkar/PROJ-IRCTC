const mongoose = require('mongoose');
const { EventEmitter } = require('events');
const Booking = require('../models/booking');
const Seat = require('../models/seat');
const Coach = require('../models/coach');
const Train = require('../models/train');

const CLERKAGE_FEE = 60;
const FLAT_DEDUCTION_BY_CLASS = {
  '1A': 240, '2A': 200, '3A': 180, '3E': 180,
  SL: 120, CC: 180, EC: 240, '2S': 60,
};

// Consumers (Socket.IO, SSE, audit listeners) can subscribe without coupling
// ticket mutation to a particular realtime transport.
const pnrEvents = new EventEmitter();

function activePassengers(booking) {
  return booking.passengers.filter((passenger) => passenger.currentStatus !== 'CAN');
}

function departureFor(booking, train) {
  const origin = train.route.find((stop) => stop.stationCode === booking.fromStationCode)
    || train.route.find((stop) => stop.stopNumber === 1);
  const departure = origin?.departureTime;
  if (!departure) return new Date(booking.journeyDate);
  const date = new Date(booking.journeyDate);
  const [hours, minutes] = departure.split(':').map(Number);
  date.setUTCHours(hours, minutes, 0, 0);
  return date;
}

function calculateRefund({ booking, passengers, departureTime, cancellationTimestamp, chartPrepared }) {
  const cancellationTime = new Date(cancellationTimestamp || Date.now());
  const hoursToDeparture = (new Date(departureTime) - cancellationTime) / 3_600_000;
  const active = activePassengers(booking);
  const selected = passengers;
  const perPassengerFare = booking.fareDetails.totalFare / active.length;
  const perPassengerBaseFare = booking.fareDetails.baseFare / active.length;
  const selectedStatuses = active.map((passenger) => passenger.currentStatus);
  const hasConfirmed = selectedStatuses.includes('CNF');
  const hasNonConfirmed = selectedStatuses.some((status) => status === 'RAC' || status === 'WL');
  const pureRacOrWl = selectedStatuses.every((status) => status === 'RAC' || status === 'WL');
  const partialConfirmed = hasConfirmed && hasNonConfirmed;

  if (partialConfirmed && selected.length !== active.length) {
    throw new Error('A partially confirmed PNR must be cancelled as a complete ticket.');
  }

  if ((pureRacOrWl || partialConfirmed) && hoursToDeparture < 0.5) {
    throw new Error('RAC/WL and partially-confirmed tickets can only be cancelled until 30 minutes before departure.');
  }
  if (hasConfirmed && !partialConfirmed && (chartPrepared || hoursToDeparture < 4)) {
    throw new Error('Confirmed tickets cannot be cancelled after chart preparation or within four hours of departure.');
  }

  let deductionPerPassenger;
  if (pureRacOrWl || partialConfirmed) {
    deductionPerPassenger = CLERKAGE_FEE;
  } else if (hoursToDeparture > 48) {
    deductionPerPassenger = FLAT_DEDUCTION_BY_CLASS[booking.classType] || CLERKAGE_FEE;
  } else if (hoursToDeparture >= 12) {
    deductionPerPassenger = perPassengerBaseFare * 0.25;
  } else {
    deductionPerPassenger = perPassengerBaseFare * 0.5;
  }

  const deduction = Number((Math.min(perPassengerFare, deductionPerPassenger) * selected.length).toFixed(2));
  const refundAmount = Number(Math.max(0, (perPassengerFare * selected.length) - deduction).toFixed(2));
  return { refundAmount, deduction, hoursToDeparture };
}

function recalculatedBookingStatus(booking) {
  const active = activePassengers(booking);
  if (!active.length) return 'CANCELLED';
  if (active.every((p) => p.currentStatus === 'CNF')) return 'CONFIRMED';
  if (active.every((p) => p.currentStatus === 'WL')) return 'WAITLISTED';
  if (active.every((p) => p.currentStatus === 'RAC')) return 'RAC';
  return 'PARTIALLY_CANCELLED';
}

async function reindexQueue({ train, journeyDate, classType, status, session }) {
  const bookings = await Booking.find({ train, journeyDate, classType, 'passengers.currentStatus': status }).session(session);
  const queued = [];
  bookings.forEach((booking) => booking.passengers.forEach((passenger) => {
    if (passenger.currentStatus === status) queued.push({ booking, passenger });
  }));
  queued.sort((a, b) => (a.passenger.waitingNumber || Number.MAX_SAFE_INTEGER) - (b.passenger.waitingNumber || Number.MAX_SAFE_INTEGER));
  const changedBookings = new Set();
  queued.forEach(({ booking, passenger }, index) => {
    passenger.waitingNumber = index + 1;
    changedBookings.add(booking);
  });
  await Promise.all([...changedBookings].map((booking) => booking.save({ session })));
}

async function promoteQueue({ booking, releasedBerths, releasedRacSlots = 0, session }) {
  const scope = { train: booking.train, journeyDate: booking.journeyDate, classType: booking.classType };
  const candidates = await Booking.find({ ...scope, 'passengers.currentStatus': { $in: ['RAC', 'WL'] } }).session(session);
  const rac = [];
  const waitlist = [];
  candidates.forEach((candidate) => candidate.passengers.forEach((passenger) => {
    if (passenger.currentStatus === 'RAC') rac.push({ booking: candidate, passenger });
    if (passenger.currentStatus === 'WL') waitlist.push({ booking: candidate, passenger });
  }));
  const byPriority = (a, b) => (a.passenger.waitingNumber || Number.MAX_SAFE_INTEGER) - (b.passenger.waitingNumber || Number.MAX_SAFE_INTEGER);
  rac.sort(byPriority);
  waitlist.sort(byPriority);

  const changed = new Set();
  // A cancelled RAC passenger frees a shared RAC position even when no full
  // berth was released. Fill those positions before processing CNF berths.
  for (let slot = 0; slot < releasedRacSlots; slot += 1) {
    const wlPassenger = waitlist.shift();
    if (!wlPassenger) break;
    wlPassenger.passenger.currentStatus = 'RAC';
    changed.add(wlPassenger.booking);
  }
  for (const berth of releasedBerths) {
    const racPassenger = rac.shift();
    if (!racPassenger) break;
    const releasedRacNumber = racPassenger.passenger.waitingNumber;
    Object.assign(racPassenger.passenger, {
      currentStatus: 'CNF', waitingNumber: null,
      allocatedCoach: berth.allocatedCoach, allocatedSeatNumber: berth.allocatedSeatNumber, allocatedBerth: berth.allocatedBerth,
    });
    changed.add(racPassenger.booking);
    await Seat.updateOne({ coach: berth.coachId, seatNumber: berth.allocatedSeatNumber }, { $set: { status: 'BOOKED' } }, { session });

    const wlPassenger = waitlist.shift();
    if (wlPassenger) {
      wlPassenger.passenger.currentStatus = 'RAC';
      wlPassenger.passenger.waitingNumber = releasedRacNumber || 1;
      changed.add(wlPassenger.booking);
    }
  }
  for (const changedBooking of changed) {
    changedBooking.bookingStatus = recalculatedBookingStatus(changedBooking);
    await changedBooking.save({ session });
  }
  await reindexQueue({ ...scope, status: 'RAC', session });
  await reindexQueue({ ...scope, status: 'WL', session });
}

/**
 * All reads and writes take place in a Mongo snapshot transaction. Mongo's
 * transaction retries make conflicting cancellation/chart transitions fail and
 * retry as one unit, preventing the same berth from being promoted twice.
 */
async function cancelTicket({ ticketId, passengerIds, cancellationTimestamp, userId }) {
  const session = await mongoose.startSession();
  let result;
  const cleanTicketId = String(ticketId || '').trim();
  const lookupQuery = /^[0-9a-fA-F]{24}$/.test(cleanTicketId)
    ? { $or: [{ pnr: cleanTicketId }, { _id: cleanTicketId }] }
    : { pnr: cleanTicketId };

  try {
    await session.withTransaction(async () => {
      const booking = await Booking.findOne(lookupQuery).session(session);
      if (!booking) throw new Error('Ticket not found.');
      const isGuestBooking = String(booking.user) === '000000000000000000000001';
      if (userId && !isGuestBooking && String(booking.user) !== String(userId)) {
        throw new Error('You cannot cancel this ticket.');
      }
      const train = await Train.findById(booking.train).session(session);
      if (!train) throw new Error('Train not found.');
      const active = activePassengers(booking);
      let selected = passengerIds?.length
        ? active.filter((passenger) =>
            passengerIds.map(String).includes(String(passenger._id)) ||
            passengerIds.map(String).includes(String(passenger.id)) ||
            passengerIds.map(String).includes(String(passenger.name))
          )
        : active;
      if (!selected.length && passengerIds?.length >= active.length) {
        selected = active;
      }
      if (!selected.length) throw new Error('No active passengers were selected for cancellation.');
      const departureTime = departureFor(booking, train);
      const refund = calculateRefund({ booking, passengers: selected, departureTime, cancellationTimestamp, chartPrepared: train.chartPrepared });
      const releasedBerths = [];
      let releasedRacSlots = 0;
      for (const passenger of selected) {
        if (passenger.currentStatus === 'CNF' && passenger.allocatedSeatNumber) {
          const coach = await Coach.findOne({ train: booking.train, coachNumber: passenger.allocatedCoach }).session(session);
          const seat = coach && await Seat.findOne({ coach: coach._id, seatNumber: passenger.allocatedSeatNumber }).session(session);
          if (seat) {
            releasedBerths.push({ allocatedCoach: passenger.allocatedCoach, allocatedSeatNumber: passenger.allocatedSeatNumber, allocatedBerth: passenger.allocatedBerth, coachId: seat.coach });
            seat.status = 'AVAILABLE';
            await seat.save({ session });
          }
        }
        if (passenger.currentStatus === 'RAC') releasedRacSlots += 1;
        passenger.currentStatus = 'CAN';
        passenger.waitingNumber = null;
      }
      booking.bookingStatus = recalculatedBookingStatus(booking);
      await booking.save({ session });
      if (releasedBerths.length || releasedRacSlots) await promoteQueue({ booking, releasedBerths, releasedRacSlots, session });
      await reindexQueue({ train: booking.train, journeyDate: booking.journeyDate, classType: booking.classType, status: 'RAC', session });
      await reindexQueue({ train: booking.train, journeyDate: booking.journeyDate, classType: booking.classType, status: 'WL', session });
      result = {
        pnr: booking.pnr,
        bookingStatus: booking.bookingStatus,
        passengers: booking.passengers,
        cancelledPassengerIds: selected.map((p) => String(p._id)),
        departureTime,
        ...refund,
      };
    }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
  } finally {
    await session.endSession();
  }
  pnrEvents.emit('pnr:updated', result);
  return result;
}

module.exports = { CLERKAGE_FEE, calculateRefund, cancelTicket, pnrEvents, departureFor, reindexQueue, recalculatedBookingStatus };
