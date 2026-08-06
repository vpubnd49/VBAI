const assert = require('assert');
const { isFreshnessQuery, isExtractQuery, detectQueryIntent } = require('../../legal/domain/query-intent');

function testQueryIntent() {
  assert.strictEqual(isFreshnessQuery('Luật an ninh mạng mới nhất'), true);
  assert.strictEqual(isFreshnessQuery('Quy định bình thường'), false);
  assert.strictEqual(isExtractQuery('Trích Điều 5 Khoản 2'), true);

  const intent1 = detectQueryIntent('72/2025/QH15');
  assert.strictEqual(intent1.mode, 'strict_number');
  assert.strictEqual(intent1.docNumber, '72/2025/QH15');

  const intent2 = detectQueryIntent('Luật an ninh mạng mới nhất');
  assert.strictEqual(intent2.mode, 'freshness_search');

  console.log('PASS query-intent.test.cjs');
}

testQueryIntent();
