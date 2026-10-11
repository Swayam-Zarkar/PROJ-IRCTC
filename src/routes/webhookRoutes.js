const express = require('express');
const router = express.Router();
const { redisConnection } = require('../config/redisClient');
const Booking = require('../models/booking');
const { enqueueRefundJob } = require('../queue/refundQueue');

/**
 * POST /api/webhooks/payment
 *
 * Payment Gateway Webhook Reconciliation Route:
 * Reconciles asynchronous payment success callbacks against the 10-minute Redis seat hold lock.
 */
router.post('/payment', async (req, res) => {
  try {
    const {
      paymentStatus,
      paymentId,
      bookingId,
      pnr,
      trainId,
      userId,
      amount,
    } = req.body;

    // 1. Validate required webhook payload fields
    if (!trainId || !userId || !paymentId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required webhook fields: trainId, userId, and paymentId are mandatory.',
      });
    }

    // Ignore non-successful payment events (or handle failed payments separately)
    if (paymentStatus && paymentStatus !== 'SUCCESS') {
      return res.status(200).json({
        success: true,
        message: `Webhook acknowledged for non-success status: ${paymentStatus}`,
      });
    }

    // 2. Construct the exact Redis temporary hold lock key created during seat inventory hold
    const lockKey = `seat:${trainId}:lock:${userId}`;

    // 3. Check Redis to see if the user's 10-minute hold lock still exists
    const lockExists = await redisConnection.exists(lockKey);

    // =========================================================================
    // CASE A: LOCK EXISTS (Payment arrived within the 10-minute TTL window)
    // =========================================================================
    if (lockExists === 1) {
      // Confirm the booking in MongoDB
      const query = bookingId ? { _id: bookingId } : pnr ? { pnr } : { user: userId, train: trainId, 'paymentDetails.paymentStatus': 'PENDING' };

      const confirmedBooking = await Booking.findOneAndUpdate(
        query,
        {
          $set: {
            bookingStatus: 'CONFIRMED',
            'paymentDetails.paymentStatus': 'SUCCESS',
            'paymentDetails.transactionId': paymentId,
            'paymentDetails.paidAt': new Date(),
          },
        },
        { new: true }
      );

      // Delete the temporary hold lock from Redis now that the booking is permanently persisted
      await redisConnection.del(lockKey);

      console.log(`✅ [Webhook:Payment] Lock found (${lockKey}). Booking confirmed & lock deleted for User: ${userId}`);

      return res.status(200).json({
        success: true,
        status: 'BOOKING_CONFIRMED',
        message: 'Payment reconciled on time. Booking confirmed and hold lock cleared.',
        bookingId: confirmedBooking?._id || bookingId || null,
        pnr: confirmedBooking?.pnr || pnr || null,
      });
    }

    // =========================================================================
    // CASE B: LOCK IS MISSING (Payment arrived late; TTL expired & seat released)
    // =========================================================================
    console.warn(
      `⚠️ [Webhook:Payment] Lock expired/missing (${lockKey}) for Payment: ${paymentId}. Enqueueing auto-refund.`
    );

    // Immediately push a job to BullMQ refundQueue to refund the user
    const refundJob = await enqueueRefundJob({
      bookingId,
      pnr,
      userId,
      trainId,
      paymentId,
      amount,
      reason: 'Hold lock expired before payment webhook arrival',
      failedAt: new Date().toISOString(),
    });

    // Always return 200 OK to the payment gateway so it does not infinitely retry the webhook
    return res.status(200).json({
      success: true,
      status: 'LOCK_EXPIRED_REFUND_QUEUED',
      message: 'Seat hold lock expired prior to payment confirmation. Auto-refund job has been queued.',
      refundJobId: refundJob.id,
    });
  } catch (error) {
    console.error('❌ [Webhook:Payment] Error reconciling payment webhook:', error);
    // Return 500 so the payment gateway knows to retry the webhook delivery on transient DB/Redis errors
    return res.status(500).json({
      success: false,
      message: 'Internal server error during payment webhook reconciliation.',
      error: error.message,
    });
  }
});

module.exports = router;
