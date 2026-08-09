/* eslint-disable no-console */
const { spawnSync } = require('child_process');
const path = require('path');

const testsDir = __dirname;

function runStep(name, testFile) {
  console.log(`\n== ${name} ==`);
  const filePath = path.join(testsDir, testFile);
  const out = spawnSync('node', [filePath], { stdio: 'inherit' });
  if (out.status !== 0) {
    console.error(`Step failed: ${name}`);
    process.exit(out.status || 1);
  }
}

runStep('Known documents integrity', 'known-documents-integrity.test.cjs');
runStep('Unit tests', 'run-unit-tests.cjs');
runStep('Golden legal extract tests', 'golden-legal-extract.test.cjs');

if (process.env.VBAI_PROXY_BASE_URL && process.env.VBAI_TEST_ID_TOKEN) {
  runStep('Runtime integration tests', 'runtime-web-search.integration.cjs');
  runStep('Runtime canary checks', 'runtime-web-search.canary.cjs');
  runStep('Runtime legal smoke checks', 'runtime-legal-smoke.cjs');
} else {
  console.log('\nSkipping runtime integration/canary/legal-smoke (missing VBAI_PROXY_BASE_URL or VBAI_TEST_ID_TOKEN).');
}

console.log('\nAll available checks finished.');