const assert = require('assert');
const { orchestrateLegalSearch } = require('../../legal/services/legal-search-orchestrator');

async function testWebSearchContract() {
  const res = await orchestrateLegalSearch({ query: '117/2025/QH15' });
  assert.strictEqual(res.success, true);
  assert.ok(res.meta);
  assert.ok(Array.isArray(res.results));
  assert.ok(res.metadata);
  assert.strictEqual(res.metadata.documentNumber, '117/2025/QH15');

  console.log('PASS web-search-contract.test.cjs');
}

testWebSearchContract();
