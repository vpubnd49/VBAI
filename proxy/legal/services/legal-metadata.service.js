/**
 * Service to aggregate legal metadata across sources by confidence tier.
 */
const { getLocalMetadataByDocumentNumber } = require('../repositories/local-metadata.repository');
const { findKnownDocumentByNumber } = require('../repositories/known-documents.repository');

function resolveMetadataForDocument(docNumber = '') {
  if (!docNumber) return null;

  const localMeta = getLocalMetadataByDocumentNumber(docNumber);
  const knownDoc = findKnownDocumentByNumber(docNumber);

  if (localMeta) return localMeta;

  if (knownDoc) {
    return {
      documentNumber: knownDoc.document_number,
      title: knownDoc.title || null,
      documentType: knownDoc.document_type || null,
      issuer: knownDoc.issuer || null,
      issueDate: knownDoc.issue_date || null,
      effectiveDate: knownDoc.effective_date || null,
      effectiveStatus: knownDoc.effective_status || 'unknown',
      statusAsOf: knownDoc.status_as_of || null,
      replaces: knownDoc.replaces || [],
      amends: knownDoc.amends || [],
      supersededBy: knownDoc.superseded_by || [],
      sourceUrl: (knownDoc.official_source_urls && knownDoc.official_source_urls[0]) || null,
      sourceTier: 'known_repository',
      retrievedAt: null,
      contentSha256: null,
      verificationStatus: knownDoc.verification_status || 'unverified',
      reviewState: knownDoc.review_state || 'draft',
      provenance: {},
    };
  }

  return {
    documentNumber: docNumber,
    title: null,
    documentType: null,
    issuer: null,
    issueDate: null,
    effectiveDate: null,
    effectiveStatus: 'unknown',
    statusAsOf: null,
    replaces: [],
    amends: [],
    supersededBy: [],
    sourceUrl: null,
    sourceTier: 'unknown',
    retrievedAt: null,
    contentSha256: null,
    verificationStatus: 'unverified',
    reviewState: 'draft',
    provenance: {},
  };
}

module.exports = {
  resolveMetadataForDocument,
};
