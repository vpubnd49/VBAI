/**
 * Distributed Rate Limiting Unit Test (Corrective V2)
 *
 * Verifies:
 * - No in-memory ipLimits/userLimits Maps in server.js
 * - No fallbackStore in rate-limit middleware
 * - 503 when MongoDB not initialized (fail-close)
 * - 503 when MongoDB transaction throws (fail-close)
 * - 429 when quota exceeded via mock MongoDB
 * - Admin user bypasses limits
 * - PII hashing (no raw UID/IP in stored keys)
 * - Mock requests have headers: {} (no crash)
 *
 * Run: node proxy/tests/unit/distributed-rate-limit.test.cjs
 */
'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { DistributedRateLimiter, rateLimiterInstance } = require(
  path.join(__dirname, '../../middleware/rate-limit.middleware')
);

let passed = 0;
let failed = 0;

function ok(condition, msg) {
  if (condition) {
    console.log(`  \u2714 PASS: ${msg}`);
    passed++;
  } else {
    console.error(`  \u2718 FAIL: ${msg}`);
    failed++;
  }
}

console.log('=== Distributed Rate Limiting Unit Test (Corrective V2) ===\n');

// 1. Source-level assertions
console.log('--- 1. Source-Level Code Inspection ---');
const serverPath = path.join(__dirname, '..', '..', 'server.js');
const serverContent = fs.readFileSync(serverPath, 'utf8');
const rateLimitPath = path.join(__dirname, '..', '..', 'middleware', 'rate-limit.middleware.js');
const rateLimitContent = fs.readFileSync(rateLimitPath, 'utf8');

ok(!serverContent.includes('const ipLimits = new Map()'), 'server.js DOES NOT use in-memory ipLimits Map');
ok(!serverContent.includes('const userLimits = new Map()'), 'server.js DOES NOT use in-memory userLimits Map');
ok(serverContent.includes('rateLimiterInstance'), 'server.js uses distributed rateLimiterInstance');
ok(!rateLimitContent.includes('fallbackStore'), 'rate-limit.middleware has NO fallbackStore');
ok(!rateLimitContent.includes('new Map()'), 'rate-limit.middleware has NO in-memory Map');
ok(!rateLimitContent.includes('_checkFallback'), 'rate-limit.middleware has NO _checkFallback method');

// 2. Fail-close when MongoDB not initialized
console.log('\n--- 2. Fail-Close: MongoDB Not Initialized ---');
(async () => {
  const limiter = new DistributedRateLimiter(null); // no MongoDB client
  const req = { headers: {}, socket: { remoteAddress: '10.0.0.1' } };
  const decoded = { uid: 'user_test_123', admin: false };

  const res1 = await limiter.checkRateLimit(req, decoded, { ipLimit: 20, userLimit: 50 });
  ok(res1.allowed === false, 'No MongoDB: request NOT allowed');
  ok(res1.status === 503, 'No MongoDB: status is 503');
  ok(res1.error === 'Service Unavailable', 'No MongoDB: error is Service Unavailable');

  // 3. Fail-close when MongoDB transaction throws
  console.log('\n--- 3. Fail-Close: MongoDB Transaction Error ---');
  const brokenMongoDB = {
    collection: () => ({ doc: () => ({}) }),
    runTransaction: async () => { throw new Error('SIMULATED_FAILURE'); },
  };
  const brokenMongo = { checkAndIncrementRateLimit: async () => { throw new Error('SIMULATED_FAILURE'); } };
  const limiter2 = new DistributedRateLimiter(brokenMongo);
  const res2 = await limiter2.checkRateLimit(req, decoded, { ipLimit: 20, userLimit: 50 });
  ok(res2.allowed === false, 'MongoDB error: request NOT allowed');
  ok(res2.status === 503, 'MongoDB error: status is 503');
  ok(res2.error === 'Service Unavailable', 'MongoDB error: error is Service Unavailable');
  ok(typeof res2.retryAfterSeconds === 'number', 'MongoDB error: retryAfterSeconds present');

  // 4. 429 when quota exceeded via mock MongoDB
  console.log('\n--- 4. 429: Quota Exceeded via Mock MongoDB ---');
  let callCount = 0;
  const mockMongoDB = {
    collection: () => ({
      doc: () => ({}),
    }),
    runTransaction: async (fn) => {
      callCount++;
      // Simulate user doc that already exceeded quota
      const mockDoc = {
        exists: true,
        data: () => ({ count: 100 }), // way over limit
      };
      const mockTransaction = {
        get: async () => mockDoc,
        set: () => {},
        update: () => {},
      };
      return await fn(mockTransaction);
    },
  };

  const mockMongo = {
    checkAndIncrementRateLimit: async ({ type }) => ({ allowed: type !== 'user', count: 100 }),
  };
  const limiter3 = new DistributedRateLimiter(mockMongo);
  const res3 = await limiter3.checkRateLimit(req, decoded, { ipLimit: 20, userLimit: 5 });
  ok(res3.allowed === false, '429: request NOT allowed when count >= limit');
  ok(res3.status === 429, '429: status is 429');
  ok(res3.error === 'Too Many Requests', '429: error is Too Many Requests');

  // 5. Admin user bypasses limits
  console.log('\n--- 5. Admin & Canary Bypass ---');
  const adminDecoded = { uid: 'admin_123', admin: true };
  const resAdmin = await limiter.checkRateLimit(req, adminDecoded, { ipLimit: 1, userLimit: 1 });
  ok(resAdmin.allowed === true, 'Admin user bypasses rate limits even with no MongoDB');

  const canaryDecoded = { uid: 'canary-bot', canary: true };
  const resCanary = await limiter.checkRateLimit(req, canaryDecoded, { ipLimit: 1, userLimit: 1 });
  ok(resCanary.allowed === true, 'Canary token bypasses rate limits even with no MongoDB');

  // 6. PII hashing verification
  console.log('\n--- 6. PII Hashing ---');
  ok(rateLimitContent.includes('hashKey'), 'hashKey function present');
  ok(rateLimitContent.includes("crypto.createHash('sha256')"), 'Uses SHA-256 for key hashing');
  ok(rateLimitContent.includes('hashedUid'), 'UID is hashed before storage');
  ok(rateLimitContent.includes('hashedIp'), 'IP is hashed before storage');
  // Verify no raw UID/IP stored in key field
  ok(!rateLimitContent.includes('key: uid'), 'No raw uid stored as key');
  ok(!rateLimitContent.includes('key: clientIp'), 'No raw clientIp stored as key');

  // 7. Mock request with empty headers (no crash)
  console.log('\n--- 7. Empty Headers Safety ---');
  const bareReq = { headers: {} }; // no socket
  const res4 = await limiter.checkRateLimit(bareReq, null, { ipLimit: 20, userLimit: 50 });
  ok(res4.status === 503, 'Bare request with empty headers returns 503 (no crash)');

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) process.exit(1);
})().catch((err) => {
  console.error('Test runner crashed:', err);
  process.exit(1);
});
