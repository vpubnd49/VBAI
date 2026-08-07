/**
 * Legal Evidence Bundle Assembly Service.
 * Constructs verified legal evidence bundles for client-side citation rendering & validation.
 */
const { classifySourceTier } = require('../domain/source-tier');
const { determineEffectiveStatus } = require('../domain/effective-status');
const { parseArticleCoordinate } = require('../domain/article-coordinate');

function buildEvidenceBundle(query = '', rawResults = [], options = {}) {
  const documents = [];
  let officialCount = 0;
  let referenceCount = 0;

  for (const item of rawResults) {
    const url = item.link || item.url || '';
    const tier = classifySourceTier(url);
    if (tier === 'official') officialCount++;
    if (tier === 'reference') referenceCount++;

    const statusInfo = determineEffectiveStatus({
      rawStatus: item.effectiveStatus || item.status || '',
      sourceTier: tier,
      hasExplicitValidityClause: Boolean(item.hasValidityClause),
      supersededBy: item.supersededBy || [],
    });

    const coordinate = parseArticleCoordinate(item.snippet || item.title || query);

    documents.push({
      id: item.id || `doc-${documents.length + 1}`,
      title: item.title || 'Văn bản pháp luật',
      documentNumber: item.documentNumber || item.number || null,
      issuer: item.issuer || null,
      issueDate: item.issueDate || null,
      effectiveDate: item.effectiveDate || null,
      effectiveStatus: statusInfo.effectiveStatus,
      verificationStatus: statusInfo.verificationStatus,
      sourceTier: tier,
      sourceUrl: url,
      snippet: item.snippet || item.snippetText || '',
      coordinate,
    });
  }

  let overallVerificationLevel = 'UNVERIFIED';
  if (officialCount > 0) {
    overallVerificationLevel = 'VERIFIED';
  } else if (referenceCount > 0) {
    overallVerificationLevel = 'PARTIAL';
  }

  return {
    query,
    totalSources: documents.length,
    officialSourcesCount: officialCount,
    referenceSourcesCount: referenceCount,
    verificationLevel: overallVerificationLevel,
    documents,
    timestamp: new Date().toISOString(),
  };
}

module.exports = {
  buildEvidenceBundle,
};
