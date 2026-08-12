/**
 * Transcription Controller (V2 Final)
 *
 * Handles /api/transcribe — delegates to transcription.service.js.
 * No inline business logic; controller is thin routing glue.
 *
 * Flow:
 * 1. Auth middleware (pre-verified, stashed in req._preAuthUser)
 * 2. Multer upload middleware (field: "audio")
 * 3. Rate limit check (sets Retry-After on 429 and fail-close 503)
 * 4. Delegate to service using single object contract
 */
'use strict';

const path = require('path');
const { MAX_AUDIO_UPLOAD_MB, MAX_AUDIO_UPLOAD_BYTES } = require('../schemas/upload-config');
const { registerCleanup, cleanupTempFile } = require('../middleware/upload-security');
const { transcribeSingleFile } = require('../services/transcription.service');

/**
 * Sanitize uploadId — whitelist [a-zA-Z0-9_-]
 * @param {string} raw
 * @returns {{ safe: string|null, error?: string }}
 */
function sanitizeUploadId(raw) {
  if (!raw) return { safe: null };
  const s = String(raw).replace(/[^a-zA-Z0-9_-]/g, '');
  if (!s || s !== String(raw)) {
    return { safe: null, error: 'uploadId contains invalid characters' };
  }
  return { safe: s };
}

/**
 * Main transcribe handler
 * @param {Object} deps - Injected dependencies
 * @param {Function} deps.checkRateLimit - (req, decoded) => { allowed, status, error, message, retryAfterSeconds }
 * @param {Function} deps.uploadToProvider - async ({ filePath, mimeType, filename, model, prompt }) => result
 * @param {Function} deps.initFirebase
 */
function createTranscribeHandler(deps) {
  const { checkRateLimit, uploadToProvider, initFirebase } = deps;

  return async (req, res) => {
    try {
      initFirebase();
      const decoded = req._preAuthUser;
      if (!decoded) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Rate limit check with Retry-After header support
      const rateCheck = await checkRateLimit(req, decoded);
      if (!rateCheck.allowed) {
        if (rateCheck.retryAfterSeconds) {
          res.set('Retry-After', String(rateCheck.retryAfterSeconds));
        }
        return res.status(rateCheck.status || 429).json({ error: rateCheck.error, message: rateCheck.message });
      }

      const { filename, model, prompt, part, total, uploadId } = req.body || {};
      const partNum = part ? parseInt(part, 10) : null;
      const totalNum = total ? parseInt(total, 10) : null;
      const tempFilePath = req.file?.path || null;
      registerCleanup(res, tempFilePath);

      const detectedMimeType = req.file?.mimetype || 'application/octet-stream';
      const effectiveFilename = req.file?.originalname || filename || 'audio';

      // Base64 fallback (disabled by default for streaming; size-capped)
      if (!tempFilePath && req.body?.audio_base64) {
        const b64Str = String(req.body.audio_base64);
        const estimatedDecodedSize = Math.ceil(b64Str.length * 3 / 4);
        if (estimatedDecodedSize > MAX_AUDIO_UPLOAD_BYTES) {
          return res.status(413).json({
            error: 'Payload too large',
            message: `Base64 audio exceeds ${MAX_AUDIO_UPLOAD_MB}MB limit`,
          });
        }
        return res.status(400).json({
          error: 'Base64 upload not supported',
          message: 'Please use multipart file upload with field name "audio"',
        });
      }

      if (!tempFilePath) {
        return res.status(400).json({ error: 'audio file is required (multipart field: audio)' });
      }

      // Chunked upload handling — Fail-closed 501 until GCS+Firestore distributed storage is wired
      if (partNum || totalNum || uploadId || req.body?.part || req.body?.total || req.query?.part || req.query?.uploadId) {
        cleanupTempFile(tempFilePath);
        return res.status(501).json({
          error: 'Not Implemented',
          message: 'CHUNK_UPLOAD_DISABLED_DISTRIBUTED_STORAGE_REQUIRED',
        });
      }

      // Single file transcription via object contract
      const result = await transcribeSingleFile({
        filePath: tempFilePath,
        mimeType: detectedMimeType,
        filename: effectiveFilename,
        model,
        prompt,
        uid: decoded.uid,
        uploadToProvider,
      });
      return res.status(result.error ? result.status : 200).json(result.body);
    } catch (err) {
      console.error('POST /api/transcribe error:', err);
      return res.status(500).json({ error: 'Internal server error', message: err.message });
    }
  };
}

module.exports = { createTranscribeHandler, sanitizeUploadId };
