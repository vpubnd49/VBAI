/**
 * VBAI Legal Pro V3 — Comprehensive Local Verification Script
 * Run: node proxy/tests/verify-v3-hardening.cjs
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  PASS: ${name}`);
    passed++;
  } catch (e) {
    console.log(`  FAIL: ${name}`);
    console.log(`        ${e.message}`);
    failed++;
  }
}

async function asyncTest(name, fn) {
  try {
    await fn();
    console.log(`  PASS: ${name}`);
    passed++;
  } catch (e) {
    console.log(`  FAIL: ${name}`);
    console.log(`        ${e.message}`);
    failed++;
  }
}

console.log('======================================================================');
console.log('VBAI LEGAL PRO V3 — COMPREHENSIVE LOCAL VERIFICATION');
console.log('======================================================================\n');

// ===== SECTION 1: Data Integrity =====
console.log('--- SECTION 1: Data Integrity ---');

test('bosung_metadata.json contains 72/2025/QH15', () => {
  const raw = fs.readFileSync(path.join(__dirname, '../bosung_metadata.json'), 'utf8');
  const bosung = JSON.parse(raw);
  let found = null;
  for (const key of Object.keys(bosung)) {
    if (bosung[key]?.so_hieu === '72/2025/QH15') { found = bosung[key]; break; }
  }
  assert.ok(found, '72/2025/QH15 must exist in bosung_metadata.json');
  assert.ok(found.trich_yeu.includes('Tổ chức chính quyền địa phương'),
    `Title must be "Luật Tổ chức chính quyền địa phương", got: ${found.trich_yeu}`);
});

test('known-documents.json contains 72/2025/QH15 with correct title', () => {
  const raw = fs.readFileSync(path.join(__dirname, '../legal/data/known-documents.json'), 'utf8');
  const docs = JSON.parse(raw);
  const found = docs.find(d => d.document_number === '72/2025/QH15');
  assert.ok(found, '72/2025/QH15 must exist in known-documents.json');
  assert.ok(found.title.includes('Tổ chức chính quyền địa phương'),
    `Title must include "Tổ chức chính quyền địa phương", got: ${found.title}`);
  assert.ok(!found.title.includes('an ninh mạng'), 'Title must NOT include "an ninh mạng"');
});

// ===== SECTION 2: Module Imports =====
console.log('\n--- SECTION 2: Module Imports ---');

test('legal/index.js barrel import works', () => {
  const legal = require('../legal/index');
  assert.ok(legal.domain.matchScore, 'matchScore must be imported');
  assert.ok(legal.domain.documentNumber, 'documentNumber must be imported');
  assert.ok(legal.domain.queryIntent, 'queryIntent must be imported');
  assert.ok(legal.repositories.knownDocumentsRepo, 'knownDocumentsRepo must be imported');
});

test('known-documents.repository exports findByPartialNumber', () => {
  const repo = require('../legal/repositories/known-documents.repository');
  assert.ok(typeof repo.findByPartialNumber === 'function', 'findByPartialNumber must be a function');
  assert.ok(typeof repo.findByTopicInBosung === 'function', 'findByTopicInBosung must be a function');
});

test('answer-validator exports getDocumentMetadata', () => {
  const av = require('../legal/services/answer-validator');
  assert.ok(typeof av.getDocumentMetadata === 'function');
  assert.ok(typeof av.isDocumentKnown === 'function');
  assert.ok(typeof av.clearValidatorCaches === 'function');
});

test('legal-query-engine exports processLegalQuery', () => {
  const engine = require('../legal/services/legal-query-engine');
  assert.ok(typeof engine.processLegalQuery === 'function');
});

// ===== SECTION 3: Answer Validator =====
console.log('\n--- SECTION 3: Answer Validator ---');

const { getDocumentMetadata, isDocumentKnown, clearValidatorCaches } = require('../legal/services/answer-validator');
clearValidatorCaches();

test('getDocumentMetadata(72/2025/QH15) resolves from bosung', () => {
  const meta = getDocumentMetadata('72/2025/QH15');
  assert.ok(meta, 'Must resolve');
  assert.strictEqual(meta.source, 'bosung_metadata', `Source must be bosung_metadata, got: ${meta.source}`);
  assert.ok(meta.title.includes('Tổ chức chính quyền địa phương'),
    `Title must include "Tổ chức chính quyền địa phương", got: ${meta.title}`);
});

test('getDocumentMetadata(74/2025/QH15) resolves', () => {
  const meta = getDocumentMetadata('74/2025/QH15');
  assert.ok(meta, 'Must resolve');
});

test('isDocumentKnown(72/2025/QH15) returns true', () => {
  assert.strictEqual(isDocumentKnown('72/2025/QH15'), true);
});

test('isDocumentKnown(999/9999/FAKE) returns false', () => {
  assert.strictEqual(isDocumentKnown('999/9999/FAKE'), false);
});

// ===== SECTION 4: Entity Extraction =====
console.log('\n--- SECTION 4: Entity Extraction ---');

const { extractLegalEntities, extractDocumentNumbers, extractArticleReferences, detectDocumentType } = require('../legal/domain/legal-entity-extractor');

test('extractDocumentNumbers("Luat so 72/2025/QH15") works', () => {
  const nums = extractDocumentNumbers('Luat so 72/2025/QH15');
  assert.strictEqual(nums.length, 1);
  assert.strictEqual(nums[0].normalized, '72/2025/QH15');
});

test('extractArticleReferences("Dieu 51 quy dinh gi") works', () => {
  const refs = extractArticleReferences('Dieu 51 quy dinh gi');
  assert.ok(refs.length > 0);
  assert.strictEqual(refs[0].value, '51');
});

test('detectDocumentType("Luat to chuc chinh quyen dia phuong") works', () => {
  const dt = detectDocumentType('Luat to chuc chinh quyen dia phuong');
  assert.ok(dt);
  assert.strictEqual(dt.type, 'luat');
});

test('extractLegalEntities("Dieu 51 Luat 72/2025/QH15") works', () => {
  const entities = extractLegalEntities('Dieu 51 Luat 72/2025/QH15');
  assert.strictEqual(entities.hasDocumentRef, true);
  assert.strictEqual(entities.hasArticleRef, true);
});

test('extractLegalEntities("luat 72") detects bare number', () => {
  const entities = extractLegalEntities('luat 72');
  assert.ok(entities.hasBareNumberRef, 'Must detect bare number');
  assert.strictEqual(entities.bareNumberCandidates[0].number, '72');
  assert.strictEqual(entities.bareNumberCandidates[0].docType, 'luat');
});

test('extractLegalEntities("chinh quyen dia phuong") detects topic', () => {
  const entities = extractLegalEntities('quy dinh ve chinh quyen dia phuong');
  assert.ok(entities.topics.length > 0, 'Must detect topic');
});

// ===== SECTION 5: Repository Functions =====
console.log('\n--- SECTION 5: Repository Functions ---');

const { findByPartialNumber, findByTopicInBosung } = require('../legal/repositories/known-documents.repository');

test('findByPartialNumber("72", "luat") finds 72/2025/QH15', () => {
  const results = findByPartialNumber('72', 'luat');
  assert.ok(results.length > 0, 'Must find at least one result');
  assert.ok(results.some(r => r.documentNumber === '72/2025/QH15'),
    'Must include 72/2025/QH15, got: ' + JSON.stringify(results.map(r => r.documentNumber)));
});

test('findByPartialNumber("72/2025") finds 72/2025/QH15', () => {
  const results = findByPartialNumber('72/2025');
  assert.ok(results.length > 0, 'Must find at least one result');
});

test('findByTopicInBosung("chinh quyen dia phuong") finds 72/2025/QH15', () => {
  const results = findByTopicInBosung('chính quyền địa phương');
  assert.ok(results.length > 0, 'Must find at least one result');
  assert.ok(results.some(r => r.documentNumber === '72/2025/QH15'),
    'Must include 72/2025/QH15');
});

// ===== SECTION 6: Legal Query Engine (async) =====
console.log('\n--- SECTION 6: Legal Query Engine ---');

const { processLegalQuery } = require('../legal/services/legal-query-engine');

(async () => {
  await asyncTest('processLegalQuery("72/2025/QH15 la luat gi?") succeeds', async () => {
    const r = await processLegalQuery({ query: '72/2025/QH15 la luat gi?' });
    assert.ok(r.success, 'Must succeed');
    assert.strictEqual(r.effectiveDocNumber, '72/2025/QH15');
    assert.ok(r.document, 'Must have document object');
    assert.ok(r.document.title.includes('Tổ chức chính quyền địa phương'),
      'Document title must include correct name, got: ' + r.document.title);
    assert.ok(r.retrievalContext, 'Must have retrievalContext');
    assert.ok(Array.isArray(r.followUps), 'Must have followUps');
    assert.ok(r.conversationUpdate, 'Must have conversationUpdate');
  });

  await asyncTest('processLegalQuery("luat 72 co gi?") resolves via bare number', async () => {
    const r = await processLegalQuery({ query: 'luat 72 co gi?' });
    assert.ok(r.success, 'Must succeed');
    assert.ok(r.effectiveDocNumber, 'Must resolve a document number, got null');
    assert.strictEqual(r.effectiveDocNumber, '72/2025/QH15',
      'Must resolve to 72/2025/QH15, got: ' + r.effectiveDocNumber);
  });

  await asyncTest('processLegalQuery("72/2025") partial number resolve', async () => {
    const r = await processLegalQuery({ query: '72/2025 quy dinh ve van de gi?' });
    assert.ok(r.success, 'Must succeed');
    assert.ok(r.effectiveDocNumber, 'Must resolve a document');
  });

  await asyncTest('processLegalQuery("Dieu 1 cua Luat so 72/2025/QH15") extracts article', async () => {
    const r = await processLegalQuery({ query: 'Dieu 1 cua Luat so 72/2025/QH15 quy dinh gi?' });
    assert.ok(r.success);
    assert.strictEqual(r.effectiveDocNumber, '72/2025/QH15');
    assert.ok(r.articles && r.articles.length > 0, 'Must have articles');
  });

  await asyncTest('processLegalQuery with conversation context', async () => {
    const r = await processLegalQuery({
      query: 'Dieu 2 noi gi?',
      conversationContext: { documentNumber: '72/2025/QH15' }
    });
    assert.ok(r.success);
    assert.strictEqual(r.effectiveDocNumber, '72/2025/QH15');
  });

  await asyncTest('processLegalQuery("") returns error', async () => {
    const r = await processLegalQuery({ query: '' });
    assert.strictEqual(r.success, false);
  });

  await asyncTest('processLegalQuery topic search for chinh quyen dia phuong', async () => {
    const r = await processLegalQuery({ query: 'quy dinh moi ve to chuc chinh quyen dia phuong' });
    assert.ok(r.success, 'Must succeed');
  });

  // ===== SECTION 7: File Integrity =====
  console.log('\n--- SECTION 7: File Integrity ---');

  const criticalFiles = [
    '../server.js',
    '../routes/legal-research.routes.js',
    '../routes/web-search.routes.js',
    '../routes/web-extract.routes.js',
    '../legal/index.js',
    '../legal/domain/query-intent.js',
    '../legal/domain/legal-entity-extractor.js',
    '../legal/domain/document-number.js',
    '../legal/domain/match-score.js',
    '../legal/domain/article-coordinate.js',
    '../legal/services/answer-validator.js',
    '../legal/services/legal-query-engine.js',
    '../legal/services/evidence-bundle.service.js',
    '../legal/services/cross-reference.service.js',
    '../legal/repositories/known-documents.repository.js',
    '../Dockerfile',
  ];
  for (const f of criticalFiles) {
    test(`File exists: ${path.basename(f)}`, () => {
      assert.ok(fs.existsSync(path.join(__dirname, f)), `File must exist: ${f}`);
    });
  }

  test('build-info.json is neutral', () => {
    const biPath = path.join(__dirname, '../../webapp/public/build-info.json');
    const bi = JSON.parse(fs.readFileSync(biPath, 'utf8'));
    assert.strictEqual(bi.gitSha, 'dev', 'build-info.json gitSha must be "dev"');
  });

  test('Dockerfile copies legal/ and routes/', () => {
    const dockerfile = fs.readFileSync(path.join(__dirname, '../Dockerfile'), 'utf8');
    assert.ok(dockerfile.includes('COPY legal'), 'Must copy legal/');
    assert.ok(dockerfile.includes('COPY routes'), 'Must copy routes/');
    assert.ok(dockerfile.includes('bosung_metadata.json'), 'Must copy bosung_metadata.json');
  });

  // ===== FINAL REPORT =====
  console.log('\n======================================================================');
  console.log(`RESULTS: ${passed} passed, ${failed} failed, total ${passed + failed}`);
  if (failed === 0) {
    console.log('VERDICT: ALL TESTS PASS — V3 HARDENING VERIFIED');
  } else {
    console.log('VERDICT: SOME TESTS FAILED — REVIEW REQUIRED');
  }
  console.log('======================================================================');
  process.exit(failed > 0 ? 1 : 0);
})();
