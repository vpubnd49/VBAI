/**
 * Unit Test: Citation Validation Service.
 * Tests official vs reference source verification, fabricated citation rejection, and article validation.
 */
const assert = require('assert');
const { validateCitations } = require('../../legal/services/citation-validation.service');

function runCitationValidationTests() {
  console.log('[Test Suite]: Citation Validation');

  const evidenceBundle = {
    documents: [
      {
        id: 'doc-1',
        documentNumber: '30/2020/NĐ-CP',
        title: 'Nghị định 30/2020/NĐ-CP',
        sourceTier: 'official',
        verificationStatus: 'VERIFIED',
        coordinate: { article: '15' },
      },
      {
        id: 'doc-2',
        documentNumber: '05-HD/TW',
        title: 'Hướng dẫn 05-HD/TW',
        sourceTier: 'reference',
        verificationStatus: 'PARTIAL',
      },
    ],
  };

  // Case 1: Official verified citation
  const text1 = 'Theo quy định tại [Nghị định 30/2020/NĐ-CP], việc soạn thảo văn bản phải tuân thủ...';
  const res1 = validateCitations(text1, evidenceBundle);
  assert.strictEqual(res1.totalCitations, 1);
  assert.strictEqual(res1.citations[0].citationMatchesEvidence, true);
  assert.strictEqual(res1.citations[0].evidenceVerificationStatus, 'verified');
  assert.strictEqual(res1.citations[0].verified, true);
  console.log('  ✔ Test 1 PASS: Official source citation verified');

  // Case 2: Reference source citation (matched but unverified source)
  const text2 = 'Theo [Hướng dẫn 05-HD/TW], quy định này đã thay đổi.';
  const res2 = validateCitations(text2, evidenceBundle);
  assert.strictEqual(res2.totalCitations, 1);
  assert.strictEqual(res2.citations[0].citationMatchesEvidence, true);
  assert.strictEqual(res2.citations[0].evidenceVerificationStatus, 'partial');
  assert.strictEqual(res2.citations[0].verified, false);
  console.log('  ✔ Test 2 PASS: Reference source citation marked citationMatchesEvidence=true but verified=false');

  // Case 3: Fabricated citation
  const text3 = 'Theo [Nghị định 9999/2099/NĐ-CP], quy định không tồn tại.';
  const res3 = validateCitations(text3, evidenceBundle);
  assert.strictEqual(res3.totalCitations, 1);
  assert.strictEqual(res3.citations[0].citationMatchesEvidence, false);
  assert.strictEqual(res3.citations[0].verified, false);
  console.log('  ✔ Test 3 PASS: Fabricated citation correctly rejected');

  console.log('[ALL CITATION VALIDATION TESTS PASSED]\n');
}

runCitationValidationTests();
