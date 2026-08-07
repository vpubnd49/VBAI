import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Programmatically discover all *.test.mjs files in tests directory
const discoveredFiles = fs.readdirSync(__dirname).filter((f) => f.endsWith('.test.mjs')).sort();

let executedCount = 0;
let passedCount = 0;
let failedCount = 0;

console.log('== Running Webapp Legal & Policy Tests ==\n');
console.log(`DISCOVERED WEBAPP TEST FILES: ${discoveredFiles.length}`);

const loaderPath = path.resolve(__dirname, 'browser-import-loader.mjs');
const loaderUrl = pathToFileURL(loaderPath).href;

for (const file of discoveredFiles) {
  const filePath = path.join(__dirname, file);
  const isRouteSmoke = file === 'route-smoke.test.mjs';
  const args = (isRouteSmoke && fs.existsSync(loaderPath))
    ? ['--loader', loaderUrl, filePath]
    : [filePath];

  executedCount++;
  const res = spawnSync(process.execPath, args, { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });
  if (res.status === 0) {
    passedCount++;
  } else {
    failedCount++;
    console.error(`FAILED: ${file}`);
  }
}

console.log('\n========================================');
console.log(`DISCOVERED TEST FILES: ${discoveredFiles.length}`);
console.log(`EXECUTED TEST FILES:   ${executedCount}`);
console.log(`PASSED TEST FILES:     ${passedCount}`);
console.log(`FAILED TEST FILES:     ${failedCount}`);
console.log('========================================');

if (executedCount !== discoveredFiles.length) {
  console.error(`❌ CRITICAL: Executed test count (${executedCount}) does not match discovered test count (${discoveredFiles.length})!`);
  process.exit(1);
}

if (failedCount > 0) {
  console.error(`❌ Webapp test suite failed with ${failedCount} failure(s).`);
  process.exit(1);
}

console.log('🎉 ALL WEBAPP TESTS PASSED SUCCESSFULLY!');
