/**
 * Known Documents Integrity Test (Prompt 02)
 *
 * Enforces strict data integrity rules on known-documents.json
 * and validates lookup consistency with bosung_metadata.json.
 *
 * Run: node proxy/tests/known-documents-integrity.test.cjs
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { parseBosungMetadata } = require('../legal/repositories/bosung-metadata-index');

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) {
    console.log(`  PASS: ${msg}`);
    passed++;
  } else {
    console.error(`  FAIL: ${msg}`);
    failed++;
  }
}

function assertWarn(condition, msg) {
  if (condition) {
    console.log(`  PASS: ${msg}`);
    passed++;
  } else {
    console.warn(`  WARN: ${msg}`);
    // Warnings don't count as failures in this suite
  }
}

const proxyRoot = path.join(__dirname, '..');
const knownDocsPath = path.join(proxyRoot, 'legal', 'data', 'known-documents.json');
const bosungPath = path.join(proxyRoot, 'bosung_metadata.json');

console.log('=== Known Documents Integrity Test ===\n');

// ─────────────────────────────────────────────────────────────────
// 1. Load data
// ─────────────────────────────────────────────────────────────────
console.log('--- 1. File Loadability ---');

let knownDocs = [];
let bosungData = {};

try {
  knownDocs = JSON.parse(fs.readFileSync(knownDocsPath, 'utf8'));
  assert(true, 'known-documents.json is valid JSON');
} catch (e) {
  assert(false, `known-documents.json is valid JSON: ${e.message}`);
  process.exit(1);
}

try {
  bosungData = parseBosungMetadata(fs.readFileSync(bosungPath, 'utf8'));
  assert(true, 'bosung_metadata.json is valid JSON with unique top-level source keys');
} catch (e) {
  assert(false, `bosung_metadata.json is valid JSON: ${e.message}`);
}

// ─────────────────────────────────────────────────────────────────
// 2. known-documents.json schema validation
// ─────────────────────────────────────────────────────────────────
console.log('\n--- 2. Schema Validation ---');

assert(Array.isArray(knownDocs), 'known-documents.json root is an array');
assert(knownDocs.length > 0, `At least 1 document in registry (found ${knownDocs.length})`);

const REQUIRED_FIELDS = ['id', 'document_number', 'document_type', 'title', 'verification_status', 'review_state'];
const VALID_VERIFICATION_STATUSES = ['verified', 'unverified', 'identity_resolved', 'pending'];
const VALID_REVIEW_STATES = ['published', 'draft', 'archived'];
const VALID_DOC_TYPES = ['luat', 'nghi_dinh', 'thong_tu', 'quyet_dinh', 'nghi_quyet', 'phap_lenh', 'chi_thi', 'khac'];

let schemaErrors = 0;
const idSet = new Set();
const docNumSet = new Set();

for (let i = 0; i < knownDocs.length; i++) {
  const d = knownDocs[i];

  // Required fields
  for (const f of REQUIRED_FIELDS) {
    if (!d[f] && d[f] !== 0) {
      console.error(`    ERROR: index ${i} (${d.document_number || '?'}) missing required field '${f}'`);
      schemaErrors++;
    }
  }

  // Duplicate id
  if (d.id) {
    if (idSet.has(d.id)) {
      console.error(`    ERROR: duplicate id '${d.id}' at index ${i}`);
      schemaErrors++;
    }
    idSet.add(d.id);
  }

  // Duplicate document_number
  const dnNorm = String(d.document_number || '').toUpperCase().trim();
  if (dnNorm) {
    if (docNumSet.has(dnNorm)) {
      console.error(`    ERROR: duplicate document_number '${d.document_number}' at index ${i}`);
      schemaErrors++;
    }
    docNumSet.add(dnNorm);
  }

  // Valid verification_status
  if (d.verification_status && !VALID_VERIFICATION_STATUSES.includes(d.verification_status)) {
    console.error(`    ERROR: index ${i} (${d.document_number}) invalid verification_status '${d.verification_status}'`);
    schemaErrors++;
  }

  // Valid review_state
  if (d.review_state && !VALID_REVIEW_STATES.includes(d.review_state)) {
    console.error(`    ERROR: index ${i} (${d.document_number}) invalid review_state '${d.review_state}'`);
    schemaErrors++;
  }

  // Document type should be known (warn only)
  if (d.document_type && !VALID_DOC_TYPES.includes(d.document_type)) {
    console.warn(`    WARN: index ${i} (${d.document_number}) unknown document_type '${d.document_type}'`);
  }

  // Arrays must be arrays
  for (const arrField of ['topic_aliases', 'query_patterns', 'replaces', 'amends', 'superseded_by', 'official_source_urls']) {
    if (d[arrField] !== undefined && !Array.isArray(d[arrField])) {
      console.error(`    ERROR: index ${i} (${d.document_number}) field '${arrField}' must be array`);
      schemaErrors++;
    }
  }
}

assert(schemaErrors === 0, `Zero schema errors across ${knownDocs.length} documents`);

// ─────────────────────────────────────────────────────────────────
// 3. Fail-closed verification policy
// ─────────────────────────────────────────────────────────────────
console.log('\n--- 3. Fail-Closed Verification Policy ---');

let verificationViolations = 0;
for (const d of knownDocs) {
  if (d.verification_status === 'verified') {
    const hasSourceUrl = Array.isArray(d.official_source_urls) && d.official_source_urls.length > 0;
    const hasVerifiedAt = d.verified_at && String(d.verified_at).trim().length > 0;
    if (!hasSourceUrl || !hasVerifiedAt) {
      console.error(`    FAIL: ${d.document_number} marked 'verified' but missing evidence artifacts (official_source_urls or verified_at)`);
      verificationViolations++;
    }
  }
}
assert(verificationViolations === 0, 'No documents marked "verified" without evidence artifacts (fail-closed policy)');

// ─────────────────────────────────────────────────────────────────
// 4. Bosung metadata deduplication check
// ─────────────────────────────────────────────────────────────────
console.log('\n--- 4. Bosung Metadata Integrity ---');

const { loadBosungMetadataIndex } = require('../legal/repositories/bosung-metadata-index');
const bosungIndex = loadBosungMetadataIndex(true);
assert(
  bosungIndex.diagnostics.unresolvedConflicts.length === 0,
  'All duplicate so_hieu groups are deterministic, complementary, or explicitly resolved'
);
assert(
  bosungIndex.records.size > 0,
  `Deterministic bosung index contains records (${bosungIndex.records.size})`
);

// ─────────────────────────────────────────────────────────────────
// 5. Repository lookup consistency
// ─────────────────────────────────────────────────────────────────
console.log('\n--- 5. Repository Lookup Consistency ---');

const { findKnownDocumentByNumber, findKnownDocumentByAlias, findByPartialNumber } =
  require('../legal/repositories/known-documents.repository');

// Test exact match
for (const d of knownDocs) {
  const result = findKnownDocumentByNumber(d.document_number);
  assert(
    result !== null && result.document_number === d.document_number,
    `findKnownDocumentByNumber('${d.document_number}') returns correct entry`
  );
}

// Test alias match
const aliasDoc = knownDocs.find(d => Array.isArray(d.topic_aliases) && d.topic_aliases.length > 0);
if (aliasDoc) {
  const alias = aliasDoc.topic_aliases[0];
  const result = findKnownDocumentByAlias(alias);
  assert(
    result !== null,
    `findKnownDocumentByAlias('${alias}') returns a match`
  );
}

// Test partial number match
const partialResult = findByPartialNumber('72');
assert(
  Array.isArray(partialResult) && partialResult.length > 0,
  `findByPartialNumber('72') returns at least one result`
);

// Test no-match returns null / empty
const noMatch = findKnownDocumentByNumber('99999/9999/XX');
assert(noMatch === null, `findKnownDocumentByNumber('99999/9999/XX') returns null for unknown`);

// Test normalization: lowercase query should match
const lowerResult = findKnownDocumentByNumber('72/2025/qh15');
assert(
  lowerResult !== null,
  `findKnownDocumentByNumber is case-insensitive (lowercase '72/2025/qh15')`
);

// ─────────────────────────────────────────────────────────────────
// 6. Answer validator consistency
// ─────────────────────────────────────────────────────────────────
console.log('\n--- 6. Answer Validator Consistency ---');

const {
  getDocumentMetadata, isDocumentKnown, validateAnswer,
} = require('../legal/services/answer-validator');

// The source-verified 72/2025/QH15 identity is deterministic across duplicate source files.
const meta72 = getDocumentMetadata('72/2025/QH15');
assert(meta72 !== null, `getDocumentMetadata('72/2025/QH15') returns non-null`);
assert(
  meta72.source === 'bosung_metadata',
  `getDocumentMetadata('72/2025/QH15') uses deterministic source-verified metadata`
);
assert(meta72.verified === true, `72/2025/QH15 requires official source evidence`);
assert(meta72.effectiveDate === '16/06/2025', `72/2025/QH15 effective date matches Article 51`);
assert(meta72.effectiveStatus === 'co_hieu_luc', `72/2025/QH15 verified status is exposed`);
assert(meta72.replacements.includes('65/2025/QH15'), `72/2025/QH15 replaces 65/2025/QH15`);
assert(meta72.summary === '', `unreviewed derived summary remains suppressed`);

// Unknown document
assert(!isDocumentKnown('99/9999/XX'), `isDocumentKnown returns false for unknown document`);

// validateAnswer with known doc citation
const answerResult = validateAnswer({
  documents: [{ documentNumber: '72/2025/QH15', status: meta72.effectiveStatus }],
  citations: [{ documentNumber: '72/2025/QH15' }],
});
assert(answerResult.valid === true, `validateAnswer with known doc is valid`);
assert(answerResult.warnings.length === 0, `validateAnswer with matching status produces no warnings`);

// validateAnswer with unknown doc
const unknownResult = validateAnswer({
  documents: [{ documentNumber: '99/9999/XX' }],
});
assert(unknownResult.warnings.length > 0, `validateAnswer with unknown doc produces warnings`);

// ─────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
