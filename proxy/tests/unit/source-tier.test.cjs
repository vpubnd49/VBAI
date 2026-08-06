const assert = require('assert');
const { classifySourceTier, isOfficialSource } = require('../../legal/domain/source-tier');

function testSourceTier() {
  assert.strictEqual(classifySourceTier('https://vbpl.vn/bo-tu-phap/van-ban.aspx'), 'official');
  assert.strictEqual(classifySourceTier('https://vanban.chinhphu.vn/'), 'official');
  assert.strictEqual(classifySourceTier('https://luatvietnam.vn/dat-dai.html'), 'reference');
  assert.strictEqual(classifySourceTier('https://unknown-blog.com/post/1'), 'unknown');
  assert.strictEqual(isOfficialSource('https://vbpl.vn/doc'), true);

  console.log('PASS source-tier.test.cjs');
}

testSourceTier();
