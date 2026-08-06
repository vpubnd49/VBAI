const assert = require('assert');
const { buildOfficialQuery } = require('../../legal/services/legal-query-builder');

function testQueryBuilder() {
  const built = buildOfficialQuery('72/2025/QH15 Luật an ninh mạng');
  assert.strictEqual(built.docNumber, '72/2025/QH15');
  assert.ok(built.officialQuery.includes('site:vbpl.vn'));

  console.log('PASS legal-query-builder.test.cjs');
}

testQueryBuilder();
