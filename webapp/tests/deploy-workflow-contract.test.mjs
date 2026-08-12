import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const deployPath = path.join(repoRoot, '.github', 'workflows', 'deploy.yml');
const verifyPath = path.join(repoRoot, '.github', 'workflows', 'verify-production.yml');
const dockerfilePath = path.join(repoRoot, 'webapp', 'Dockerfile');

console.log('[TEST] Running production workflow contract test...');

const deploy = fs.readFileSync(deployPath, 'utf8');
const verify = fs.readFileSync(verifyPath, 'utf8');
const dockerfile = fs.readFileSync(dockerfilePath, 'utf8');

assert.match(deploy, /name:\s*Production Release/);
assert.match(deploy, /release_sha:/);
assert.match(deploy, /baseline_sha:/);
assert.doesNotMatch(deploy, /accept_residual_risk:/);
assert.match(deploy, /refs\/heads\/main/);
assert.ok(!deploy.includes('credentials_json:'), 'long-lived JSON service-account auth is forbidden');
assert.ok(!deploy.includes('GCP_SA_KEY'), 'legacy GCP_SA_KEY is forbidden');
assert.match(deploy, /workload_identity_provider:/);
assert.match(deploy, /GCP_BUILD_SERVICE_ACCOUNT/);
assert.match(deploy, /GCP_DEPLOY_SERVICE_ACCOUNT/);
assert.ok((deploy.match(/--no-traffic/g) || []).length >= 2, 'proxy and webapp must both deploy at zero traffic');
assert.ok((deploy.match(/--to-revisions/g) || []).length >= 4, 'promotion and rollback must target exact revisions for both services');
assert.doesNotMatch(deploy, /set \+e/, 'rollback must not suppress command failures');
assert.match(deploy, /failure\(\) && steps\.release\.outcome == 'success'/, 'rollback must require recorded rollback targets');
assert.match(deploy, /needs\.build\.outputs\.proxy_digest/);
assert.match(deploy, /needs\.build\.outputs\.webapp_digest/);
assert.match(deploy, /actions\/attest-build-provenance@v2/);
assert.match(deploy, /playwright install --with-deps chromium/);
assert.match(deploy, /positive\.some\(row => row\.revisionName!==expected\)/);
assert.ok(!deploy.includes('LATEST=100'));
assert.ok(!deploy.includes('MAX_AUDIO_UPLOAD_MB=500'));
assert.match(deploy, /https:\/\/vbai-419728335518\.asia-southeast1\.run\.app/);

assert.match(verify, /name:\s*Production Release Verification/);
assert.match(verify, /workflow_run:/);
assert.match(verify, /workflows:\s*\[Production Release\]/);
assert.match(verify, /GCP_VERIFY_SERVICE_ACCOUNT/);
assert.match(verify, /verify-release\.mjs/);
assert.match(verify, /Roll back when independent verification fails/);
assert.doesNotMatch(verify, /status\.traffic\[0\]\.revisionName/);
assert.match(verify, /positive\.some\(row => row\.revisionName!==expected\)/);

for (const name of ['GIT_SHA', 'SOURCE_TREE_HASH', 'SOURCE_TREE_DIRTY', 'REQUIRE_CLEAN_BUILD']) {
  assert.match(dockerfile, new RegExp(`ARG ${name}`), `webapp Dockerfile must accept ${name} at build time`);
  assert.match(dockerfile, new RegExp(`${name}=\\$\\{${name}\\}`), `webapp Dockerfile must export ${name}`);
}
assert.match(dockerfile, /APP_ENV=production/);
assert.match(dockerfile, /NODE_ENV=production/);

console.log('PASS production workflow contract test');
