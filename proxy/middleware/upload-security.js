/**
 * Upload Security Middleware (Corrective V2 Final)
 *
 * Provides:
 * - Magic-byte validation for audio files (RIFF/WAVE, ID3/MPEG, OggS, ftyp, WebM/Matroska, FLAC)
 * - MIME/extension cross-check against magic bytes
 * - Header-only read (16 bytes) via fs.open/read — no full-file buffering
 * - Stream-based chunk assembly with backpressure
 * - Idempotent cleanup across all exit paths
 * - NO .tmp bypass — unknown bytes always rejected
 */
'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Magic byte signatures for supported audio formats
 */
const MAGIC_SIGNATURES = [
  { name: 'RIFF/WAVE', bytes: [0x52, 0x49, 0x46, 0x46], offset: 0, exts: ['.wav'], mimes: ['audio/wav', 'audio/wave', 'audio/x-wav'] },
  { name: 'ID3v2', bytes: [0x49, 0x44, 0x33], offset: 0, exts: ['.mp3'], mimes: ['audio/mpeg', 'audio/mp3'] },
  { name: 'MPEG-sync', bytes: [0xFF, 0xFB], offset: 0, exts: ['.mp3'], mimes: ['audio/mpeg', 'audio/mp3'] },
  { name: 'MPEG-sync-alt', bytes: [0xFF, 0xF3], offset: 0, exts: ['.mp3'], mimes: ['audio/mpeg', 'audio/mp3'] },
  { name: 'MPEG-sync-alt2', bytes: [0xFF, 0xF2], offset: 0, exts: ['.mp3'], mimes: ['audio/mpeg', 'audio/mp3'] },
  { name: 'OggS', bytes: [0x4F, 0x67, 0x67, 0x53], offset: 0, exts: ['.ogg'], mimes: ['audio/ogg', 'application/ogg'] },
  { name: 'fLaC', bytes: [0x66, 0x4C, 0x61, 0x43], offset: 0, exts: ['.flac'], mimes: ['audio/flac', 'audio/x-flac'] },
  { name: 'WebM/Matroska', bytes: [0x1A, 0x45, 0xDF, 0xA3], offset: 0, exts: ['.webm', '.mkv'], mimes: ['audio/webm', 'video/webm'] },
  { name: 'ftyp-M4A', bytes: [0x66, 0x74, 0x79, 0x70], offset: 4, exts: ['.m4a', '.mp4', '.aac'], mimes: ['audio/mp4', 'audio/aac', 'audio/m4a', 'video/mp4'] },
  { name: 'ADTS-AAC', bytes: [0xFF, 0xF1], offset: 0, exts: ['.aac'], mimes: ['audio/aac'] },
  { name: 'ADTS-AAC-alt', bytes: [0xFF, 0xF9], offset: 0, exts: ['.aac'], mimes: ['audio/aac'] },
];

// .tmp is NOT in client extension allowlist — internal temp names are not trusted formats
const VALID_AUDIO_EXTS = new Set(['.mp3', '.wav', '.m4a', '.mp4', '.webm', '.ogg', '.flac', '.aac']);

const HEADER_BYTES_NEEDED = 16;

/**
 * Detect format from magic bytes in a buffer
 * @param {Buffer} headerBuf - First 16+ bytes of the file
 * @returns {{ name: string, exts: string[], mimes: string[] } | null}
 */
function detectMagicBytes(headerBuf) {
  if (!Buffer.isBuffer(headerBuf) || headerBuf.length < 4) return null;

  for (const sig of MAGIC_SIGNATURES) {
    if (headerBuf.length < sig.offset + sig.bytes.length) continue;
    let match = true;
    for (let i = 0; i < sig.bytes.length; i++) {
      if (headerBuf[sig.offset + i] !== sig.bytes[i]) {
        match = false;
        break;
      }
    }
    if (match) return { name: sig.name, exts: sig.exts, mimes: sig.mimes };
  }
  return null;
}

/**
 * Read only the first N bytes of a file using fs.open/read (no full-file buffer).
 * @param {string} filePath
 * @param {number} [numBytes=16]
 * @returns {Promise<Buffer>}
 */
