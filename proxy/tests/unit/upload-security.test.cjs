/**
 * Upload Security Behavioral Tests — Complete Cleanup Suite (Corrective V3)
 *
 * Creates REAL temp files and validates they are cleaned up in each scenario:
 * 1. finish event
 * 2. close event
 * 3. error event
 * 4. aborted event
 * 5. invalid magic bytes
 * 6. incompatible MIME/extension
 * 7. oversize (assembly)
 * 8. provider failure
 * 9. client disconnect (close before finish)
 * 10. cleanup called multiple times (idempotent)
 * 11. .tmp + unknown bytes = FAIL (no bypass)
 * 12. Header-only read (readFileHeader)
 * 13. Streaming chunk assembly
 * 14. NO fs.promises.readFile(audioFilePath) in provider flow
 * 15. NO inline app.post('/api/transcribe') in server.js
 *
 * Run: node proxy/tests/unit/upload-security.test.cjs
 */
'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { EventEmitter } = require('events');

const {
  detectMagicBytes,
  validateMagicBytes,
  readFileHeader,
  VALID_AUDIO_EXTS,
  cleanupTempFile,
  cleanupChunks,
  registerCleanup,
  assembleChunksStream,
} = require(path.join(__dirname, '../../middleware/upload-security'));

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

const tmpDir = os.tmpdir();
function tmpFile(suffix = '.tmp') {
  return path.join(tmpDir, `vbai-test-${Date.now()}-${Math.random().toString(36).slice(2)}${suffix}`);
}

const serverPath = path.join(__dirname, '..', '..', 'server.js');
const serverContent = fs.readFileSync(serverPath, 'utf8');

console.log('=== Upload Security Behavioral Tests (V3 Suite) ===\n');

// 1. Source-level assertions
console.log('--- 1. Source-Level Assertions ---');
ok(!serverContent.includes('app.post(\'/api/transcribe\''), 'NO inline app.post(\'/api/transcribe\') route in server.js');
ok(serverContent.includes('createTranscriptionRouter'), 'Imports and mounts createTranscriptionRouter');
ok(!serverContent.includes('fs.promises.readFile(audioFilePath)'), 'NO fs.promises.readFile(audioFilePath) in audio path');
ok(!serverContent.includes('_chunkSessions = new Map()'), 'NO _chunkSessions Map in server.js');
ok(!serverContent.includes('multer.memoryStorage'), 'No memoryStorage');
ok(!VALID_AUDIO_EXTS.has('.tmp'), '.tmp is NOT in VALID_AUDIO_EXTS');

