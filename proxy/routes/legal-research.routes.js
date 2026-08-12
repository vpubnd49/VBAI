/**
 * Express router for /api/legal-research endpoints.
 * Auth enforced via shared middleware (Prompt 03).
 */
'use strict';
const express = require('express');
const router = express.Router();
const { processLegalQuery } = require('../legal/services/legal-query-engine');
const { getDocumentMetadata } = require('../legal/services/answer-validator');
const { makeAuthMiddleware } = require('../middleware/auth.middleware');

let _requireAuth = null;

/**
 * Initialize router with a modular Firebase Auth client.
 * Must be called before mounting the router.
 * @param {{verifyIdToken: Function}} authClient
 */
function initRouter(authClient) {
  const mw = makeAuthMiddleware(authClient);
  _requireAuth = mw.requireAuth;
  return router;
}

// Lazy middleware wrapper: resolves _requireAuth at request time.
// Missing initialization is a service failure, never an authentication bypass.
function authGuard(req, res, next) {
  if (!_requireAuth) {
    res.set('Retry-After', '30');
    return res.status(503).json({
      error: 'AUTH_SERVICE_UNAVAILABLE',
      message: 'Authentication service is not initialized. Please retry later.',
    });
  }
  return _requireAuth()(req, res, next);
}

router.post('/legal-research/query', authGuard, async (req, res) => {
  try {
    const { query, conversationContext, effectiveDate, mode } = req.body || {};
    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({ success: false, error: 'Query is required.' });
    }
    const result = await processLegalQuery({ query: query.trim(), conversationContext, effectiveDate, mode });
    return res.json(result);
  } catch (err) {
    console.error('[legal-research.routes] Error processing query:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.get('/legal-sources/:documentNumber', authGuard, (req, res) => {
  try {
    const docNumber = decodeURIComponent(req.params.documentNumber || '').trim();
    if (!docNumber) return res.status(400).json({ success: false, error: 'Document number is required' });
    const meta = getDocumentMetadata(docNumber);
    if (!meta) return res.status(404).json({ success: false, error: `Document ${docNumber} not found` });
    return res.json({ success: true, document: meta });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = { router, initRouter, authGuard };
