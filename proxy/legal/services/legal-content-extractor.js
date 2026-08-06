/**
 * Legal Content Extractor service.
 */
const { extractStrictLegalText } = require('../../lib/legal-extract');
const { classifySourceTier } = require('../domain/source-tier');
const crypto = require('crypto');

function extractLegalContent({ text = '', article = null, clause = null, point = null, sourceUrl = '' }) {
  const extractedResult = extractStrictLegalText(text, { article, clause, point });
  const sourceTier = classifySourceTier(sourceUrl);
  const contentHash = crypto.createHash('sha256').update(text || '').digest('hex');

  return {
    text: extractedResult.text || '',
    extracted: extractedResult.extracted || false,
    strict_match: extractedResult.strict_match || false,
    article_found: extractedResult.article_found !== undefined ? extractedResult.article_found : null,
    clause_found: extractedResult.clause_found !== undefined ? extractedResult.clause_found : null,
    point_found: extractedResult.point_found !== undefined ? extractedResult.point_found : null,
    extract_mode: extractedResult.strict_match ? 'strict' : 'fallback',
    source_url: sourceUrl || null,
    source_tier: sourceTier,
    retrieved_at: new Date().toISOString(),
    content_hash: contentHash,
    warnings: extractedResult.strict_match ? [] : ['Content did not match strict Article/Clause/Point criteria'],
  };
}

module.exports = {
  extractLegalContent,
};
