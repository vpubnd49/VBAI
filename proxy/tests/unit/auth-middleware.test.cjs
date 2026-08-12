/**
 * Auth Middleware Unit Test (Prompt 03)
 *
 * Tests the shared auth middleware factory using a modular Auth mock.
 * Run: node proxy/tests/unit/auth-middleware.test.cjs
 */
'use strict';

const assert = require('node:assert/strict');
const path = require('path');

const { makeAuthMiddleware, extractBearerToken } = require(
  path.join(__dirname, '../../middleware/auth.middleware')
);

let passed = 0;
let failed = 0;

function ok(condition, msg) {
  if (condition) {
    console.log(`  ✔ PASS: ${msg}`);
    passed++;
  } else {
    console.error(`  ✘ FAIL: ${msg}`);
    failed++;
  }
}

// ─────────────────────────────────────────────────────
// Mock modular Firebase Auth client factory
// ─────────────────────────────────────────────────────
function makeMockAuth({ resolveWith = null, rejectWith = null } = {}) {
  return {
    verifyIdToken: async (token) => {
      if (rejectWith) throw rejectWith;
      if (resolveWith) return resolveWith;
      // Default: treat token as uid
      return { uid: token, email: `${token}@test.com`, admin: false };
    },
  };
}

// Mock Express req/res/next helpers
function makeReq({ authHeader = null } = {}) {
  return {
    headers: authHeader ? { authorization: authHeader } : {},
    user: undefined,
  };
}

function makeRes() {
  let _status = 200;
  let _body = null;
  return {
    _status: () => _status,
    _body: () => _body,
    status(code) { _status = code; return this; },
    json(body) { _body = body; return this; },
  };
}

