/**
 * Validation service for legal document number, type, and source accuracy.
 */
const { isFullDocumentNumber, normalizeDocumentNumber } = require('../domain/document-number');
const { classifySourceTier } = require('../domain/source-tier');
const { findKnownDocumentByNumber } = require('../repositories/known-documents.repository');

function validateLegalDocument({ documentNumber, url = '', documentType = '' }) {
  const normNumber = normalizeDocumentNumber(documentNumber);
  const isValidNumber = isFullDocumentNumber(normNumber);
  const sourceTier = classifySourceTier(url);
  const knownDoc = findKnownDocumentByNumber(normNumber);

  return {
    documentNumber: normNumber,
    isValidNumber,
    sourceTier,
    isKnownDocument: !!knownDoc,
    knownDoc,
    verificationStatus: sourceTier === 'official' && isValidNumber ? 'verified' : 'unverified',
  };
}

module.exports = {
  validateLegalDocument,
};
