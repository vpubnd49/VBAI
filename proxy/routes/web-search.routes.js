/**
 * Express router for /api/web-search
 */
const express = require('express');
const router = express.Router();
const { orchestrateLegalSearch } = require('../legal/services/legal-search-orchestrator');

router.post('/web-search', async (req, res) => {
  try {
    const { query, mode, provider, forceFresh } = req.body || {};
    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Query parameter is required and must be a string.',
      });
    }

    const result = await orchestrateLegalSearch({
      query,
      forceFresh: forceFresh === true,
      mode,
      provider,
    });

    return res.json(result);
  } catch (err) {
    console.error('[web-search.routes] Error processing search request:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal server error while executing legal search.',
    });
  }
});

module.exports = router;
