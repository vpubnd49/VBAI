const FULL_SHA = /^[0-9a-f]{40}$/;
const IMAGE_DIGEST = /^sha256:[0-9a-f]{64}$/;

function normalizeUrl(value) {
  return typeof value === 'string' ? value.replace(/\/+$/, '') : '';
}

function envValue(revision, name) {
  const env = revision?.env;
  if (env && !Array.isArray(env) && typeof env === 'object') {
    return env[name] ?? null;
  }

  const entries = revision?.spec?.containers?.[0]?.env;
  if (!Array.isArray(entries)) return null;
  return entries.find((entry) => entry?.name === name)?.value ?? null;
}

function revisionDigest(revision) {
  return revision?.imageDigest ?? revision?.status?.imageDigest ?? null;
}

function revisionImage(revision) {
  return revision?.image ?? revision?.spec?.containers?.[0]?.image ?? null;
}

function trafficEntries(service) {
  const entries = service?.traffic ?? service?.status?.traffic;
  return Array.isArray(entries) ? entries : [];
}

function numberOrNull(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function checkService({ state, key, expectedServiceName, expectedSha, workflowId, expectedDigest }, fail) {
  const serviceState = state?.cloudRun?.[key];
  if (!serviceState) {
    fail(`CLOUD_RUN_${key.toUpperCase()}_MISSING`, `${key} Cloud Run state is missing`);
    return;
  }

  if (serviceState.serviceName !== expectedServiceName) {
    fail(
      `CLOUD_RUN_${key.toUpperCase()}_SERVICE_NAME`,
      `${key} service must be ${expectedServiceName}`
    );
  }

  const candidateRevision = serviceState.candidateRevision;
  const shortSha = expectedSha.slice(0, 7);
  if (
    typeof candidateRevision !== 'string' ||
    !candidateRevision.startsWith(`${expectedServiceName}-`) ||
    !candidateRevision.includes(shortSha) ||
    !candidateRevision.includes(String(workflowId)) ||
    /(?:^|-)candidate(?:-|$)/i.test(candidateRevision)
  ) {
    fail(
      `CLOUD_RUN_${key.toUpperCase()}_CANDIDATE_IDENTITY`,
      `${key} candidate revision must include the service name, short SHA and workflow run id; generic candidate names are forbidden`
    );
  }

  if (
    typeof serviceState.previousRevision !== 'string' ||
    serviceState.previousRevision.length === 0 ||
    serviceState.previousRevision === candidateRevision
  ) {
    fail(
      `CLOUD_RUN_${key.toUpperCase()}_ROLLBACK_TARGET`,
      `${key} must record a distinct previous revision before promotion`
    );
  }

  if (serviceState.rollbackArmed !== true || serviceState.promotionAttempted !== true) {
    fail(
      `CLOUD_RUN_${key.toUpperCase()}_PROMOTION_EVIDENCE`,
      `${key} must prove rollback was armed and exact-revision promotion was attempted`
    );
  }

  const traffic = trafficEntries(serviceState.service);
  const candidateTraffic = traffic.filter((entry) => entry?.revisionName === candidateRevision);
  const candidatePercent = candidateTraffic.reduce(
    (total, entry) => total + (numberOrNull(entry?.percent) ?? 0),
    0
  );
  const totalTraffic = traffic.reduce((total, entry) => total + (numberOrNull(entry?.percent) ?? 0), 0);
  if (
    candidateTraffic.length < 1 ||
    candidatePercent !== 100 ||
    totalTraffic !== 100 ||
    traffic.some((entry) => entry?.revisionName !== candidateRevision && (numberOrNull(entry?.percent) ?? 0) > 0)
  ) {
    fail(
      `CLOUD_RUN_${key.toUpperCase()}_TRAFFIC`,
      `${key} production traffic must be exactly 100% on the recorded candidate revision`
    );
  }

  const deployedImage = revisionImage(serviceState.revision);
  const digestMatches = revisionDigest(serviceState.revision) === expectedDigest ||
    (typeof deployedImage === 'string' && deployedImage.endsWith(`@${expectedDigest}`));
  if (!digestMatches) {
    fail(
      `CLOUD_RUN_${key.toUpperCase()}_DIGEST`,
      `${key} deployed revision digest does not match the image digest built by the workflow`
    );
  }

  if (envValue(serviceState.revision, 'GIT_SHA') !== expectedSha) {
    fail(
      `CLOUD_RUN_${key.toUpperCase()}_GIT_SHA`,
      `${key} deployed revision GIT_SHA does not match the expected commit`
    );
  }
}

export function verifyReleaseState(state) {
  const errors = [];
  const fail = (code, message) => errors.push({ code, message });

  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    return {
      schemaVersion: 1,
      overall: 'NO_GO',
      errors: [{ code: 'INPUT_INVALID', message: 'Release state must be a JSON object' }],
      checks: { total: 1, passed: 0, failed: 1 },
    };
  }

  if (state.schemaVersion !== 1) {
    fail('SCHEMA_VERSION', 'schemaVersion must equal 1');
  }
  if (state.repository !== 'vpubnd49/VBAI') {
    fail('REPOSITORY_IDENTITY', 'repository must equal vpubnd49/VBAI');
  }
  if (state.branch !== 'main') {
    fail('RELEASE_BRANCH', 'production releases must originate from main');
  }

  const baselineSha = state.baselineSha;
  const expectedSha = state.expectedSha;
  if (!FULL_SHA.test(baselineSha ?? '')) {
    fail('BASELINE_SHA', 'baselineSha must be a lowercase 40-character Git SHA');
  }
  if (!FULL_SHA.test(expectedSha ?? '')) {
    fail('EXPECTED_SHA', 'expectedSha must be a lowercase 40-character Git SHA');
  }
  if (baselineSha === expectedSha) {
    fail('NO_RELEASE_COMMIT', 'expectedSha must differ from the deployed baseline SHA');
  }
  if (state.remote?.branchSha !== expectedSha) {
    fail('REMOTE_SHA', 'remote main SHA does not match expectedSha');
  }

  const workflow = state.workflow ?? {};
  const workflowId = Number(workflow.id);
  if (!Number.isSafeInteger(workflowId) || workflowId <= 0) {
    fail('WORKFLOW_RUN_ID', 'workflow.id must be a positive integer from GitHub Actions');
  }
  if (
    typeof workflow.url !== 'string' ||
    workflow.url !== `https://github.com/vpubnd49/VBAI/actions/runs/${workflowId}`
  ) {
    fail('WORKFLOW_RUN_URL', 'workflow.url must identify the exact recorded GitHub Actions run');
  }
  if (workflow.event !== 'workflow_dispatch') {
    fail('WORKFLOW_EVENT', 'production release must use workflow_dispatch');
  }
  if (workflow.status !== 'completed' || workflow.conclusion !== 'success') {
    fail('WORKFLOW_RESULT', 'GitHub Actions run must be completed successfully');
  }
  if (workflow.headSha !== expectedSha) {
    fail('WORKFLOW_HEAD_SHA', 'workflow head SHA does not match expectedSha');
  }
  if (workflow.workflowName !== 'Production Release') {
    fail('WORKFLOW_IDENTITY', 'workflow name must equal Production Release');
  }

  const gates = state.gates ?? {};
  if (
    numberOrNull(gates.total) !== 25 ||
    numberOrNull(gates.passed) !== 25 ||
    numberOrNull(gates.failed) !== 0 ||
    numberOrNull(gates.blocked) !== 0 ||
    gates.headSha !== expectedSha
  ) {
    fail('MASTER_GATES', 'master gates must be 25 PASS, 0 FAIL, 0 BLOCKED for expectedSha');
  }

  const security = state.security ?? {};
  if (security.acceptance !== 'NOT_REQUIRED_ZERO_VULNERABILITIES') {
    fail('SECURITY_ACCEPTANCE', 'release must eliminate the residual dependency risk instead of accepting it');
  }
  if (security.optionalStorageAbsent !== true) {
    fail('OPTIONAL_STORAGE_PRESENT', '@google-cloud/storage must be absent from the production image');
  }
  if (security.storageRuntimeUnreachable !== true) {
    fail('STORAGE_REACHABLE', 'Firebase Storage must be unreachable in the production runtime');
  }
  const audit = security.deployedAudit ?? {};
  if (['critical', 'high', 'moderate', 'low'].some((severity) => numberOrNull(audit[severity]) !== 0)) {
    fail('DEPLOYED_AUDIT', 'deployed production dependency audit must contain zero vulnerabilities');
  }
  const completeAudit = security.completeAudit ?? {};
  if (['critical', 'high', 'moderate', 'low'].some((severity) => numberOrNull(completeAudit[severity]) !== 0)) {
    fail('COMPLETE_AUDIT', 'complete proxy dependency audit must contain zero vulnerabilities');
  }

  const proxyDigest = state.images?.proxy?.builtDigest;
  const webappDigest = state.images?.webapp?.builtDigest;
  if (!IMAGE_DIGEST.test(proxyDigest ?? '')) {
    fail('PROXY_IMAGE_DIGEST', 'proxy builtDigest must be an immutable sha256 digest');
  }
  if (!IMAGE_DIGEST.test(webappDigest ?? '')) {
    fail('WEBAPP_IMAGE_DIGEST', 'webapp builtDigest must be an immutable sha256 digest');
  }

  if (state.cloudRun?.projectId !== 'gen-lang-client-0462350485') {
    fail('GCP_PROJECT_ID', 'Cloud Run project id is incorrect');
  }
  if (String(state.cloudRun?.projectNumber ?? '') !== '419728335518') {
    fail('GCP_PROJECT_NUMBER', 'Cloud Run project number is incorrect');
  }
  if (state.cloudRun?.region !== 'asia-southeast1') {
    fail('GCP_REGION', 'Cloud Run region is incorrect');
  }

  if (FULL_SHA.test(expectedSha ?? '') && Number.isSafeInteger(workflowId) && workflowId > 0) {
    checkService({
      state,
      key: 'proxy',
      expectedServiceName: 'vbai-proxy',
      expectedSha,
      workflowId,
      expectedDigest: proxyDigest,
    }, fail);
    checkService({
      state,
      key: 'webapp',
      expectedServiceName: 'vbai',
      expectedSha,
      workflowId,
      expectedDigest: webappDigest,
    }, fail);
  }

  const canonical = state.canonical ?? {};
  if (normalizeUrl(canonical.url) !== 'https://vbai-419728335518.asia-southeast1.run.app') {
    fail('CANONICAL_URL', 'canonical production URL is incorrect');
  }
  if (canonical.healthOk !== true) {
    fail('CANONICAL_HEALTH', 'canonical production health check did not pass');
  }
  if (canonical.gitSha !== expectedSha) {
    fail('CANONICAL_SHA', 'canonical production SHA does not match expectedSha');
  }

  const totalChecks = 20;
  return {
    schemaVersion: 1,
    overall: errors.length === 0 ? 'DEPLOYED_VERIFIED' : 'NO_GO',
    expectedSha: expectedSha ?? null,
    workflowRunId: Number.isSafeInteger(workflowId) ? workflowId : null,
    errors,
    checks: {
      total: totalChecks,
      passed: Math.max(0, totalChecks - errors.length),
      failed: errors.length,
    },
  };
}
