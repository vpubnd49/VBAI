/**
 * Integration Test: Server-Side Citation Validation & Legal V2 Runtime Wiring.
 * Verifies:
 * 1. Static assertion: proxy/server.js imports citation-validation.service and invokes validateCitations.
 * 2. Runtime orchestrator & citation validation wiring.
 * 3. Server-side citation validation metadata contract on actual evidence bundle documents.
 * 4. Non-legal query backward compatibility.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { orchestrateLegalSearch } = require('../../legal/services/legal-search-orchestrator');
const { validateCitations } = require('../../legal/services/citation-validation.service');

async function runRuntimeWiringTests() {
  console.log('[Test Suite]: Server-Side Citation Validation & Runtime Wiring Verification');

  // Test 1: Static code assertion on proxy/server.js
  const serverJsPath = path.join(__dirname, '../../server.js');
  const serverJsContent = fs.readFileSync(serverJsPath, 'utf8');

  assert.match(
    serverJsContent,
    /require\(['"]\.\/legal\/services\/citation-validation\.service['"]\)/,
    'proxy/server.js MUST import citation-validation.service'
  );
  assert.match(
    serverJsContent,
    /validateCitations\(/,
    'proxy/server.js MUST invoke validateCitations()'
  );
  console.log('  ✔ Test 1 PASS: Static assertion verified — proxy/server.js imports and invokes citation validation service in runtime path');

  // Test 2: Legal query orchestration with Article coordinate and document resolution
  const query = 'Khoản 1 Điều 15 Nghị định 30/2020/NĐ-CP quy định như thế nào?';
  const legalRes = await orchestrateLegalSearch({ query, forceFresh: true });

  assert.strictEqual(legalRes.success, true);
  assert.ok(legalRes.legal, 'legal response object must exist');
  assert.ok(Array.isArray(legalRes.legal.coordinates), 'coordinates must be an array');
  assert.strictEqual(legalRes.legal.coordinates[0].article, '15');
  assert.strictEqual(legalRes.legal.coordinates[0].clause, '1');
  assert.ok(legalRes.legal.evidenceBundle, 'evidenceBundle must exist');
  assert.ok(Array.isArray(legalRes.legal.evidenceBundle.documents), 'documents array must exist');
  assert.ok(legalRes.legal.evidenceBundle.documents.length > 0, 'at least 1 resolved document must exist');
  console.log('  ✔ Test 2 PASS: Legal orchestrator resolves document & coordinates (Khoản 1 Điều 15)');

  // Test 3: Server-side citation validation using actual document from retrieved evidence bundle
  const docs = legalRes.legal.evidenceBundle.documents;
  const actualDocRef = docs[0].documentNumber || docs[0].title;
  const simulatedAnswer = `Theo quy định tại [${actualDocRef}] và [9999/2099/NĐ-CP], thể thức văn bản hành chính được áp dụng...`;

  const citationValidation = validateCitations(simulatedAnswer, legalRes.legal.evidenceBundle);

  assert.strictEqual(citationValidation.totalCitations, 2);
  assert.strictEqual(citationValidation.citations[0].citationMatchesEvidence, true);
  assert.strictEqual(citationValidation.citations[1].citationMatchesEvidence, false);
  assert.strictEqual(citationValidation.citations[1].verified, false);
  console.log('  ✔ Test 3 PASS: Citation validation accurately verifies actual evidence document and flags fabricated [9999/2099/NĐ-CP]');

  // Test 4: Non-legal query backward compatibility
  const nonLegalQuery = 'Xin chào trợ lý, thời tiết hôm nay thế nào?';
  const nonLegalRes = await orchestrateLegalSearch({ query: nonLegalQuery, forceFresh: true });
  assert.strictEqual(nonLegalRes.success, true);
  assert.strictEqual(nonLegalRes.legal.coordinates.length, 0);
  console.log('  ✔ Test 4 PASS: Non-legal query passes backward compatibility check without legal coordinates');

  console.log('[ALL RUNTIME CITATION VALIDATION WIRING TESTS PASSED]\n');
}

runRuntimeWiringTests().catch((err) => {
  console.error('[GATE B RUNTIME TEST ERROR]:', err);
  process.exit(1);
});
