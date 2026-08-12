/**
 * UI Rendered Artifact Contract Validation Test
 *
 * Strict single path resolution:
 * 1. process.argv[2]
 * 2. process.env.VBAI_UI_SCENARIO_RESULT_PATH
 * 3. process.env.VBAI_UI_AUDIT_OUTPUT_DIR / UI_AUDIT_OUTPUT_DIR + 'ui-scenario-results.json'
 * 4. resolveAuthoritativeResultPath(process.env)
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  UI_ROUTES,
  UI_VIEWPORTS,
  UI_STATES,
  buildScenarioId,
  buildExpectedScenarios,
  resolveAuthoritativeResultPath,
} from './ui-scenario-matrix.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function resolveContractResultPath(customArg = process.argv[2], env = process.env) {
  if (customArg && typeof customArg === 'string' && customArg.trim().length > 0) {
    return path.resolve(customArg.trim());
  }
  return resolveAuthoritativeResultPath(env);
}

export function validateRenderedArtifact(targetPath = null) {
  const resultPath = resolveContractResultPath(targetPath);

  if (!resultPath) {
    console.error('RESULT_PATH_REQUIRED');
    if (process.argv[1] === __filename) process.exit(2);
    throw new Error('RESULT_PATH_REQUIRED');
  }

  const absPath = path.resolve(resultPath);
  if (!fs.existsSync(absPath)) {
    console.error(`RESULT_ARTIFACT_NOT_FOUND=${absPath}`);
    if (process.argv[1] === __filename) process.exit(2);
    throw new Error(`RESULT_ARTIFACT_NOT_FOUND=${absPath}`);
  }

  let data;
  let sha256Hex = '';
  try {
    const raw = fs.readFileSync(absPath);
    sha256Hex = crypto.createHash('sha256').update(raw).digest('hex').toUpperCase();
    data = JSON.parse(raw.toString('utf8'));
  } catch (err) {
    console.error(`INVALID_JSON_ARTIFACT=${absPath}: ${err.message}`);
    if (process.argv[1] === __filename) process.exit(1);
    throw err;
  }

  const scenarios = Array.isArray(data.scenarios) ? data.scenarios : [];
  const actualPassedCount = scenarios.filter(s => s.status === 'PASSED' || s.status === 'PASS').length;
  const actualFailedCount = scenarios.filter(s => s.status === 'FAILED' || s.status === 'FAIL').length;
  const actualBlockedCount = scenarios.filter(s => s.status === 'BLOCKED').length;

  const EXECUTED = typeof data.EXECUTED === 'number' ? data.EXECUTED : (actualPassedCount + actualFailedCount);
  const PASSED = typeof data.PASSED === 'number' ? data.PASSED : actualPassedCount;
  const FAILED = typeof data.FAILED === 'number' ? data.FAILED : actualFailedCount;
  const BLOCKED = typeof data.BLOCKED === 'number' ? data.BLOCKED : actualBlockedCount;
  const DISCOVERED = typeof data.DISCOVERED === 'number' ? data.DISCOVERED : scenarios.length;

  console.log(`VALIDATED_RESULT_PATH=${absPath}`);
  console.log(`VALIDATED_RESULT_SHA256=${sha256Hex}`);
  console.log(`DISCOVERED=${DISCOVERED}`);
  console.log(`EXECUTED=${EXECUTED}`);
  console.log(`PASSED=${PASSED}`);
  console.log(`FAILED=${FAILED}`);
  console.log(`BLOCKED=${BLOCKED}`);

  let assertionCount = 0;
  const failures = [];

  const assert = (condition, msg) => {
    assertionCount++;
    if (!condition) {
      failures.push(msg);
    }
  };

  const expectedScenarios = buildExpectedScenarios(); // 612
  const expectedIdSet = new Set(expectedScenarios.map(s => s.id));

  // 1. Exactly 17 unique routes
  const routesInMatrix = new Set(UI_ROUTES.map(r => r.id));
  assert(routesInMatrix.size === 17, `Unique routes count (${routesInMatrix.size}) !== 17`);

  // 2. Exactly 3 unique viewports
  const viewportsInMatrix = new Set(UI_VIEWPORTS.map(v => v.name));
  assert(viewportsInMatrix.size === 3, `Unique viewports count (${viewportsInMatrix.size}) !== 3`);

  // 3. Exactly 12 unique states
  const statesInMatrix = new Set(UI_STATES);
  assert(statesInMatrix.size === 12, `Unique states count (${statesInMatrix.size}) !== 12`);

  // 4. Exactly 612 unique expected IDs
  assert(expectedIdSet.size === 612, `Expected scenario IDs (${expectedIdSet.size}) !== 612`);

  // 5. Exactly 612 result records
  assert(scenarios.length === 612, `scenarios.length (${scenarios.length}) !== 612`);

  // Scenario ID mapping
  const seenIdCounts = new Map();
  for (const s of scenarios) {
    const id = s.id || buildScenarioId(s.surface, s.viewport, s.state);
    seenIdCounts.set(id, (seenIdCounts.get(id) || 0) + 1);
  }

  const missingScenarios = [];
  const duplicateScenarios = [];
  const unexpectedScenarios = [];

  for (const expId of expectedIdSet) {
    const count = seenIdCounts.get(expId) || 0;
    if (count === 0) missingScenarios.push(expId);
    if (count > 1) duplicateScenarios.push({ id: expId, count });
  }

  for (const actualId of seenIdCounts.keys()) {
    if (!expectedIdSet.has(actualId)) {
      unexpectedScenarios.push(actualId);
    }
  }

  assert(missingScenarios.length === 0, `Missing scenario count (${missingScenarios.length}) !== 0`);
  assert(unexpectedScenarios.length === 0, `Unexpected scenario count (${unexpectedScenarios.length}) !== 0`);
  assert(duplicateScenarios.length === 0, `Duplicate scenario count (${duplicateScenarios.length}) !== 0`);

  // Strict Matrix Count Assertions
  assert(DISCOVERED === 612, `DISCOVERED (${DISCOVERED}) !== 612`);
  assert(EXECUTED === 612, `EXECUTED (${EXECUTED}) !== 612`);
  assert(PASSED === 612, `PASSED (${PASSED}) !== 612`);
  assert(FAILED === 0, `FAILED (${FAILED}) !== 0`);
  assert(BLOCKED === 0, `BLOCKED (${BLOCKED}) !== 0`);

  assert(PASSED === actualPassedCount, `Top-level PASSED (${PASSED}) !== actual array PASSED (${actualPassedCount})`);
  assert(FAILED === actualFailedCount, `Top-level FAILED (${FAILED}) !== actual array FAILED (${actualFailedCount})`);
  assert(BLOCKED === actualBlockedCount, `Top-level BLOCKED (${BLOCKED}) !== actual array BLOCKED (${actualBlockedCount})`);

  console.log(`CONTRACT_ASSERTIONS_EXECUTED=${assertionCount}`);

  if (failures.length > 0) {
    console.error(`❌ Contract Validation Failed (${failures.length} failures):`);
    failures.forEach(f => console.error(`  - ${f}`));
    if (process.argv[1] === __filename) process.exit(1);
    throw new Error(`Contract Validation Failed (${failures.length} failures)`);
  }

  console.log('  ✔ UI Rendered Artifact Contract PASS');
  return { status: 'PASS', assertionsExecuted: assertionCount, sha256: sha256Hex, path: absPath };
}

export function selfTestPathContract() {
  // Test 1: Renderer path equals validator path
  const testEnv = { VBAI_UI_AUDIT_OUTPUT_DIR: path.join(__dirname, 'test_output_dir') };
  const path1 = resolveAuthoritativeResultPath(testEnv);
  const path2 = resolveContractResultPath(null, testEnv);
  const equalPath = (path1 === path2);

  // Test 2: Custom output directory works
  const customEnv = { VBAI_UI_SCENARIO_RESULT_PATH: path.join(__dirname, 'custom_dir', 'ui-scenario-results.json') };
  const customPath = resolveContractResultPath(null, customEnv);
  const customPathWorks = (customPath === path.resolve(customEnv.VBAI_UI_SCENARIO_RESULT_PATH));

  // Test 3: Spaces in path work
  const spacesEnv = { VBAI_UI_SCENARIO_RESULT_PATH: path.join(__dirname, 'folder with spaces', 'ui-scenario-results.json') };
  const spacesPath = resolveContractResultPath(null, spacesEnv);
  const spacesWork = (spacesPath === path.resolve(spacesEnv.VBAI_UI_SCENARIO_RESULT_PATH));

  // Test 4: Missing artifact returns error
  let missingFails = false;
  try {
    validateRenderedArtifact(path.join(__dirname, 'non_existent_file_999.json'));
  } catch (_) {
    missingFails = true;
  }

  // Test 5: Reject 612/578 false positive fixture
  const falsePositiveFixture = {
    DISCOVERED: 612,
    EXECUTED: 578,
    PASSED: 578,
    FAILED: 0,
    BLOCKED: 0,
    scenarios: Array(578).fill(null).map((_, i) => ({ id: `scen_${i}`, status: 'PASSED' }))
  };
  const tempFile = path.join(__dirname, `temp_fixture_test_${Date.now()}.json`);
  fs.writeFileSync(tempFile, JSON.stringify(falsePositiveFixture));
  let falsePositiveRejected = false;
  try {
    validateRenderedArtifact(tempFile);
  } catch (_) {
    falsePositiveRejected = true;
  } finally {
    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
  }

  return {
    equalPath,
    customPathWorks,
    spacesWork,
    missingFails,
    falsePositiveRejected,
    allPassed: equalPath && customPathWorks && spacesWork && missingFails && falsePositiveRejected
  };
}

if (process.argv[1] === __filename) {
  const targetPath = process.argv[2] || process.env.VBAI_UI_SCENARIO_RESULT_PATH || process.env.VBAI_UI_AUDIT_OUTPUT_DIR || process.env.UI_AUDIT_OUTPUT_DIR;
  try {
    validateRenderedArtifact(targetPath);
    process.exit(0);
  } catch (err) {
    if (!process.exitCode) process.exit(1);
  }
}
