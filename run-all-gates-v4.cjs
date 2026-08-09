/**
 * VBAI Legal Pro V4 — Master Gate Runner
 * Executes all security scans, UI audits, unit tests, contract tests, and legal verification steps.
 * Usage: node run-all-gates-v4.cjs
 */
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const REPO = __dirname;

function runStep(name, cmd, args) {
  console.log(`\n======================================================================`);
  console.log(`GATE: ${name}`);
  console.log(`======================================================================`);
  const result = spawnSync(cmd, args, {
    cwd: REPO,
    stdio: 'inherit',
    env: { ...process.env, NODE_NO_WARNINGS: '1' },
  });
  if (result.status !== 0) {
    console.error(`\n❌ FAILED GATE: ${name} (exit code ${result.status})`);
    return false;
  }
  console.log(`\n✅ PASSED GATE: ${name}`);
  return true;
}

const gates = [
  { name: 'Secret Scanner', cmd: 'node', args: ['scripts/secret-scan.cjs'] },
  { name: 'CSS Light UI Audit', cmd: 'node', args: ['webapp/tests/css-light-audit.test.mjs'] },
  { name: 'UI Theme Integrity', cmd: 'node', args: ['webapp/tests/ui-theme.test.mjs'] },
  { name: 'System Config Security Unit Test', cmd: 'node', args: ['proxy/tests/unit/system-config-security.test.cjs'] },
  { name: 'Proxy Unit Test Suite', cmd: 'node', args: ['proxy/tests/run-unit-tests.cjs'] },
  { name: 'Golden Legal Extract Tests', cmd: 'node', args: ['proxy/tests/golden-legal-extract.test.cjs'] },
  { name: 'V3/V4 Comprehensive Hardening Verification', cmd: 'node', args: ['proxy/tests/verify-v3-hardening.cjs'] },
  { name: 'Webapp Suite (All Webapp Tests)', cmd: 'node', args: ['webapp/tests/run-all.mjs'] },
];

let failedCount = 0;
for (const gate of gates) {
  const ok = runStep(gate.name, gate.cmd, gate.args);
  if (!ok) failedCount++;
}

console.log('\n======================================================================');
if (failedCount === 0) {
  console.log('🎉 ALL V4 GATES PASSED (8/8) — READY FOR PRODUCTION RELEASE');
  console.log('======================================================================');
  process.exit(0);
} else {
  console.error(`❌ ${failedCount} GATE(S) FAILED — REVIEW REQUIRED BEFORE DEPLOYMENT`);
  console.log('======================================================================');
  process.exit(1);
}
