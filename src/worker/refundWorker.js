require('dotenv').config({ path: '../../.env' });
const { Worker } = require('bullmq');
const mongoose = require('mongoose');
const { redisConfig } = require('../config/redisClient');
const { REFUND_QUEUE_NAME } = require('../queue/refundQueue');
const Booking = require('../models/booking');

const REFUND_WORKER_CONCURRENCY = Number(process.env.REFUND_WORKER_CONCURRENCY) || 5;

/**
 * Placeholder function for the Payment Gateway's Refund API (e.g., Razorpay / Stripe / IRCTC iPay).
 * In production, replace this with the actual SDK/HTTP call to the gateway.
 *
 * @param {Object} params
 * @param {string} params.paymentId - Gateway transaction/payment ID
 * @param {number} params.amount - Amount to refund
 * @param {string} params.reason - Reason for auto-refund
 * @returns {Promise<Object>} Gateway refund response
 */
async function callPaymentGatewayRefundAPI({ paymentId, amount, reason }) {
  console.log(`🔄 [PaymentGateway] Initiating refund for Payment ID: ${paymentId}, Amount: ₹${amount}`);

  // Simulate network latency to external payment provider
  await new Promise((resolve) => setTimeout(resolve, 300));

  // Simulated successful gateway response
  return {
    success: true,
    refundId: `rfnd_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    paymentId,
    amount,
    reason,
    status: 'PROCESSED',
    processedAt: new Date().toISOString(),
  };
}

/**
 * BullMQ Worker processor for handling expired-lock auto-refund jobs
 * @param {import('bullmq').Job} job
 */
async function processRefundJob(job) {
  const {
    bookingId,
    pnr,
    userId,
    trainId,
    paymentId,
    amount,
    reason = 'EXPIRED_HOLD_LOCK_LATE_PAYMENT',
  } = job.data;

  console.log(
    `⚙️ [BullMQ:RefundWorker] Processing refund job ${job.id} (Attempt ${job.attemptsMade + 1}/${job.opts.attempts}) | PaymentId: ${paymentId} | User: ${userId}`
  );

  // Step 1: Execute the refund against the external Payment Gateway API
  // If this throws or fails, BullMQ will automatically catch it and retry with exponential backoff.
  const gatewayRefund = await callPaymentGatewayRefundAPI({
    paymentId,
    amount,
    reason,
  });

  if (!gatewayRefund || !gatewayRefund.success) {
    throw new Error(`GATEWAY_REFUND_FAILED: Failed to refund payment ${paymentId}`);
  }

  // Step 2: Update the Booking record in MongoDB to reflect the FAILED booking and REFUNDED payment status
  const filter = bookingId ? { _id: bookingId } : pnr ? { pnr } : { 'paymentDetails.transactionId': paymentId };

  const updatedBooking = await Booking.findOneAndUpdate(
    filter,
    {
      $set: {
        bookingStatus: 'FAILED',
        'paymentDetails.paymentStatus': 'REFUNDED',
        'paymentDetails.transactionId': paymentId,
      },
    },
    { new: true }
  );

  return {
    success: true,
    refundId: gatewayRefund.refundId,
    paymentId,
    bookingId: updatedBooking?._id || bookingId || null,
    status: 'REFUNDED',
    processedAt: gatewayRefund.processedAt,
  };
}

/**
 * Starts the BullMQ Refund Worker
 */
async function startRefundWorker() {
  try {
    if (mongoose.connection.readyState === 0 && process.env.MONGO_URL) {
      await mongoose.connect(`${process.env.MONGO_URL}/${process.env.MONGO_DATABASE}`);
      console.log('✅ [RefundWorker] Connected to MongoDB successfully.');
    }

    const refundWorker = new Worker(REFUND_QUEUE_NAME, processRefundJob, {
      connection: redisConfig,
      concurrency: REFUND_WORKER_CONCURRENCY,
    });

    refundWorker.on('active', (job) => {
      console.log(`▶️ [BullMQ:RefundWorker] Job ${job.id} started.`);
    });

    refundWorker.on('completed', (job, result) => {
      console.log(`✅ [BullMQ:RefundWorker] Job ${job.id} completed. Refund ID: ${result.refundId}`);
    });

    refundWorker.on('failed', (job, err) => {
      console.error(
        `❌ [BullMQ:RefundWorker] Job ${job?.id} failed (Attempt ${job?.attemptsMade}/${job?.opts?.attempts}): ${err.message}`
      );
    });

    refundWorker.on('error', (err) => {
      console.error(`⚠️ [BullMQ:RefundWorker] Worker error: ${err.message}`);
    });

    return refundWorker;
  } catch (error) {
    console.error('❌ [RefundWorker] Failed to initialize refund worker:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  startRefundWorker();
}

module.exports = {
  startRefundWorker,
  processRefundJob,
  callPaymentGatewayRefundAPI,
};
