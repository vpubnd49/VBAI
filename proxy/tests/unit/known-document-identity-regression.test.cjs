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
assert.strictEqual(law24.title, 'Luật An ninh mạng 2018', 'relation title preserves canonical metadata');
assert.strictEqual(law24.title_is_placeholder, undefined, 'canonical document title is not a placeholder');
assert.strictEqual(law24.document_type, 'luat', 'canonical document type is preserved');
assert.strictEqual(law24.issuer, 'Quốc hội', 'canonical issuer is preserved');
assert.ok(law24.issue_date, 'canonical issue date is preserved');
assert.ok(law24.effective_date, 'canonical effective date is preserved');
assert.strictEqual(law24.effective_status, 'in_force', 'canonical effective status is preserved');
assert.ok(law24.official_source_urls.every((url) => /^https:\/\//i.test(url)), 'source URLs are safe HTTPS URLs');
assert.ok(!law24.source || law24.source === 'bosung_metadata', 'canonical source is metadata-backed');
assert.deepStrictEqual(law24.superseded_by, ['116/2025/QH15'], 'superseded_by contains 116/2025/QH15');
assert.strictEqual(law24.match_type, 'direct', 'canonical match_type is direct');
assert.strictEqual(law24.verification_status, 'verified', 'canonical verification status is preserved');
assert.ok(law24.verified_at, 'canonical verified_at is preserved');

// 2. DIRECT_MATCH lookup for replacing document (e.g. 116/2025/QH15) retains real metadata
const law116 = findKnownDocumentByNumber('116/2025/QH15');
assert.ok(law116, '116/2025/QH15 must resolve directly');
assert.strictEqual(canonicalNumber(law116), '116/2025/QH15', 'exact direct document number returned');
assert.ok(!law116.source || law116.source === 'bosung_metadata', 'direct match remains metadata-backed');
assert.strictEqual(law116.match_type, 'direct', 'direct match_type is direct');
assert.ok(law116.title.includes('Luật An ninh mạng'), 'direct match retains canonical title');
assert.ok(law116.issue_date, 'direct match retains issue_date');

// 3. Lowercase and surrounding spaces work for RELATION_MATCH
const law24Lower = findKnownDocumentByNumber('  24/2018/qh14  ');
assert.ok(law24Lower, 'Lowercase and padded 24/2018/qh14 must resolve');
assert.strictEqual(canonicalNumber(law24Lower), '24/2018/QH14');
assert.strictEqual(law24Lower.match_type, 'direct');
assert.ok(!law24Lower.source || law24Lower.source === 'bosung_metadata');

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
