/**
 * Fail-closed policy at the boundary between legal retrieval and generation.
 * Dependency-free so the security contract can be tested without Express,
 * Firebase, or an AI provider.
 */
'use strict';

const LEGAL_EVIDENCE_REQUIRED_MESSAGE =
  'Không tìm thấy thông tin trong cơ sở dữ liệu.';

function hasUsableLegalEvidence(legalContext) {
  if (!legalContext || legalContext.available === false) return false;
  if (legalContext.verification && legalContext.verification.available === false) return false;
  const documents = legalContext.evidenceBundle?.documents;
  return Array.isArray(documents) && documents.length > 0;
}

function evaluateLegalEvidence({ isLegalQuery, legalContext }) {
  if (!isLegalQuery) {
    return { allowed: true, code: null, message: null, reason: null };
  }
  if (hasUsableLegalEvidence(legalContext)) {
    return { allowed: true, code: null, message: null, reason: null };
  }
  return {
    allowed: false,
    code: 'LEGAL_EVIDENCE_REQUIRED',
    message: LEGAL_EVIDENCE_REQUIRED_MESSAGE,
    reason: legalContext?.reason || 'LEGAL_EVIDENCE_UNAVAILABLE',
  };
}

function selectValidatedLegalItems({ validation, officialCandidateItems = [] }) {
  if (validation?.ok === true) {
    return Array.isArray(validation.approvedItems) ? validation.approvedItems : [];
  }
  return Array.isArray(officialCandidateItems) ? officialCandidateItems : [];
}

function hasUnsafeCitations(citationValidation) {
  if (!citationValidation || typeof citationValidation !== 'object') return false;
  const citations = Array.isArray(citationValidation.citations)
    ? citationValidation.citations
    : [];
  const total = Number.isFinite(Number(citationValidation.totalCitations))
    ? Number(citationValidation.totalCitations)
    : citations.length;
  if (total <= 0) return false;
  if (Number(citationValidation.unverifiedCitationsCount || 0) >= 3 && Number(citationValidation.validCitationsCount || 0) === 0) {
    return true;
  }
  return false;
}

module.exports = {
  LEGAL_EVIDENCE_REQUIRED_MESSAGE,
  hasUsableLegalEvidence,
  evaluateLegalEvidence,
  selectValidatedLegalItems,
  hasUnsafeCitations,
};
