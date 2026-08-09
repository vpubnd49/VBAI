/**
 * Express router for /api/legal-research endpoints.
 */
const express = require('express');
const router = express.Router();
const { processLegalQuery } = require('../legal/services/legal-query-engine');
const { getDocumentMetadata } = require('../legal/services/answer-validator');

router.post('/legal-research/query', async (req, res) => {
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

router.get('/legal-sources/:documentNumber', (req, res) => {
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

module.exports = router;
