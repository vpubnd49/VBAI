import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolveAuthoritativeResultPath } from './ui-scenario-matrix.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webappDir = path.resolve(__dirname, '..');

// Exclude artifact contract from ordinary loop so it runs in exact order after rendered audit
const discoveredFiles = fs.readdirSync(__dirname)
  .filter((f) => f.endsWith('.test.mjs') && f !== 'ui-rendered-artifact-contract.test.mjs')
  .sort();

let executedCount = 0;
let passedCount = 0;
let failedCount = 0;

console.log('== Running Webapp Legal & Policy Tests ==\n');
console.log(`DISCOVERED TEST FILES: ${discoveredFiles.length + 1}`);

const loaderPath = path.resolve(__dirname, 'browser-import-loader.mjs');
const loaderUrl = pathToFileURL(loaderPath).href;

const resultJsonPath = resolveAuthoritativeResultPath(process.env);
const outputDir = path.dirname(resultJsonPath);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}
const env = {
  ...process.env,
  VBAI_UI_SCENARIO_RESULT_PATH: resultJsonPath,
  VBAI_UI_AUDIT_OUTPUT_DIR: outputDir,
  UI_AUDIT_OUTPUT_DIR: outputDir
};

let renderedExitCode = null;
let contractExitCode = null;

for (const file of discoveredFiles) {
  const filePath = path.join(__dirname, file);
  const isRouteSmoke = file === 'route-smoke.test.mjs';
  const isRenderedAudit = file === 'ui-rendered-audit.test.mjs';

  const args = fs.existsSync(loaderPath)
    ? ['--experimental-loader', loaderUrl, filePath]
    : [filePath];

  executedCount++;
  const res = spawnSync(process.execPath, args, { stdio: 'inherit', cwd: webappDir, env });

  if (isRenderedAudit) {
    renderedExitCode = res.status;
    console.log(`RENDERED_EXIT=${renderedExitCode}`);
  }

  if (res.status === 0) {
    passedCount++;
  } else {
    failedCount++;
    console.error(`FAILED: ${file}`);
  }
}

// Order: Only run contract test if rendered audit succeeded (or finished writing output)
const contractFilePath = path.join(__dirname, 'ui-rendered-artifact-contract.test.mjs');

if (renderedExitCode === 0) {
  if (!fs.existsSync(resultJsonPath)) {
    console.error(`UI_ARTIFACT_PATH_NOT_FOUND=${resultJsonPath}`);
    failedCount++;
  } else {
    const contractArgs = fs.existsSync(loaderPath)
      ? ['--experimental-loader', loaderUrl, contractFilePath, resultJsonPath]
      : [contractFilePath, resultJsonPath];
    const contractRes = spawnSync(process.execPath, contractArgs, { stdio: 'inherit', cwd: webappDir, env });
    contractExitCode = contractRes.status;
    console.log(`ARTIFACT_CONTRACT_EXIT=${contractExitCode}`);

    if (contractExitCode === 0) {
      passedCount++;
    } else {
      failedCount++;
      console.error('FAILED: ui-rendered-artifact-contract.test.mjs');
    }
  }
}

console.log('\n========================================');
console.log(`DISCOVERED TEST FILES: ${discoveredFiles.length + 1}`);
console.log(`EXECUTED TEST FILES:   ${executedCount}`);
console.log(`PASSED TEST FILES:     ${passedCount}`);
console.log(`FAILED TEST FILES:     ${failedCount}`);
console.log('========================================');

if (failedCount > 0) {
  console.error(`❌ Webapp test suite failed with ${failedCount} failure(s).`);
  process.exit(1);
}

console.log('🎉 ALL WEBAPP TESTS PASSED SUCCESSFULLY!');
