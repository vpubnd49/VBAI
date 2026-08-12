import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const runner = fs.readFileSync(path.join(repoRoot, 'run-all-gates-v4.cjs'), 'utf8');
const deploy = fs.readFileSync(path.join(repoRoot, '.github/workflows/deploy.yml'), 'utf8');
const pr = fs.readFileSync(path.join(repoRoot, '.github/workflows/pr-validation.yml'), 'utf8');
const verify = fs.readFileSync(path.join(repoRoot, '.github/workflows/verify-production.yml'), 'utf8');
const legalKitValidator = fs.readFileSync(path.join(repoRoot, 'skill/validate-legalkit.cjs'), 'utf8');

const declaredGateIds = [...runner.matchAll(/\{ id: (\d+), name:/g)].map((match) => Number(match[1]));
assert.deepEqual(declaredGateIds, Array.from({ length: 25 }, (_, index) => index + 1));

assert.match(runner, /VBAI_UI_SCENARIO_RESULT_PATH:\s*resultJsonPath/);
assert.match(runner, /VBAI_UI_AUDIT_OUTPUT_DIR:\s*AUDIT_DIR/);
assert.match(runner, /uiData\.EXECUTED !== 612/);
assert.match(runner, /uiData\.PASSED !== 612/);
assert.doesNotMatch(runner, /uiData\.APPLICABLE/);
assert.doesNotMatch(runner, /uiData\.NOT_APPLICABLE/);

for (const workflow of [deploy, pr]) {
  assert.match(workflow, /playwright install --with-deps chromium/);
}
assert.match(verify, /needs\.verify\.result == 'failure'/);
assert.doesNotMatch(
  verify,
  /needs\.verify\.outputs\.deployment_available == 'true'/,
  'independent verification failure must always attempt rollback'
);
assert.doesNotMatch(verify, /status\.traffic\[0\]\.revisionName/);
assert.match(runner, /--output[\s\S]*docs\/legalkit-v3-source-hashes\.json/);
assert.match(legalKitValidator, /Source Master is missing or empty/);
assert.match(legalKitValidator, /total:\s*54/);
assert.match(legalKitValidator, /COPIED:\s*41/);
assert.match(legalKitValidator, /EXCLUDED_BY_POLICY:\s*13/);

console.log('PASS master-runner-contract.test.mjs');
