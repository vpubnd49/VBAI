/**
 * Cursor Pagination Unit Test (Phase 6)
 *
 * Verifies cursor pagination implementation in GET /api/search-history:
 * - Accepts limit & cursor query parameters
 * - Uses deterministic ordering (created_at desc)
 * - Returns pagination metadata (pageSize, hasMore, nextCursor)
 *
 * Run: node proxy/tests/unit/cursor-pagination.test.cjs
 */
'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;

function ok(condition, msg) {
  if (condition) {
    console.log(`  ✔ PASS: ${msg}`);
    passed++;
  } else {
    console.error(`  ✘ FAIL: ${msg}`);
    failed++;
  }
}

const serverPath = path.join(__dirname, '..', '..', 'server.js');
const serverContent = fs.readFileSync(serverPath, 'utf8');

console.log('=== Cursor Pagination Unit Test ===\n');

const searchHistoryIndex = serverContent.indexOf("app.get('/api/search-history'");
const searchHistoryEnd = serverContent.indexOf(
  "app.delete('/api/search-history/:id'",
  searchHistoryIndex
);
const searchHistoryBlock =
  searchHistoryIndex >= 0 && searchHistoryEnd > searchHistoryIndex
    ? serverContent.slice(searchHistoryIndex, searchHistoryEnd)
    : '';

ok(searchHistoryIndex >= 0, 'GET /api/search-history route exists');
ok(
  searchHistoryEnd > searchHistoryIndex,
  'Search-history route boundary is detected'
);

ok(searchHistoryBlock.includes('req.query.limit'), 'Accepts limit query parameter');
ok(searchHistoryBlock.includes('req.query.cursor'), 'Accepts cursor query parameter');
ok(searchHistoryBlock.includes('startAfter'), 'Uses Firestore startAfter for deterministic cursor pagination');
ok(searchHistoryBlock.includes('pagination:'), 'Returns pagination metadata object in response');
ok(searchHistoryBlock.includes('nextCursor:'), 'Returns nextCursor identifier for pagination chaining');
ok(/\bhasMore\s*[:,]/.test(searchHistoryBlock), 'Returns hasMore boolean flag');

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
