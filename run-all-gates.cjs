/**
 * VBAI Legal Pro V2 — Master Gate Validation Runner
 * Executes all unit tests, LegalKit validators, CSS light audits, and route smoke tests.
 */

const { execSync } = require('child_process');
const path = require('path');

const ROOT_DIR = __dirname;

console.log('======================================================================');
console.log('VBAI LEGAL PRO V2 — MASTER POST-IMPLEMENTATION VERIFICATION GATE');
console.log('======================================================================\n');

let allPassed = true;

function runStep(name, command, cwd = ROOT_DIR) {
  console.log(`▶ Running [${name}]...`);
  try {
    const output = execSync(command, { cwd, encoding: 'utf8', stdio: 'pipe' });
    console.log(output);
    console.log(`✅ [${name}] PASS\n`);
  } catch (err) {
    console.error(`❌ [${name}] FAIL`);
    console.error(err.stdout || err.stderr || err.message);
    console.log('\n');
    allPassed = false;
  }
}

const { pathToFileURL } = require('url');
const loaderUrl = pathToFileURL(path.resolve(ROOT_DIR, 'webapp/tests/browser-import-loader.mjs')).href;

// 1. LegalKit Programmatic Validation
runStep('LegalKit V3 Validator', 'node skill/validate-legalkit.cjs');

// 2. Skill Compiler
runStep('Skills Compiler', 'node webapp/compile-skills.cjs');

// 3. Route Smoke Test (with custom test loader for remote browser ESM imports)
runStep('16-Route Smoke Test', `node --loader "${loaderUrl}" webapp/tests/route-smoke.test.mjs`);

// 4. CSS Light Audit Test
runStep('CSS Light-Only Audit', 'node webapp/tests/css-light-audit.test.mjs');

// 5. Proxy Unit Tests
runStep('Proxy Gemini-Only Test', 'node proxy/tests/unit/gemini-only.test.cjs');
runStep('Proxy Migration Safety Test', 'node proxy/tests/unit/migration-safety.test.cjs');
runStep('Proxy Zero-Occurrence Test', 'node proxy/tests/unit/zero-occurrence.test.cjs');

// 6. WebApp Audit Trace Test
runStep('Audit Trace Test', 'node webapp/tests/audit-trace.test.mjs');

// 7. Full WebApp Test Suite (All Discovered Tests)
runStep('Full WebApp Test Suite (All 17 Tests)', 'node webapp/tests/run-all.mjs');

console.log('======================================================================');
if (allPassed) {
  console.log('🎉 ALL VERIFICATION GATES PASSED! RESULT: POST_IMPLEMENTATION_VERIFIED_PASS');
} else {
  console.error('⚠️ ONE OR MORE GATES FAILED! RESULT: POST_IMPLEMENTATION_BLOCKED');
  process.exit(1);
}
console.log('======================================================================');
