/**
 * Query freshness policy logic.
 */
const { isFreshnessQuery } = require('./query-intent');

function shouldForceFreshSearch({ query = '', forceFresh = false, maxAgeMs = null }) {
  if (forceFresh === true) return true;
  if (isFreshnessQuery(query)) return true;
  if (typeof maxAgeMs === 'number' && maxAgeMs === 0) return true;
  return false;
}

function getCacheStrategy(queryIntent) {
  if (queryIntent.isFreshness || queryIntent.mode === 'freshness_search') {
    return {
      bypassCache: true,
      bypassHotIndex: true,
      preferOfficial: true,
      ttlMs: 0,
    };
  }
  return {
    bypassCache: false,
    bypassHotIndex: false,
    preferOfficial: true,
    ttlMs: 90000,
  };
}

module.exports = {
  shouldForceFreshSearch,
  getCacheStrategy,
};
