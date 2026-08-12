/**
 * Repository for known documents with in-memory caching.
 */
const path = require('path');
const fs = require('fs');
const { normalizeDocumentNumber } = require('../domain/document-number');
const { normalizeVietnamese } = require('../domain/normalize-vietnamese');
const { loadBosungMetadataIndex } = require('./bosung-metadata-index');

let cachedDocuments = null;
let cachedBosung = null;

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

function loadBosungMetadata(forceReload = false) {
  if (cachedBosung && !forceReload) {
    return cachedBosung;
  }
  const bosungPath = path.join(__dirname, '..', '..', 'bosung_metadata.json');
  try {
    const raw = fs.readFileSync(bosungPath, 'utf8');
    cachedBosung = JSON.parse(raw);
  } catch (e) {
    console.warn('[known-documents.repository] Failed to read bosung_metadata.json:', e.message);
    cachedBosung = {};
  }
  return cachedBosung;
}

function mapBosungEntryToCanonical(entry, matchedDocNumber = null) {
  if (!entry) return null;

  const isRelationMatch = Boolean(
    matchedDocNumber &&
    entry.so_hieu &&
    normalizeDocumentNumber(matchedDocNumber) !== normalizeDocumentNumber(entry.so_hieu)
  );

  if (isRelationMatch) {
    const docNum = matchedDocNumber;
    const normDocNum = normalizeDocumentNumber(docNum);
    const safeId = 'bosung_rel_' + normDocNum.toLowerCase().replace(/[^a-z0-9]/g, '_');

    return {
      id: safeId,
      document_number: docNum,
      title: `Văn bản ${docNum}`,
      title_is_placeholder: true,
      document_type: null,
      topic_aliases: [],
      query_patterns: [],
      issuer: null,
      issue_date: null,
      effective_date: null,
      effective_status: 'unknown',
      status_as_of: null,
      replaces: [],
      amends: [],
      superseded_by: [entry.so_hieu],
      official_source_urls: [],
      verification_status: 'identity_resolved',
      verified_at: null,
      review_state: 'draft',
      source: 'bosung_metadata_relationship',
      source_document_number: entry.so_hieu,
      match_type: 'replacement_relation',
      data_version: 1,
    };
  }

  // DIRECT_MATCH
  const docNum = entry.so_hieu || '';
  const normDocNum = normalizeDocumentNumber(docNum);
  const safeId = 'bosung_' + normDocNum.toLowerCase().replace(/[^a-z0-9]/g, '_');

  const replacesArr = Array.isArray(entry.thay_the_cho)
    ? entry.thay_the_cho
    : (entry.thay_the_cho ? [entry.thay_the_cho] : []);

  const amendsArr = Array.isArray(entry.sua_doi_cho) ? entry.sua_doi_cho : [];
  const supersededByArr = Array.isArray(entry.bi_thay_the_boi) ? entry.bi_thay_the_boi : [];
  const sourceUrls = Array.isArray(entry.official_source_urls) ? entry.official_source_urls : [];
  const verified = entry.verified === true && sourceUrls.length > 0 && Boolean(entry.verified_at);

  return {
    id: entry.id || safeId,
    document_number: docNum,
    document_type: entry.loai_van_ban || 'luat',
    title: entry.trich_yeu || '',
    topic_aliases: Array.isArray(entry.topic_aliases) ? entry.topic_aliases : [],
    query_patterns: Array.isArray(entry.query_patterns) ? entry.query_patterns : [],
    issuer: entry.co_quan_ban_hanh || null,
    issue_date: entry.ngay_ban_hanh || null,
    effective_date: verified ? (entry.ngay_hieu_luc || null) : null,
    effective_status: verified ? (entry.tinh_trang_hieu_luc || 'unknown') : 'unknown',
    status_as_of: verified ? (entry.ngay_cap_nhat || entry.verified_at || null) : null,
    replaces: verified ? replacesArr : [],
    amends: verified ? amendsArr : [],
    superseded_by: verified ? supersededByArr : [],
    official_source_urls: verified ? sourceUrls : [],
    verification_status: verified ? 'verified' : 'identity_resolved',
    verified_at: verified ? entry.verified_at : null,
    review_state: verified ? 'published' : 'draft',
    data_version: 1,
    source: 'bosung_metadata',
    match_type: 'direct',
  };
}

