/**
 * VBAI V3 — Run all gates in one shot
 * Usage: node run-all-gates.cjs
 */
const { spawnSync } = require('child_process');
const path = require('path');

const REPO = __dirname;
const steps = [
  { name: 'V3 Hardening Verification', cmd: 'node', args: ['proxy/tests/verify-v3-hardening.cjs'] },
  { name: 'Legal Entity Extractor Test', cmd: 'node', args: ['proxy/tests/legal-entity-extractor.test.cjs'] },
  { name: 'Answer Validator Test', cmd: 'node', args: ['proxy/tests/answer-validator.test.cjs'] },
  { name: 'Legal Query Engine Test', cmd: 'node', args: ['proxy/tests/legal-query-engine.test.cjs'] },
];

let allPassed = true;
for (const step of steps) {
  console.log(`\n== ${step.name} ==`);
  const result = spawnSync(step.cmd, step.args, {
    cwd: REPO,
    stdio: 'inherit',
    env: { ...process.env, NODE_NO_WARNINGS: '1' },
  });
  if (result.status !== 0) {
    console.error(`FAILED: ${step.name} (exit code ${result.status})`);
    allPassed = false;
  }
}

console.log('\n======================================================================');
if (allPassed) {
  console.log('ALL GATES PASSED — READY FOR DEPLOYMENT');
} else {
  console.log('SOME GATES FAILED — REVIEW REQUIRED');
  process.exit(1);
}
console.log('======================================================================');
