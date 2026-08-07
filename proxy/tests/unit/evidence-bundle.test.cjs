/**
 * Unit Test: Evidence Bundle Service.
 */
const assert = require('assert');
const { buildEvidenceBundle } = require('../../legal/services/evidence-bundle.service');
const { EFFECTIVE_STATUS } = require('../../legal/constants/legal-status');

function runEvidenceBundleTests() {
  console.log('[Test Suite]: Evidence Bundle Assembly');

  const rawResults = [
    {
      title: 'Nghị định 30/2020/NĐ-CP về công tác văn thư',
      link: 'https://vanban.chinhphu.vn/default.aspx?pageid=27160&docid=199272',
      effectiveStatus: 'Còn hiệu lực',
      snippet: 'Điều 15 quy định về kỹ thuật trình bày văn bản...',
    },
    {
      title: 'Thông tư 01/2011/TT-BNV',
      link: 'https://thuvienphapluat.vn/van-ban/Cong-van/Thong-tu-01-2011-TT-BNV',
      effectiveStatus: 'Hết hiệu lực',
      snippet: 'Khoản 2 Điều 10 bị thay thế bởi Nghị định 30/2020/NĐ-CP',
    },
  ];

  const bundle = buildEvidenceBundle('Thủ tục trình bày văn bản hành chính', rawResults);

  assert.strictEqual(bundle.totalSources, 2);
  assert.strictEqual(bundle.officialSourcesCount, 1);
  assert.strictEqual(bundle.referenceSourcesCount, 1);
  assert.strictEqual(bundle.verificationLevel, 'VERIFIED');
  assert.strictEqual(bundle.documents[0].sourceTier, 'official');
  assert.strictEqual(bundle.documents[0].effectiveStatus, EFFECTIVE_STATUS.ACTIVE);
  assert.strictEqual(bundle.documents[1].sourceTier, 'reference');
  assert.strictEqual(bundle.documents[1].effectiveStatus, EFFECTIVE_STATUS.EXPIRED);

  console.log('  ✔ Test 1 PASS: Evidence bundle correctly classifies official vs reference tiers');
  console.log('  ✔ Test 2 PASS: Evidence bundle sets overall verificationLevel to VERIFIED');

  console.log('[ALL EVIDENCE BUNDLE TESTS PASSED]\n');
}

runEvidenceBundleTests();
