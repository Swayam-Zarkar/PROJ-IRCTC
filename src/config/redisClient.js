require('dotenv').config();
const IORedis = require('ioredis');

// Shared configuration options required by BullMQ and high-throughput connections
const redisConfig = {
  host: process.env.UPSTASH_HOST || '127.0.0.1',
  port: Number(process.env.UPSTASH_PORT) || 6379,
  password: process.env.UPSTASH_PASSWORD || undefined,
  maxRetriesPerRequest: null, // MANDATORY for BullMQ
  enableReadyCheck: false,
  tls: {
    rejectUnauthorized: false, // Required for secure cloud connections like Upstash
  },
  retryStrategy(times) {
    // Exponential reconnect strategy with 3s cap
    const delay = Math.min(times * 100, 3000);
    return delay;
  },
};

// Create a reusable IORedis instance (for atomic scripts, inventory queries, etc.)
const redisUri = process.env.REDIS_URL;
const redisConnection = redisUri
  ? new IORedis(redisUri, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      tls: {
        rejectUnauthorized: false,
      },
      retryStrategy(times) {
        return Math.min(times * 100, 3000);
      },
    })
  : new IORedis(redisConfig);


  

redisConnection.on('connect', () => {
  console.log('✅ [IORedis] Connected to Redis server.');
});

redisConnection.on('ready', () => {
  console.log('🚀 [IORedis] Redis client is ready.');
});

redisConnection.on('error', (err) => {
  console.error('❌ [IORedis] Redis connection error:', err.message);
});

module.exports = {
  redisConnection,
  redisConfig,
};

