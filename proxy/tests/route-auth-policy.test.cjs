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

// 5. Test: Mounted route files must have auth
console.log('\n--- Route File Auth Check ---');
const routesDir = path.join(__dirname, '..', 'routes');
const routeFiles = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));

// Route files that are mounted in server.js must use auth middleware
const MOUNTED_WITH_AUTH_REQUIRED = ['legal-research.routes.js'];
const NOT_MOUNTED = ['web-search.routes.js', 'web-extract.routes.js'];

for (const rf of routeFiles) {
  const rfPath = path.join(routesDir, rf);
  const content = fs.readFileSync(rfPath, 'utf8');

  if (MOUNTED_WITH_AUTH_REQUIRED.includes(rf)) {
    // Must use the shared auth middleware or verifyIdToken
    const hasAuth = content.includes('makeAuthMiddleware') ||
                    content.includes('requireAuth') ||
                    content.includes('verifyIdToken') ||
                    content.includes('authGuard');
    assert(hasAuth, `${rf} (mounted, auth-required) uses auth middleware`);
  } else if (NOT_MOUNTED.includes(rf)) {
    console.log(`  NOTE: ${rf} not mounted — inline handlers in server.js handle auth`);
  } else {
    const hasInlineAuth = content.includes('verifyIdToken') || content.includes('firebase-admin') || content.includes('makeAuthMiddleware');
    if (!hasInlineAuth) {
      console.log(`  NOTE: ${rf} has no inline auth (verify it's intentionally public or unmounted)`);
    } else {
      console.log(`  OK: ${rf} has inline auth`);
    }
  }
}


// 6. Legal research auth initialization must fail closed.
console.log('\n--- Legal Research Auth Initialization ---');
const legalResearchSource = fs.readFileSync(
  path.join(routesDir, 'legal-research.routes.js'),
  'utf8'
);
assert(
  /if\s*\(!_requireAuth\)[\s\S]*?status\(503\)[\s\S]*?AUTH_SERVICE_UNAVAILABLE/.test(legalResearchSource),
  'legal-research router fails closed with 503 when auth is not initialized'
);
assert(
  !/if\s*\(!_requireAuth\)[\s\S]{0,180}?return\s+next\(\)/.test(legalResearchSource),
  'legal-research router has no missing-auth pass-through'
);

// 7. Test: maskApiKey exists and is used for sensitive config
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
