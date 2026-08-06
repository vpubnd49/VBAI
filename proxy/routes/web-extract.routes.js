/**
 * Express router for /api/web-extract
 */
const express = require('express');
const router = express.Router();
const { validateFetchUrl } = require('../legal/services/legal-content-fetcher');
const { extractLegalContent } = require('../legal/services/legal-content-extractor');

router.post('/web-extract', async (req, res) => {
  try {
    const { url, article, clause, point, rawText } = req.body || {};

    if (url) {
      const validation = validateFetchUrl(url);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: validation.reason,
        });
      }
    }

    const textToExtract = rawText || '';
    const result = extractLegalContent({
      text: textToExtract,
      article,
      clause,
      point,
      sourceUrl: url,
    });

    return res.json({
      success: true,
      ...result,
    });
  } catch (err) {
    console.error('[web-extract.routes] Error processing extraction:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal server error while extracting legal content.',
    });
  }
});

module.exports = router;
