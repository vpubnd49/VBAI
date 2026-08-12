/**
 * Transcription Router
 *
 * Mounts POST /api/transcribe with:
 * 1. Auth-before-upload middleware (verifyIdToken)
 * 2. Multer single('audio') middleware
 * 3. Transcription controller handler
 *
 * Usage in server.js:
 *   const { createTranscriptionRouter } = require('./routers/transcription.router');
 *   app.use(createTranscriptionRouter({ verifyIdToken, upload, checkRateLimit, uploadToProvider, initFirebase }));
 */
'use strict';

const express = require('express');
const { MAX_AUDIO_UPLOAD_MB } = require('../schemas/upload-config');
const { createTranscribeHandler } = require('../controllers/transcription.controller');

/**
 * Create the transcription router with injected dependencies.
 * @param {Object} deps
 * @param {Function} deps.verifyIdToken - (req) => decoded | null
 * @param {Object} deps.upload - Multer instance
 * @param {Function} deps.checkRateLimit - (req, decoded) => { allowed, ... }
 * @param {Function} deps.uploadToProvider - (filePath, mimeType, filename) => result
 * @param {Function} deps.initFirebase
 * @returns {express.Router}
 */
function createTranscriptionRouter(deps) {
  const { verifyIdToken, upload, checkRateLimit, uploadToProvider, initFirebase } = deps;
  const router = express.Router();

  // Auth-before-upload: verify token BEFORE multer processes the body
  const authMiddleware = async (req, res, next) => {
    initFirebase();
    try {
      const decoded = await verifyIdToken(req);
      if (!decoded) {
        return res.status(401).json({ error: 'Unauthorized', message: 'Valid auth token required' });
      }
      req._preAuthUser = decoded;
    } catch (_) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Valid auth token required' });
    }
    return next();
  };

  // Multer middleware with error handling
  const uploadMiddleware = (req, res, next) => {
    upload.single('audio')(req, res, (err) => {
      if (!err) return next();
      if (err?.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          error: 'Payload too large',
          message: `Audio file vuot qua gioi han ${MAX_AUDIO_UPLOAD_MB}MB`,
        });
      }
      return res.status(400).json({ error: 'Invalid upload', message: err.message || 'Upload failed' });
    });
  };

  const handler = createTranscribeHandler({ checkRateLimit, uploadToProvider, initFirebase });

  router.post('/api/transcribe', authMiddleware, uploadMiddleware, handler);

  return router;
}

module.exports = { createTranscriptionRouter };
