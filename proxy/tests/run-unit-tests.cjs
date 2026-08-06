const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const unitDir = path.join(__dirname, 'unit');
const files = fs.readdirSync(unitDir).filter((f) => f.endsWith('.test.cjs'));

let passed = 0;
let failed = 0;

console.log('== Running Proxy Unit Tests ==\n');

for (const file of files) {
  const filePath = path.join(unitDir, file);
  const res = spawnSync('node', [filePath], { stdio: 'inherit' });
  if (res.status === 0) {
    passed += 1;
  } else {
    failed += 1;
    console.error(`FAILED: ${file}`);
  }
}

console.log(`\nUnit test summary: ${passed} passed, ${failed} failed out of ${files.length} test files.`);
if (failed > 0) {
  process.exit(1);
}
