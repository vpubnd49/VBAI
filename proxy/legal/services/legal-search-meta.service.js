/**
 * Metadata builder for search responses.
 */
const { classifySourceTier } = require('../domain/source-tier');

function buildSearchMetaResponse({ query, results = [], mode = 'cse_with_fallback', provider = 'vertex_search' }) {
  const containsOfficial = results.some((r) => classifySourceTier(r.link || r.url) === 'official');
  return {
    query,
    mode,
    provider,
    total_results: results.length,
    contains_official_sources: containsOfficial,
    timestamp: new Date().toISOString(),
  };
}

module.exports = {
  buildSearchMetaResponse,
};