(async () => {
// ─────────────────────────────────────────────────────
// 1. extractBearerToken
// ─────────────────────────────────────────────────────
console.log('\n--- 1. extractBearerToken ---');

ok(extractBearerToken(makeReq()) === null, 'No header → null');
ok(extractBearerToken(makeReq({ authHeader: 'Bearer abc123' })) === 'abc123', 'Bearer token extracted');
ok(extractBearerToken(makeReq({ authHeader: 'Basic abc123' })) === null, 'Non-Bearer scheme → null');
ok(extractBearerToken(makeReq({ authHeader: 'Bearer ' })) === null, 'Empty Bearer → null');

// ─────────────────────────────────────────────────────
// 2. makeAuthMiddleware factory validation
// ─────────────────────────────────────────────────────
console.log('\n--- 2. Factory validation ---');

try {
  makeAuthMiddleware(null);
  ok(false, 'null authClient should throw');
} catch (e) {
  ok(e.message.includes('authClient must expose verifyIdToken'), 'null authClient throws with correct message');
}

try {
  makeAuthMiddleware({});
  ok(false, 'authClient without verifyIdToken() should throw');
} catch (e) {
  ok(e.message.includes('authClient must expose verifyIdToken'), 'invalid authClient throws');
}

// ─────────────────────────────────────────────────────
// 3. requireAuth() — no token
// ─────────────────────────────────────────────────────
console.log('\n--- 3. requireAuth() — no token ---');
{
  const { requireAuth } = makeAuthMiddleware(makeMockAuth());
  const req = makeReq();
  const res = makeRes();
  let nextCalled = false;
  await requireAuth()(req, res, () => { nextCalled = true; });
  ok(res._status() === 401, 'Returns 401 when no token');
  ok(!nextCalled, 'next() NOT called when no token');
  ok(res._body().error === 'Unauthorized', 'Error message is Unauthorized');
}

// ─────────────────────────────────────────────────────
// 4. requireAuth() — valid token
// ─────────────────────────────────────────────────────
console.log('\n--- 4. requireAuth() — valid token ---');
{
  const fakeUser = { uid: 'user-1', email: 'user@test.com', admin: false };
  const { requireAuth } = makeAuthMiddleware(makeMockAuth({ resolveWith: fakeUser }));
  const req = makeReq({ authHeader: 'Bearer valid-token' });
  const res = makeRes();
  let nextCalled = false;
  await requireAuth()(req, res, () => { nextCalled = true; });
  ok(nextCalled, 'next() called on valid token');
  ok(req.user === fakeUser, 'req.user set to decoded token');
  ok(res._status() === 200, 'No error response on valid token');
}

// ─────────────────────────────────────────────────────
// 5. requireAuth() — invalid token
// ─────────────────────────────────────────────────────
console.log('\n--- 5. requireAuth() — invalid/expired token ---');
{
  const { requireAuth } = makeAuthMiddleware(makeMockAuth({ rejectWith: new Error('auth/id-token-expired') }));
  const req = makeReq({ authHeader: 'Bearer bad-token' });
  const res = makeRes();
  let nextCalled = false;
  await requireAuth()(req, res, () => { nextCalled = true; });
  ok(res._status() === 401, 'Returns 401 on invalid token');
  ok(!nextCalled, 'next() NOT called on invalid token');
}

// ─────────────────────────────────────────────────────
// 6. requireAdmin() — no admin claim
// ─────────────────────────────────────────────────────
console.log('\n--- 6. requireAdmin() — no admin claim ---');
{
  const { requireAdmin } = makeAuthMiddleware(makeMockAuth());
  const req = { user: { uid: 'user-1', admin: false } };
  const res = makeRes();
  let nextCalled = false;
  requireAdmin()(req, res, () => { nextCalled = true; });
  ok(res._status() === 403, 'Returns 403 when no admin claim');
  ok(!nextCalled, 'next() NOT called without admin claim');
}

// ─────────────────────────────────────────────────────
// 7. requireAdmin() — has admin claim
// ─────────────────────────────────────────────────────
console.log('\n--- 7. requireAdmin() — has admin claim ---');
{
  const { requireAdmin } = makeAuthMiddleware(makeMockAuth());
  const req = { user: { uid: 'admin-1', admin: true } };
  const res = makeRes();
  let nextCalled = false;
  requireAdmin()(req, res, () => { nextCalled = true; });
  ok(nextCalled, 'next() called when admin=true');
  ok(res._status() === 200, 'No error response for admin');
}

// ─────────────────────────────────────────────────────
// 8. requireAdmin() — no req.user (middleware order error)
// ─────────────────────────────────────────────────────
console.log('\n--- 8. requireAdmin() — missing req.user ---');
{
  const { requireAdmin } = makeAuthMiddleware(makeMockAuth());
  const req = {};
  const res = makeRes();
  let nextCalled = false;
  requireAdmin()(req, res, () => { nextCalled = true; });
  ok(res._status() === 401, 'Returns 401 when req.user missing');
  ok(!nextCalled, 'next() NOT called without req.user');
}

// ─────────────────────────────────────────────────────
// 9. optionalAuth() — no token
// ─────────────────────────────────────────────────────
console.log('\n--- 9. optionalAuth() — no token ---');
{
  const { optionalAuth } = makeAuthMiddleware(makeMockAuth());
  const req = makeReq();
  const res = makeRes();
  let nextCalled = false;
  await optionalAuth()(req, res, () => { nextCalled = true; });
  ok(nextCalled, 'next() called even with no token');
  ok(req.user === null, 'req.user set to null without token');
}

// ─────────────────────────────────────────────────────
// 10. optionalAuth() — valid token
// ─────────────────────────────────────────────────────
console.log('\n--- 10. optionalAuth() — valid token ---');
{
  const fakeUser = { uid: 'user-2', email: 'u2@test.com' };
  const { optionalAuth } = makeAuthMiddleware(makeMockAuth({ resolveWith: fakeUser }));
  const req = makeReq({ authHeader: 'Bearer some-token' });
  const res = makeRes();
  let nextCalled = false;
  await optionalAuth()(req, res, () => { nextCalled = true; });
  ok(nextCalled, 'next() called with valid token');
  ok(req.user === fakeUser, 'req.user set to decoded token');
}

// ─────────────────────────────────────────────────────
// 11. optionalAuth() — bad token still calls next
// ─────────────────────────────────────────────────────
console.log('\n--- 11. optionalAuth() — bad token still continues ---');
{
  const { optionalAuth } = makeAuthMiddleware(makeMockAuth({ rejectWith: new Error('invalid') }));
  const req = makeReq({ authHeader: 'Bearer invalid-token' });
  const res = makeRes();
  let nextCalled = false;
  await optionalAuth()(req, res, () => { nextCalled = true; });
  ok(nextCalled, 'next() called even on bad token (optional)');
  ok(req.user === null, 'req.user is null on bad token');
}

// ─────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
})().catch(err => { console.error('Test runner crashed:', err); process.exit(1); });