function findKnownDocumentByNumber(docNumber = '') {
  if (!docNumber) return null;
  const target = normalizeDocumentNumber(docNumber);
  if (!target) return null;

  // 1. Search known-documents.json first
  const docs = loadKnownDocuments();
  const foundKnown = docs.find((d) => normalizeDocumentNumber(d.document_number) === target);
  if (foundKnown) {
    return {
      ...foundKnown,
      match_type: 'direct',
    };
  }

  // 2. Search proxy/bosung_metadata.json
  const bosung = loadBosungMetadataIndex();
  if (bosung?.records instanceof Map) {
    // 2a. DIRECT_MATCH: only deterministic or explicitly reviewed records are indexed.
    const direct = bosung.records.get(target);
    if (direct?.record) return mapBosungEntryToCanonical(direct.record);

    // 2b. RELATION_MATCH: Compare normalized entry.thay_the_cho items
    for (const { record: entry } of bosung.records.values()) {
      if (entry && Array.isArray(entry.thay_the_cho)) {
        for (const replaced of entry.thay_the_cho) {
          if (normalizeDocumentNumber(replaced) === target) {
            return mapBosungEntryToCanonical(entry, replaced);
          }
        }
      }
    }
  }

  return null;
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
  const warnings = [];

  if (!Array.isArray(docs)) {
    return { valid: false, errors: ['Known documents must be an array'], warnings: [], count: 0 };
  }

  const REQUIRED_FIELDS = ['id', 'document_number', 'document_type', 'title', 'verification_status', 'review_state'];
  const VALID_VERIFICATION_STATUSES = ['verified', 'unverified', 'identity_resolved', 'pending'];
  const VALID_REVIEW_STATES = ['published', 'draft', 'archived'];
  const ARRAY_FIELDS = ['topic_aliases', 'query_patterns', 'replaces', 'amends', 'superseded_by', 'official_source_urls'];

  const idSet = new Set();
  const docNumSet = new Set();

  docs.forEach((doc, idx) => {
    const label = `index ${idx} (${doc.document_number || '?'})`;

    // Required fields
    for (const f of REQUIRED_FIELDS) {
      if (!doc[f] && doc[f] !== 0) {
        errors.push(`${label} missing required field '${f}'`);
      }
    }

    // Duplicate id
    if (doc.id) {
      if (idSet.has(doc.id)) {
        errors.push(`${label} has duplicate id '${doc.id}'`);
      }
      idSet.add(doc.id);
    }

    // Duplicate document_number (normalized)
    const dnNorm = String(doc.document_number || '').toUpperCase().trim();
    if (dnNorm) {
      if (docNumSet.has(dnNorm)) {
        errors.push(`${label} has duplicate document_number '${doc.document_number}'`);
      }
      docNumSet.add(dnNorm);
    }

    // Valid enum values
    if (doc.verification_status && !VALID_VERIFICATION_STATUSES.includes(doc.verification_status)) {
      errors.push(`${label} invalid verification_status '${doc.verification_status}'`);
    }
    if (doc.review_state && !VALID_REVIEW_STATES.includes(doc.review_state)) {
      errors.push(`${label} invalid review_state '${doc.review_state}'`);
    }

    // Fail-closed verification policy
    if (doc.verification_status === 'verified') {
      const hasUrl = Array.isArray(doc.official_source_urls) && doc.official_source_urls.length > 0;
      const hasVerifiedAt = doc.verified_at && String(doc.verified_at).trim().length > 0;
      if (!hasUrl || !hasVerifiedAt) {
        errors.push(`${label} marked 'verified' without evidence artifacts (official_source_urls + verified_at required)`);
      }
    }

    // Array fields must be arrays
    for (const f of ARRAY_FIELDS) {
      if (doc[f] !== undefined && !Array.isArray(doc[f])) {
        errors.push(`${label} field '${f}' must be an array`);
      }
    }

    // Warn: no topic_aliases or query_patterns
    if (!doc.topic_aliases || doc.topic_aliases.length === 0) {
      warnings.push(`${label} has no topic_aliases (may not be discoverable by semantic search)`);
    }
  });

  return {
    valid: errors.length === 0,
    count: docs.length,
    errors,
    warnings,
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
    const bosung = loadBosungMetadataIndex();
    for (const { record: entry } of bosung.records.values()) {
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
    const bosung = loadBosungMetadataIndex();
    for (const { record: entry } of bosung.records.values()) {
      if (!entry || !entry.so_hieu) continue;
      const titleNorm = normalizeVietnamese(entry.trich_yeu || '');
      const trustedSummary = entry.verified === true && entry.summary_verified === true
        ? entry.tom_tat_chinh_sach
        : '';
      const policyNorm = normalizeVietnamese(typeof trustedSummary === 'string' ? trustedSummary : '');
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
  loadBosungMetadata,
  findKnownDocumentByNumber,
  findKnownDocumentByAlias,
  validateKnownDocumentRegistry,
  findByPartialNumber,
  findByTopicInBosung,
};
