const assert = require('assert');
const {
  normalizeDocumentNumber,
  extractFullDocumentNumber,
  isFullDocumentNumber,
  extractPartialDocumentNumber,
} = require('../../legal/domain/document-number');

function testDocumentNumber() {
  assert.strictEqual(normalizeDocumentNumber(' 72/2025/qh15 '), '72/2025/QH15');
  assert.strictEqual(extractFullDocumentNumber('Theo Luật số 72/2025/QH15 mới ban hành'), '72/2025/QH15');
  assert.strictEqual(isFullDocumentNumber('72/2025/QH15'), true);
  assert.strictEqual(isFullDocumentNumber('72/2025'), false);
  assert.strictEqual(extractPartialDocumentNumber('Tìm 72/2025 xem sao'), '72/2025');

  console.log('PASS document-number.test.cjs');
}

testDocumentNumber();
