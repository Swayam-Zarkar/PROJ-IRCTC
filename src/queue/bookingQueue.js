const { Queue, QueueEvents } = require('bullmq');
const { redisConfig, redisConnection } = require('../config/redisClient');

const BOOKING_QUEUE_NAME = 'booking-queue';

// BullMQ Queue instance
const bookingQueue = new Queue(BOOKING_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3, // Auto-retry up to 3 times on transient failure
    backoff: {
      type: 'exponential',
      delay: 1500, // 1.5s, 3s, 6s...
    },
    removeOnComplete: {
      count: 2000, // Retain last 2000 completed jobs
      age: 24 * 3600, // Retain for 24 hours
    },
    removeOnFail: {
      count: 5000, // Retain failed jobs for dead-letter analysis
    },
  },
});

// Event listener for queue monitoring
const bookingQueueEvents = new QueueEvents(BOOKING_QUEUE_NAME, {
  connection: redisConfig,
});

bookingQueueEvents.on('waiting', ({ jobId }) => {
  console.log(`📥 [BullMQ:Queue] Job ${jobId} queued in ${BOOKING_QUEUE_NAME}`);
});

/**
 * Adds a new booking request to the queue
 * @param {Object} bookingData - Booking payload
 */
async function addBookingJob(bookingData) {
  // Tatkal ('TQ') gets higher execution priority (lower number = higher priority in BullMQ)
  const priority = bookingData.quota === 'TQ' ? 1 : 5;

  const job = await bookingQueue.add('process-booking', bookingData, {
    priority,
  });

  return job;
}

module.exports = {
  bookingQueue,
  bookingQueueEvents,
  addBookingJob,
  BOOKING_QUEUE_NAME,
};

