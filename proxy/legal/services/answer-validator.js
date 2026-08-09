/**
 * Legal Answer Validation Service.
 * Validates generated AI responses against authoritative document metadata repositories.
 */
const path = require('path');
const fs = require('fs');
const { normalizeDocumentNumber } = require('../domain/document-number');

let bosungCache = null;
let knownDocsCache = null;

function loadBosungData() {
  if (bosungCache) return bosungCache;
  try {
    const raw = fs.readFileSync(path.join(__dirname, '../../bosung_metadata.json'), 'utf8');
    bosungCache = JSON.parse(raw);
  } catch (e) {
    console.warn('[answer-validator] Failed to load bosung_metadata.json:', e.message);
    bosungCache = {};
  }
  return bosungCache;
}

function loadKnownDocsData() {
  if (knownDocsCache) return knownDocsCache;
  try {
    const raw = fs.readFileSync(path.join(__dirname, '../data/known-documents.json'), 'utf8');
    knownDocsCache = JSON.parse(raw);
  } catch (e) {
    console.warn('[answer-validator] Failed to load known-documents.json:', e.message);
    knownDocsCache = [];
  }
  return knownDocsCache;
}

function findInBosungMetadata(docNumber = '') {
  if (!docNumber) return null;
  const target = normalizeDocumentNumber(docNumber);
  const bosung = loadBosungData();
  for (const key of Object.keys(bosung)) {
    const entry = bosung[key];
    if (entry && normalizeDocumentNumber(entry.so_hieu) === target) {
      return {
        source: 'bosung_metadata',
        sourceTier: 'official',
        documentNumber: entry.so_hieu,
        documentType: entry.loai_van_ban || '',
        title: entry.trich_yeu || '',
        issuer: entry.co_quan_ban_hanh || '',
        issueDate: entry.ngay_ban_hanh || null,
        effectiveDate: entry.ngay_hieu_luc || null,
        effectiveStatus: entry.tinh_trang_hieu_luc || 'co_hieu_luc',
        replacements: entry.thay_the_cho || [],
        summary: entry.tom_tat_chinh_sach || '',
        chapterArticleSummary: entry.tom_tat_chuong_dieu || '',
        verified: true,
        verificationStatus: 'verified',
      };
    }
  }
  return null;
}

function findInKnownDocuments(docNumber = '') {
  if (!docNumber) return null;
  const target = normalizeDocumentNumber(docNumber);
  const docs = loadKnownDocsData();
  const found = docs.find((d) => normalizeDocumentNumber(d.document_number) === target);
  if (!found) return null;
  // Strictly evidence-based verification: only mark verified if artifacts exist
  const hasEvidenceArtifacts = Array.isArray(found.official_source_urls)
    && found.official_source_urls.length > 0
    && found.verified_at;
  const isVerified = found.verification_status === 'verified' && hasEvidenceArtifacts;
  return {
    source: 'known_documents',
    sourceTier: isVerified ? 'official' : 'reference',
    documentNumber: found.document_number,
    documentType: found.document_type || '',
    title: found.title || '',
    issuer: found.issuer || '',
    issueDate: found.issue_date || null,
    effectiveDate: found.effective_date || null,
    effectiveStatus: found.effective_status || 'unknown',
    replacements: found.replaces || [],
    summary: '',
    chapterArticleSummary: '',
    verified: isVerified,
    verificationStatus: isVerified ? 'verified' : (found.verification_status || 'unverified'),
  };
}

function getDocumentMetadata(docNumber = '') {
  if (!docNumber) return null;
  // Priority: bosung_metadata.json (authoritative) > known-documents.json
  return findInBosungMetadata(docNumber) || findInKnownDocuments(docNumber);
}

function isDocumentKnown(docNumber = '') {
  return getDocumentMetadata(docNumber) !== null;
}

function validateAnswer(answer = {}) {
  const warnings = [];
  const blockers = [];

  if (!answer || typeof answer !== 'object') {
    return { valid: true, warnings: [], blockers: [], documentCount: 0, citationCount: 0, verifiedDocuments: 0 };
  }

  if (Array.isArray(answer.documents)) {
    for (const doc of answer.documents) {
      const docNum = doc.documentNumber || doc.number || '';
      if (!docNum) continue;

      const meta = getDocumentMetadata(docNum);
      if (!meta) {
        warnings.push(`Van ban ${docNum} chua duoc xac nhan trong he thong du lieu.`);
      } else if (doc.status && doc.status !== meta.effectiveStatus) {
        warnings.push(`Cảnh báo tinh trang hieu luc cua ${docNum}: he thong ghi nhận [${meta.effectiveStatus}] nhung tra loi la [${doc.status}].`);
      }
    }
  }

  if (Array.isArray(answer.citations)) {
    for (const cit of answer.citations) {
      const docNum = cit.documentNumber || cit.documentId || '';
      if (docNum && !isDocumentKnown(docNum)) {
        warnings.push(`Trich dan tu van ban ${docNum} chua duoc xac nhan trong co so du lieu.`);
      }
    }
  }

  return {
    valid: blockers.length === 0,
    warnings,
    blockers,
    documentCount: Array.isArray(answer.documents) ? answer.documents.length : 0,
    citationCount: Array.isArray(answer.citations) ? answer.citations.length : 0,
    verifiedDocuments: Array.isArray(answer.documents)
      ? answer.documents.filter(d => isDocumentKnown(d.documentNumber || d.number || '')).length
      : 0,
  };
}

function clearValidatorCaches() {
  bosungCache = null;
  knownDocsCache = null;
}

module.exports = {
  isDocumentKnown,
  getDocumentMetadata,
  findInBosungMetadata,
  findInKnownDocuments,
  validateAnswer,
  clearValidatorCaches,
};
