'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('known-documents.json includes core NQ57 & DX 2024-2026 documents', () => {
  const filePath = path.resolve(__dirname, '../../legal/data/known-documents.json');
  const docs = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const numbers = new Set(docs.map((d) => d.document_number));

  for (const expected of ['57-NQ/TW', '71/NQ-CP', '11/NQ-CP', '02-KH/BCĐTW', '1425/QĐ-TTg']) {
    assert.ok(numbers.has(expected), `Missing required document: ${expected}`);
  }

  const nq11 = docs.find((d) => d.document_number === '11/NQ-CP');
  assert.equal(nq11.issue_date, '2026-01-14');
  assert.ok(nq11.amends.includes('71/NQ-CP'));

  const qd1425 = docs.find((d) => d.document_number === '1425/QĐ-TTg');
  assert.equal(qd1425.issue_date, '2026-07-29');
});

test('auth.service.js does not contain hardcoded LEGACY_JWT_SECRET', () => {
  const authPath = path.resolve(__dirname, '../../services/auth.service.js');
  const src = fs.readFileSync(authPath, 'utf8');
  assert.ok(!src.includes('LEGACY_JWT_SECRET'), 'LEGACY_JWT_SECRET must be removed');
  assert.ok(src.includes('org_level'), 'RBAC 2-tier org_level must be present');
});