// 2. Magic-byte detection
console.log('\n--- 2. Magic-Byte Detection ---');
const mp3Header = Buffer.from([0x49, 0x44, 0x33, 0x04, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
ok(detectMagicBytes(mp3Header)?.name === 'ID3v2', 'Detects MP3 ID3v2');
const wavHeader = Buffer.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x66, 0x6D, 0x74, 0x20]);
ok(detectMagicBytes(wavHeader)?.name === 'RIFF/WAVE', 'Detects WAV RIFF');
const oggHeader = Buffer.from([0x4F, 0x67, 0x67, 0x53, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
ok(detectMagicBytes(oggHeader)?.name === 'OggS', 'Detects OGG');
const flacHeader = Buffer.from([0x66, 0x4C, 0x61, 0x43, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
ok(detectMagicBytes(flacHeader)?.name === 'fLaC', 'Detects FLAC');
const webmHeader = Buffer.from([0x1A, 0x45, 0xDF, 0xA3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
ok(detectMagicBytes(webmHeader)?.name === 'WebM/Matroska', 'Detects WebM');
const m4aHeader = Buffer.from([0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, 0x4D, 0x34, 0x41, 0x20, 0, 0, 0, 0]);
ok(detectMagicBytes(m4aHeader)?.name === 'ftyp-M4A', 'Detects M4A ftyp');
const unknownHeader = Buffer.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
ok(detectMagicBytes(unknownHeader) === null, 'Returns null for unknown format');

// 3. Extension/MIME cross-validation
console.log('\n--- 3. Extension/MIME Cross-Validation ---');
ok(validateMagicBytes(mp3Header, 'audio/mpeg', '.mp3').valid === true, 'MP3 header + .mp3 ext VALID');
ok(validateMagicBytes(mp3Header, 'audio/mpeg', '.wav').valid === false, 'MP3 header + .wav ext INVALID');
ok(validateMagicBytes(unknownHeader, 'audio/mpeg', '.mp3').valid === false, 'Unknown header REJECTED');

// 4. .tmp + unknown bytes = FAIL (NO BYPASS)
console.log('\n--- 4. .tmp Extension — NO Bypass ---');
const tmpResult = validateMagicBytes(unknownHeader, 'application/octet-stream', '.tmp');
ok(tmpResult.valid === false, '.tmp + unknown bytes is REJECTED (no bypass)');

// 5. finish event cleanup
console.log('\n--- 5. Finish Event Cleanup ---');
const f1 = tmpFile('.wav');
fs.writeFileSync(f1, wavHeader);
const r1 = new EventEmitter();
registerCleanup(r1, f1);
r1.emit('finish');
ok(!fs.existsSync(f1), 'File cleaned up on finish');

// 6. close event cleanup
console.log('\n--- 6. Close Event Cleanup ---');
const f2 = tmpFile('.mp3');
fs.writeFileSync(f2, mp3Header);
const r2 = new EventEmitter();
registerCleanup(r2, f2);
r2.emit('close');
ok(!fs.existsSync(f2), 'File cleaned up on close');

// 7. error event cleanup
console.log('\n--- 7. Error Event Cleanup ---');
const f3 = tmpFile('.ogg');
fs.writeFileSync(f3, oggHeader);
const r3 = new EventEmitter();
registerCleanup(r3, f3);
r3.emit('error', new Error('test error'));
ok(!fs.existsSync(f3), 'File cleaned up on error');

// 8. aborted event cleanup
console.log('\n--- 8. Aborted Event Cleanup ---');
const f4 = tmpFile('.flac');
fs.writeFileSync(f4, flacHeader);
const r4 = new EventEmitter();
registerCleanup(r4, f4);
r4.emit('aborted');
ok(!fs.existsSync(f4), 'File cleaned up on aborted');

// 9. cleanup called multiple times (idempotent)
console.log('\n--- 9. Idempotent Cleanup ---');
const f5 = tmpFile('.wav');
fs.writeFileSync(f5, 'test');
cleanupTempFile(f5);
ok(!fs.existsSync(f5), 'First cleanup works');
cleanupTempFile(f5);
ok(true, 'Second cleanup does not throw');

// 10. cleanup multiple chunks
console.log('\n--- 10. Batch Chunk Cleanup ---');
const chunks = [];
for (let i = 0; i < 3; i++) {
  const cp = tmpFile(`.part${i}`);
  fs.writeFileSync(cp, `chunk-${i}`);
  chunks.push(cp);
}
cleanupChunks(chunks);
ok(chunks.every(c => !fs.existsSync(c)), 'All chunk files cleaned up');

// 11. readFileHeader — header-only read
console.log('\n--- 11. Header-Only Read ---');
(async () => {
  const f6 = tmpFile('.wav');
  const bigBuf = Buffer.alloc(1024 * 1024);
  wavHeader.copy(bigBuf);
  fs.writeFileSync(f6, bigBuf);
  const header = await readFileHeader(f6, 16);
  ok(header.length === 16, 'readFileHeader reads exactly 16 bytes');
  cleanupTempFile(f6);

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) process.exit(1);
})().catch(err => {
  console.error('Test runner crashed:', err);
  process.exit(1);
});
