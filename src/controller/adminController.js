const mongoose = require('mongoose');
const Train = require('../models/train');
const { chartPreparationQueue } = require('../queue/chartQueue');
const { normalizeDateString } = require('../utils/keyGenerator');

/**
 * @desc    On-demand charting trigger for testing & immediate berth upgrades
 * @route   POST /api/admin/trains/prepare-chart
 * @access  Admin / Protected
 */
async function triggerChartPreparation(req, res) {
  try {
    const { trainNumber, journeyDate, trainId } = req.body;

    if (!trainNumber && !trainId) {
      return res.status(400).json({
        success: false,
        message: 'trainNumber or trainId is required in request body.',
      });
    }

    if (!journeyDate) {
      return res.status(400).json({
        success: false,
        message: 'journeyDate is required in request body.',
      });
    }

    const cleanDate = normalizeDateString(journeyDate);

    // 1. Resolve Train document from MongoDB
    let train = null;
    if (trainId && mongoose.Types.ObjectId.isValid(trainId)) {
      train = await Train.findById(trainId);
    }
    if (!train && trainNumber) {
      train = await Train.findOne({ trainNumber: String(trainNumber).trim() });
    }

    if (!train) {
      return res.status(404).json({
        success: false,
        message: `Train not found for identifier: ${trainNumber || trainId}`,
      });
    }

    // 2. Instantly enqueue job to BullMQ chartQueue with high priority (priority: 1)
    const job = await chartPreparationQueue.add(
      'prepare-chart',
      {
        trainId: String(train._id),
        trainNumber: train.trainNumber,
        journeyDate: cleanDate,
      },
      {
        priority: 1,
        removeOnComplete: { age: 3600, count: 1000 },
        removeOnFail: false,
      }
    );

    console.log(`🚀 [AdminController] On-demand charting job ${job.id} enqueued for Train ${train.trainNumber} on ${cleanDate}`);

    return res.status(200).json({
      success: true,
      message: `On-demand charting job enqueued successfully for Train ${train.trainNumber} (${train.trainName}) on ${cleanDate}.`,
      jobId: job.id,
      trainNumber: train.trainNumber,
      trainName: train.trainName,
      journeyDate: cleanDate,
    });
  } catch (error) {
    console.error('❌ [AdminController:triggerChartPreparation] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to enqueue chart preparation job.',
      error: error.message,
    });
  }
}

module.exports = {
  triggerChartPreparation,
};

