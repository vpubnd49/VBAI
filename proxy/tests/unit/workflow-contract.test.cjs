/**
 * Workflow Contract Test (Corrective V4 Architecture)
 *
 * Verifies ALL 9 backend layers exist and export expected contracts:
 * 1. proxy/controllers/ — transcription.controller.js
 * 2. proxy/models/ — upload-session.model.js
 * 3. proxy/routers/ — transcription.router.js
 * 4. proxy/schemas/ — upload-config.js
 * 5. proxy/services/ — transcription.service.js
 * 6. proxy/repositories/ — upload.repository.js
 * 7. proxy/utils/ — pagination.js
 * 8. proxy/prompts/ — transcription.prompt.js
 * 9. proxy/middleware/ — auth, rate-limit, upload-security
 *
 * Also validates deploy.yml contract, router wiring, and fail-closed chunk mode.
 *
 * Run: node proxy/tests/unit/workflow-contract.test.cjs
 */
'use strict';

const fs = require('fs');
const path = require('path');

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

const PROXY_ROOT = path.join(__dirname, '..', '..');

console.log('=== Workflow Contract Test (V4 Architecture — 9 Layers) ===\n');

// 1. All 9 directories exist
console.log('--- 1. Directory Structure (9 layers) ---');
const requiredDirs = [
  'controllers', 'models', 'routers', 'schemas',
  'services', 'repositories', 'utils', 'prompts', 'middleware',
];
for (const dir of requiredDirs) {
  const dirPath = path.join(PROXY_ROOT, dir);
  ok(fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory(), `${dir}/ directory exists`);
}

// 2. Module contracts — each file require-able with expected exports
console.log('\n--- 2. Module Contracts ---');

// controllers/transcription.controller.js
try {
  const tc = require(path.join(PROXY_ROOT, 'controllers', 'transcription.controller'));
  ok(typeof tc.createTranscribeHandler === 'function', 'transcription.controller exports createTranscribeHandler');
  ok(typeof tc.sanitizeUploadId === 'function', 'transcription.controller exports sanitizeUploadId');
} catch (e) { ok(false, `controllers/transcription.controller failed: ${e.message}`); }

// models/upload-session.model.js
try {
  const { UploadSession } = require(path.join(PROXY_ROOT, 'models', 'upload-session.model'));
  ok(typeof UploadSession === 'function', 'upload-session.model exports UploadSession class');
  const s = new UploadSession('test', 3, 'audio.mp3', 'uid1');
  ok(s.totalParts === 3, 'UploadSession sets totalParts');
} catch (e) { ok(false, `models/upload-session.model failed: ${e.message}`); }

// routers/transcription.router.js
try {
  const { createTranscriptionRouter } = require(path.join(PROXY_ROOT, 'routers', 'transcription.router'));
  ok(typeof createTranscriptionRouter === 'function', 'transcription.router exports createTranscriptionRouter');
} catch (e) { ok(false, `routers/transcription.router failed: ${e.message}`); }

// schemas/upload-config.js
try {
  const uc = require(path.join(PROXY_ROOT, 'schemas', 'upload-config'));
  ok(uc.DEFAULT_MAX_AUDIO_UPLOAD_MB === 25, 'upload-config DEFAULT is 25');
  ok(uc.ABSOLUTE_MAX_AUDIO_UPLOAD_MB === 50, 'upload-config ABSOLUTE is 50');
  ok(typeof uc.MAX_AUDIO_UPLOAD_MB === 'number', 'MAX_AUDIO_UPLOAD_MB is number');
  ok(typeof uc.MAX_AUDIO_UPLOAD_BYTES === 'number', 'MAX_AUDIO_UPLOAD_BYTES is number');
} catch (e) { ok(false, `schemas/upload-config failed: ${e.message}`); }

