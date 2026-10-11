const { Queue, QueueEvents } = require('bullmq');
const { redisConfig, redisConnection } = require('../config/redisClient');

const REFUND_QUEUE_NAME = 'refundQueue';

/**
 * BullMQ Queue for processing automated refunds when a payment succeeds
 * AFTER the 10-minute Redis seat hold lock has already expired.
 */
const refundQueue = new Queue(REFUND_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 5, // Retry up to 5 times if the payment gateway API is temporarily unreachable
    backoff: {
      type: 'exponential',
      delay: 2000, // 2s -> 4s -> 8s -> 16s -> 32s
    },
    removeOnComplete: {
      count: 1000,
      age: 24 * 3600, // Keep completed refund logs for 24 hours
    },
    removeOnFail: {
      count: 5000, // Keep failed refund jobs for manual reconciliation / DLQ inspection
    },
  },
});

const refundQueueEvents = new QueueEvents(REFUND_QUEUE_NAME, {
  connection: redisConfig,
});

refundQueueEvents.on('waiting', ({ jobId }) => {
  console.log(`💸 [BullMQ:RefundQueue] Refund job ${jobId} queued in ${REFUND_QUEUE_NAME}`);
});

/**
 * Helper to enqueue an auto-refund job with idempotency via jobId
 * @param {Object} refundPayload
 */
async function enqueueRefundJob(refundPayload) {
  const { paymentId } = refundPayload;

  // Use paymentId as deterministic jobId so duplicate webhook deliveries don't trigger double refunds
  return await refundQueue.add('process-auto-refund', refundPayload, {
    jobId: paymentId ? `refund-${paymentId}` : undefined,
  });
}

module.exports = {
  refundQueue,
  refundQueueEvents,
  enqueueRefundJob,
  REFUND_QUEUE_NAME,
};
