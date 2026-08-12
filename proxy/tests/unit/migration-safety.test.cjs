/**
 * Migration Safety Test (Corrective V2)
 *
 * Verifies that migration script:
 * - Defaults to dry-run (no --apply)
 * - Has --apply flag check
 * - Reports examined/changed/skipped/failed
 * - Does not auto-apply
 *
 * Run: node proxy/tests/unit/migration-safety.test.cjs
 */
'use strict';

const fs = require('fs');
const path = require('path');

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

console.log('=== Migration Safety Test (Corrective V2) ===\n');

const migrationPath = path.join(__dirname, '..', '..', '..', 'scripts', 'migrate-search-logs.cjs');
ok(fs.existsSync(migrationPath), 'Migration script exists');

if (fs.existsSync(migrationPath)) {
  const content = fs.readFileSync(migrationPath, 'utf8');

  ok(content.includes("'--apply'"), 'Has --apply flag check');
  ok(content.includes('DRY-RUN'), 'Mentions DRY-RUN mode');
  ok(content.includes('examined'), 'Reports examined count');
  ok(content.includes('changed'), 'Reports changed count');
  ok(content.includes('skipped'), 'Reports skipped count');
  ok(content.includes('failed'), 'Reports failed count');
  ok(!content.includes('IS_APPLY = true'), 'Does NOT default to apply');
  ok(content.includes("IS_APPLY = process.argv.includes"), 'Apply mode requires CLI flag');
  ok(content.includes('batch.commit'), 'Uses Firestore batch writes');
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
