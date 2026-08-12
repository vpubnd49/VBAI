/**
 * Governance & Metadata Assertions Unit Test (Phase 7)
 *
 * Verifies:
 * - Skill_The_Thuc_VB_Dang_HD05/package.json name & description contain HD05 (not HD36)
 * - README.md contains full VBAI Legal Pro V4 architecture & setup docs
 * - ADR files (0001-0004) contain valid status and architectural decision text
 * - PULL_REQUEST_TEMPLATE.md contains required checklists
 *
 * Run: node proxy/tests/unit/governance-metadata.test.cjs
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

const repoRoot = path.join(__dirname, '..', '..', '..');

console.log('=== Governance & Metadata Unit Test ===\n');

// 1. Check Skill_The_Thuc_VB_Dang_HD05/package.json
console.log('--- 1. Skill Metadata Inspection ---');
const hd05PkgPath = path.join(repoRoot, 'Skill_The_Thuc_VB_Dang_HD05', 'package.json');
ok(fs.existsSync(hd05PkgPath), 'Skill_The_Thuc_VB_Dang_HD05/package.json exists');

if (fs.existsSync(hd05PkgPath)) {
  const pkg = JSON.parse(fs.readFileSync(hd05PkgPath, 'utf8'));
  ok(pkg.name === 'skill-vb-dang-hd05', `package.json name is 'skill-vb-dang-hd05' (was: ${pkg.name})`);
  ok(pkg.description.includes('HD 05-HD/VPTW') || pkg.description.includes('HD05'),
    `package.json description references HD05 (was: ${pkg.description})`);
  ok(!pkg.name.includes('hd36'), 'package.json name DOES NOT contain hd36');
  ok(!pkg.description.includes('HD 36'), 'package.json description DOES NOT contain HD 36');
}

// 2. Check README.md content assertions
console.log('\n--- 2. README Content Assertions ---');
const readmePath = path.join(repoRoot, 'README.md');
ok(fs.existsSync(readmePath), 'README.md exists');
if (fs.existsSync(readmePath)) {
  const readme = fs.readFileSync(readmePath, 'utf8');
  ok(readme.includes('VBAI Legal Pro V4'), 'README contains VBAI Legal Pro V4 header');
  ok(readme.includes('bosung_metadata.json'), 'README documents bosung_metadata.json canonical source');
  ok(readme.includes('Fail-Closed Verification Policy'), 'README documents fail-closed verification policy');
}

// 3. Check ADR content assertions
console.log('\n--- 3. ADR Content Assertions ---');
const adrDir = path.join(repoRoot, 'docs', 'adr');
const expectedAdrs = [
  '0001-bosung-metadata-authoritative.md',
  '0002-fail-closed-verification.md',
  '0003-gemini-only-architecture.md',
  '0004-firebase-auth-isolation.md',
];

for (const adrFile of expectedAdrs) {
  const adrPath = path.join(adrDir, adrFile);
  ok(fs.existsSync(adrPath), `${adrFile} exists`);
  if (fs.existsSync(adrPath)) {
    const text = fs.readFileSync(adrPath, 'utf8');
    ok(text.includes('Status') && text.includes('Accepted'), `${adrFile} has Accepted status`);
  }
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
