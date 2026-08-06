const assert = require('assert');
const { shouldForceFreshSearch, getCacheStrategy } = require('../../legal/domain/query-freshness');
const { detectQueryIntent } = require('../../legal/domain/query-intent');

function testQueryFreshness() {
  assert.strictEqual(shouldForceFreshSearch({ query: 'Luật mới nhất' }), true);
  assert.strictEqual(shouldForceFreshSearch({ query: 'Luật đất đai', forceFresh: true }), true);
  assert.strictEqual(shouldForceFreshSearch({ query: 'Quy trình bình thường' }), false);

  const intent = detectQueryIntent('Luật mới nhất');
  const strategy = getCacheStrategy(intent);
  assert.strictEqual(strategy.bypassCache, true);
  assert.strictEqual(strategy.ttlMs, 0);

  console.log('PASS query-freshness.test.cjs');
}

testQueryFreshness();
