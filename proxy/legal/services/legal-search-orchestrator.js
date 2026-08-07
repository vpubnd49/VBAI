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

async function orchestrateLegalSearch({ query, forceFresh = false, mode = 'cse_with_fallback', provider = 'vertex_search' }) {
  if (!query || typeof query !== 'string' || !query.trim()) {
    return {
      success: false,
      error: 'Query string is required',
      results: [],
    };
  }

  const intent = detectQueryIntent(query);
  const cacheStrategy = getCacheStrategy(intent);

  const cacheKey = `search:${query.trim().toLowerCase()}`;

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
    knownDoc = findKnownDocumentByAlias(query);
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
        effectiveStatus: metaDoc.effectiveStatus,
        verificationStatus: metaDoc.verificationStatus,
      });
    } else {
      results.push({
        title: metaDoc.title || (knownDoc && knownDoc.title) || `Văn bản số ${docNumber}`,
        snippet: `Thông tin văn bản số ${docNumber} - Trạng thái: ${metaDoc.effectiveStatus}`,
        link: metaDoc.sourceUrl || `https://vbpl.vn/tim-kiem?q=${encodeURIComponent(docNumber)}`,
        source: metaDoc.sourceTier,
        documentNumber: docNumber,
        effectiveStatus: metaDoc.effectiveStatus,
        verificationStatus: metaDoc.verificationStatus,
      });
    }
  }

  const meta = buildSearchMetaResponse({ query, results, mode, provider });
  const articleCoord = parseArticleCoordinate(query);
  const evidenceBundle = buildEvidenceBundle(query, results);
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
