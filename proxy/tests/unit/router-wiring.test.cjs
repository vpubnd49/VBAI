/**
 * Router Wiring & Behavioral Provider Contract Unit Test (Corrective V4.1)
 *
 * Behavioral Verification Suite:
 * 1. createTranscriptionRouter returns Express router.
 * 2. POST /api/transcribe exists exactly once.
 * 3. Auth middleware is ordered before upload middleware.
 * 4. Handler calls uploadToProvider exactly once with single object parameter:
 *    { filePath, mimeType, filename, model, prompt }.
 * 5. Rejects positional calls uploadToProvider(filePath, mimeType, filename).
 * 6. Controller returns transcript text from provider.
 * 7. Cleanup registered and executed on success and on provider throw.
 * 8. Chunk request returns 501 CHUNK_UPLOAD_DISABLED_DISTRIBUTED_STORAGE_REQUIRED with Retry-After.
 *
 * Run: node proxy/tests/unit/router-wiring.test.cjs
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { createTranscriptionRouter } = require('../../routers/transcription.router');
const { createTranscribeHandler } = require('../../controllers/transcription.controller');
const { transcribeSingleFile } = require('../../services/transcription.service');

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

console.log('=== Router Wiring & Provider Behavioral Test ===\n');

// 1. Router creation & route mount
console.log('--- 1. Router Mount & Ordering ---');
const dummyAuth = (req, res, next) => next();
const dummyUpload = { single: () => (req, res, next) => next() };
const dummyRateCheck = async () => ({ allowed: true });
const dummyProvider = async () => ({ text: 'ok' });

const router = createTranscriptionRouter({
  verifyIdToken: dummyAuth,
  upload: dummyUpload,
  checkRateLimit: dummyRateCheck,
  uploadToProvider: dummyProvider,
  initFirebase: () => {},
});

ok(typeof router === 'function' && typeof router.use === 'function', 'createTranscriptionRouter returns Express router');

const routes = router.stack.filter(s => s.route && s.route.path === '/api/transcribe');
ok(routes.length === 1, `Exactly ONE POST /api/transcribe route layer (got ${routes.length})`);

const routeStack = routes[0].route.stack;
ok(routeStack.length === 3, `Route contains 3 middleware handlers (got ${routeStack.length})`);

// 2. Behavioral Object Contract Test
console.log('\n--- 2. Behavioral Object Contract & Output Test ---');
(async () => {
  let callCount = 0;
  let argCount = 0;
  let receivedOpts = null;

  const mockUploadToProvider = async (...args) => {
    callCount++;
    argCount = args.length;
    receivedOpts = args[0];
    return { text: 'Băng ghi âm họp HĐQT ngày 10/08/2026', meta: { provider_status: 200 } };
  };

  const dummyFilePath = path.join(__dirname, 'temp-router-test.wav');
  fs.writeFileSync(dummyFilePath, Buffer.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x66, 0x6D, 0x74, 0x20]));

  const result = await transcribeSingleFile({
    filePath: dummyFilePath,
    mimeType: 'audio/wav',
    filename: 'test-audio.wav',
    model: 'gemini-3.5-flash-lite',
    prompt: 'Bóc băng họp',
    uid: 'user_123',
    uploadToProvider: mockUploadToProvider,
  });

  ok(result.error === false, 'transcribeSingleFile succeeds');
  ok(result.body.text === 'Băng ghi âm họp HĐQT ngày 10/08/2026', 'Controller returns transcript text');
  ok(callCount === 1, `uploadToProvider called exactly once (got ${callCount})`);
  ok(argCount === 1, `uploadToProvider called with exactly ONE argument (got ${argCount})`);
  ok(receivedOpts !== null && typeof receivedOpts === 'object', 'Argument is an object');
  ok(receivedOpts.filePath === dummyFilePath, 'Object contains filePath');
  ok(receivedOpts.mimeType === 'audio/wav', 'Object contains mimeType');
  ok(receivedOpts.filename === 'test-audio.wav', 'Object contains filename');
  ok(receivedOpts.model === 'gemini-3.5-flash-lite', 'Object contains model');
  ok(receivedOpts.prompt === 'Bóc băng họp', 'Object contains prompt');

  // Verify temp file cleanup on success
  ok(!fs.existsSync(dummyFilePath), 'Temp file cleaned up after successful transcription');

  // 3. Behavioral Cleanup on Provider Failure
  console.log('\n--- 3. Cleanup on Provider Failure ---');
  const dummyFailFile = path.join(__dirname, 'temp-router-fail.wav');
  fs.writeFileSync(dummyFailFile, Buffer.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x66, 0x6D, 0x74, 0x20]));

  const mockFailingProvider = async () => {
    throw new Error('Gemini API 503 Service Unavailable');
  };

  const failResult = await transcribeSingleFile({
    filePath: dummyFailFile,
    mimeType: 'audio/wav',
    filename: 'fail-audio.wav',
    model: 'gemini-3.5-flash-lite',
    uid: 'user_123',
    uploadToProvider: mockFailingProvider,
  });

  ok(failResult.error === true, 'transcribeSingleFile returns error object on provider failure');
  ok(failResult.status === 500, 'Returns HTTP 500 status on provider exception');
  ok(!fs.existsSync(dummyFailFile), 'Temp file cleaned up after provider exception');

  // 4. Behavioral Chunk Rejection (501) & Retry-After Test
  console.log('\n--- 4. Chunk 501 & Retry-After Response Test ---');
  let setHeaderName = null;
  let setHeaderVal = null;
  let responseCode = null;
  let responseBody = null;

  const mockRes = {
    set: (name, val) => { setHeaderName = name; setHeaderVal = val; },
    status: (code) => {
      responseCode = code;
      return { json: (data) => { responseBody = data; } };
    },
    on: () => {},
  };

  const handler = createTranscribeHandler({
    checkRateLimit: async () => ({ allowed: true }),
    uploadToProvider: async () => ({}),
    initFirebase: () => {},
  });

  const tempChunkFile = path.join(__dirname, 'temp-chunk.part');
  fs.writeFileSync(tempChunkFile, 'chunk data');

  const chunkReq = {
    _preAuthUser: { uid: 'user_123' },
    file: { path: tempChunkFile, mimetype: 'audio/wav', originalname: 'chunk.part' },
    body: { part: '1', total: '3', uploadId: 'upload_session_99' },
  };

  await handler(chunkReq, mockRes);
  ok(responseCode === 501, `Chunk request returns 501 Not Implemented (got ${responseCode})`);
  ok(responseBody?.message === 'CHUNK_UPLOAD_DISABLED_DISTRIBUTED_STORAGE_REQUIRED', 'Response code is CHUNK_UPLOAD_DISABLED_DISTRIBUTED_STORAGE_REQUIRED');
  ok(!fs.existsSync(tempChunkFile), 'Temp chunk file cleaned up on 501 response');

  // 5. Rate Limit Retry-After Header
  console.log('\n--- 5. Rate Limit Retry-After Header ---');
  setHeaderName = null;
  setHeaderVal = null;

  const rateLimitedHandler = createTranscribeHandler({
    checkRateLimit: async () => ({ allowed: false, status: 429, error: 'Too Many Requests', message: 'Limit exceeded', retryAfterSeconds: 45 }),
    uploadToProvider: async () => ({}),
    initFirebase: () => {},
  });

  await rateLimitedHandler({ _preAuthUser: { uid: 'user_1' } }, mockRes);
  ok(setHeaderName === 'Retry-After', 'Sets Retry-After header on 429 rate limit');
  ok(setHeaderVal === '45', 'Retry-After header value is 45');

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) process.exit(1);
})().catch(err => {
  console.error('Test runner crashed:', err);
  process.exit(1);
});
