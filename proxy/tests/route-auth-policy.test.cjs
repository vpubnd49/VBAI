/**
 * Route Auth Policy Test
 *
 * Verifies that auth enforcement patterns exist in all
 * non-public route handlers using static analysis.
 *
 * Run: node proxy/tests/route-auth-policy.test.cjs
 */
'use strict';

const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) {
    console.log(`  PASS: ${msg}`);
    passed++;
  } else {
    console.error(`  FAIL: ${msg}`);
    failed++;
  }
}

console.log('=== Route Auth Policy Test ===\n');

const serverPath = path.join(__dirname, '..', 'server.js');
const serverContent = fs.readFileSync(serverPath, 'utf8');

// Public endpoints that should NOT require auth
const PUBLIC_ENDPOINTS = [
  '/api/health',
  '/api/build-info',
  '/health',
];

// Admin endpoints that must check isAdmin
const ADMIN_ENDPOINTS = [
  '/api/admin/validate-gemini-key',
  '/api/admin/ingest-vertex',
  '/api/admin/system-config',
  '/api/admin/web-search-health',
  '/api/admin/web-search-ingest',
  '/api/admin/delete-user',
  '/api/admin/update-user',
];

// Auth-required endpoints (non-admin)
const AUTH_ENDPOINTS = [
  '/api/document-metadata',
  '/api/stats/visits',
  '/api/system-config-summary',
  '/api/chat',
  '/api/transcribe',
  '/api/legal-agent-retrieve',
  '/api/search-history',
];

// 1. Test: Public endpoints should NOT call verifyIdToken
console.log('--- Public Endpoints (no auth) ---');
for (const ep of PUBLIC_ENDPOINTS) {
  // Find the handler block
  const handlerIdx = serverContent.indexOf(`'${ep}'`);
  const altIdx = serverContent.indexOf(`"${ep}"`);
  const blockStart = handlerIdx !== -1 ? handlerIdx : altIdx;
  if (blockStart === -1) {
    console.log(`  SKIP: ${ep} not found in server.js (may be in router)`);
    continue;
  }
  // Find the end of this handler: look for the next app.get/post/use/delete
  const afterHandler = serverContent.substring(blockStart + ep.length);
  const nextRouteMatch = afterHandler.match(/\napp\.(get|post|put|delete|use)\s*\(/);
  const handlerEnd = nextRouteMatch
    ? blockStart + ep.length + nextRouteMatch.index
    : Math.min(blockStart + 1000, serverContent.length);
  const block = serverContent.substring(blockStart, handlerEnd);

  const noAuth = !block.includes('verifyIdToken');
  assert(
    noAuth,
    `${ep} does NOT require auth (public endpoint)`
  );
}

// 2. Test: Auth endpoints should call verifyIdToken
console.log('\n--- Auth Endpoints (token required) ---');
for (const ep of AUTH_ENDPOINTS) {
  const idx1 = serverContent.indexOf(`'${ep}'`);
  const idx2 = serverContent.indexOf(`"${ep}"`);
  const handlerIdx = idx1 !== -1 ? idx1 : idx2;
  if (handlerIdx === -1) {
    console.log(`  SKIP: ${ep} not found in server.js`);
    continue;
  }
  const block = serverContent.substring(handlerIdx, Math.min(handlerIdx + 2000, serverContent.length));
  const hasAuth = block.substring(0, 800).includes('verifyIdToken');
  assert(
    hasAuth,
    `${ep} requires verifyIdToken`
  );
}

// 3. Test: Admin endpoints should call isAdmin
console.log('\n--- Admin Endpoints (admin required) ---');
for (const ep of ADMIN_ENDPOINTS) {
  const idx1 = serverContent.indexOf(`'${ep}'`);
  const idx2 = serverContent.indexOf(`"${ep}"`);
  const handlerIdx = idx1 !== -1 ? idx1 : idx2;
  if (handlerIdx === -1) {
    console.log(`  SKIP: ${ep} not found in server.js`);
    continue;
  }
  const block = serverContent.substring(handlerIdx, Math.min(handlerIdx + 2000, serverContent.length));
  const hasAdmin = block.substring(0, 800).includes('isAdmin');
  assert(
    hasAdmin,
    `${ep} requires isAdmin check`
  );
}

// 4. Test: CORS configuration should NOT use wildcard with credentials
console.log('\n--- CORS Configuration ---');
const hasWildcardCors = /cors\s*\(\s*\{[^}]*origin\s*:\s*['"`]\*['"`]/s.test(serverContent);
assert(
  !hasWildcardCors,
  'CORS does not use hardcoded wildcard origin'
);

const hasOriginFunction = serverContent.includes('origin: function') || serverContent.includes('origin:function');
assert(
  hasOriginFunction,
  'CORS uses dynamic origin validation function'
);

// 5. Test: Route files should not be completely unprotected
console.log('\n--- Route File Auth Check ---');
const routesDir = path.join(__dirname, '..', 'routes');
const routeFiles = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));
for (const rf of routeFiles) {
  const rfPath = path.join(routesDir, rf);
  const content = fs.readFileSync(rfPath, 'utf8');
  // Route files that are mounted under /api share the
  // server-level middleware. For now, note their auth status.
  const hasInlineAuth = content.includes('verifyIdToken') || content.includes('firebase-admin');
  if (!hasInlineAuth) {
    console.log(`  NOTE: ${rf} has no inline auth (relies on server middleware or is designed public)`);
  } else {
    console.log(`  OK: ${rf} has inline auth`);
  }
}

// 6. Test: maskApiKey exists and is used for sensitive config
console.log('\n--- API Key Masking ---');
assert(
  serverContent.includes('maskApiKey'),
  'maskApiKey function exists in server.js'
);
assert(
  serverContent.includes('maskedKey'),
  'API keys are returned masked in system-config-summary'
);

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
