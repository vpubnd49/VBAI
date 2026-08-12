/**
 * Distributed Rate Limiting Middleware (Phase 5)
 *
 * Implements atomic distributed rate limiting across Cloud Run instances.
 * Stores rate limit state in Firestore (`rate_limits` collection) with automatic TTL.
 * Uses UID as primary key and sanitized IP as fallback.
 * Returns HTTP 429 + Retry-After headers when quota is exceeded.
 */
'use strict';

const crypto = require('crypto');

/**
 * SHA-256 hash a key to avoid storing raw PII (UID/IP) in Firestore
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
 * Strictly atomic Firestore-backed rate limiter with fail-close semantics.
 */
class DistributedRateLimiter {
  constructor(firestoreDb = null, fieldValue = null) {
    this.firestoreDb = firestoreDb;
    this.fieldValue = fieldValue;
  }

  setFirestore(firestoreDb, fieldValue) {
    this.firestoreDb = firestoreDb;
    this.fieldValue = fieldValue;
  }

  /**
   * Atomic check & increment rate limit
   */
  async checkRateLimit(req, decoded = null, { ipLimit = 20, userLimit = 50 } = {}) {
    const isAdminUser = Boolean(
      decoded && (decoded.admin === true || decoded.role === 'admin' || decoded['https://vbai.app/role'] === 'admin')
    );
    if (isAdminUser) {
      return { allowed: true };
    }

    const today = getTodayString();
    const clientIp = getClientIp(req);
    const uid = decoded?.uid || null;

    // Fail-close: if Firestore admin is not initialized, block requests
    if (!this.firestoreDb || !this.fieldValue || typeof this.fieldValue.increment !== 'function') {
      console.error('[rate-limit] Firebase Admin/Firestore not initialized — fail-close 503');
      return {
        allowed: false,
        status: 503,
        error: 'Service Unavailable',
        message: 'Rate limiting service not initialized. Please retry later.',
        retryAfterSeconds: 30,
      };
    }

    try {
      const db = this.firestoreDb;

      // 1. User Account Rate Limit Check
      if (uid) {
        const hashedUid = hashKey(uid);
        const userDocRef = db.collection('rate_limits').doc(`user_${hashedUid}_${today}`);
        const userCheck = await db.runTransaction(async (transaction) => {
          const doc = await transaction.get(userDocRef);
          if (!doc.exists) {
            transaction.set(userDocRef, {
              key: hashedUid,
              type: 'user',
              count: 1,
              date: today,
              expiresAt: new Date(Date.now() + 86400000 * 2), // 48h TTL
            });
            return { allowed: true, count: 1 };
          }
          const data = doc.data();
          if (data.count >= userLimit) {
            return { allowed: false, count: data.count, type: 'user' };
          }
          transaction.update(userDocRef, {
            count: this.fieldValue.increment(1),
          });
          return { allowed: true, count: data.count + 1 };
        });

        if (!userCheck.allowed) {
          return {
            allowed: false,
            status: 429,
            error: 'Too Many Requests',
            message: `Tài khoản của bạn đã vượt quá giới hạn ${userLimit} lượt truy cập hôm nay.`,
            retryAfterSeconds: 3600,
          };
        }
      }

      // 2. IP Rate Limit Check
      if (clientIp) {
        const hashedIp = hashKey(clientIp);
        const ipDocRef = db.collection('rate_limits').doc(`ip_${hashedIp}_${today}`);
        const ipCheck = await db.runTransaction(async (transaction) => {
          const doc = await transaction.get(ipDocRef);
          if (!doc.exists) {
            transaction.set(ipDocRef, {
              key: hashedIp,
              type: 'ip',
              count: 1,
              date: today,
              expiresAt: new Date(Date.now() + 86400000 * 2), // 48h TTL
            });
            return { allowed: true, count: 1 };
          }
          const data = doc.data();
          if (data.count >= ipLimit) {
            return { allowed: false, count: data.count, type: 'ip' };
          }
          transaction.update(ipDocRef, {
            count: this.fieldValue.increment(1),
          });
          return { allowed: true, count: data.count + 1 };
        });

        if (!ipCheck.allowed) {
          return {
            allowed: false,
            status: 429,
            error: 'Too Many Requests',
            message: `IP của bạn đã vượt quá giới hạn ${ipLimit} lượt truy cập hôm nay.`,
            retryAfterSeconds: 3600,
          };
        }
      }

      return { allowed: true };
    } catch (err) {
      // FAIL-CLOSE: Firestore failure on high-cost endpoints returns 503, not fail-open
      console.error('[rate-limit] Distributed transaction failed (fail-close):', err.message);
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
