/**
 * Repository adapter for local metadata (bosung_metadata.json/jsonl) with provenance support.
 */
const { normalizeDocumentNumber } = require('../domain/document-number');
const { loadBosungMetadataIndex } = require('./bosung-metadata-index');

let localMetadataCache = null;

function loadLocalMetadataMap() {
  if (localMetadataCache) return localMetadataCache;

  try {
    const index = loadBosungMetadataIndex();
    const map = new Map();
    for (const [documentNumber, selected] of index.records) {
      map.set(documentNumber, selected.record);
    }
    localMetadataCache = map;
  } catch (e) {
    console.warn('[local-metadata.repository] Could not load bosung_metadata.json:', e.message);
    localMetadataCache = new Map();
  }
  return localMetadataCache;
}

function getLocalMetadataByDocumentNumber(docNumber = '') {
  if (!docNumber) return null;
  const normKey = normalizeDocumentNumber(docNumber);
  const map = loadLocalMetadataMap();
  const raw = map.get(normKey);
  if (!raw) return null;

  const officialSourceUrls = Array.isArray(raw.official_source_urls)
    ? raw.official_source_urls
    : (raw.link_nguon ? [raw.link_nguon] : []);
  const verified = raw.verified === true && officialSourceUrls.length > 0 && Boolean(raw.verified_at);
  const effectiveStatus = verified ? (raw.tinh_trang_hieu_luc || 'unknown') : 'unknown';
  const verificationStatus = verified ? 'verified' : 'unverified';

  return {
    documentNumber: normKey,
    title: raw.trich_yeu || raw.ten_van_ban || null,
    documentType: raw.loai_van_ban || null,
    issuer: raw.co_quan_ban_hanh || null,
    issueDate: raw.ngay_ban_hanh || null,
    effectiveDate: verified ? (raw.ngay_hieu_luc || null) : null,
    effectiveStatus,
    statusAsOf: verified ? (raw.ngay_cap_nhat || raw.verified_at || null) : null,
    replaces: verified && Array.isArray(raw.thay_the_cho) ? raw.thay_the_cho : [],
    amends: verified && Array.isArray(raw.sua_doi_cho) ? raw.sua_doi_cho : [],
    supersededBy: verified && Array.isArray(raw.bi_thay_the_boi) ? raw.bi_thay_the_boi : [],
    sourceUrl: verified ? officialSourceUrls[0] : null,
    sourceTier: verified ? 'official' : 'local_metadata',
    retrievedAt: raw.retrieved_at || null,
    contentSha256: raw.content_hash || null,
    verificationStatus,
    reviewState: verified ? 'source_verified' : 'pending_review',
    provenance: {
      documentNumber: {
        field: 'documentNumber',
        value: normKey,
        sourceTier: verified ? 'official' : 'local_metadata',
        confidence: verified ? 1 : 0.7,
      },
      effectiveStatus: {
        field: 'effectiveStatus',
        value: effectiveStatus,
        sourceTier: verified ? 'official' : 'local_metadata',
        confidence: verified ? 1 : 0,
      },
    },
  };
}

module.exports = {
  loadLocalMetadataMap,
  getLocalMetadataByDocumentNumber,
};
