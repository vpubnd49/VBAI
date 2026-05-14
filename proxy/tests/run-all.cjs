/* eslint-disable no-console */
const { spawnSync } = require('child_process');

function runStep(name, command, args = []) {
  console.log(`\n== ${name} ==`);
  const out = spawnSync(command, args, { stdio: 'inherit' });
  if (out.status !== 0) {
    console.error(`Step failed: ${name}`);
    process.exit(out.status || 1);
  }
}

runStep('Golden legal extract tests', 'node', ['tests/golden-legal-extract.test.cjs']);

if (process.env.VBAI_PROXY_BASE_URL && process.env.VBAI_TEST_ID_TOKEN) {
  runStep('Runtime integration tests', 'node', ['tests/runtime-web-search.integration.cjs']);
  runStep('Runtime canary checks', 'node', ['tests/runtime-web-search.canary.cjs']);
} else {
  console.log('\nSkipping runtime integration/canary (missing VBAI_PROXY_BASE_URL or VBAI_TEST_ID_TOKEN).');
}

console.log('\nAll available checks finished.');
