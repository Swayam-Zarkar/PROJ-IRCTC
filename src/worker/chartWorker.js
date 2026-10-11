require('dotenv').config({ path: '../../.env' });
const mongoose = require('mongoose');
const { Worker } = require('bullmq');
const { redisConfig, redisConnection } = require('../config/redisClient');
const { CHART_QUEUE_NAME } = require('../queue/chartQueue');
const { getInventoryKey } = require('../services/inventoryService');
const { CLERKAGE_FEE, recalculatedBookingStatus, reindexQueue, pnrEvents } = require('../services/cancellationService');
const { enqueueRefundJob } = require('../queue/refundQueue');
const Booking = require('../models/booking');
const Seat = require('../models/seat');
const Train = require('../models/train');

const QUOTA_POOLS = ['TQ', 'LD', 'SS', 'HP'];
// A new script is kept local to charting; the booking reservation Lua script is
// intentionally untouched. One Redis script execution makes pool release atomic.
const REALLOCATE_QUOTAS_LUA = `
  local released = 0
  for i = 2, #KEYS do
    local available = tonumber(redis.call('HGET', KEYS[i], 'available_seats') or '0')
    released = released + available
    redis.call('HSET', KEYS[i], 'available_seats', 0)
  end
  if released > 0 then redis.call('HINCRBY', KEYS[1], 'available_seats', released) end
  return released
`;

async function releaseQuotaInventory({ trainNumber, journeyDate, classType }) {
  const keys = [getInventoryKey(trainNumber, journeyDate, classType, 'GN'), ...QUOTA_POOLS.map((quota) => getInventoryKey(trainNumber, journeyDate, classType, quota))];
  return Number(await redisConnection.eval(REALLOCATE_QUOTAS_LUA, keys.length, ...keys));
}

async function prepareChart(job) {
  const { trainId, trainNumber, journeyDate } = job.data;
  const session = await mongoose.startSession();
  const autoRefunds = [];
  try {
    await session.withTransaction(async () => {
      const train = await Train.findById(trainId).session(session);
      if (!train) throw new Error('Train not found for chart preparation.');
      const classes = train.availableClasses || [];
      for (const classType of classes) await releaseQuotaInventory({ trainNumber: trainNumber || train.trainNumber, journeyDate, classType });

      for (const classType of classes) {
        const scope = { train: train._id, journeyDate: new Date(journeyDate), classType };
        const bookings = await Booking.find({ ...scope, 'passengers.currentStatus': { $in: ['RAC', 'WL'] } }).session(session);
        const rac = [];
        const wl = [];
        bookings.forEach((booking) => booking.passengers.forEach((passenger) => {
          if (passenger.currentStatus === 'RAC') rac.push({ booking, passenger });
          if (passenger.currentStatus === 'WL') wl.push({ booking, passenger });
        }));
        const priority = (a, b) => (a.passenger.waitingNumber || Number.MAX_SAFE_INTEGER) - (b.passenger.waitingNumber || Number.MAX_SAFE_INTEGER);
        rac.sort(priority); wl.sort(priority);
        const availableSeats = await Seat.find({ train: train._id, coachType: classType, status: 'AVAILABLE' }).sort({ seatNumber: 1 }).session(session);
        const changed = new Set();
        for (const seat of availableSeats) {
          const nextRac = rac.shift();
          if (!nextRac) break;
          nextRac.passenger.currentStatus = 'CNF';
          nextRac.passenger.waitingNumber = null;
          nextRac.passenger.allocatedSeatNumber = seat.seatNumber;
          nextRac.passenger.allocatedBerth = seat.berthType;
          const coach = await seat.populate('coach');
          nextRac.passenger.allocatedCoach = coach.coach.coachNumber;
          seat.status = 'BOOKED';
          await seat.save({ session });
          changed.add(nextRac.booking);
          const nextWl = wl.shift();
          if (nextWl) { nextWl.passenger.currentStatus = 'RAC'; changed.add(nextWl.booking); }
        }
        for (const booking of changed) { booking.bookingStatus = recalculatedBookingStatus(booking); await booking.save({ session }); }
        await reindexQueue({ ...scope, status: 'RAC', session });
        await reindexQueue({ ...scope, status: 'WL', session });

        const waitlisted = await Booking.find({ ...scope, bookingStatus: 'WAITLISTED' }).session(session);
        for (const booking of waitlisted) {
          const active = booking.passengers.filter((p) => p.currentStatus === 'WL');
          if (active.length !== booking.passengers.filter((p) => p.currentStatus !== 'CAN').length) continue;
          active.forEach((passenger) => { passenger.currentStatus = 'CAN'; passenger.waitingNumber = null; });
          booking.bookingStatus = 'CANCELLED';
          await booking.save({ session });
          autoRefunds.push({ bookingId: String(booking._id), pnr: booking.pnr, userId: String(booking.user), trainId: String(train._id), paymentId: booking.paymentDetails.transactionId, amount: Math.max(0, booking.fareDetails.totalFare - active.length * CLERKAGE_FEE), reason: 'CHART_PREPARATION_WAITLIST_AUTO_REFUND' });
        }
      }
      train.chartPrepared = true;
      await train.save({ session });

      const dateStr = String(journeyDate).split('T')[0];
      await Booking.updateMany(
        {
          train: train._id,
          journeyDate: {
            $gte: new Date(`${dateStr}T00:00:00.000Z`),
            $lte: new Date(`${dateStr}T23:59:59.999Z`),
          },
        },
        { $set: { chartStatus: 'CHART PREPARED' } },
        { session }
      );
    }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
  } finally { await session.endSession(); }
  await Promise.all(autoRefunds.map((refund) => enqueueRefundJob(refund)));
  pnrEvents.emit('chart:prepared', { trainId, journeyDate, autoRefundCount: autoRefunds.length });
  return { trainId, journeyDate, autoRefundCount: autoRefunds.length };
}

async function startChartWorker() {
  await mongoose.connect(`${process.env.MONGO_URL}/${process.env.MONGO_DATABASE}`);
  return new Worker(CHART_QUEUE_NAME, prepareChart, { connection: redisConfig, concurrency: Number(process.env.CHART_WORKER_CONCURRENCY) || 2 });
}

if (require.main === module) startChartWorker().catch((error) => { console.error('[ChartWorker]', error); process.exit(1); });
module.exports = { prepareChart, startChartWorker, releaseQuotaInventory };
