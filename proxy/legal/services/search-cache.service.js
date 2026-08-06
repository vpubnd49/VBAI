/**
 * In-memory web search result cache with TTL.
 */
const WEB_SEARCH_RESULT_CACHE = new Map();
const DEFAULT_TTL_MS = 90000;
const MAX_CACHE_SIZE = 200;

function getCachedSearchResults(key = '') {
  if (!key) return null;
  const entry = WEB_SEARCH_RESULT_CACHE.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > entry.ttlMs) {
    WEB_SEARCH_RESULT_CACHE.delete(key);
    return null;
  }
  return entry.data;
}

function setCachedSearchResults(key = '', data = null, ttlMs = DEFAULT_TTL_MS) {
  if (!key || !data) return;
  if (WEB_SEARCH_RESULT_CACHE.size >= MAX_CACHE_SIZE) {
    const firstKey = WEB_SEARCH_RESULT_CACHE.keys().next().value;
    WEB_SEARCH_RESULT_CACHE.delete(firstKey);
  }
  WEB_SEARCH_RESULT_CACHE.set(key, {
    data,
    timestamp: Date.now(),
    ttlMs,
  });
}

function clearSearchCache() {
  WEB_SEARCH_RESULT_CACHE.clear();
}

module.exports = {
  getCachedSearchResults,
  setCachedSearchResults,
  clearSearchCache,
};