// services/transcription.service.js
try {
  const ts = require(path.join(PROXY_ROOT, 'services', 'transcription.service'));
  ok(typeof ts.validateUploadedFile === 'function', 'transcription.service exports validateUploadedFile');
  ok(typeof ts.transcribeSingleFile === 'function', 'transcription.service exports transcribeSingleFile');
} catch (e) { ok(false, `services/transcription.service failed: ${e.message}`); }

// repositories/upload.repository.js
try {
  const ur = require(path.join(PROXY_ROOT, 'repositories', 'upload.repository'));
  ok(typeof ur.saveChunk === 'function', 'upload.repository exports saveChunk');
  ok(typeof ur.getChunkPath === 'function', 'upload.repository exports getChunkPath');
  ok(typeof ur.getAssembledPath === 'function', 'upload.repository exports getAssembledPath');
  const repoContent = fs.readFileSync(path.join(PROXY_ROOT, 'repositories', 'upload.repository.js'), 'utf8');
  ok(!repoContent.includes('activeSessions = new Map()'), 'NO activeSessions Map in upload.repository.js');
} catch (e) { ok(false, `repositories/upload.repository failed: ${e.message}`); }

// utils/pagination.js
try {
  const pag = require(path.join(PROXY_ROOT, 'utils', 'pagination'));
  ok(typeof pag.encodeCursor === 'function', 'pagination exports encodeCursor');
  ok(typeof pag.decodeCursor === 'function', 'pagination exports decodeCursor');
  ok(typeof pag.validateCursor === 'function', 'pagination exports validateCursor');
  ok(typeof pag.sanitizeHistoryDoc === 'function', 'pagination exports sanitizeHistoryDoc');
  ok(Array.isArray(pag.SAFE_HISTORY_FIELDS), 'pagination exports SAFE_HISTORY_FIELDS');
} catch (e) { ok(false, `utils/pagination failed: ${e.message}`); }

// prompts/transcription.prompt.js
try {
  const tp = require(path.join(PROXY_ROOT, 'prompts', 'transcription.prompt'));
  ok(typeof tp.TRANSCRIPTION_SYSTEM_PROMPT === 'string', 'transcription.prompt exports TRANSCRIPTION_SYSTEM_PROMPT');
  ok(typeof tp.buildTranscriptionPrompt === 'function', 'transcription.prompt exports buildTranscriptionPrompt');
} catch (e) { ok(false, `prompts/transcription.prompt failed: ${e.message}`); }

// middleware
try {
  const us = require(path.join(PROXY_ROOT, 'middleware', 'upload-security'));
  ok(typeof us.readFileHeader === 'function', 'upload-security exports readFileHeader');
  ok(typeof us.assembleChunksStream === 'function', 'upload-security exports assembleChunksStream');
  ok(typeof us.cleanupChunks === 'function', 'upload-security exports cleanupChunks');
  ok(us.VALID_AUDIO_EXTS instanceof Set, 'VALID_AUDIO_EXTS is a Set');
  ok(!us.VALID_AUDIO_EXTS.has('.tmp'), '.tmp NOT in VALID_AUDIO_EXTS');
} catch (e) { ok(false, `middleware/upload-security failed: ${e.message}`); }

try {
  const rl = require(path.join(PROXY_ROOT, 'middleware', 'rate-limit.middleware'));
  ok(typeof rl.DistributedRateLimiter === 'function', 'rate-limit exports DistributedRateLimiter');
} catch (e) { ok(false, `middleware/rate-limit.middleware failed: ${e.message}`); }

// 3. Server.js V4 Architecture Contract
console.log('\n--- 3. Server.js V4 Architecture Contract ---');
const serverContent = fs.readFileSync(path.join(PROXY_ROOT, 'server.js'), 'utf8');
ok(serverContent.includes("require('./routers/transcription.router')"), 'Imports transcription.router');
ok(serverContent.includes('app.use(createTranscriptionRouter('), 'Mounts createTranscriptionRouter');
ok(!serverContent.includes("app.post('/api/transcribe'"), 'NO inline app.post("/api/transcribe") in server.js');
ok(!serverContent.includes('fs.promises.readFile(audioFilePath)'), 'NO fs.promises.readFile(audioFilePath)');
ok(!serverContent.includes('_chunkSessions = new Map()'), 'NO _chunkSessions Map in server.js');

