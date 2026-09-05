/**
 * Distributed Rate Limiting Middleware (Phase 5)
 *
 * Implements atomic distributed rate limiting across Cloud Run instances.
 * Stores rate limit state in MongoDB through the dbService abstraction with automatic TTL.
 * Uses UID as primary key and sanitized IP as fallback.
 * Returns HTTP 429 + Retry-After headers when quota is exceeded.
 */
'use strict';

const crypto = require('crypto');
const dbService = require('../services/db.service');

/**
 * SHA-256 hash a key to avoid storing raw PII (UID/IP) in MongoDB
 */
function hashKey(input) {
  return crypto.createHash('sha256').update(String(input)).digest('hex').substring(0, 32);
}

/**
 * Get current date string (YYYY-MM-DD) in GMT+7 (Indochina Time)
 */
function getTodayString() {
  const d = new Date();
  const localTime = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  return `${localTime.getUTCFullYear()}-${localTime.getUTCMonth() + 1}-${localTime.getUTCDate()}`;
}

/**
 * Extract sanitized client IP address
 */
function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = String(forwarded).split(',').map((ip) => ip.trim());
    return ips[0] || req.socket?.remoteAddress || null;
  }
  return req.socket?.remoteAddress || null;
}

/**
 * Distributed Rate Limiter
 * Strictly atomic MongoDB-backed rate limiter with fail-close semantics.
 */
class DistributedRateLimiter {
  constructor(databaseService = dbService) {
    this.databaseService = databaseService;
  }

  setDatabaseService(databaseService) {
    this.databaseService = databaseService;
  }

  /**
   * Atomic check & increment rate limit
   */
  async checkRateLimit(req, decoded = null, { ipLimit = 20, userLimit = 50 } = {}) {
    const isAdminUser = Boolean(
      decoded && (
        decoded.admin === true ||
        decoded.role === 'admin' ||
        decoded['https://vbai.app/role'] === 'admin' ||
        decoded.canary === true
      )
    );
    if (isAdminUser) {
      return { allowed: true };
    }

    const today = getTodayString();
    const clientIp = getClientIp(req);
    const uid = decoded?.uid || null;

    // Fail-close: rate limiting requires the MongoDB-backed atomic operation.
    if (!this.databaseService || typeof this.databaseService.checkAndIncrementRateLimit !== 'function') {
      console.error('[rate-limit] MongoDB rate limiter not initialized — fail-close 503');
      return {
        allowed: false,
        status: 503,
        error: 'Service Unavailable',
        message: 'Rate limiting service not initialized. Please retry later.',
        retryAfterSeconds: 30,
      };
    }

    try {
      const checks = [];
      if (uid) {
        const hashedUid = hashKey(uid);
        checks.push({ key: `user_${hashedUid}_${today}`, type: 'user', limit: userLimit });
      }
      if (clientIp) {
        const hashedIp = hashKey(clientIp);
        checks.push({ key: `ip_${hashedIp}_${today}`, type: 'ip', limit: ipLimit });
      }
      for (const check of checks) {
        const result = await this.databaseService.checkAndIncrementRateLimit(check);
        if (!result.allowed) {
          return {
            allowed: false,
            status: 429,
            error: 'Too Many Requests',
            message: `${check.type === 'user' ? 'Tài khoản' : 'IP'} của bạn đã vượt quá giới hạn ${check.limit} lượt truy cập hôm nay.`,
            retryAfterSeconds: 3600,
          };
        }
      }
      return { allowed: true };
    } catch (err) {
      // FAIL-CLOSE: MongoDB failure on high-cost endpoints returns 503.
      console.error('[rate-limit] MongoDB atomic operation failed (fail-close):', err.message);
      return {
        allowed: false,
        status: 503,
        error: 'Service Unavailable',
        message: 'Rate limiting service temporarily unavailable. Please retry later.',
        retryAfterSeconds: 30,
      };
    }
  }

}

const rateLimiterInstance = new DistributedRateLimiter();

module.exports = {
  DistributedRateLimiter,
  rateLimiterInstance,
  getTodayString,
  getClientIp,
};
