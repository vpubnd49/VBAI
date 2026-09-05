/**
 * Privacy Isolation & Pagination Test (Corrective V2)
 *
 * Verifies:
 * - Versioned cursor encode/decode round-trip
 * - Invalid cursor returns 400-like error
 * - Safe field allowlist strips prompt/email/token
 * - User A cannot access User B's data (isolation check via source)
 *
 * Run: node proxy/tests/unit/privacy-isolation.test.cjs
 */
'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const {
  encodeCursor,
  decodeCursor,
  validateCursor,
  sanitizeHistoryDoc,
  SAFE_HISTORY_FIELDS,
} = require(path.join(__dirname, '../../utils/pagination'));

let passed = 0;
let failed = 0;

function ok(condition, msg) {
  if (condition) {
    console.log(`  \u2714 PASS: ${msg}`);
    passed++;
  } else {
    console.error(`  \u2718 FAIL: ${msg}`);
    failed++;
  }
}

console.log('=== Privacy Isolation & Pagination Test (Corrective V2) ===\n');

// 1. Cursor round-trip
console.log('--- 1. Cursor Round-Trip ---');
const testDoc = {
  id: 'doc_abc123',
  created_at: '2026-08-10T01:00:00.000Z',
};
const cursor = encodeCursor(testDoc);
ok(typeof cursor === 'string' && cursor.length > 0, 'Cursor is a non-empty string');

const decoded = decodeCursor(cursor);
ok(decoded !== null, 'Cursor decodes successfully');
ok(decoded.docId === 'doc_abc123', 'Cursor contains correct docId');
ok(decoded.createdAt === '2026-08-10T01:00:00.000Z', 'Cursor contains correct createdAt');

// 2. Invalid cursor
console.log('\n--- 2. Invalid Cursor Rejection ---');
ok(decodeCursor('not-a-valid-cursor') === null, 'Garbage cursor returns null');
ok(decodeCursor('') === null, 'Empty cursor returns null');
ok(decodeCursor(null) === null, 'Null cursor returns null');

const validation = validateCursor('invalid-base64');
ok(!validation.valid, 'validateCursor rejects invalid cursor');
ok(validation.error.includes('Invalid'), 'Error message mentions Invalid');

const validValidation = validateCursor(cursor);
ok(validValidation.valid, 'validateCursor accepts valid cursor');

const emptyValidation = validateCursor(null);
ok(emptyValidation.valid, 'validateCursor accepts null (first page)');

// 3. Safe field allowlist
console.log('\n--- 3. Safe Field Allowlist ---');
const rawDoc = {
  id: 'doc_123',
  created_at: '2026-01-01T00:00:00Z',
  feature: 'legal-search',
  mode: 'A',
  status: 'success',
  user_id: 'uid_abc',
  prompt: 'Tell me about labor law...',
  email: 'user@example.com',
  token: 'firebase-id-token-xyz',
  provider_response: { raw: 'huge data' },
  userEmail: 'user@example.com',
  user_email: 'user@example.com',
};

const sanitized = sanitizeHistoryDoc(rawDoc);
ok(sanitized.id === 'doc_123', 'id preserved');
ok(sanitized.feature === 'legal-search', 'feature preserved');
ok(sanitized.user_id === 'uid_abc', 'user_id preserved');
ok(sanitized.prompt === undefined, 'prompt STRIPPED');
ok(sanitized.email === undefined, 'email STRIPPED');
ok(sanitized.token === undefined, 'token STRIPPED');
ok(sanitized.provider_response === undefined, 'provider_response STRIPPED');
ok(sanitized.userEmail === undefined, 'userEmail STRIPPED to avoid PII');
ok(sanitized.user_email === undefined, 'user_email STRIPPED to avoid PII');

// 4. Source-level ownership checks
console.log('\n--- 4. Source-Level Privacy Checks ---');
const serverPath = path.join(__dirname, '..', '..', 'server.js');
const serverContent = fs.readFileSync(serverPath, 'utf8');
ok(serverContent.includes("{ user_id: decoded.uid }"), 'search_logs filters by user_id through Mongo repository');

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
