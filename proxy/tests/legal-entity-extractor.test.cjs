const assert = require('assert');
const { extractDocumentNumbers, extractArticleReferences, detectDocumentType, extractLegalEntities } = require('../legal/domain/legal-entity-extractor');

console.log('=== Legal Entity Extractor Tests ===');

const nums = extractDocumentNumbers('Luat so 72/2025/QH15');
assert.strictEqual(nums.length, 1);
assert.strictEqual(nums[0].normalized, '72/2025/QH15');

const refs = extractArticleReferences('Dieu 51 quy dinh gi');
assert.strictEqual(refs[0].value, '51');

const dt = detectDocumentType('Luat to chuc chinh quyen dia phuong');
assert.strictEqual(dt.type, 'luat');

const entities = extractLegalEntities('Dieu 51 Luat 72/2025/QH15');
assert.strictEqual(entities.hasDocumentRef, true);
assert.strictEqual(entities.hasArticleRef, true);

console.log('PASS legal-entity-extractor.test.cjs');
