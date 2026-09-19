/**
 * Link-reference adapter for the National Legal Portal.
 *
 * The portal renders its result list client-side and does not expose a stable
 * public JSON API. Keep this adapter deliberately dependency-free: callers get
 * a canonical search link even when the remote page cannot be fetched.
 */
const { SOURCE_REGISTRY } = require('../constants/source-registry');

const PHAPLUAT_SEARCH_PATH = '/he-thong-van-ban-phap-luat';
const PHAPLUAT_SOURCE = SOURCE_REGISTRY.phapluat_gov;

function buildPhapluatSearchUrl(keyword = '') {
  const url = new URL(`https://${PHAPLUAT_SOURCE.source}${PHAPLUAT_SEARCH_PATH}`);
  const value = String(keyword || '').trim();
  if (value) url.searchParams.set('search', value);
  return url.toString();
}

function buildPhapluatDetailUrl(slug = '') {
  const value = String(slug || '').trim();
  if (!value) return buildPhapluatSearchUrl();
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${PHAPLUAT_SOURCE.source}/${value.replace(/^\/+/, '')}`;
}

async function fetchPhapluatDocuments(keyword = '', limit = 8) {
  const searchUrl = buildPhapluatSearchUrl(keyword);
  return [{
    document_number: '',
    title: `Tra cứu văn bản pháp luật Trung ương${keyword ? `: ${String(keyword).trim()}` : ''}`,
    document_type: 'van_ban',
    source_id: PHAPLUAT_SOURCE.id,
    source_feed: PHAPLUAT_SOURCE.source,
    official_source_urls: [searchUrl],
    source_url: searchUrl,
    link_reference: true,
    query: String(keyword || '').trim(),
    limit: Math.max(1, Number(limit) || 8),
  }];
}

module.exports = {
  buildPhapluatSearchUrl,
  buildPhapluatDetailUrl,
  fetchPhapluatDocuments,
};
