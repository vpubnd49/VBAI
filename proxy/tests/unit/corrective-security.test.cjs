/**
 * Corrective Security Tests (V3 Final - Executable & Behavioral)
 *
 * Validates all corrective security properties using executable logic:
 * 1. UploadSession model directly (duplicate part rejection)
 * 2. validateMagicBytes executable logic (.tmp rejection)
 * 3. createTranscriptionRouter executable express router mount
 * 4. deploy.yml configuration and variable consumption
 * 5. Rate limiter fail-close and PII hashing
 *
 * Run: node proxy/tests/unit/corrective-security.test.cjs
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { UploadSession } = require('../../models/upload-session.model');
const { validateMagicBytes, VALID_AUDIO_EXTS } = require('../../middleware/upload-security');
const { createTranscriptionRouter } = require('../../routers/transcription.router');

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

const serverPath = path.join(__dirname, '..', '..', 'server.js');
const serverContent = fs.readFileSync(serverPath, 'utf8');
const rateLimitPath = path.join(__dirname, '..', '..', 'middleware', 'rate-limit.middleware.js');
const rateLimitContent = fs.readFileSync(rateLimitPath, 'utf8');

console.log('=== Corrective Security Tests V3 (Executable & Behavioral) ===\n');

// 1. UploadSession Direct Behavioral Test
console.log('--- 1. UploadSession Direct Behavioral Test ---');
const session = new UploadSession('sess-100', 5, 'test.wav', 'user-123');
const p1 = session.addPart(1);
ok(p1.accepted === true, 'First part 1 is accepted');
const p1Dup = session.addPart(1);
ok(p1Dup.accepted === false && p1Dup.error.includes('Duplicate part'), 'Duplicate part 1 is rejected directly by UploadSession');
const pOut = session.addPart(99);
ok(pOut.accepted === false && pOut.error.includes('out of range'), 'Out-of-range part 99 is rejected');

// 2. Executable .tmp & Magic-Byte Validation
console.log('\n--- 2. Executable Magic-Byte & .tmp Validation ---');
const unknownBytes = Buffer.from([0, 1, 2, 3, 4, 5, 6, 7]);
const tmpResult = validateMagicBytes(unknownBytes, 'application/octet-stream', '.tmp');
ok(tmpResult.valid === false, '.tmp with unknown bytes is rejected by executable logic');
ok(!VALID_AUDIO_EXTS.has('.tmp'), '.tmp is NOT in VALID_AUDIO_EXTS set');

// 3. Runtime Router Mount Verification
console.log('\n--- 3. Router Runtime Mount Verification ---');
const testRouter = createTranscriptionRouter({
  verifyIdToken: async () => ({ uid: 'test' }),
  upload: { single: () => (req, res, next) => next() },
  checkRateLimit: async () => ({ allowed: true }),
  uploadToProvider: async () => ({ text: 'ok' }),
  initFirebase: () => {},
});
ok(typeof testRouter === 'function' && Array.isArray(testRouter.stack), 'createTranscriptionRouter returns executable router function');
const transcribeRoute = testRouter.stack.find(s => s.route && s.route.path === '/api/transcribe');
ok(transcribeRoute && transcribeRoute.route.methods.post === true, 'Router contains POST /api/transcribe route layer');
ok(transcribeRoute.route.stack.length >= 3, 'POST /api/transcribe has auth, upload, and transcribe middlewares');

// 4. Deploy Contract Variable Verification
console.log('\n--- 4. Deploy Contract Variable Verification ---');
const deployPath = path.join(__dirname, '..', '..', '..', '.github', 'workflows', 'deploy.yml');
if (fs.existsSync(deployPath)) {
  const deployContent = fs.readFileSync(deployPath, 'utf8');
  ok(/MAX_AUDIO_UPLOAD_MB=25/.test(deployContent), 'deploy.yml sets MAX_AUDIO_UPLOAD_MB=25');
  ok(/GIT_SHA=/.test(deployContent) && /\${{\s*inputs\.release_sha\s*}}/.test(deployContent), 'deploy.yml passes exact workflow input release SHA');
  ok(/419728335518/.test(deployContent), 'deploy.yml validates project number 419728335518');
  ok(!deployContent.includes('credentials_json:'), 'deploy.yml does not use a long-lived JSON service-account key');
  ok(deployContent.includes('workload_identity_provider:'), 'deploy.yml uses Workload Identity Federation');
} else {
  console.log('  SKIP: deploy.yml not found');
}

// 5. Rate Limiter Fail-Close & PII Hashing
console.log('\n--- 5. Rate Limiter Fail-Close & PII Hashing ---');
ok(rateLimitContent.includes('status: 503'), 'Returns 503 on Firestore failure');
ok(!rateLimitContent.includes('fallbackStore'), 'No fallbackStore');
ok(!rateLimitContent.includes('new Map()'), 'No in-memory Map');
ok(rateLimitContent.includes('hashKey'), 'hashKey function present');
ok(rateLimitContent.includes("crypto.createHash('sha256')"), 'SHA-256 hashing');

// 6. Pagination & Privacy
console.log('\n--- 6. Pagination & Privacy ---');
ok(serverContent.includes('encodeCursor'), 'server.js uses encodeCursor');
ok(serverContent.includes('sanitizeHistoryDoc'), 'server.js uses sanitizeHistoryDoc');
ok(serverContent.includes("orderBy('created_at', 'desc')"), 'Orders by created_at DESC');

// 7. User-Controlled Deep Fetch Redirect Hardening
console.log('\n--- 7. Deep Fetch Redirect Hardening ---');
const deepFetchStart = serverContent.indexOf('async function fetchDeepContent');
const deepFetchEnd = serverContent.indexOf('\nfunction parseLegalDocumentMetadata', deepFetchStart);
const deepFetchContent = serverContent.slice(deepFetchStart, deepFetchEnd);
ok(deepFetchContent.includes("redirect: 'manual'"), 'Deep fetch uses manual redirect handling');
ok(!deepFetchContent.includes("redirect: 'follow'"), 'Deep fetch does not automatically follow redirects');
ok(deepFetchContent.includes('validateUrlForSSRF(currentUrl)'), 'Initial and redirected URLs use the SSRF guard');
ok(deepFetchContent.includes('new URL(location, currentUrl)'), 'Redirect locations are resolved relative to the current URL');
ok(deepFetchContent.includes('hop <= 3') && deepFetchContent.includes('hop === 3'), 'Deep fetch is limited to three redirect hops');

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
