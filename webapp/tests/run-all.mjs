import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const files = fs.readdirSync(__dirname).filter((f) => f.endsWith('.test.mjs'));

let passed = 0;
let failed = 0;

console.log('== Running Webapp Legal & Policy Tests ==\n');

for (const file of files) {
  const filePath = path.join(__dirname, file);
  const res = spawnSync('node', [filePath], { stdio: 'inherit' });
  if (res.status === 0) {
    passed += 1;
  } else {
    failed += 1;
    console.error(`FAILED: ${file}`);
  }
}

console.log(`\nWebapp test summary: ${passed} passed, ${failed} failed out of ${files.length} test files.`);
if (failed > 0) {
  process.exit(1);
}
