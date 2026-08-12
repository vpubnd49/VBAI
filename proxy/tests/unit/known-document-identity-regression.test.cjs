'use strict';

const assert = require('assert');
const {
  findKnownDocumentByNumber,
  validateKnownDocumentRegistry,
} = require('../../legal/repositories/known-documents.repository');

function canonicalNumber(doc) {
  return String(doc?.document_number || doc?.documentNumber || '').toUpperCase();
}

// 1. RELATION_MATCH lookup for old replaced document (e.g. 24/2018/QH14)
const law24 = findKnownDocumentByNumber('24/2018/QH14');
assert.ok(law24, '24/2018/QH14 must remain resolvable via relationship');
assert.strictEqual(canonicalNumber(law24), '24/2018/QH14', 'exact old document number is returned');
assert.strictEqual(law24.title, 'Văn bản 24/2018/QH14', 'relation title equals Văn bản 24/2018/QH14');
assert.strictEqual(law24.title_is_placeholder, true, 'title_is_placeholder is true');
assert.strictEqual(law24.document_type, null, 'document_type is null');
assert.strictEqual(law24.issuer, null, 'issuer is null');
assert.strictEqual(law24.issue_date, null, 'issue_date is null');
assert.strictEqual(law24.effective_date, null, 'effective_date is null');
assert.strictEqual(law24.effective_status, 'unknown', 'effective_status is unknown');
assert.deepStrictEqual(law24.official_source_urls, [], 'official_source_urls is empty');
assert.strictEqual(law24.source, 'bosung_metadata_relationship', 'source is bosung_metadata_relationship');
assert.strictEqual(law24.source_document_number, '116/2025/QH15', 'source_document_number is 116/2025/QH15');
assert.deepStrictEqual(law24.superseded_by, ['116/2025/QH15'], 'superseded_by contains 116/2025/QH15');
assert.strictEqual(law24.match_type, 'replacement_relation', 'match_type is replacement_relation');
assert.strictEqual(law24.verification_status, 'identity_resolved', 'verification_status is identity_resolved');
assert.strictEqual(law24.verified_at, null, 'verified_at is null');

// 2. DIRECT_MATCH lookup for replacing document (e.g. 116/2025/QH15) retains real metadata
const law116 = findKnownDocumentByNumber('116/2025/QH15');
assert.ok(law116, '116/2025/QH15 must resolve directly');
assert.strictEqual(canonicalNumber(law116), '116/2025/QH15', 'exact direct document number returned');
assert.strictEqual(law116.source, 'bosung_metadata', 'direct match source is bosung_metadata');
assert.strictEqual(law116.match_type, 'direct', 'direct match_type is direct');
assert.strictEqual(law116.title, 'Luật An ninh mạng', 'direct match retains real title');
assert.ok(law116.issue_date, 'direct match retains issue_date');

// 3. Lowercase and surrounding spaces work for RELATION_MATCH
const law24Lower = findKnownDocumentByNumber('  24/2018/qh14  ');
assert.ok(law24Lower, 'Lowercase and padded 24/2018/qh14 must resolve');
assert.strictEqual(canonicalNumber(law24Lower), '24/2018/QH14');
assert.strictEqual(law24Lower.match_type, 'replacement_relation');
assert.strictEqual(law24Lower.source, 'bosung_metadata_relationship');

// 4. Partial number does not match
const partialDoc = findKnownDocumentByNumber('24');
assert.strictEqual(partialDoc, null, 'Partial number "24" must return null');

// 5. Unknown number returns null
const unknownDoc = findKnownDocumentByNumber('99999/9999/XX');
assert.strictEqual(unknownDoc, null, 'Unknown document number must return null');

// 6. Unsupported document 100/2019/NĐ-CP (query hint only, not in registry)
const unsupported = findKnownDocumentByNumber('100/2019/NĐ-CP');
assert.strictEqual(
  unsupported,
  null,
  'Query hints must not promote unsupported documents into known identities'
);

// 7. Registry validation continues to pass
const validation = validateKnownDocumentRegistry();
assert.strictEqual(validation.valid, true, 'Registry validation must pass');

console.log('PASS known-document-identity-regression.test.cjs (all 14 assertions passed)');
