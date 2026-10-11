const { redisConnection } = require('../config/redisClient');
const {
  normalizeDateString,
  getInventoryKey,
  calculateInventoryTTL,
} = require('../utils/keyGenerator');
const Train = require('../models/train');
const Seat = require('../models/seat');

/**
 * Cascading Atomic Reservation Lua Script for Nested Quota Architecture
 *
 * Keys:
 * KEYS[1] = GN key
 * KEYS[2] = TQ key
 *
 * Arguments:
 * ARGV[1] = quota ('GN', 'TQ', 'LD', 'SS', 'HP', 'PT')
 * ARGV[2] = passengerCount
 */
const RESERVE_SEATS_LUA = `
local gnKey = KEYS[1]
local tqKey = KEYS[2]
local quota = string.upper(ARGV[1] or 'GN')
local count = tonumber(ARGV[2] or '1')

local targetKey = gnKey
local targetField = 'gn_available'

if quota == 'TQ' then
    targetKey = tqKey
    targetField = 'tq_available'
elseif quota == 'PT' then
    targetKey = tqKey
    targetField = 'pt_available'
elseif quota == 'LD' then
    targetKey = gnKey
    targetField = 'ld_available'
elseif quota == 'HP' then
    targetKey = gnKey
    targetField = 'hp_available'
elseif quota == 'SS' then
    targetKey = gnKey
    targetField = 'ss_available'
else
    targetKey = gnKey
    targetField = 'gn_available'
end

local cnfAllocated = 0
local racAllocated = 0
local wlAllocated = 0

for i = 1, count do
    local primaryAvail = tonumber(redis.call('HGET', targetKey, targetField) or '0')
    if primaryAvail > 0 then
        redis.call('HINCRBY', targetKey, targetField, -1)
        cnfAllocated = cnfAllocated + 1
    else
        -- Fallback 1: rac_available in GN key
        local racAvail = tonumber(redis.call('HGET', gnKey, 'rac_available') or '0')
        if racAvail > 0 then
            redis.call('HINCRBY', gnKey, 'rac_available', -1)
            racAllocated = racAllocated + 1
        else
            -- Fallback 2: wl_available in GN key
            local wlAvail = tonumber(redis.call('HGET', gnKey, 'wl_available') or '0')
            if wlAvail > 0 then
                redis.call('HINCRBY', gnKey, 'wl_available', -1)
                wlAllocated = wlAllocated + 1
            end
        end
    end
end

local totalAllocated = cnfAllocated + racAllocated + wlAllocated
if totalAllocated < count then
    -- Roll back partial allocations if request cannot be completely fulfilled
    if cnfAllocated > 0 then
        redis.call('HINCRBY', targetKey, targetField, cnfAllocated)
    end
    if racAllocated > 0 then
        redis.call('HINCRBY', gnKey, 'rac_available', racAllocated)
    end
    if wlAllocated > 0 then
        redis.call('HINCRBY', gnKey, 'wl_available', wlAllocated)
    end
    return cjson.encode({
        status = "REGRET",
        message = "No capacity available in " .. quota .. ", RAC, or Waitlist."
    })
end

return cjson.encode({
    status = "SUCCESS",
    quota = quota,
    targetKey = targetKey,
    targetField = targetField,
    cnfCount = cnfAllocated,
    rac = { count = racAllocated },
    wl = { count = wlAllocated }
})
`;

/**
 * Compensating Lua Script for Rollback on MongoDB Write Failure
 * Restores exactly the seats/counters that were deducted.
 */
const ROLLBACK_RESERVATION_LUA = `
local gnKey = KEYS[1]
local tqKey = KEYS[2]
local quota = string.upper(ARGV[1] or 'GN')
local cnfCount = tonumber(ARGV[2] or '0')
local racCount = tonumber(ARGV[3] or '0')
local wlCount = tonumber(ARGV[4] or '0')

local targetKey = gnKey
local targetField = 'gn_available'

if quota == 'TQ' then
    targetKey = tqKey
    targetField = 'tq_available'
elseif quota == 'PT' then
    targetKey = tqKey
    targetField = 'pt_available'
elseif quota == 'LD' then
    targetKey = gnKey
    targetField = 'ld_available'
elseif quota == 'HP' then
    targetKey = gnKey
    targetField = 'hp_available'
elseif quota == 'SS' then
    targetKey = gnKey
    targetField = 'ss_available'
else
    targetKey = gnKey
    targetField = 'gn_available'
end

if cnfCount > 0 then
    redis.call('HINCRBY', targetKey, targetField, cnfCount)
end
if racCount > 0 then
    redis.call('HINCRBY', gnKey, 'rac_available', racCount)
end
if wlCount > 0 then
    redis.call('HINCRBY', gnKey, 'wl_available', wlCount)
end

return cjson.encode({ status = "ROLLED_BACK" })
`;

