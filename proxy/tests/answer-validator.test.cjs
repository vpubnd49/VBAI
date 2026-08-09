const assert = require('assert');
const { isDocumentKnown, getDocumentMetadata, validateAnswer, clearValidatorCaches } = require('../legal/services/answer-validator');

clearValidatorCaches();
console.log('=== Answer Validator Tests ===');

assert.strictEqual(isDocumentKnown('74/2025/QH15'), true);
assert.strictEqual(isDocumentKnown('75/2025/QH15'), true);
assert.strictEqual(isDocumentKnown('999/9999/FAKE'), false);

const meta = getDocumentMetadata('74/2025/QH15');
assert.ok(meta);
assert.strictEqual(meta.documentNumber, '74/2025/QH15');
assert.strictEqual(meta.issuer, 'Quốc hội');

const valResult = validateAnswer({
  documents: [{ documentNumber: '74/2025/QH15', status: 'co_hieu_luc' }],
  citations: [],
});
assert.strictEqual(valResult.valid, true);

console.log('PASS answer-validator.test.cjs');
