/**
 * Timezone-Safe Date and Redis Key Normalization Utility
 *
 * Prevents UTC drift in Indian Standard Time (IST, UTC+5:30) or any local timezone,
 * ensuring midnight dates (e.g., 2026-10-10 00:00:00 IST) do NOT roll back to the
 * previous calendar day when serialized.
 */

/**
 * Normalizes any Date object, ISO timestamp, or date string to strict local YYYY-MM-DD
 * in Asia/Kolkata timezone.
 *
 * @param {Date|string|number} dateInput - Journey date
 * @returns {string} Calendar date string in YYYY-MM-DD format
 */
function normalizeDateString(dateInput) {
  if (!dateInput) {
    const now = new Date();
    return formatIST(now);
  }

  // If already a clean YYYY-MM-DD string, return directly without running through Date constructor
  if (typeof dateInput === 'string') {
    const match = dateInput.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return `${match[1]}-${match[2]}-${match[3]}`;
    }
  }

  const d = new Date(dateInput);
  if (isNaN(d.getTime())) {
    throw new Error(`Invalid date format provided: ${dateInput}`);
  }

  return formatIST(d);
}

/**
 * Formats a Date object specifically to Asia/Kolkata (IST: UTC+5:30) YYYY-MM-DD
 *
 * @param {Date} dateObj
 * @returns {string}
 */
function formatIST(dateObj) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(dateObj); // Returns "YYYY-MM-DD"
}

/**
 * Generates standardized Redis key for train seat inventory
 *
 * @param {string|number} trainNumber
 * @param {Date|string} journeyDate
 * @param {string} classType (e.g., '1A', '2A', '3A', 'SL')
 * @param {string} [quota='GN'] (e.g., 'GN', 'TQ', 'LD')
 * @returns {string} Redis hash key
 */
function getInventoryKey(trainNumber, journeyDate, classType, quota = 'GN') {
  const dateStr = normalizeDateString(journeyDate);
  const cleanTrain = String(trainNumber || '').trim();
  const cleanClass = String(classType || '3A').trim().toUpperCase();
  const cleanQuota = String(quota || 'GN').trim().toUpperCase();

  return `train:${cleanTrain}:${dateStr}:${cleanClass}:${cleanQuota}:inventory`;
}

/**
 * Calculates Time-To-Live (TTL) in seconds for Redis inventory keys.
 * Automatically expires 48 hours after journey date completion (end-of-day IST)
 * to prevent memory exhaustion and stale hashes in Redis.
 *
 * @param {Date|string} journeyDate
 * @returns {number} TTL in seconds
 */
function calculateInventoryTTL(journeyDate) {
  const dateStr = normalizeDateString(journeyDate);
  const [year, month, day] = dateStr.split('-').map(Number);

  // Journey day ends at 23:59:59.999 IST (corresponds to 18:29:59.999 UTC)
  const journeyEndIST = Date.UTC(year, month - 1, day, 18, 29, 59, 999);

  // Retention window: 48 hours post journey completion
  const retentionMs = 48 * 60 * 60 * 1000;
  const expirationTimestamp = journeyEndIST + retentionMs;

  const now = Date.now();
  const ttlSeconds = Math.max(Math.floor((expirationTimestamp - now) / 1000), 3600); // Minimum 1h safeguard

  return ttlSeconds;
}

module.exports = {
  normalizeDateString,
  getInventoryKey,
  calculateInventoryTTL,
};