/**
 * Initializes seat inventory in Redis for a specific train run and class.
 * ONLY creates two Redis keys: GN and TQ, storing all sub-quota counters as nested fields.
 *
 * GN hash:
 * - gn_available: 60, gn_total: 60
 * - ld_available: 10, ld_total: 10
 * - hp_available: 5,  hp_total: 5
 * - ss_available: 5,  ss_total: 5
 * - wl_available: 70, wl_total: 70
 * - rac_available: 25, rac_total: 25
 *
 * TQ hash:
 * - tq_available: 10, tq_total: 10
 * - pt_available: 10, pt_total: 10
 */
async function initializeCoachInventory(trainNumber, journeyDate, classType) {
  const gnKey = getInventoryKey(trainNumber, journeyDate, classType, 'GN');
  const tqKey = getInventoryKey(trainNumber, journeyDate, classType, 'TQ');
  const ttlSeconds = calculateInventoryTTL(journeyDate);

  const gnFields = {
    gn_available: 60,
    gn_total: 60,
    ld_available: 10,
    ld_total: 10,
    hp_available: 5,
    hp_total: 5,
    ss_available: 5,
    ss_total: 5,
    wl_available: 70,
    wl_total: 70,
    rac_available: 25,
    rac_total: 25,
  };

  const tqFields = {
    tq_available: 10,
    tq_total: 10,
    pt_available: 10,
    pt_total: 10,
  };

  await Promise.all([
    redisConnection.hmset(gnKey, gnFields),
    redisConnection.hmset(tqKey, tqFields),
  ]);

  await Promise.all([
    redisConnection.expire(gnKey, ttlSeconds),
    redisConnection.expire(tqKey, ttlSeconds),
  ]);

  return { gnKey, tqKey, ttlSeconds };
}

/**
 * Backward compatibility wrapper
 */
async function initializeInventory(trainNumber, journeyDate, classType, quota = 'GN', config = {}) {
  const ttlSeconds = calculateInventoryTTL(journeyDate);
  const q = String(quota || 'GN').toUpperCase();

  if (q === 'TQ') {
    const tqKey = getInventoryKey(trainNumber, journeyDate, classType, 'TQ');
    const tqFields = {
      tq_available: config.tq_available !== undefined ? config.tq_available : 10,
      tq_total: config.tq_total !== undefined ? config.tq_total : 10,
      pt_available: config.pt_available !== undefined ? config.pt_available : 10,
      pt_total: config.pt_total !== undefined ? config.pt_total : 10,
    };
    await redisConnection.hmset(tqKey, tqFields);
    await redisConnection.expire(tqKey, ttlSeconds);
    return { key: tqKey, ...tqFields };
  } else {
    const gnKey = getInventoryKey(trainNumber, journeyDate, classType, 'GN');
    const gnFields = {
      gn_available: config.gn_available !== undefined ? config.gn_available : 60,
      gn_total: config.gn_total !== undefined ? config.gn_total : 60,
      ld_available: config.ld_available !== undefined ? config.ld_available : 10,
      ld_total: config.ld_total !== undefined ? config.ld_total : 10,
      hp_available: config.hp_available !== undefined ? config.hp_available : 5,
      hp_total: config.hp_total !== undefined ? config.hp_total : 5,
      ss_available: config.ss_available !== undefined ? config.ss_available : 5,
      ss_total: config.ss_total !== undefined ? config.ss_total : 5,
      wl_available: config.wl_available !== undefined ? config.wl_available : 70,
      wl_total: config.wl_total !== undefined ? config.wl_total : 70,
      rac_available: config.rac_available !== undefined ? config.rac_available : 25,
      rac_total: config.rac_total !== undefined ? config.rac_total : 25,
    };
    await redisConnection.hmset(gnKey, gnFields);
    await redisConnection.expire(gnKey, ttlSeconds);
    return { key: gnKey, ...gnFields };
  }
}

/**
 * Decrement specific quota available counter using HINCRBY with fallback to rac_available / wl_available.
 *
 * If quota is LD, decrements ld_available in GN key.
 * If quota is PT, decrements pt_available in TQ key.
 * If quota is HP, decrements hp_available in GN key.
 * If quota is SS, decrements ss_available in GN key.
 * If quota is TQ, decrements tq_available in TQ key.
 * If quota is GN, decrements gn_available in GN key.
 * Falls back to rac_available or wl_available if primary quota field hits 0.
 *
 * @param {string} trainNumber
 * @param {Date|string} journeyDate
 * @param {string} classType
 * @param {string} quota
 * @param {number} [passengerCount=1]
 */
async function decrementQuotaInventory(trainNumber, journeyDate, classType, quota, passengerCount = 1) {
  const gnKey = getInventoryKey(trainNumber, journeyDate, classType, 'GN');
  const tqKey = getInventoryKey(trainNumber, journeyDate, classType, 'TQ');
  const q = String(quota || 'GN').trim().toUpperCase();

  const rawResult = await redisConnection.eval(
    RESERVE_SEATS_LUA,
    2,
    gnKey,
    tqKey,
    q,
    passengerCount
  );

  return JSON.parse(rawResult);
}