// 4. Controller & Rate-Limit Contract
console.log('\n--- 4. Controller Fail-Closed & Retry-After Contract ---');
const controllerContent = fs.readFileSync(path.join(PROXY_ROOT, 'controllers', 'transcription.controller.js'), 'utf8');
ok(controllerContent.includes('CHUNK_UPLOAD_DISABLED_DISTRIBUTED_STORAGE_REQUIRED'), 'Contains CHUNK_UPLOAD_DISABLED_DISTRIBUTED_STORAGE_REQUIRED code');
ok(controllerContent.includes('Retry-After'), 'Controller sets Retry-After header');
ok(controllerContent.includes('status(501)'), 'Returns 501 for chunk uploads');

// 5. Deploy.yml Contract
console.log('\n--- 5. Deploy.yml Contract ---');
const deployPath = path.join(PROXY_ROOT, '..', '.github', 'workflows', 'deploy.yml');
if (fs.existsSync(deployPath)) {
  const dc = fs.readFileSync(deployPath, 'utf8');
  ok(dc.includes('gen-lang-client-0462350485'), 'PROJECT_ID present');
  ok(dc.includes('EXPECTED_PROJECT_NUMBER: "419728335518"'), 'Project number present');
  ok(dc.includes('REGION: asia-southeast1') || dc.includes('asia-southeast1'), 'REGION is asia-southeast1');
  ok(dc.includes('WEBAPP_SERVICE: vbai'), 'WEBAPP_SERVICE is vbai');
  ok(dc.includes('PROXY_SERVICE: vbai-proxy'), 'PROXY_SERVICE is vbai-proxy');
  ok(dc.includes('MAX_AUDIO_UPLOAD_MB: "25"') || dc.includes('MAX_AUDIO_UPLOAD_MB=25'), 'MAX_AUDIO_UPLOAD_MB is 25');
  ok(!dc.includes('MAX_AUDIO_UPLOAD_MB=500'), 'NO MAX_AUDIO_UPLOAD_MB=500 in deploy.yml');
  ok(!dc.includes('LATEST=100'), 'NO LATEST=100 in deploy.yml');
  ok(!dc.includes('set +e'), 'Rollback does not suppress command failures');
  ok(dc.includes("failure() && steps.release.outcome == 'success'"), 'Rollback requires recorded rollback targets');
  ok(dc.includes('positive.some(row => row.revisionName!==expected)'), 'Rollback verifies exact restored traffic');
  ok((dc.match(/--no-traffic/g) || []).length >= 2, 'Both candidates deploy with --no-traffic');
  ok(dc.includes('steps.candidates.outputs.vbai_proxy_revision'), 'Promotes the exact recorded proxy revision');
  ok(dc.includes('steps.candidates.outputs.vbai_revision'), 'Promotes the exact recorded webapp revision');
  ok(!dc.includes('credentials_json:'), 'No long-lived JSON service-account authentication');
  ok(dc.includes('GCP_WORKLOAD_IDENTITY_PROVIDER'), 'Uses Workload Identity Federation');
  ok(dc.includes('@${{ needs.build.outputs.proxy_digest }}'), 'Deploys proxy by immutable digest');
  ok(dc.includes('@${{ needs.build.outputs.webapp_digest }}'), 'Deploys webapp by immutable digest');
  ok(dc.includes('playwright install --with-deps chromium'), 'Installs the locked Playwright browser before UI gates');
  ok(dc.includes('vbai-419728335518.asia-southeast1.run.app'), 'CANONICAL_PRODUCTION_URL present');
} else {
  console.log('  SKIP: deploy.yml not found');
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
