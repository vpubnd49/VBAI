const assert = require('assert');
const { validateLegalDocument } = require('../../legal/services/legal-validation.service');

function testLegalValidation() {
  const v1 = validateLegalDocument({
    documentNumber: '117/2025/QH15',
    url: 'https://vbpl.vn/doc/117',
    documentType: 'luat',
  });
  assert.strictEqual(v1.isValidNumber, true);
  assert.strictEqual(v1.sourceTier, 'official');
  assert.strictEqual(v1.isKnownDocument, true);
  assert.strictEqual(v1.verificationStatus, 'verified');

  console.log('PASS legal-validation.test.cjs');
}

testLegalValidation();