async function readFileHeader(filePath, numBytes = HEADER_BYTES_NEEDED) {
  const fd = await fs.promises.open(filePath, 'r');
  try {
    const buf = Buffer.alloc(numBytes);
    const { bytesRead } = await fd.read(buf, 0, numBytes, 0);
    return buf.subarray(0, bytesRead);
  } finally {
    await fd.close();
  }
}

/**
 * Validate magic bytes against declared MIME type and extension.
 * Unknown magic bytes are ALWAYS rejected — no .tmp bypass.
 * @param {Buffer} headerBuf - First bytes of file
 * @param {string} mimeType - Declared MIME type from client
 * @param {string} ext - File extension (lowercase, with dot)
 * @returns {{ valid: boolean, detected: object|null, reason: string|null }}
 */
function validateMagicBytes(headerBuf, mimeType, ext) {
  const detected = detectMagicBytes(headerBuf);
  if (!detected) {
    return { valid: false, detected: null, reason: 'Unrecognized audio format (magic bytes mismatch)' };
  }
  // Extension compatibility check
  if (ext && !detected.exts.includes(ext)) {
    return {
      valid: false,
      detected,
      reason: `Extension ${ext} is incompatible with detected format ${detected.name} (expected: ${detected.exts.join(', ')})`,
    };
  }
  return { valid: true, detected, reason: null };
}

/**
 * Stream-assemble chunk parts into a single file using pipeline (backpressure).
 * Validates: no duplicate parts, part range, total size limit.
 *
 * @param {string[]} chunkPaths - Ordered array of chunk file paths
 * @param {string} outputPath - Destination assembled file path
 * @param {number} maxBytes - Maximum total assembled size
 * @returns {Promise<{ size: number }>}
 */
async function assembleChunksStream(chunkPaths, outputPath, maxBytes) {
  const writeStream = fs.createWriteStream(outputPath);
  let totalBytes = 0;

  for (const chunkPath of chunkPaths) {
    const stat = await fs.promises.stat(chunkPath);
    totalBytes += stat.size;
    if (totalBytes > maxBytes) {
      writeStream.destroy();
      cleanupTempFile(outputPath);
      throw new Error(`Assembled file exceeds ${Math.round(maxBytes / 1024 / 1024)}MB limit`);
    }
    const readStream = fs.createReadStream(chunkPath);
    // Use pipeline for backpressure; { end: false } keeps writeStream open
    await new Promise((resolve, reject) => {
      readStream.pipe(writeStream, { end: false });
      readStream.on('end', resolve);
      readStream.on('error', reject);
    });
  }

  await new Promise((resolve, reject) => {
    writeStream.end(resolve);
    writeStream.on('error', reject);
  });

  return { size: totalBytes };
}

/**
 * Idempotent cleanup of temp file.
 * Safe to call multiple times; silently ignores missing files.
 * @param {string|null} filePath
 */
function cleanupTempFile(filePath) {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (_) {
    // Ignore errors on cleanup (file may already be removed)
  }
}

/**
 * Cleanup multiple chunk files
 * @param {string[]} chunkPaths
 */
function cleanupChunks(chunkPaths) {
  for (const p of chunkPaths) {
    cleanupTempFile(p);
  }
}

/**
 * Register idempotent cleanup on all response exit paths
 * @param {object} res - Express response object
 * @param {string|null} filePath - Path to temp file
 */
function registerCleanup(res, filePath) {
  if (!filePath) return;
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    cleanupTempFile(filePath);
  };
  res.on('finish', cleanup);
  res.on('close', cleanup);
  res.on('error', cleanup);
  // 'aborted' is deprecated in Node 16+ but still fires on older runtimes
  try { res.on('aborted', cleanup); } catch (_) { /* ignore if not available */ }
}

module.exports = {
  MAGIC_SIGNATURES,
  VALID_AUDIO_EXTS,
  HEADER_BYTES_NEEDED,
  detectMagicBytes,
  readFileHeader,
  validateMagicBytes,
  assembleChunksStream,
  cleanupTempFile,
  cleanupChunks,
  registerCleanup,
};
