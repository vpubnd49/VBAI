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

module.exports = {
  loadKnownDocuments,
  findKnownDocumentByNumber,
  findKnownDocumentByAlias,
  validateKnownDocumentRegistry,
};
