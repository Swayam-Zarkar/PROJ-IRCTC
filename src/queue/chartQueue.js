const { Queue, QueueEvents } = require('bullmq');
const { redisConnection, redisConfig } = require('../config/redisClient');

const CHART_QUEUE_NAME = 'chart-preparation-queue';
const chartPreparationQueue = new Queue(CHART_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: { age: 86400, count: 1000 }, removeOnFail: { count: 5000 } },
});
const chartQueueEvents = new QueueEvents(CHART_QUEUE_NAME, { connection: redisConfig });

/** Schedules one idempotent chart job for a train run, exactly four hours before departure. */
async function scheduleChartPreparation({ trainId, trainNumber, journeyDate, departureTime }) {
  const departure = new Date(departureTime).getTime();
  if (Number.isNaN(departure)) throw new Error('A valid departureTime is required to schedule chart preparation.');
  const delay = Math.max(0, departure - Date.now() - 4 * 60 * 60 * 1000);
  const jobId = `chart:${trainId}:${new Date(journeyDate).toISOString().slice(0, 10)}`;
  return chartPreparationQueue.add('prepare-chart', { trainId: String(trainId), trainNumber, journeyDate: new Date(journeyDate).toISOString(), departureTime }, { jobId, delay });
}

module.exports = { CHART_QUEUE_NAME, chartPreparationQueue, chartQueueEvents, scheduleChartPreparation };
