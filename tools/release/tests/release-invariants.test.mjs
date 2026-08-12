import assert from 'node:assert/strict';
import { verifyReleaseState } from '../lib/release-invariants.mjs';

const baselineSha = '1111111111111111111111111111111111111111';
const expectedSha = '2222222222222222222222222222222222222222';
const runId = 987654321;
const proxyDigest = `sha256:${'a'.repeat(64)}`;
const webappDigest = `sha256:${'b'.repeat(64)}`;

function serviceState(serviceName, digest) {
  const revision = `${serviceName}-${expectedSha.slice(0, 7)}-${runId}`;
  return {
    serviceName,
    candidateRevision: revision,
    previousRevision: `${serviceName}-previous`,
    rollbackArmed: true,
    promotionAttempted: true,
    service: { status: { traffic: [
      { revisionName: revision, percent: 100 },
      { revisionName: revision, tag: `candidate-${runId}`, url: `https://${serviceName}-tag.example` },
    ] } },
    revision: {
      status: { imageDigest: digest },
      spec: { containers: [{ image: `registry.example/${serviceName}@${digest}`, env: [{ name: 'GIT_SHA', value: expectedSha }] }] },
    },
  };
}

function validState() {
  return {
    schemaVersion: 1,
    repository: 'vpubnd49/VBAI',
    branch: 'main',
    baselineSha,
    expectedSha,
    remote: { branchSha: expectedSha },
    workflow: {
      id: runId,
      url: `https://github.com/vpubnd49/VBAI/actions/runs/${runId}`,
      event: 'workflow_dispatch',
      status: 'completed',
      conclusion: 'success',
      headSha: expectedSha,
      workflowName: 'Production Release',
    },
    gates: { total: 25, passed: 25, failed: 0, blocked: 0, headSha: expectedSha },
    security: {
      acceptance: 'NOT_REQUIRED_ZERO_VULNERABILITIES',
      optionalStorageAbsent: true,
      storageRuntimeUnreachable: true,
      deployedAudit: { critical: 0, high: 0, moderate: 0, low: 0 },
      completeAudit: { critical: 0, high: 0, moderate: 0, low: 0 },
    },
    images: {
      proxy: { builtDigest: proxyDigest },
      webapp: { builtDigest: webappDigest },
    },
    cloudRun: {
      projectId: 'gen-lang-client-0462350485',
      projectNumber: '419728335518',
      region: 'asia-southeast1',
      proxy: serviceState('vbai-proxy', proxyDigest),
      webapp: serviceState('vbai', webappDigest),
    },
    canonical: {
      url: 'https://vbai-419728335518.asia-southeast1.run.app/',
      healthOk: true,
      gitSha: expectedSha,
    },
  };
}

function expectFailure(mutate, code) {
  const state = validState();
  mutate(state);
  const result = verifyReleaseState(state);
  assert.equal(result.overall, 'NO_GO');
  assert.ok(result.errors.some((error) => error.code === code), `missing expected error ${code}`);
}

assert.equal(verifyReleaseState(validState()).overall, 'DEPLOYED_VERIFIED');

expectFailure((state) => { state.expectedSha = state.baselineSha; }, 'NO_RELEASE_COMMIT');
expectFailure((state) => { state.workflow.url = 'https://github.com/vpubnd49/VBAI/actions/runs/latest'; }, 'WORKFLOW_RUN_URL');
expectFailure((state) => { state.workflow.headSha = baselineSha; }, 'WORKFLOW_HEAD_SHA');
expectFailure((state) => { state.gates.failed = 1; state.gates.passed = 24; }, 'MASTER_GATES');
expectFailure((state) => { state.security.optionalStorageAbsent = false; }, 'OPTIONAL_STORAGE_PRESENT');
expectFailure((state) => { state.security.completeAudit.moderate = 1; }, 'COMPLETE_AUDIT');
expectFailure((state) => { state.cloudRun.proxy.candidateRevision = 'vbai-proxy-v4-candidate'; }, 'CLOUD_RUN_PROXY_CANDIDATE_IDENTITY');
expectFailure((state) => {
  state.cloudRun.webapp.revision.status.imageDigest = proxyDigest;
  state.cloudRun.webapp.revision.spec.containers[0].image = `registry.example/vbai@${proxyDigest}`;
}, 'CLOUD_RUN_WEBAPP_DIGEST');
expectFailure((state) => { state.cloudRun.proxy.service.status.traffic[0].percent = 99; }, 'CLOUD_RUN_PROXY_TRAFFIC');
expectFailure((state) => { state.cloudRun.proxy.service.status.traffic.push({ revisionName: 'other', percent: 1 }); }, 'CLOUD_RUN_PROXY_TRAFFIC');
expectFailure((state) => { state.canonical.gitSha = baselineSha; }, 'CANONICAL_SHA');

console.log('PASS release-invariants.test.mjs');