/**
 * Atomically reserves seats via Cascading Redis Lua script.
 *
 * @param {string} trainNumber
 * @param {Date|string} journeyDate
 * @param {string} classType
 * @param {string} quota
 * @param {number} passengerCount
 * @returns {Promise<object>} Parsed allocation result
 */
async function reserveSeatsAtomically(trainNumber, journeyDate, classType, quota, passengerCount) {
  return decrementQuotaInventory(trainNumber, journeyDate, classType, quota, passengerCount);
}

/**
 * Reverts Redis counters if MongoDB fails after reservation (Compensating Transaction)
 */
async function rollbackReservation(trainNumber, journeyDate, classType, quota, allocationResult) {
  if (!allocationResult || allocationResult.status !== 'SUCCESS') return;

  const gnKey = getInventoryKey(trainNumber, journeyDate, classType, 'GN');
  const tqKey = getInventoryKey(trainNumber, journeyDate, classType, 'TQ');
  const q = String(quota || 'GN').trim().toUpperCase();
  const cnfCount = allocationResult.cnfCount || 0;
  const racCount = allocationResult.rac?.count || 0;
  const wlCount = allocationResult.wl?.count || 0;

  try {
    await redisConnection.eval(
      ROLLBACK_RESERVATION_LUA,
      2,
      gnKey,
      tqKey,
      q,
      cnfCount,
      racCount,
      wlCount
    );
    console.log(`🔄 [InventoryService] Rolled back Redis reservation for ${q}: CNF=${cnfCount}, RAC=${racCount}, WL=${wlCount}`);
  } catch (error) {
    console.error(`❌ [InventoryService] Critical: Failed to rollback Redis reservation:`, error);
  }
}

/**
 * Retrieves current real-time availability from Redis for GN and TQ hashes
 */
async function getSeatAvailability(trainNumber, journeyDate, classType, quota = 'GN') {
  const gnKey = getInventoryKey(trainNumber, journeyDate, classType, 'GN');
  const tqKey = getInventoryKey(trainNumber, journeyDate, classType, 'TQ');

  const [gnData, tqData] = await Promise.all([
    redisConnection.hgetall(gnKey).catch(() => ({})),
    redisConnection.hgetall(tqKey).catch(() => ({})),
  ]);

  const q = String(quota || 'GN').trim().toUpperCase();
  let availableSeats = 0;
  if (q === 'TQ') {
    availableSeats = Number(tqData?.tq_available || 0);
  } else if (q === 'PT') {
    availableSeats = Number(tqData?.pt_available || 0);
  } else if (q === 'LD') {
    availableSeats = Number(gnData?.ld_available || 0);
  } else if (q === 'HP') {
    availableSeats = Number(gnData?.hp_available || 0);
  } else if (q === 'SS') {
    availableSeats = Number(gnData?.ss_available || 0);
  } else {
    availableSeats = Number(gnData?.gn_available || 0);
  }

  const racSeatsRemaining = Number(gnData?.rac_available || 0);
  const wlSeatsRemaining = Number(gnData?.wl_available || 0);

  return {
    gn: gnData,
    tq: tqData,
    availableSeats,
    racSeatsRemaining,
    wlSeatsRemaining,
  };
}

/**
 * Releases seats back to inventory on booking cancellation using HINCRBY
 */
async function releaseSeats(trainNumber, journeyDate, classType, quota, bookingStatus, count) {
  const gnKey = getInventoryKey(trainNumber, journeyDate, classType, 'GN');
  const tqKey = getInventoryKey(trainNumber, journeyDate, classType, 'TQ');
  const q = String(quota || 'GN').trim().toUpperCase();

  if (bookingStatus === 'CNF') {
    if (q === 'TQ') {
      await redisConnection.hincrby(tqKey, 'tq_available', count);
    } else if (q === 'PT') {
      await redisConnection.hincrby(tqKey, 'pt_available', count);
    } else if (q === 'LD') {
      await redisConnection.hincrby(gnKey, 'ld_available', count);
    } else if (q === 'HP') {
      await redisConnection.hincrby(gnKey, 'hp_available', count);
    } else if (q === 'SS') {
      await redisConnection.hincrby(gnKey, 'ss_available', count);
    } else {
      await redisConnection.hincrby(gnKey, 'gn_available', count);
    }
  } else if (bookingStatus === 'RAC') {
    await redisConnection.hincrby(gnKey, 'rac_available', count);
  } else if (bookingStatus === 'WL') {
    await redisConnection.hincrby(gnKey, 'wl_available', count);
  }
}

module.exports = {
  normalizeDateString,
  getInventoryKey,
  calculateInventoryTTL,
  initializeCoachInventory,
  initializeInventory,
  decrementQuotaInventory,
  reserveSeatsAtomically,
  rollbackReservation,
  getSeatAvailability,
  releaseSeats,
};
