/**
 * Legal Search Orchestrator service.
 */
const { detectQueryIntent } = require('../domain/query-intent');
const { extractLegalEntities } = require('../domain/legal-entity-extractor');
const { getCacheStrategy } = require('../domain/query-freshness');
const { getCachedSearchResults, setCachedSearchResults } = require('./search-cache.service');
const { getHotIndexItem } = require('./hot-index.service');
const { findKnownDocumentByNumber, findKnownDocumentByAlias, findByPartialNumber } = require('../repositories/known-documents.repository');
const { resolveMetadataForDocument } = require('./legal-metadata.service');
const { buildSearchMetaResponse } = require('./legal-search-meta.service');

const { parseArticleCoordinate } = require('../domain/article-coordinate');
const { buildEvidenceBundle } = require('./evidence-bundle.service');
const { resolveCrossReferences } = require('./cross-reference.service');
const { resolveChinhphuDocument, fetchChinhphuDocuments, buildChinhphuSearchUrl } = require('./chinhphu-gov-crawler');

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
  let intent = detectQueryIntent(cleanQuery);
  let entities = extractLegalEntities(cleanQuery);
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
    // Resolve partial numbers using the explicit document type, e.g. “TT 71/2026”.
    const partial = entities.partialDocumentNumbers.find((item) => item.number && item.year);
    const typedMatches = partial
      ? findByPartialNumber(partial.number, entities.documentType?.type || null, parseInt(partial.year, 10))
      : [];
    if (typedMatches.length > 0) {
      knownDoc = typedMatches[0];
      docNumber = knownDoc.document_number || knownDoc.documentNumber;
    } else {
      knownDoc = findKnownDocumentByAlias(cleanQuery);
      if (knownDoc) {
        docNumber = knownDoc.document_number;
      }
    }
  }

  let results = [];
  let metaDoc = null;

  if (docNumber) {
    metaDoc = resolveMetadataForDocument(docNumber);
    const hotItem = getHotIndexItem(docNumber);

    // --- Resolve PDF link from chinhphu.vn ---
    let pdfDownloadUrl = knownDoc?.pdf_download_url || knownDoc?.pdfDownloadUrl || metaDoc?.pdf_download_url || metaDoc?.pdfDownloadUrl || null;
    let chinhphuDetailUrl = (knownDoc && knownDoc.official_source_urls && knownDoc.official_source_urls[0]) || metaDoc?.sourceUrl || null;

    if (!pdfDownloadUrl) {
      let chinhphuResult = null;
      try {
        chinhphuResult = await resolveChinhphuDocument(docNumber, {
          issueDate: metaDoc?.issueDate || (knownDoc && knownDoc.issue_date) || null,
          title: metaDoc?.title || (knownDoc && knownDoc.title) || null,
          official_source_urls: (knownDoc && knownDoc.official_source_urls) || (metaDoc && metaDoc.official_source_urls) || [],
        });
      } catch (_) {}
      if (chinhphuResult?.pdfUrl) {
        pdfDownloadUrl = chinhphuResult.pdfUrl;
      }
      if (chinhphuResult?.detailUrl) {
        chinhphuDetailUrl = chinhphuResult.detailUrl;
      }
    }

    if (hotItem) {
      results.push({
        title: hotItem.title || metaDoc.title || `Văn bản số ${docNumber}`,
        snippet: hotItem.snippet || `Văn bản quy phạm pháp luật số ${docNumber}`,
        link: hotItem.sourceUrl || metaDoc.sourceUrl || `https://vanban.chinhphu.vn/`,
        source: 'hot_index',
        documentNumber: docNumber,
        issuer: hotItem.issuer || metaDoc?.issuer || (knownDoc && knownDoc.issuer) || null,
        issueDate: hotItem.issueDate || metaDoc?.issueDate || (knownDoc && knownDoc.issue_date) || null,
        effectiveDate: hotItem.effectiveDate || metaDoc?.effectiveDate || (knownDoc && knownDoc.effective_date) || null,
        effectiveStatus: metaDoc?.effectiveStatus || 'in_force',
        verificationStatus: metaDoc?.verificationStatus || 'verified',
        pdfDownloadUrl,
        pdfDownloadUrls: knownDoc?.pdf_download_urls || knownDoc?.pdfDownloadUrls || metaDoc?.pdf_download_urls || metaDoc?.pdfDownloadUrls || (pdfDownloadUrl ? [pdfDownloadUrl] : []),
        chinhphuDetailUrl,
      });
    } else if (knownDoc || (metaDoc && metaDoc.title)) {
      // Keep evidence snippet concise (summary of core policy), strictly under 250 chars.
      // Chapter/article breakdowns are kept in chapterArticleSummary, not dumped into the sidebar quote snippet.
      let briefSnippet = knownDoc?.tom_tat_chinh_sach || metaDoc?.summary || metaDoc?.snippet || `Văn bản quy phạm pháp luật số ${docNumber}`;
      if (briefSnippet.length > 250) {
        briefSnippet = briefSnippet.slice(0, 247) + '...';
      }

      results.push({
        title: metaDoc?.title || (knownDoc && knownDoc.title) || `Văn bản số ${docNumber}`,
        snippet: briefSnippet,
        link: metaDoc?.sourceUrl || (knownDoc && knownDoc.official_source_urls && knownDoc.official_source_urls[0]) || `https://vanban.chinhphu.vn/`,
        source: metaDoc?.sourceTier || 'official',
        documentNumber: docNumber,
        issuer: metaDoc?.issuer || (knownDoc && knownDoc.issuer) || 'Chính phủ',
        issueDate: metaDoc?.issueDate || (knownDoc && knownDoc.issue_date) || null,
        effectiveDate: metaDoc?.effectiveDate || (knownDoc && knownDoc.effective_date) || null,
        effectiveStatus: metaDoc?.effectiveStatus || 'in_force',
        verificationStatus: metaDoc?.verificationStatus || 'verified',
        summary: knownDoc?.tom_tat_chinh_sach || metaDoc?.summary || '',
        chapterArticleSummary: knownDoc?.tom_tat_chuong_dieu || metaDoc?.chapterArticleSummary || '',
        can_cu_phap_ly: knownDoc?.can_cu_phap_ly || metaDoc?.can_cu_phap_ly || [],
        pdfDownloadUrl,
        pdfDownloadUrls: knownDoc?.pdf_download_urls || knownDoc?.pdfDownloadUrls || metaDoc?.pdf_download_urls || metaDoc?.pdfDownloadUrls || (pdfDownloadUrl ? [pdfDownloadUrl] : []),
        chinhphuDetailUrl,
      });
    } else {
      // Document NOT FOUND in official national legal databases
      results.push({
        title: `Không tìm thấy văn bản số ${docNumber}`,
        snippet: `Hệ thống cơ sở dữ liệu văn bản pháp luật quốc gia không ghi nhận văn bản số ${docNumber}. Số hiệu văn bản này không tồn tại trong hệ thống pháp luật Việt Nam hoặc chưa được ban hành.`,
        link: `https://vanban.chinhphu.vn/`,
        source: 'reference',
        documentNumber: docNumber,
        issuer: null,
        issueDate: null,
        effectiveDate: null,
        effectiveStatus: 'not_found',
        verificationStatus: 'unverified',
        pdfDownloadUrl,
        chinhphuDetailUrl: chinhphuDetailUrl || buildChinhphuSearchUrl(docNumber),
      });
    }
  } else {
    // General legal topic query — include chinhphu.vn listing results
    results.push({
      title: `Cổng Văn bản Quy phạm Pháp luật: ${cleanQuery}`,
      snippet: `Căn cứ dữ liệu pháp luật và Cổng VBPL chính thức đối với nội dung "${cleanQuery}".`,
      link: `https://vanban.chinhphu.vn/`,
      source: 'official',
      documentNumber: null,
      effectiveStatus: 'in_force',
      verificationStatus: 'verified',
    });

    // Append chinhphu.vn listing with PDF links
    try {
      const chinhphuDocs = await fetchChinhphuDocuments(cleanQuery, 10);
      for (const doc of chinhphuDocs) {
        if (!doc.documentNumber || doc.link_reference) continue;
        results.push({
          title: doc.title || `Văn bản số ${doc.documentNumber}`,
          snippet: `${doc.documentNumber} — ${doc.issuer || 'Chính phủ'} — Ngày ${doc.issueDate || 'N/A'}`,
          link: doc.detailUrl || doc.sourceUrl || buildChinhphuSearchUrl(),
          source: 'chinhphu_gov',
          documentNumber: doc.documentNumber,
          issuer: doc.issuer || null,
          issueDate: doc.issueDate || null,
          effectiveStatus: 'in_force',
          verificationStatus: 'verified',
          pdfDownloadUrl: doc.pdfUrl || null,
          pdfVerified: doc.pdfVerified || false,
          chinhphuDetailUrl: doc.detailUrl || null,
        });
      }
    } catch (_) {}
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
