/**
 * Transcription Service
 *
 * Handles the core transcription logic:
 * - Single-file streaming transcription via Gemini Files API
 * - Magic-byte verification on uploaded files
 * - Stream-based provider upload (no full-file Buffer)
 */
'use strict';

const fs = require('fs');
const path = require('path');
const {
  readFileHeader,
  validateMagicBytes,
  VALID_AUDIO_EXTS,
  cleanupTempFile,
} = require('../middleware/upload-security');
const { TRANSCRIPTION_SYSTEM_PROMPT, buildTranscriptionPrompt } = require('../prompts/transcription.prompt');

/**
 * Validate the uploaded file's extension and magic bytes using header-only read.
 * @param {string} filePath - Path to temp file on disk
 * @param {string} mimeType - Declared MIME
 * @param {string} ext - Lowercase extension with dot
 * @returns {Promise<{ valid: boolean, reason?: string }>}
 */
async function validateUploadedFile(filePath, mimeType, ext) {
  // Extension check
  if (ext && !VALID_AUDIO_EXTS.has(ext)) {
    return { valid: false, reason: `Unsupported extension ${ext}` };
  }
  // Magic-byte check using header-only read (16 bytes, not full file)
  const header = await readFileHeader(filePath, 16);
  if (header.length < 4) {
    return { valid: false, reason: 'File too small to identify audio format' };
  }
  const magicResult = validateMagicBytes(header, mimeType, ext);
  if (!magicResult.valid) {
    return { valid: false, reason: magicResult.reason };
  }
  return { valid: true };
}

/**
 * Handle a single transcription request.
 * Streams the file to the provider using object contract without loading into RAM.
 *
 * @param {Object} opts
 * @param {string} opts.filePath - Multer temp file path
 * @param {string} opts.mimeType - Declared MIME
 * @param {string} opts.filename - Original filename
 * @param {string} opts.model - Model name
 * @param {string} [opts.prompt] - Optional custom prompt
 * @param {string} opts.uid - User ID
 * @param {Function} opts.uploadToProvider - async ({ filePath, mimeType, filename, model, prompt }) => providerResult
 * @returns {Promise<Object>}
 */
async function transcribeSingleFile({ filePath, mimeType, filename, model, prompt, uid, uploadToProvider }) {
  const ext = path.extname(filename).toLowerCase();
  const validation = await validateUploadedFile(filePath, mimeType, ext);
  if (!validation.valid) {
    cleanupTempFile(filePath);
    return { error: true, status: 400, body: { error: 'Invalid audio format', message: validation.reason } };
  }

  try {
    const result = await uploadToProvider({ filePath, mimeType, filename, model, prompt });
    return { error: false, body: result };
  } catch (err) {
    return { error: true, status: err.status || 500, body: { error: 'Transcription failed', message: err.message } };
  } finally {
    cleanupTempFile(filePath);
  }
}

module.exports = {
  validateUploadedFile,
  transcribeSingleFile,
  TRANSCRIPTION_SYSTEM_PROMPT,
  buildTranscriptionPrompt,
};
