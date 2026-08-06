import assert from 'node:assert/strict';
import { extractDocNumberFromQuery, isFreshnessNeeded, isExtractRequested } from '../modules/legal/query-intent.js';

assert.equal(extractDocNumberFromQuery('Tra cứu 72/2025/QH15'), '72/2025/QH15');
assert.equal(isFreshnessNeeded('Luật an ninh mạng mới nhất'), true);
assert.equal(isExtractRequested('Trích Điều 5 Khoản 2'), true);

console.log('PASS legal-query-intent.test.mjs');
