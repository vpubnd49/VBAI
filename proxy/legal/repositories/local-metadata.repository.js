/**
 * Repository adapter for local metadata (bosung_metadata.json/jsonl) with provenance support.
 */
const path = require('path');
const fs = require('fs');
const { normalizeDocumentNumber } = require('../domain/document-number');

let localMetadataCache = null;

function loadLocalMetadataMap() {
  if (localMetadataCache) return localMetadataCache;

  const map = new Map();
  const jsonPath = path.join(__dirname, '..', '..', 'bosung_metadata.json');

  try {
    if (fs.existsSync(jsonPath)) {
      const raw = fs.readFileSync(jsonPath, 'utf8');
      const parsed = JSON.parse(raw);
      for (const key of Object.keys(parsed)) {
        const item = parsed[key];
        if (item && item.so_hieu) {
          const normKey = normalizeDocumentNumber(item.so_hieu);
          map.set(normKey, item);
        }
      }
    }
  } catch (e) {
    console.warn('[local-metadata.repository] Could not load bosung_metadata.json:', e.message);
  }

  localMetadataCache = map;
  return map;
}

function getLocalMetadataByDocumentNumber(docNumber = '') {
  if (!docNumber) return null;
  const normKey = normalizeDocumentNumber(docNumber);
  const map = loadLocalMetadataMap();
  const raw = map.get(normKey);
  if (!raw) return null;

  const effectiveStatus = raw.tinh_trang_hieu_luc || 'unknown';
  const verificationStatus = raw.verified ? 'verified' : 'unverified';

  return {
    documentNumber: normKey,
    title: raw.trich_yeu || raw.ten_van_ban || null,
    documentType: raw.loai_van_ban || null,
    issuer: raw.co_quan_ban_hanh || null,
    issueDate: raw.ngay_ban_hanh || null,
    effectiveDate: raw.ngay_hieu_luc || null,
    effectiveStatus,
    statusAsOf: raw.ngay_cap_nhat || null,
    replaces: Array.isArray(raw.thay_the_cho) ? raw.thay_the_cho : (raw.thay_the_cho ? [raw.thay_the_cho] : []),
    amends: Array.isArray(raw.sua_doi_cho) ? raw.sua_doi_cho : [],
    supersededBy: Array.isArray(raw.bi_thay_the_boi) ? raw.bi_thay_the_boi : [],
    sourceUrl: raw.link_nguon || null,
    sourceTier: 'local_metadata',
    retrievedAt: raw.retrieved_at || null,
    contentSha256: raw.content_hash || null,
    verificationStatus,
    reviewState: 'reviewed',
    provenance: {
      documentNumber: { field: 'documentNumber', value: normKey, sourceTier: 'local_metadata', confidence: 0.95 },
      effectiveStatus: { field: 'effectiveStatus', value: effectiveStatus, sourceTier: 'local_metadata', confidence: 0.8 },
    },
  };
}

module.exports = {
  loadLocalMetadataMap,
  getLocalMetadataByDocumentNumber,
};
