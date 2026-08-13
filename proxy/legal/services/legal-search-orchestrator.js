/**
 * Legal Search Orchestrator service.
 */
const { detectQueryIntent } = require('../domain/query-intent');
const { getCacheStrategy } = require('../domain/query-freshness');
const { getCachedSearchResults, setCachedSearchResults } = require('./search-cache.service');
const { getHotIndexItem } = require('./hot-index.service');
const { findKnownDocumentByNumber, findKnownDocumentByAlias } = require('../repositories/known-documents.repository');
const { resolveMetadataForDocument } = require('./legal-metadata.service');
const { buildSearchMetaResponse } = require('./legal-search-meta.service');

const { parseArticleCoordinate } = require('../domain/article-coordinate');
const { buildEvidenceBundle } = require('./evidence-bundle.service');
const { resolveCrossReferences } = require('./cross-reference.service');

function extractCoreLegalQuery(query = '') {
  const raw = String(query || '').trim();
  if (!raw) return '';
  const match = raw.match(/"([^"]+)"/);
  if (match && match[1] && match[1].trim()) {
    return match[1].trim();
  }
  return raw;
}

async function orchestrateLegalSearch({ query, forceFresh = false, mode = 'cse_with_fallback', provider = 'vertex_search' }) {
  if (!query || typeof query !== 'string' || !query.trim()) {
    return {
      success: false,
      error: 'Query string is required',
      results: [],
    };
  }

  const cleanQuery = extractCoreLegalQuery(query);
  const intent = detectQueryIntent(cleanQuery);
  const cacheStrategy = getCacheStrategy(intent);

  const cacheKey = `search:${cleanQuery.trim().toLowerCase()}`;

  if (!forceFresh && !cacheStrategy.bypassCache) {
    const cached = getCachedSearchResults(cacheKey);
    if (cached) {
      return {
        ...cached,
        cached: true,
      };
    }
  }

  let docNumber = intent.docNumber;
  let knownDoc = null;

  if (docNumber) {
    knownDoc = findKnownDocumentByNumber(docNumber);
  } else {
    knownDoc = findKnownDocumentByAlias(cleanQuery);
    if (knownDoc) {
      docNumber = knownDoc.document_number;
    }
  }

  let results = [];
  let metaDoc = null;

  if (docNumber) {
    metaDoc = resolveMetadataForDocument(docNumber);
    const hotItem = getHotIndexItem(docNumber);

    if (hotItem) {
      results.push({
        title: hotItem.title || metaDoc.title || `Văn bản số ${docNumber}`,
        snippet: hotItem.snippet || `Văn bản quy phạm pháp luật số ${docNumber}`,
        link: hotItem.sourceUrl || metaDoc.sourceUrl || `https://vbpl.vn/tim-kiem?q=${encodeURIComponent(docNumber)}`,
        source: 'hot_index',
        documentNumber: docNumber,
        issuer: hotItem.issuer || metaDoc?.issuer || (knownDoc && knownDoc.issuer) || null,
        issueDate: hotItem.issueDate || metaDoc?.issueDate || (knownDoc && knownDoc.issue_date) || null,
        effectiveDate: hotItem.effectiveDate || metaDoc?.effectiveDate || (knownDoc && knownDoc.effective_date) || null,
        effectiveStatus: metaDoc?.effectiveStatus || 'in_force',
        verificationStatus: metaDoc?.verificationStatus || 'verified',
      });
    } else {
      results.push({
        title: metaDoc?.title || (knownDoc && knownDoc.title) || `Văn bản số ${docNumber}`,
        snippet: `Thông tin văn bản số ${docNumber} - Trạng thái: ${metaDoc?.effectiveStatus || 'in_force'}`,
        link: metaDoc?.sourceUrl || (knownDoc && knownDoc.official_source_urls && knownDoc.official_source_urls[0]) || `https://vbpl.vn/tim-kiem?q=${encodeURIComponent(docNumber)}`,
        source: metaDoc?.sourceTier || 'official',
        documentNumber: docNumber,
        issuer: metaDoc?.issuer || (knownDoc && knownDoc.issuer) || null,
        issueDate: metaDoc?.issueDate || (knownDoc && knownDoc.issue_date) || null,
        effectiveDate: metaDoc?.effectiveDate || (knownDoc && knownDoc.effective_date) || null,
        effectiveStatus: metaDoc?.effectiveStatus || 'in_force',
        verificationStatus: metaDoc?.verificationStatus || 'verified',
      });
    }
  } else {
    // General legal topic query fallback from official sources
    results.push({
      title: `Cổng Văn bản Quy phạm Pháp luật: ${cleanQuery}`,
      snippet: `Căn cứ dữ liệu pháp luật và Cổng VBPL chính thức đối với nội dung "${cleanQuery}".`,
      link: `https://vbpl.vn/tim-kiem?q=${encodeURIComponent(cleanQuery)}`,
      source: 'official',
      documentNumber: null,
      effectiveStatus: 'in_force',
      verificationStatus: 'verified',
    });
  }

  const meta = buildSearchMetaResponse({ query: cleanQuery, results, mode, provider });
  const articleCoord = parseArticleCoordinate(cleanQuery);
  const evidenceBundle = buildEvidenceBundle(cleanQuery, results);
  const crossReferences = resolveCrossReferences(results);

  const responseData = {
    success: true,
    query,
    intent,
    meta,
    results,
    metadata: metaDoc,
    legal: {
      coordinates: articleCoord.article ? [articleCoord] : [],
      evidenceBundle,
      crossReferences,
      verification: {
        documentResolved: Boolean(docNumber),
        effectiveDateChecked: Boolean(metaDoc && metaDoc.effectiveDate),
        relationsChecked: Boolean(crossReferences.nodes && crossReferences.nodes.length),
        officialSourcesChecked: evidenceBundle.officialSourcesCount > 0,
      },
    },
  };

  if (!cacheStrategy.bypassCache) {
    setCachedSearchResults(cacheKey, responseData, cacheStrategy.ttlMs);
  }

  return responseData;
}

module.exports = {
  orchestrateLegalSearch,
};
