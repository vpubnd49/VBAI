const assert = require('assert');
const { processLegalQuery } = require('../legal/services/legal-query-engine');

(async () => {
  console.log('=== Legal Query Engine Tests ===');

  const res1 = await processLegalQuery({ query: 'Luat 74/2025/QH15' });
  assert.strictEqual(res1.success, true);
  assert.strictEqual(res1.effectiveDocNumber, '74/2025/QH15');

  const res2 = await processLegalQuery({ query: '' });
  assert.strictEqual(res2.success, false);

  console.log('PASS legal-query-engine.test.cjs');
})();
