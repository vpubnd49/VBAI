const assert = require('assert');
const { validateFetchUrl } = require('../../legal/services/legal-content-fetcher');

function testWebExtractSecurity() {
  assert.strictEqual(validateFetchUrl('http://localhost:8080/').valid, false);
  assert.strictEqual(validateFetchUrl('http://127.0.0.1/admin').valid, false);
  assert.strictEqual(validateFetchUrl('http://192.168.1.1/').valid, false);
  assert.strictEqual(validateFetchUrl('http://malicious-external-site.com/').valid, false);
  assert.strictEqual(validateFetchUrl('https://vbpl.vn/doc/1').valid, true);

  console.log('PASS web-extract-security.test.cjs');
}

testWebExtractSecurity();
