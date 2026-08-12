'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { normalizeDocumentNumber } = require('../domain/document-number');

const PROVENANCE_ONLY_FIELDS = new Set(['original_filename', 'num_pages']);
let cachedIndex = null;

function findDuplicateTopLevelKeys(text) {
  const seen = new Set();
  const duplicates = new Set();
  let objectDepth = 0;

  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === '{') {
      objectDepth++;
      continue;
    }
    if (char === '}') {
      objectDepth--;
      continue;
    }
    if (char !== '"') continue;

    let end = index + 1;
    let escaped = false;
    for (; end < text.length; end++) {
      const candidate = text[end];
      if (escaped) {
        escaped = false;
      } else if (candidate === '\\') {
        escaped = true;
      } else if (candidate === '"') {
        break;
      }
    }
    if (end >= text.length) throw new Error('Invalid JSON string in bosung_metadata.json');

    if (objectDepth === 1) {
      let cursor = end + 1;
      while (/\s/.test(text[cursor] || '')) cursor++;
      if (text[cursor] === ':') {
        const key = JSON.parse(text.slice(index, end + 1));
        if (seen.has(key)) duplicates.add(key);
        seen.add(key);
      }
    }
    index = end;
  }

  return [...duplicates].sort();
}

function parseBosungMetadata(text) {
  const duplicateKeys = findDuplicateTopLevelKeys(text);
  if (duplicateKeys.length > 0) {
    throw new Error(`Duplicate top-level source keys: ${duplicateKeys.join(', ')}`);
  }
  return JSON.parse(text);
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value)
      .filter((key) => !PROVENANCE_ONLY_FIELDS.has(key))
      .sort()
      .map((key) => [key, canonicalize(value[key])])
  );
}

function fingerprint(record) {
  const normalizedRecord = record && typeof record === 'object'
    ? { ...record, so_hieu: normalizeDocumentNumber(record.so_hieu || '') }
    : record;
  return crypto.createHash('sha256')
    .update(JSON.stringify(canonicalize(normalizedRecord)))
    .digest('hex');
}

function mergeCompatibleCandidates(candidates) {
  const merged = {};
  const conflictingFields = new Set();
  const missing = (value) => value === undefined || value === null || value === '';

  for (const { record } of candidates) {
    for (const [key, rawValue] of Object.entries(record || {})) {
      if (PROVENANCE_ONLY_FIELDS.has(key)) continue;
      const value = key === 'so_hieu' ? normalizeDocumentNumber(rawValue || '') : rawValue;
      if (!(key in merged) || missing(merged[key])) {
        if (!missing(value)) merged[key] = value;
        continue;
      }
      if (missing(value)) continue;
      if (JSON.stringify(canonicalize(merged[key])) !== JSON.stringify(canonicalize(value))) {
        conflictingFields.add(key);
      }
    }
  }
  return { merged, conflictingFields: [...conflictingFields].sort() };
}

function buildBosungMetadataIndex(raw, policy = { resolutions: [] }) {
  const groups = new Map();
  for (const [sourceKey, record] of Object.entries(raw || {})) {
    const normalized = normalizeDocumentNumber(record?.so_hieu || '');
    if (!normalized) continue;
    if (!groups.has(normalized)) groups.set(normalized, []);
    groups.get(normalized).push({ sourceKey, record, fingerprint: fingerprint(record) });
  }

  const resolutions = new Map(
    (Array.isArray(policy?.resolutions) ? policy.resolutions : [])
      .map((entry) => [normalizeDocumentNumber(entry?.so_hieu || ''), entry])
      .filter(([number]) => number)
  );
  const records = new Map();
  const diagnostics = {
    duplicateGroups: 0,
    identicalGroups: 0,
    mergedComplementaryGroups: 0,
    resolvedConflicts: 0,
    unresolvedConflicts: [],
  };

  for (const [documentNumber, candidates] of groups) {
    const sorted = [...candidates].sort((a, b) => a.sourceKey.localeCompare(b.sourceKey));
    if (sorted.length === 1) {
      records.set(documentNumber, sorted[0]);
      continue;
    }

    diagnostics.duplicateGroups++;
    if (new Set(sorted.map((entry) => entry.fingerprint)).size === 1) {
      diagnostics.identicalGroups++;
      records.set(documentNumber, sorted[0]);
      continue;
    }

    const compatible = mergeCompatibleCandidates(sorted);
    if (compatible.conflictingFields.length === 0) {
      diagnostics.mergedComplementaryGroups++;
      records.set(documentNumber, {
        sourceKey: sorted.map((entry) => entry.sourceKey).join('+'),
        sourceKeys: sorted.map((entry) => entry.sourceKey),
        record: compatible.merged,
        fingerprint: fingerprint(compatible.merged),
      });
      continue;
    }

    const resolution = resolutions.get(documentNumber);
    const selected = sorted.find((entry) => entry.sourceKey === resolution?.canonical_source_key);
    const resolutionComplete = selected &&
      typeof resolution?.reason === 'string' && resolution.reason.trim() &&
      typeof resolution?.reviewed_by === 'string' && resolution.reviewed_by.trim() &&
      /^\d{4}-\d{2}-\d{2}T/.test(resolution?.reviewed_at || '');
    if (resolutionComplete) {
      diagnostics.resolvedConflicts++;
      records.set(documentNumber, selected);
    } else {
      diagnostics.unresolvedConflicts.push({
        documentNumber,
        sourceKeys: sorted.map((entry) => entry.sourceKey),
        fingerprints: Object.fromEntries(sorted.map((entry) => [entry.sourceKey, entry.fingerprint])),
        conflictingFields: compatible.conflictingFields,
      });
    }
  }

  return { records, diagnostics };
}

function loadBosungMetadataIndex(forceReload = false) {
  if (cachedIndex && !forceReload) return cachedIndex;
  const sourcePath = path.join(__dirname, '..', '..', 'bosung_metadata.json');
  const policyPath = path.join(__dirname, '..', 'data', 'bosung-duplicate-resolutions.json');
  const raw = parseBosungMetadata(fs.readFileSync(sourcePath, 'utf8'));
  const policy = fs.existsSync(policyPath)
    ? JSON.parse(fs.readFileSync(policyPath, 'utf8'))
    : { schemaVersion: 1, resolutions: [] };
  cachedIndex = buildBosungMetadataIndex(raw, policy);
  return cachedIndex;
}

module.exports = {
  PROVENANCE_ONLY_FIELDS,
  canonicalize,
  fingerprint,
  mergeCompatibleCandidates,
  findDuplicateTopLevelKeys,
  parseBosungMetadata,
  buildBosungMetadataIndex,
  loadBosungMetadataIndex,
};
