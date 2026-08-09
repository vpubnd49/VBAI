/**
 * Repository for known documents with in-memory caching.
 */
const path = require('path');
const fs = require('fs');
const { normalizeDocumentNumber } = require('../domain/document-number');
const { normalizeVietnamese } = require('../domain/normalize-vietnamese');

let cachedDocuments = null;

function loadKnownDocuments(forceReload = false) {
  if (cachedDocuments && !forceReload) {
    return cachedDocuments;
  }
  const filePath = path.join(__dirname, '..', 'data', 'known-documents.json');
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    cachedDocuments = JSON.parse(raw);
  } catch (e) {
    console.warn('[known-documents.repository] Failed to read known-documents.json:', e.message);
    cachedDocuments = [];
  }
  return cachedDocuments;
}

function findKnownDocumentByNumber(docNumber = '') {
  if (!docNumber) return null;
  const target = normalizeDocumentNumber(docNumber);
  const docs = loadKnownDocuments();
  return docs.find((d) => normalizeDocumentNumber(d.document_number) === target) || null;
}

function findKnownDocumentByAlias(query = '') {
  if (!query) return null;
  const qNorm = normalizeVietnamese(query);
  const docs = loadKnownDocuments();

  for (const doc of docs) {
    if (doc.topic_aliases && Array.isArray(doc.topic_aliases)) {
      for (const alias of doc.topic_aliases) {
        if (qNorm.includes(normalizeVietnamese(alias))) {
          return doc;
        }
      }
    }
    if (doc.query_patterns && Array.isArray(doc.query_patterns)) {
      for (const pat of doc.query_patterns) {
        if (qNorm.includes(normalizeVietnamese(pat))) {
          return doc;
        }
      }
    }
  }
  return null;
}

function validateKnownDocumentRegistry() {
  const docs = loadKnownDocuments(true);
  const errors = [];
  if (!Array.isArray(docs)) {
    return { valid: false, errors: ['Known documents must be an array'] };
  }
  docs.forEach((doc, idx) => {
    if (!doc.id || !doc.document_number || !doc.document_type) {
      errors.push(`Document index ${idx} is missing required fields (id, document_number, document_type)`);
    }
  });
  return {
    valid: errors.length === 0,
    count: docs.length,
    errors,
  };
}

/**
 * Find documents by partial number (e.g., "72" or "72/2025").
 * Searches both known-documents.json and bosung_metadata.json.
 */
function findByPartialNumber(number = '', docType = null, yearFilter = null) {
  if (!number) return [];
  const numStr = String(number).trim();
  const results = [];

  // Search known-documents.json
  const docs = loadKnownDocuments();
  for (const doc of docs) {
    const dn = String(doc.document_number || '');
    // Match if the document number starts with the bare number + "/"
    if (dn.startsWith(numStr + '/') || dn === numStr) {
      if (docType && doc.document_type !== docType) continue;
      if (yearFilter && !dn.includes('/' + yearFilter + '/')) continue;
      results.push({
        documentNumber: doc.document_number,
        title: doc.title || '',
        documentType: doc.document_type || '',
        issuer: doc.issuer || '',
        effectiveStatus: doc.effective_status || 'unknown',
        source: 'known_documents',
      });
    }
  }

  // Search bosung_metadata.json
  try {
    const bosungPath = path.join(__dirname, '../../bosung_metadata.json');
    const bosungRaw = fs.readFileSync(bosungPath, 'utf8');
    const bosung = JSON.parse(bosungRaw);
    for (const key of Object.keys(bosung)) {
      const entry = bosung[key];
      if (!entry || !entry.so_hieu) continue;
      const dn = String(entry.so_hieu);
      if (dn.startsWith(numStr + '/') || dn === numStr) {
        if (docType && entry.loai_van_ban !== docType) continue;
        if (yearFilter && !dn.includes('/' + yearFilter + '/')) continue;
        // Avoid duplicates
        if (!results.some(r => normalizeDocumentNumber(r.documentNumber) === normalizeDocumentNumber(dn))) {
          results.push({
            documentNumber: dn,
            title: entry.trich_yeu || '',
            documentType: entry.loai_van_ban || '',
            issuer: entry.co_quan_ban_hanh || '',
            effectiveStatus: entry.tinh_trang_hieu_luc || 'unknown',
            source: 'bosung_metadata',
          });
        }
      }
    }
  } catch (e) {
    // Silently ignore if bosung is not available
  }

  return results;
}

/**
 * Find documents by topic keyword in bosung_metadata.json.
 */
function findByTopicInBosung(topic = '') {
  if (!topic) return [];
  const topicNorm = normalizeVietnamese(topic);
  if (!topicNorm) return [];
  const results = [];

  try {
    const bosungPath = path.join(__dirname, '../../bosung_metadata.json');
    const bosungRaw = fs.readFileSync(bosungPath, 'utf8');
    const bosung = JSON.parse(bosungRaw);
    for (const key of Object.keys(bosung)) {
      const entry = bosung[key];
      if (!entry || !entry.so_hieu) continue;
      const titleNorm = normalizeVietnamese(entry.trich_yeu || '');
      const policyNorm = normalizeVietnamese(
        typeof entry.tom_tat_chinh_sach === 'string' ? entry.tom_tat_chinh_sach : ''
      );
      if (titleNorm.includes(topicNorm) || policyNorm.includes(topicNorm)) {
        if (!results.some(r => normalizeDocumentNumber(r.documentNumber) === normalizeDocumentNumber(entry.so_hieu))) {
          results.push({
            documentNumber: entry.so_hieu,
            title: entry.trich_yeu || '',
            documentType: entry.loai_van_ban || '',
            issuer: entry.co_quan_ban_hanh || '',
            effectiveStatus: entry.tinh_trang_hieu_luc || 'unknown',
            source: 'bosung_metadata',
          });
        }
      }
    }
  } catch (e) {
    // Silently ignore if bosung is not available
  }

  return results;
}

module.exports = {
  loadKnownDocuments,
  findKnownDocumentByNumber,
  findKnownDocumentByAlias,
  validateKnownDocumentRegistry,
  findByPartialNumber,
  findByTopicInBosung,
};
