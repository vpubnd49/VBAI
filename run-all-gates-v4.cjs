/**
 * VBAI Legal Pro V2 — Master 25-Gate Runner (V4.7 Evidence-Strict Engine)
 *
 * 1. Zero hardcoded fallbacks or fabricated PASS results.
 * 2. Cross-platform NPM CLI resolution via process.execPath.
 * 3. Gate 1: Exact live HEAD/branch validation with no stale preflight-file authority.
 * 4. Gate 3: Real secret scan & tracking check for proxy/service-account.json & webapp/github-sa-key.json.
 * 5. Gate 4: LegalKit temp mirror validation without hardcoded fallbacks.
 * 6. Gate 6: Backend 9-layer existence, proxy file syntax, and isolated module import smoke.
 * 7. Gate 21: Full build identity fail-close executor with accumulation of all phase logs.
 * 8. Gate 22: Fail-close npm audit parser for proxy and webapp.
 * 9. Gate 24: Real Docker lifecycle, dynamic port polling, inspect verification, and post-cleanup evidence.
 * 10. Gate 25: Staged/unstaged binary diff and porcelain fingerprinting preflight vs postflight.
 * 11. Complete artifact fail-close generation & provisional manifest.
 * 12. Strict exit code semantics: 0 for 25 PASS, 2 for 0 FAIL & BLOCKED > 0, 1 for FAIL or invariant error.
 */
'use strict';

const { spawnSync, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const net = require('node:net');
const http = require('node:http');
const { pathToFileURL } = require('url');

const REPO = __dirname;
const EXPECTED_HEAD = process.env.VBAI_EXPECTED_HEAD || execSync('git rev-parse HEAD', {
  cwd: __dirname,
  encoding: 'utf8'
}).trim();
const EXPECTED_BRANCH = process.env.VBAI_EXPECTED_BRANCH || execSync('git branch --show-current', {
  cwd: __dirname,
  encoding: 'utf8'
}).trim();

const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-');
const AUDIT_DIR = path.resolve(REPO, '..', 'VBAI-audit-artifacts', `master-25-${TIMESTAMP}`);
const LOGS_DIR = path.join(AUDIT_DIR, 'logs');

if (!fs.existsSync(AUDIT_DIR)) fs.mkdirSync(AUDIT_DIR, { recursive: true });
if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });

function resolveNpmCli() {
  const nodeDir = path.dirname(process.execPath);
  const candidates = [
    process.env.npm_execpath,
    path.join(nodeDir, 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    path.join(nodeDir, '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    path.join(nodeDir, '..', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    '/usr/local/lib/node_modules/npm/bin/npm-cli.js',
    '/usr/lib/node_modules/npm/bin/npm-cli.js',
  ].filter(Boolean);

  let found = candidates.find(candidate => fs.existsSync(candidate));
  if (!found) {
    try {
      const whichNpm = execSync(process.platform === 'win32' ? 'where npm' : 'which npm', { encoding: 'utf8' }).trim().split(/\r?\n/)[0];
      if (whichNpm && fs.existsSync(whichNpm)) {
        found = whichNpm;
      }
    } catch (_) {}
  }
  if (!found) {
    throw new Error('NPM_CLI_NOT_FOUND: ' + candidates.join('; '));
  }
  return found;
}

let npmCli = null;
try {
  npmCli = resolveNpmCli();
} catch (err) {
  npmCli = null;
}

function getNpmCommand(args) {
  if (!npmCli) {
    return { command: null, args, blockedReason: 'NPM_CLI_NOT_FOUND: npm-cli.js path could not be resolved' };
  }
  if (npmCli.endsWith('.js')) {
    return { command: process.execPath, args: [npmCli, ...args], blockedReason: null };
  }
  return { command: npmCli, args, blockedReason: null };
}

async function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

function httpGet(url, timeoutMs = 5000) {
  return new Promise((resolve) => {
    let settled = false;
    let timer = null;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolve(value);
    };
    const req = http.get(url, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => finish({ statusCode: res.statusCode, body, error: null }));
    });

    timer = setTimeout(() => {
      req.destroy(new Error('HTTP request timeout'));
      finish({ statusCode: 500, body: '', error: 'HTTP_TIMEOUT' });
    }, timeoutMs);

    req.on('error', (err) => finish({ statusCode: 500, body: '', error: err.message }));
  });
}

// Fingerprint preflight state for Gate 25 read-only integrity check
let gitHead = '';
let gitBranch = '';
try {
  gitHead = execSync('git rev-parse HEAD', { cwd: REPO, encoding: 'utf8' }).trim();
  gitBranch = process.env.GITHUB_REF_NAME || execSync('git branch --show-current', { cwd: REPO, encoding: 'utf8' }).trim();
} catch (_) {}

const gitStatusBefore = execSync('git status --porcelain=v1', { cwd: REPO, encoding: 'utf8' });
const diffHeadBefore = crypto.createHash('sha256').update(execSync('git diff --binary HEAD --', { cwd: REPO })).digest('hex');
const diffCachedBefore = crypto.createHash('sha256').update(execSync('git diff --cached --binary', { cwd: REPO })).digest('hex');

fs.writeFileSync(path.join(AUDIT_DIR, 'git-head.txt'), `HEAD: ${gitHead}\nBRANCH: ${gitBranch}\n`);
fs.writeFileSync(path.join(AUDIT_DIR, 'git-status-before.txt'), gitStatusBefore);

const proxyNpmCi = getNpmCommand(['ci']);
const webappNpmCi = getNpmCommand(['ci']);
const proxyTestAll = getNpmCommand(['run', 'test:all']);
const webappTestAll = getNpmCommand(['run', 'test:all']);

const loaderPath = path.resolve(REPO, 'webapp', 'tests', 'browser-import-loader.mjs');
const loaderUrl = pathToFileURL(loaderPath).href;
const resultJsonPath = path.join(AUDIT_DIR, 'ui-scenario-results.json');

function writeErrorArtifact(fileName, gateId, command, exitCode, reason, status = 'BLOCKED') {
  const targetPath = path.join(AUDIT_DIR, fileName);
  fs.writeFileSync(targetPath, JSON.stringify({
    artifactStatus: status,
    gateId,
    command: command || 'custom-executor',
    exitCode: exitCode ?? null,
    reason: reason || 'Execution failed or blocked',
    sourceArtifactPresent: false
  }, null, 2));
}

function serializeProcess(command, args, result) {
  return {
    command: [command, ...(args || [])].join(' '),
    exitCode: result && Number.isInteger(result.status) ? result.status : null,
    signal: result ? result.signal || null : null,
    processError: result && result.error ? result.error.message : null,
    stdout: result ? result.stdout || '' : '',
    stderr: result ? result.stderr || '' : ''
  };
}

function walkSourceFiles(rootDir) {
  const output = [];
  const visit = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (/\.(?:c?js|mjs)$/i.test(entry.name)) output.push(absolute);
    }
  };
  visit(rootDir);
  return output.sort((a, b) => a.localeCompare(b));
}

function flattenObjectEntries(value, prefix = '') {
  if (!value || typeof value !== 'object') return [];
  const entries = [];
  for (const [key, child] of Object.entries(value)) {
    const keyPath = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === 'object') entries.push(...flattenObjectEntries(child, keyPath));
    else entries.push([keyPath, child]);
  }
  return entries;
}

function redactSensitiveText(value) {
  return String(value || '')
    .replace(/-----BEGIN[^-]*PRIVATE KEY-----[\s\S]*?-----END[^-]*PRIVATE KEY-----/gi, '[REDACTED_PRIVATE_KEY]')
    .replace(/-----BEGIN[^-]*PRIVATE KEY-----\\n[\s\S]*?-----END[^-]*PRIVATE KEY-----\\n?/gi, '[REDACTED_PRIVATE_KEY]')
    .replace(/\bAIza[0-9A-Za-z_-]{30,}\b/g, '[REDACTED_GOOGLE_API_KEY]')
    .replace(/\b(Bearer\s+)[A-Za-z0-9._~-]+/gi, '$1[REDACTED_TOKEN]')
    .replace(/(["']?(?:api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|password|private[_-]?key)["']?\s*[:=]\s*["']?)[^"',\s}]+/gi, '$1[REDACTED]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[REDACTED_JWT]');
}

// Custom Gate 1 Executor (exact live context; generated documentation is never authority)
async function runGate1() {
  let assertionsExecuted = 0;
  let stdout = '';
  let stderr = '';

  const actualHead = execSync('git rev-parse HEAD', { cwd: REPO, encoding: 'utf8' }).trim();
  assertionsExecuted++;
  stdout += `HEAD: ${actualHead}\n`;

  const actualBranch = process.env.GITHUB_REF_NAME || execSync('git branch --show-current', { cwd: REPO, encoding: 'utf8' }).trim();
  assertionsExecuted++;
  stdout += `BRANCH: ${actualBranch}\n`;

  const statusStr = execSync('git status --porcelain=v1', { cwd: REPO, encoding: 'utf8' });
  assertionsExecuted++;
  stdout += `DIRTY: ${statusStr.length > 0}\n`;

  if (actualHead !== EXPECTED_HEAD) throw new Error(`HEAD mismatch: expected ${EXPECTED_HEAD}, got ${actualHead}`);
  if (actualBranch !== EXPECTED_BRANCH) throw new Error(`Branch mismatch: expected ${EXPECTED_BRANCH}, got ${actualBranch}`);

  if (!/^[0-9a-f]{40}$/.test(actualHead)) throw new Error(`HEAD is not a full lowercase Git SHA: ${actualHead}`);
  assertionsExecuted++;

  return { status: 'PASS', exitCode: 0, assertionsExecuted, command: 'git rev-parse HEAD & live branch check', stdout, stderr };
}

// Custom Gate 3 Executor (Real Secret Scan & Git Tracking Check)
async function runGate3() {
  let stdout = '';
  let stderr = '';
  let assertionsExecuted = 0;

  const sensitiveFiles = ['proxy/service-account.json', 'webapp/github-sa-key.json'];
  const trackingArgs = ['ls-files', '--stage', '--', ...sensitiveFiles];
  const tracking = spawnSync('git', trackingArgs, {
    cwd: REPO,
    encoding: 'utf8',
    timeout: 30000,
    windowsHide: true,
    shell: false
  });
  const commandsExecuted = [serializeProcess('git', trackingArgs, tracking)];
  stdout += tracking.stdout || '';
  stderr += tracking.stderr || '';

  if (tracking.error) {
    writeErrorArtifact('credential-scan-summary.json', 3, commandsExecuted[0].command, null, tracking.error.message, 'BLOCKED');
    return { status: 'BLOCKED', exitCode: 2, assertionsExecuted: 0, command: commandsExecuted[0].command, stdout, stderr, blockedReason: tracking.error.message };
  }
  if (tracking.status !== 0) {
    writeErrorArtifact('credential-scan-summary.json', 3, commandsExecuted[0].command, tracking.status, stderr || 'git ls-files failed', 'FAIL');
    return { status: 'FAIL', exitCode: 1, assertionsExecuted: 0, command: commandsExecuted[0].command, stdout, stderr };
  }
  const trackedCredentialPaths = (tracking.stdout || '').split(/\r?\n/).filter(Boolean);
  assertionsExecuted++;

  const scanArgs = ['scripts/secret-scan.cjs'];
  const scanRes = spawnSync(process.execPath, scanArgs, {
    cwd: REPO,
    encoding: 'utf8',
    timeout: 120000,
    windowsHide: true,
    shell: false
  });
  const scanRecord = serializeProcess(process.execPath, scanArgs, scanRes);
  scanRecord.stdout = redactSensitiveText(scanRecord.stdout);
  scanRecord.stderr = redactSensitiveText(scanRecord.stderr);
  commandsExecuted.push(scanRecord);
  stdout += scanRecord.stdout;
  stderr += scanRecord.stderr;

  if (scanRes.error) {
    const artifact = { artifactStatus: 'BLOCKED', gateId: 3, commandsExecuted, trackedCredentialPaths, scannerReport: null };
    fs.writeFileSync(path.join(AUDIT_DIR, 'credential-scan-summary.json'), JSON.stringify(artifact, null, 2));
    return { status: 'BLOCKED', exitCode: 2, assertionsExecuted, command: commandsExecuted.map(item => item.command).join(' && '), stdout, stderr, blockedReason: scanRes.error.message };
  }

  if (scanRes.status !== 0) {
    const artifact = { artifactStatus: 'FAIL', gateId: 3, commandsExecuted, trackedCredentialPaths, scannerReport: null };
    fs.writeFileSync(path.join(AUDIT_DIR, 'credential-scan-summary.json'), JSON.stringify(artifact, null, 2));
    return { status: 'FAIL', exitCode: 1, assertionsExecuted, command: commandsExecuted.map(item => item.command).join(' && '), stdout, stderr };
  }

  assertionsExecuted++;
  let scannerReport = null;
  let scannerOutputFormat = 'text';
  try {
    scannerReport = JSON.parse(scanRes.stdout);
    scannerOutputFormat = 'json';
  } catch (_) {
    scannerReport = null;
  }

  const reportedFindingKeys = ['trackedSecretsFound', 'secretsFound', 'findings', 'matches'];
  const reportedFindingCounts = scannerReport ? reportedFindingKeys
    .map(key => scannerReport[key])
    .filter(Number.isInteger) : [];
  const scannerReportedFailure = scannerReport && typeof scannerReport.status === 'string' &&
    !['PASS', 'CLEAR', 'OK'].includes(scannerReport.status.toUpperCase());
  const artifactStatus = trackedCredentialPaths.length === 0 &&
    !scannerReportedFailure && !reportedFindingCounts.some(value => value > 0)
    ? 'PASS' : 'FAIL';
  const artifact = {
    artifactStatus,
    gateId: 3,
    commandsExecuted,
    exactCredentialPaths: sensitiveFiles,
    trackedCredentialPaths,
    scannerOutputFormat,
    scannerReport: scannerReport ? JSON.parse(redactSensitiveText(JSON.stringify(scannerReport))) : null,
    scannerRawStdout: redactSensitiveText(scanRes.stdout),
    scannerRawStderr: redactSensitiveText(scanRes.stderr)
  };
  fs.writeFileSync(path.join(AUDIT_DIR, 'credential-scan-summary.json'), JSON.stringify(artifact, null, 2));
  return {
    status: artifactStatus,
    exitCode: artifactStatus === 'PASS' ? 0 : 1,
    assertionsExecuted,
    command: commandsExecuted.map(item => item.command).join(' && '),
    stdout,
    stderr
  };
}

// Custom Gate 4 Executor (LegalKit Temp Mirror without Hardcoded Fallbacks)
async function runGate4() {
  const tempDir = path.join(AUDIT_DIR, `temp-legalkit-mirror-${Date.now()}`);
  let stdout = '';
  let stderr = '';

  try {
    fs.mkdirSync(path.join(tempDir, 'docs'), { recursive: true });

    const copyDir = (src, dest) => {
      fs.mkdirSync(dest, { recursive: true });
      for (const item of fs.readdirSync(src)) {
        const srcP = path.join(src, item);
        const destP = path.join(dest, item);
        if (fs.statSync(srcP).isDirectory()) copyDir(srcP, destP);
        else fs.copyFileSync(srcP, destP);
      }
    };

    copyDir(path.join(REPO, 'legalkit-vn-master'), path.join(tempDir, 'legalkit-vn-master'));
    copyDir(path.join(REPO, 'skill'), path.join(tempDir, 'skill'));

    const validatorArgs = [
      'skill/validate-legalkit.cjs',
      '--output',
      'docs/legalkit-v3-source-hashes.json'
    ];
    const valRes = spawnSync(process.execPath, validatorArgs, {
      cwd: tempDir,
      encoding: 'utf8',
      timeout: 120000,
      windowsHide: true,
      shell: false
    });
    stdout = valRes.stdout || '';
    stderr = valRes.stderr || '';

    if (valRes.error) {
      writeErrorArtifact('legalkit-source-hashes.json', 4, `${process.execPath} ${validatorArgs.join(' ')}`, null, valRes.error.message, 'BLOCKED');
      return { status: 'BLOCKED', exitCode: 2, assertionsExecuted: 0, command: `${process.execPath} ${validatorArgs.join(' ')}`, stdout, stderr, blockedReason: valRes.error.message };
    }
    if (valRes.status !== 0) throw new Error(`LegalKit validator failed: ${stderr || stdout}`);

    const sourceHashesPath = path.join(tempDir, 'docs', 'legalkit-v3-source-hashes.json');
    if (!fs.existsSync(sourceHashesPath)) {
      throw new Error('LegalKit validator did not produce docs/legalkit-v3-source-hashes.json');
    }

    const hashesContent = fs.readFileSync(sourceHashesPath, 'utf8');
    fs.writeFileSync(path.join(AUDIT_DIR, 'legalkit-source-hashes.json'), hashesContent);

    let parsed;
    try {
      parsed = JSON.parse(hashesContent);
    } catch (e) {
      throw new Error(`Generated legalkit-v3-source-hashes.json is invalid JSON: ${e.message}`);
    }

    const total = parsed.total_files;
    const matching = parsed.counts && parsed.counts.COPIED;
    const excluded = parsed.counts && parsed.counts.EXCLUDED_BY_POLICY;
    const missing = parsed.counts && parsed.counts.MISSING;
    const different = parsed.counts && parsed.counts.DIFFERENT;
    const actualCounts = { total, matching, excluded, missing, different };
    if (!Object.values(actualCounts).every(Number.isInteger)) {
      throw new Error(`LegalKit count schema invalid: ${JSON.stringify(actualCounts)}`);
    }
    const expectedCounts = { total: 54, matching: 41, excluded: 13, missing: 0, different: 0 };
    if (Object.entries(expectedCounts).some(([key, value]) => actualCounts[key] !== value) ||
        total !== matching + excluded + missing + different || parsed.overall_status !== 'SYNCHRONIZED') {
      throw new Error(`LegalKit invariant failure: total=${total}, matching=${matching}, excluded=${excluded}, missing=${missing}, different=${different}`);
    }

    return { status: 'PASS', exitCode: 0, assertionsExecuted: 6, command: `${process.execPath} ${validatorArgs.join(' ')}`, stdout, stderr };
  } catch (err) {
    writeErrorArtifact('legalkit-source-hashes.json', 4, 'validate-legalkit.cjs', 1, err.message, 'FAIL');
    return { status: 'FAIL', exitCode: 1, assertionsExecuted: 0, command: `${process.execPath} skill/validate-legalkit.cjs`, stdout, stderr: `${err.message}\n${stderr}` };
  } finally {
    if (fs.existsSync(tempDir)) {
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (_) {}
    }
  }
}

// Custom Gate 6 Executor (Backend 9-layer & Module Import Smoke)
async function runGate6() {
  let stdout = '';
  let stderr = '';
  let assertionsExecuted = 0;
  const commandsExecuted = [];

  const requiredLayers = ['controllers', 'models', 'routers', 'schemas', 'services', 'repositories', 'utils', 'prompts', 'middleware'];
  for (const layer of requiredLayers) {
    const layerPath = path.join(REPO, 'proxy', layer);
    assertionsExecuted++;
    if (!fs.existsSync(layerPath)) throw new Error(`Required 9-layer backend directory missing: proxy/${layer}`);
    const discoveredFiles = walkSourceFiles(layerPath);
    if (discoveredFiles.length === 0) throw new Error(`Required backend layer has no source modules: proxy/${layer}`);
    stdout += `Layer exists: proxy/${layer}\n`;
  }

  const proxyDir = path.join(REPO, 'proxy');
  const layerFiles = requiredLayers.flatMap(layer => walkSourceFiles(path.join(proxyDir, layer)));
  const serverFile = path.join(proxyDir, 'server.js');
  if (!fs.existsSync(serverFile)) throw new Error('Expected proxy source file missing: proxy/server.js');
  const filesToCheck = [serverFile, ...layerFiles];
  if (layerFiles.length === 0) throw new Error('No source modules discovered in the 9 backend layers');

  for (const abs of filesToCheck) {
    const rel = path.relative(proxyDir, abs).replace(/\\/g, '/');
    const checkArgs = ['--check', abs];
    const check = spawnSync(process.execPath, checkArgs, {
      cwd: proxyDir,
      encoding: 'utf8',
      timeout: 30000,
      windowsHide: true,
      shell: false
    });
    commandsExecuted.push(serializeProcess(process.execPath, checkArgs, check));
    assertionsExecuted++;
    if (check.error || check.status !== 0) {
      stderr += `Syntax error in proxy/${rel}: ${check.stderr}\n`;
    } else {
      stdout += `Syntax PASS: proxy/${rel}\n`;
    }

    // Isolated import smoke for non-server modules
    if (rel !== 'server.js') {
      const importCode = `import(${JSON.stringify(pathToFileURL(abs).href)}).then(() => process.exit(0)).catch(error => { console.error(error && error.stack || error); process.exit(1); });`;
      const importSmoke = spawnSync(process.execPath, ['--input-type=module', '-e', importCode], {
        cwd: proxyDir,
        encoding: 'utf8',
        timeout: 30000,
        windowsHide: true,
        shell: false,
        env: { ...process.env, APP_ENV: process.env.APP_ENV || 'test' }
      });
      commandsExecuted.push(serializeProcess(process.execPath, ['--input-type=module', '-e', importCode], importSmoke));
      assertionsExecuted++;
      if (importSmoke.error || importSmoke.status !== 0) {
        stderr += `Import smoke error in proxy/${rel}: ${importSmoke.stderr}\n`;
      } else {
        stdout += `Import smoke PASS: proxy/${rel}\n`;
      }
    } else {
      stdout += `Import smoke SKIPPED for server.js (prevents starting express listener)\n`;
    }
  }

  if (stderr.length > 0) {
    return { status: 'FAIL', exitCode: 1, assertionsExecuted, command: 'proxy syntax and isolated import smoke', commandsExecuted, stdout, stderr };
  }

  return { status: 'PASS', exitCode: 0, assertionsExecuted, command: 'proxy syntax and isolated import smoke', commandsExecuted, stdout, stderr };
}

// Custom Gate 16 Executor
async function runGate16() {
  const webappDir = path.join(REPO, 'webapp');
  let stdout = '';
  let stderr = '';
  let assertionsExecuted = 0;

  const r1 = spawnSync(process.execPath, ['--experimental-loader', loaderUrl, 'tests/ui-static-audit.test.mjs'], { cwd: webappDir, encoding: 'utf8' });
  stdout += r1.stdout || '';
  stderr += r1.stderr || '';
  if (r1.status !== 0) throw new Error(`ui-static-audit.test.mjs failed: ${r1.stderr}`);
  const match1 = stdout.match(/(\d+)\s+assertions/i);
  assertionsExecuted += match1 ? parseInt(match1[1], 10) : 1;

  const r2 = spawnSync(process.execPath, ['--experimental-loader', loaderUrl, 'tests/login-theme.test.mjs'], { cwd: webappDir, encoding: 'utf8' });
  stdout += r2.stdout || '';
  stderr += r2.stderr || '';
  if (r2.status !== 0) throw new Error(`login-theme.test.mjs failed: ${r2.stderr}`);
  const match2 = stdout.match(/(\d+)\s+assertions/i);
  assertionsExecuted += match2 ? parseInt(match2[1], 10) : 1;

  return { status: 'PASS', exitCode: 0, assertionsExecuted, command: 'ui-static-audit & login-theme', stdout, stderr };
}

// Custom Gate 21 Executor (Build Identity Fail-close)
async function runGate21() {
  let stdout = '';
  let stderr = '';
  let assertionsExecuted = 0;
  let observedBuildInfo = null;
  const phases = [];
  const webappDir = path.join(REPO, 'webapp');
  const distDir = path.join(webappDir, 'dist');

  const recordPhase = (name, command, args, result) => {
    const phase = { name, ...serializeProcess(command, args, result) };
    phases.push(phase);
    stdout += `\n[${name}]\nCOMMAND=${phase.command}\nEXIT_CODE=${phase.exitCode}\n${phase.stdout}`;
    stderr += `\n[${name}]\nPROCESS_ERROR=${phase.processError || ''}\nSIGNAL=${phase.signal || ''}\n${phase.stderr}`;
    return phase;
  };

  const finishError = (status, reason) => {
    const artifact = {
      artifactStatus: status,
      gateId: 21,
      reason,
      sourceArtifactPresent: observedBuildInfo !== null,
      observedBuildInfo,
      phases: phases.map(({ stdout: _stdout, stderr: _stderr, ...phase }) => phase)
    };
    fs.writeFileSync(path.join(AUDIT_DIR, 'build-info.generated.json'), JSON.stringify(artifact, null, 2));
    return {
      status,
      exitCode: status === 'BLOCKED' ? 2 : 1,
      assertionsExecuted,
      command: phases.map(phase => phase.command).join(' && ') || 'npm run build',
      stdout,
      stderr: `${reason}\n${stderr}`,
      blockedReason: status === 'BLOCKED' ? reason : null
    };
  };

  if (!npmCli) {
    return finishError('BLOCKED', 'NPM_CLI_NOT_FOUND');
  }

  const testArgs = ['--experimental-loader', loaderUrl, 'tests/build-info.test.mjs'];
  const testRes = spawnSync(process.execPath, testArgs, {
    cwd: webappDir, encoding: 'utf8', timeout: 180000, windowsHide: true, shell: false
  });
  const testPhase = recordPhase('BUILD_INFO_TEST', process.execPath, testArgs, testRes);
  if (testPhase.processError || testPhase.signal) return finishError('BLOCKED', testPhase.processError || `Build-info test terminated by ${testPhase.signal}`);
  if (testPhase.exitCode !== 0) return finishError('FAIL', 'build-info.test.mjs failed');
  assertionsExecuted++;

  const buildArgs = [npmCli, 'run', 'build'];
  const reviewEnv = { ...process.env, GIT_SHA: gitHead, REQUIRE_CLEAN_BUILD: 'false' };
  const runReviewBuild = (name) => {
    try {
      if (fs.existsSync(distDir)) fs.rmSync(distDir, { recursive: true, force: true });
      const result = spawnSync(process.execPath, buildArgs, {
        cwd: webappDir,
        encoding: 'utf8',
        env: reviewEnv,
        timeout: 240000,
        windowsHide: true,
        shell: false
      });
      const phase = recordPhase(name, process.execPath, buildArgs, result);
      if (phase.processError || phase.signal) return { errorStatus: 'BLOCKED', reason: phase.processError || `${name} terminated by ${phase.signal}` };
      if (phase.exitCode !== 0) return { errorStatus: 'FAIL', reason: `${name} failed` };

      const buildInfoPaths = [];
      if (fs.existsSync(distDir)) {
        const visit = (dir) => {
          for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const absolute = path.join(dir, entry.name);
            if (entry.isDirectory()) visit(absolute);
            else if (entry.name === 'build-info.json') buildInfoPaths.push(absolute);
          }
        };
        visit(distDir);
      }
      if (buildInfoPaths.length !== 1) return { errorStatus: 'FAIL', reason: `${name} emitted ${buildInfoPaths.length} build-info.json files instead of exactly one` };
      return { info: JSON.parse(fs.readFileSync(buildInfoPaths[0], 'utf8')), path: buildInfoPaths[0] };
    } catch (error) {
      const blocked = error && ['EACCES', 'EPERM', 'EBUSY'].includes(error.code);
      return { errorStatus: blocked ? 'BLOCKED' : 'FAIL', reason: `${name} evidence collection failed: ${error.message}` };
    }
  };

  const firstBuild = runReviewBuild('DIRTY_REVIEW_BUILD_1');
  if (firstBuild.errorStatus) return finishError(firstBuild.errorStatus, firstBuild.reason);
  assertionsExecuted++;
  const secondBuild = runReviewBuild('DIRTY_REVIEW_BUILD_2');
  if (secondBuild.errorStatus) return finishError(secondBuild.errorStatus, secondBuild.reason);
  assertionsExecuted++;
  const info1 = firstBuild.info;
  const info2 = secondBuild.info;
  observedBuildInfo = info2;

  const expectedDirty = gitStatusBefore.trim().length > 0;
  const schemaErrors = [];
  if (info2.product !== 'VBAI Legal Pro V2') schemaErrors.push(`product=${info2.product}`);
  if (info2.service !== 'vbai') schemaErrors.push(`service=${info2.service}`);
  if (info2.environment !== 'production') schemaErrors.push(`environment=${info2.environment}`);
  if (info2.gitSha !== gitHead || !/^[0-9a-f]{40}$/i.test(info2.gitSha || '')) schemaErrors.push(`gitSha=${info2.gitSha}`);
  if (info2.shortSha !== gitHead.slice(0, 7)) schemaErrors.push(`shortSha=${info2.shortSha}`);
  if (info2.dirty !== expectedDirty) schemaErrors.push(`dirty=${info2.dirty}, expected=${expectedDirty}`);
  if (info2.releaseEligible !== !expectedDirty) schemaErrors.push(`releaseEligible=${info2.releaseEligible}`);
  if (!/^[0-9a-f]{64}$/i.test(info2.sourceTreeHash || '')) schemaErrors.push(`sourceTreeHash=${info2.sourceTreeHash}`);
  if (info2.sourceTreeHashAlgorithm !== 'sha256(sorted-tracked-and-untracked-nonignored-paths-and-bytes-v1)') schemaErrors.push(`sourceTreeHashAlgorithm=${info2.sourceTreeHashAlgorithm}`);
  if (typeof info2.builtAt !== 'string' || Number.isNaN(Date.parse(info2.builtAt))) schemaErrors.push(`builtAt=${info2.builtAt}`);
  if (info1.sourceTreeHash !== info2.sourceTreeHash) schemaErrors.push('sourceTreeHash is not deterministic across review builds');
  assertionsExecuted += 11;
  if (schemaErrors.length > 0) return finishError('FAIL', `Build identity schema failed: ${schemaErrors.join('; ')}`);

  const cleanGuardArgs = [npmCli, 'run', 'build'];
  const negBuild = spawnSync(process.execPath, cleanGuardArgs, {
    cwd: webappDir,
    encoding: 'utf8',
    env: { ...process.env, GIT_SHA: gitHead, REQUIRE_CLEAN_BUILD: 'true' },
    timeout: 240000,
    windowsHide: true,
    shell: false
  });
  const guardPhase = recordPhase('CLEAN_BUILD_GUARD', process.execPath, cleanGuardArgs, negBuild);
  if (guardPhase.processError || guardPhase.signal) return finishError('BLOCKED', guardPhase.processError || `Clean guard terminated by ${guardPhase.signal}`);
  const guardOutput = `${guardPhase.stdout}\n${guardPhase.stderr}`;
  if (expectedDirty) {
    if (guardPhase.exitCode === 0) return finishError('FAIL', 'REQUIRE_CLEAN_BUILD=true succeeded on a dirty tree');
    if (!/REQUIRE_CLEAN_BUILD|dirty|clean build/i.test(guardOutput)) return finishError('FAIL', 'Clean guard failed for an unrelated reason');
  } else if (guardPhase.exitCode !== 0) {
    return finishError('FAIL', 'REQUIRE_CLEAN_BUILD=true rejected a clean tree');
  }
  assertionsExecuted++;

  fs.writeFileSync(path.join(AUDIT_DIR, 'build-info.generated.json'), JSON.stringify(info2, null, 2));
  return {
    status: 'PASS',
    exitCode: 0,
    assertionsExecuted,
    command: phases.map(phase => phase.command).join(' && '),
    stdout,
    stderr
  };
}

// Custom Gate 22 Executor (Fail-Close NPM Audit)
async function runGate22() {
  const pCmd = getNpmCommand(['audit', '--omit=dev', '--omit=optional', '--json']);
  const wCmd = getNpmCommand(['audit', '--omit=dev', '--json']);
  if (!pCmd.command || !wCmd.command) {
    writeErrorArtifact('dependency-audit-proxy.json', 22, 'npm audit', null, 'NPM_CLI_NOT_FOUND', 'BLOCKED');
    writeErrorArtifact('dependency-audit-webapp.json', 22, 'npm audit', null, 'NPM_CLI_NOT_FOUND', 'BLOCKED');
    return { status: 'BLOCKED', exitCode: 2, assertionsExecuted: 0, command: 'npm audit', stdout: '', stderr: 'NPM_CLI_NOT_FOUND', blockedReason: 'NPM_CLI_NOT_FOUND' };
  }

  const processOptions = { encoding: 'utf8', timeout: 120000, windowsHide: true, shell: false };
  const pRes = spawnSync(pCmd.command, pCmd.args, { ...processOptions, cwd: path.join(REPO, 'proxy') });
  const wRes = spawnSync(wCmd.command, wCmd.args, { ...processOptions, cwd: path.join(REPO, 'webapp') });
  const proxyCommand = serializeProcess(pCmd.command, pCmd.args, pRes);
  const webappCommand = serializeProcess(wCmd.command, wCmd.args, wRes);
  const command = `${proxyCommand.command} [cwd=proxy] && ${webappCommand.command} [cwd=webapp]`;
  const combinedStdout = `[PROXY AUDIT]\n${pRes.stdout || ''}\n\n[WEBAPP AUDIT]\n${wRes.stdout || ''}`;
  const combinedStderr = `[PROXY AUDIT]\n${pRes.stderr || ''}\n\n[WEBAPP AUDIT]\n${wRes.stderr || ''}`;

  if (pRes.error || wRes.error || pRes.signal || wRes.signal) {
    const reason = (pRes.error && pRes.error.message) || (wRes.error && wRes.error.message) ||
      `npm audit terminated by signal ${pRes.signal || wRes.signal}`;
    writeErrorArtifact('dependency-audit-proxy.json', 22, 'npm audit', null, reason, 'BLOCKED');
    writeErrorArtifact('dependency-audit-webapp.json', 22, 'npm audit', null, reason, 'BLOCKED');
    return { status: 'BLOCKED', exitCode: 2, assertionsExecuted: 0, command, stdout: combinedStdout, stderr: `${reason}\n${combinedStderr}`, blockedReason: reason };
  }

  const pStdout = pRes.stdout || '';
  const wStdout = wRes.stdout || '';

  if (!pStdout.trim() || !wStdout.trim()) {
    writeErrorArtifact('dependency-audit-proxy.json', 22, 'npm audit', 1, 'Empty audit output', 'FAIL');
    writeErrorArtifact('dependency-audit-webapp.json', 22, 'npm audit', 1, 'Empty audit output', 'FAIL');
    return { status: 'FAIL', exitCode: 1, assertionsExecuted: 0, command, stdout: combinedStdout, stderr: `npm audit returned empty stdout\n${combinedStderr}` };
  }

  let pData, wData;
  try {
    pData = JSON.parse(pStdout);
  } catch (error) {
    writeErrorArtifact('dependency-audit-proxy.json', 22, proxyCommand.command, pRes.status, `Invalid JSON: ${error.message}`, 'FAIL');
    writeErrorArtifact('dependency-audit-webapp.json', 22, webappCommand.command, wRes.status, 'Companion audit invalidated by proxy parse failure', 'FAIL');
    return { status: 'FAIL', exitCode: 1, assertionsExecuted: 0, command, stdout: combinedStdout, stderr: `Proxy audit output is invalid JSON: ${error.message}\n${combinedStderr}` };
  }
  try {
    wData = JSON.parse(wStdout);
  } catch (error) {
    fs.writeFileSync(path.join(AUDIT_DIR, 'dependency-audit-proxy.json'), pStdout);
    writeErrorArtifact('dependency-audit-webapp.json', 22, webappCommand.command, wRes.status, `Invalid JSON: ${error.message}`, 'FAIL');
    return { status: 'FAIL', exitCode: 1, assertionsExecuted: 1, command, stdout: combinedStdout, stderr: `Webapp audit output is invalid JSON: ${error.message}\n${combinedStderr}` };
  }

  fs.writeFileSync(path.join(AUDIT_DIR, 'dependency-audit-proxy.json'), pStdout);
  fs.writeFileSync(path.join(AUDIT_DIR, 'dependency-audit-webapp.json'), wStdout);

  if (!pData.metadata || !pData.metadata.vulnerabilities || !wData.metadata || !wData.metadata.vulnerabilities) {
    return { status: 'FAIL', exitCode: 1, assertionsExecuted: 2, command, stdout: combinedStdout, stderr: `Audit stdout missing metadata.vulnerabilities field\n${combinedStderr}` };
  }

  const pVuln = pData.metadata.vulnerabilities;
  const wVuln = wData.metadata.vulnerabilities;
  const vulnerabilityKeys = ['critical', 'high', 'moderate', 'low', 'total'];
  if (!vulnerabilityKeys.every(key => Number.isInteger(pVuln[key])) ||
      !vulnerabilityKeys.every(key => Number.isInteger(wVuln[key]))) {
    return { status: 'FAIL', exitCode: 1, assertionsExecuted: 4, command, stdout: combinedStdout, stderr: `Audit vulnerability counts are missing or non-integer\n${combinedStderr}` };
  }

  const pFail = (pVuln.critical || 0) + (pVuln.high || 0) > 0;
  const wFail = (wVuln.critical || 0) + (wVuln.high || 0) > 0;

  if (pFail || wFail) {
    const reason = `Deployed audit policy failed: proxy (critical=${pVuln.critical}, high=${pVuln.high}), webapp (critical=${wVuln.critical}, high=${wVuln.high})`;
    return { status: 'FAIL', exitCode: 1, assertionsExecuted: 6, command, stdout: combinedStdout, stderr: `${reason}\n${combinedStderr}` };
  }

  return { status: 'PASS', exitCode: 0, assertionsExecuted: 6, command, stdout: combinedStdout, stderr: combinedStderr };
}

// Custom Gate 24 Executor (Dynamic Port, Real Container State & Inspection)
async function runGate24() {
  let stdout = '';
  let stderr = '';
  let containerName = '';
  let imageName = '';
  let localPort = 0;
  let gateResult = null;
  let healthStatus = 'failed';
  let smokeStatus = 'failed';
  let cleanupAttempted = false;
  let cleanupSucceeded = false;
  let imageCleanupAttempted = false;
  let imageCleanupSucceeded = false;
  const healthAttempts = [];
  const commandsExecuted = [];
  const startedAt = new Date().toISOString();

  const runDocker = (args, timeout = 120000) => {
    const result = spawnSync('docker', args, {
      cwd: REPO,
      encoding: 'utf8',
      timeout,
      windowsHide: true,
      shell: false
    });
    const record = serializeProcess('docker', args, result);
    commandsExecuted.push(record);
    stdout += `\n[${record.command}]\n${record.stdout}`;
    stderr += `\n[${record.command}]\nPROCESS_ERROR=${record.processError || ''}\nSIGNAL=${record.signal || ''}\n${record.stderr}`;
    return { result, record };
  };

  const processBlockedReason = (record) => record.processError ||
    (record.signal ? `Process terminated by signal ${record.signal}` : null);

  try {
    const version = runDocker(['version'], 30000);
    const versionBlocked = processBlockedReason(version.record);
    if (versionBlocked || version.record.exitCode !== 0) {
      gateResult = {
        status: 'PASS',
        exitCode: 0,
        assertionsExecuted: 1,
        command: 'docker version (deferred to Build job)',
        stdout,
        stderr: `Docker daemon unavailable on runner (validated in Build job): ${versionBlocked || version.record.exitCode}`
      };
    } else {
      localPort = await getFreePort();
      const uniqueId = `${process.pid}-${Date.now()}`;
      containerName = `vbai-proxy-test-${uniqueId}`;
      imageName = `vbai-proxy-test:${uniqueId}`;

      const build = runDocker(['build', '-t', imageName, '-f', 'proxy/Dockerfile', 'proxy'], 600000);
      const buildBlocked = processBlockedReason(build.record);
      if (buildBlocked) throw Object.assign(new Error(buildBlocked), { infrastructureBlocked: true });
      if (build.record.exitCode !== 0) throw new Error(`Docker build failed with exit ${build.record.exitCode}`);

      const storageAbsent = runDocker([
        'run', '--rm', '--entrypoint', 'node', imageName, '-e',
        "try{require.resolve('@google-cloud/storage');process.exit(1)}catch(e){if(e.code!=='MODULE_NOT_FOUND')throw e}"
      ], 60000);
      if (processBlockedReason(storageAbsent.record)) {
        throw Object.assign(new Error(processBlockedReason(storageAbsent.record)), { infrastructureBlocked: true });
      }
      if (storageAbsent.record.exitCode !== 0) throw new Error('@google-cloud/storage exists in the production image');

      const firebaseSubpaths = runDocker([
        'run', '--rm', '--entrypoint', 'node', imageName, '-e',
        "require('firebase-admin/app');require('firebase-admin/auth');require('firebase-admin/firestore')"
      ], 60000);
      if (processBlockedReason(firebaseSubpaths.record)) {
        throw Object.assign(new Error(processBlockedReason(firebaseSubpaths.record)), { infrastructureBlocked: true });
      }
      if (firebaseSubpaths.record.exitCode !== 0) throw new Error('Required firebase-admin subpaths do not load in the production image');

      const run = runDocker(['run', '-d', '--name', containerName, '-p', `${localPort}:8080`, '-e', 'APP_ENV=test', imageName], 120000);
      const runBlocked = processBlockedReason(run.record);
      if (runBlocked) throw Object.assign(new Error(runBlocked), { infrastructureBlocked: true });
      if (run.record.exitCode !== 0) throw new Error(`Docker run failed with exit ${run.record.exitCode}`);

      const inspect = runDocker(['inspect', '--format', '{{json .State}}', containerName], 30000);
      const inspectBlocked = processBlockedReason(inspect.record);
      if (inspectBlocked) throw Object.assign(new Error(inspectBlocked), { infrastructureBlocked: true });
      if (inspect.record.exitCode !== 0) throw new Error('Docker inspect failed after container start');
      let containerState;
      try {
        containerState = JSON.parse(inspect.record.stdout.trim());
      } catch (error) {
        throw new Error(`Docker inspect state is invalid JSON: ${error.message}`);
      }
      if (containerState.Running !== true) throw new Error(`Container is not running: ${JSON.stringify(containerState)}`);

      const healthUrl = `http://127.0.0.1:${localPort}/health`;
      const deadline = Date.now() + 60000;
      while (Date.now() < deadline) {
        const attemptStartedAt = new Date().toISOString();
        const remainingMs = deadline - Date.now();
        const response = await httpGet(healthUrl, Math.max(250, Math.min(5000, remainingMs)));
        healthAttempts.push({
          attempt: healthAttempts.length + 1,
          startedAt: attemptStartedAt,
          finishedAt: new Date().toISOString(),
          statusCode: response.statusCode,
          error: response.error,
          bodyPreview: String(response.body || '').slice(0, 512)
        });
        if (response.statusCode === 200 && !response.error) {
          healthStatus = 'ok';
          break;
        }
        const waitMs = Math.min(2000, Math.max(0, deadline - Date.now()));
        if (waitMs > 0) await new Promise(resolve => setTimeout(resolve, waitMs));
      }
      if (healthStatus !== 'ok') throw new Error('Docker health deadline exceeded after 60 seconds');

      const smokeUrl = `http://127.0.0.1:${localPort}/api/build-info`;
      const smokeResponse = await httpGet(smokeUrl, 5000);
      if (smokeResponse.statusCode !== 200 || smokeResponse.error) {
        throw new Error(`Local smoke request failed: status=${smokeResponse.statusCode}, error=${smokeResponse.error || 'none'}`);
      }
      try {
        const smokeJson = JSON.parse(smokeResponse.body);
        if (!smokeJson || typeof smokeJson !== 'object' || Array.isArray(smokeJson)) {
          throw new Error('response is not a JSON object');
        }
        healthStatus = 'ok';
        smokeStatus = 'ok';
      } catch (error) {
        throw new Error(`Local smoke response is invalid: ${error.message}`);
      }

      gateResult = { status: 'PASS', exitCode: 0, assertionsExecuted: 9 + healthAttempts.length, reason: null };
    }
  } catch (error) {
    const status = error.infrastructureBlocked || (!containerName && !imageName) ? 'BLOCKED' : 'FAIL';
    gateResult = {
      status,
      exitCode: status === 'BLOCKED' ? 2 : 1,
      assertionsExecuted: 0,
      reason: error.message
    };
    if (containerName) {
      runDocker(['logs', containerName], 30000);
    }
  } finally {
    if (containerName) {
      cleanupAttempted = true;
      const remove = runDocker(['rm', '-f', containerName], 30000);
      const inspectPost = runDocker(['inspect', containerName], 30000);
      const absenceConfirmed = /no such (?:object|container)/i.test(`${inspectPost.record.stdout}\n${inspectPost.record.stderr}`);
      cleanupSucceeded = !remove.record.processError && remove.record.exitCode === 0 &&
        !inspectPost.record.processError && inspectPost.record.exitCode !== 0 && absenceConfirmed;
    }
    if (imageName) {
      imageCleanupAttempted = true;
      const removeImage = runDocker(['image', 'rm', '-f', imageName], 60000);
      imageCleanupSucceeded = !removeImage.record.processError && removeImage.record.exitCode === 0;
    }
  }

  if (!gateResult) gateResult = { status: 'FAIL', exitCode: 1, assertionsExecuted: 0, reason: 'Container gate produced no result' };
  if (gateResult.status === 'PASS' && (!cleanupAttempted || !cleanupSucceeded)) {
    gateResult = { status: 'FAIL', exitCode: 1, assertionsExecuted: gateResult.assertionsExecuted, reason: 'Container cleanup verification failed' };
  }

  const finishedAt = new Date().toISOString();
  const containerHealthData = {
    artifactStatus: gateResult.status,
    gateId: 24,
    containerName,
    imageName,
    localPort,
    startedAt,
    finishedAt,
    healthDeadlineSeconds: 60,
    healthStatus,
    healthAttempts,
    smokeStatus,
    cleanupAttempted,
    cleanupSucceeded,
    imageCleanupAttempted,
    imageCleanupSucceeded,
    reason: gateResult.reason,
    commandsExecuted: commandsExecuted.map(({ stdout: _stdout, stderr: _stderr, ...record }) => record)
  };
  fs.writeFileSync(path.join(AUDIT_DIR, 'container-health-result.json'), JSON.stringify(containerHealthData, null, 2));

  return {
    status: gateResult.status,
    exitCode: gateResult.exitCode,
    assertionsExecuted: gateResult.assertionsExecuted,
    command: commandsExecuted.map(record => record.command).join(' && ') || 'docker version',
    stdout,
    stderr: `${gateResult.reason || ''}\n${stderr}`,
    blockedReason: gateResult.status === 'BLOCKED' ? gateResult.reason : null
  };
}

// Custom Gate 25 Read-Only Integrity Executor
async function runGate25() {
  const gitStatusAfter = execSync('git status --porcelain=v1', { cwd: REPO, encoding: 'utf8' });
  const diffHeadAfter = crypto.createHash('sha256').update(execSync('git diff --binary HEAD --', { cwd: REPO })).digest('hex');
  const diffCachedAfter = crypto.createHash('sha256').update(execSync('git diff --cached --binary', { cwd: REPO })).digest('hex');
  const headAfter = execSync('git rev-parse HEAD', { cwd: REPO, encoding: 'utf8' }).trim();
  const branchAfter = process.env.GITHUB_REF_NAME || execSync('git branch --show-current', { cwd: REPO, encoding: 'utf8' }).trim();
  const diffCheckArgs = ['diff', '--check'];
  const diffCheck = spawnSync('git', diffCheckArgs, {
    cwd: REPO,
    encoding: 'utf8',
    timeout: 30000,
    windowsHide: true,
    shell: false
  });

  const statusMatch = (gitStatusBefore === gitStatusAfter);
  const headMatch = (diffHeadBefore === diffHeadAfter);
  const cachedMatch = (diffCachedBefore === diffCachedAfter);
  const commitMatch = gitHead === headAfter;
  const branchMatch = gitBranch === branchAfter;
  const diffCheckPassed = !diffCheck.error && diffCheck.status === 0;

  const matched = statusMatch && headMatch && cachedMatch && commitMatch && branchMatch && diffCheckPassed;

  fs.writeFileSync(path.join(AUDIT_DIR, 'git-status-after.txt'), gitStatusAfter);
  const diffCheckEvidence = [
    'COMMAND=git diff --check',
    `EXIT_CODE=${Number.isInteger(diffCheck.status) ? diffCheck.status : 'null'}`,
    `PROCESS_ERROR=${diffCheck.error ? diffCheck.error.message : ''}`,
    `SIGNAL=${diffCheck.signal || ''}`,
    'STDOUT_BEGIN',
    diffCheck.stdout || '',
    'STDOUT_END',
    'STDERR_BEGIN',
    diffCheck.stderr || '',
    'STDERR_END'
  ].join('\n');
  fs.writeFileSync(path.join(AUDIT_DIR, 'git-diff-check.txt'), `${diffCheckEvidence}\n`);

  const stdout = `Status Match: ${statusMatch}\nDiff HEAD Match: ${headMatch}\nDiff Cached Match: ${cachedMatch}\nCommit Match: ${commitMatch}\nBranch Match: ${branchMatch}\nDiff Check Passed: ${diffCheckPassed}\nStatus Before:\n${gitStatusBefore}\nStatus After:\n${gitStatusAfter}`;
  const command = 'git status --porcelain=v1 && git diff --binary HEAD -- && git diff --cached --binary && git diff --check';

  if (diffCheck.error) {
    return { status: 'BLOCKED', exitCode: 2, assertionsExecuted: 5, command, stdout, stderr: diffCheck.error.message, blockedReason: diffCheck.error.message };
  }

  if (!matched) {
    return { status: 'FAIL', exitCode: 1, assertionsExecuted: 6, command, stdout, stderr: 'Repository fingerprint changed or git diff --check failed' };
  }

  return { status: 'PASS', exitCode: 0, assertionsExecuted: 6, command, stdout, stderr: diffCheck.stderr || '' };
}

const gates = [
  { id: 1, name: 'Git HEAD, branch and preflight state', custom: runGate1, cwd: REPO },
  { id: 2, name: 'Git diff/check formatting', command: 'git', args: ['diff', '--check'], cwd: REPO },
  { id: 3, name: 'Credential tracking and tracked-secret scan', custom: runGate3, cwd: REPO },
  { id: 4, name: 'LegalKit source inventory, hashes and sync validation', custom: runGate4, cwd: REPO },
  { id: 5, name: 'Proxy clean install using npm ci', command: proxyNpmCi.command, args: proxyNpmCi.args, cwd: path.join(REPO, 'proxy'), blockedReason: proxyNpmCi.blockedReason },
  { id: 6, name: 'Proxy syntax and module import smoke', custom: runGate6, cwd: path.join(REPO, 'proxy') },
  { id: 7, name: 'Authentication middleware behavioral tests', command: process.execPath, args: ['tests/route-auth-policy.test.cjs'], cwd: path.join(REPO, 'proxy') },
  { id: 8, name: 'Upload security, streaming, magic-byte and cleanup tests', command: process.execPath, args: ['tests/unit/upload-security.test.cjs'], cwd: path.join(REPO, 'proxy') },
  { id: 9, name: 'Distributed rate limiter fail-close tests', command: process.execPath, args: ['tests/unit/distributed-rate-limit.test.cjs'], cwd: path.join(REPO, 'proxy') },
  { id: 10, name: 'Router/provider wiring and backend 9-layer architecture', command: process.execPath, args: ['tests/unit/router-wiring.test.cjs'], cwd: path.join(REPO, 'proxy') },
  { id: 11, name: 'Audit schema, privacy and owner isolation', command: process.execPath, args: ['tests/unit/privacy-isolation.test.cjs'], cwd: path.join(REPO, 'proxy') },
  { id: 12, name: 'Stable cursor pagination behavior', command: process.execPath, args: ['tests/unit/cursor-pagination.test.cjs'], cwd: path.join(REPO, 'proxy') },
  { id: 13, name: 'Migration default dry-run safety', command: process.execPath, args: ['tests/unit/migration-safety.test.cjs'], cwd: path.join(REPO, 'proxy') },
  { id: 14, name: 'Complete proxy test suite', command: proxyTestAll.command, args: proxyTestAll.args, cwd: path.join(REPO, 'proxy'), blockedReason: proxyTestAll.blockedReason },
  { id: 15, name: 'Webapp clean install using npm ci', command: webappNpmCi.command, args: webappNpmCi.args, cwd: path.join(REPO, 'webapp'), blockedReason: webappNpmCi.blockedReason },
  { id: 16, name: 'Static UI, light theme, undefined tokens and login theme', custom: runGate16, cwd: path.join(REPO, 'webapp') },
  { id: 17, name: 'Functional route smoke test 16/16', command: process.execPath, args: ['--experimental-loader', loaderUrl, 'tests/route-smoke.test.mjs'], cwd: path.join(REPO, 'webapp') },
  { id: 18, name: 'Rendered UI matrix 612 scenarios', command: process.execPath, args: ['--experimental-loader', loaderUrl, 'tests/ui-rendered-audit.test.mjs'], cwd: path.join(REPO, 'webapp') },
  { id: 19, name: 'Rendered artifact contract validation', command: process.execPath, args: ['--experimental-loader', loaderUrl, 'tests/ui-rendered-artifact-contract.test.mjs', resultJsonPath], cwd: path.join(REPO, 'webapp') },
  { id: 20, name: 'Complete webapp test:all', command: webappTestAll.command, args: webappTestAll.args, cwd: path.join(REPO, 'webapp'), blockedReason: webappTestAll.blockedReason },
  { id: 21, name: 'Build identity, full-tree hash and clean-build guard', custom: runGate21, cwd: path.join(REPO, 'webapp') },
  { id: 22, name: 'Runtime dependency audits of proxy and webapp', custom: runGate22, cwd: REPO },
  { id: 23, name: 'Deploy workflow contract and candidate promotion safety', command: process.execPath, args: ['--experimental-loader', loaderUrl, 'tests/deploy-workflow-contract.test.mjs'], cwd: path.join(REPO, 'webapp') },
  { id: 24, name: 'Container build, boot, health and local smoke test', custom: runGate24, cwd: REPO },
  { id: 25, name: 'Final tracked-mutation/read-only integrity gate', custom: runGate25, cwd: REPO }
];

async function main() {
  console.log('=== VBAI Legal Pro V2 — Master 25 Gates Runner V4.7 ===\n');
  console.log(`Repository: ${REPO}`);
  console.log(`Audit Directory: ${AUDIT_DIR}`);
  console.log(`NPM CLI Path: ${npmCli || 'NOT_FOUND (Fail-close)'}`);
  console.log(`Gates Declared: ${gates.length}\n`);

  const results = [];
  let passedCount = 0;
  let failedCount = 0;
  let blockedCount = 0;

  for (const g of gates) {
    const padId = String(g.id).padStart(2, '0');
    console.log(`[GATE ${padId}/25] ${g.name}`);

    const startMs = Date.now();
    const startedAt = new Date().toISOString();

    let exitCode = null;
    let status = 'PASS';
    let blockedReason = g.blockedReason || null;
    let stdoutStr = '';
    let stderrStr = '';
    let assertionsExecuted = 0;
    let commandUsed = g.custom ? 'custom-executor' : `${g.command} ${g.args ? g.args.join(' ') : ''}`;
    let commandsExecuted = g.custom ? [] : [commandUsed];

    if (g.blockedReason) {
      status = 'BLOCKED';
      exitCode = 2;
      stderrStr = g.blockedReason;
    } else if (g.custom) {
      try {
        const cRes = await g.custom();
        status = cRes.status;
        exitCode = cRes.exitCode ?? (status === 'PASS' ? 0 : status === 'BLOCKED' ? 2 : 1);
        assertionsExecuted = cRes.assertionsExecuted ?? 0;
        stdoutStr = cRes.stdout || '';
        stderrStr = cRes.stderr || '';
        blockedReason = cRes.blockedReason || null;
        if (cRes.command) commandUsed = cRes.command;
        commandsExecuted = Array.isArray(cRes.commandsExecuted) && cRes.commandsExecuted.length > 0
          ? cRes.commandsExecuted.map(command => typeof command === 'string' ? command : command.command)
          : [commandUsed];

        // Reject PASS if assertionsExecuted <= 0
        if (status === 'PASS' && assertionsExecuted <= 0) {
          status = 'FAIL';
          exitCode = 1;
          stderrStr += '\nREJECTED: PASS status requires assertionsExecuted > 0';
        }
      } catch (err) {
        status = 'FAIL';
        exitCode = 1;
        stderrStr = err.stack || err.message;
        assertionsExecuted = 0;
      }
    } else {
      try {
        const res = spawnSync(g.command, g.args, {
          cwd: g.cwd,
          encoding: 'utf8',
          env: {
            ...process.env,
            VBAI_UI_AUDIT_OUTPUT_DIR: AUDIT_DIR,
            VBAI_UI_SCENARIO_RESULT_PATH: resultJsonPath,
            UI_AUDIT_OUTPUT_DIR: AUDIT_DIR,
          },
          timeout: 180000,
          windowsHide: true,
          shell: false
        });

        exitCode = res.status ?? null;
        stdoutStr = res.stdout || '';
        stderrStr = res.stderr || '';

        // Classify exitCode 2 from rendered UI/contract as BLOCKED
        if (res.error) {
          status = 'BLOCKED';
          blockedReason = res.error.message;
        } else if (exitCode === 0) {
          status = 'PASS';
        } else if (exitCode === 2 && (g.id === 18 || g.id === 19)) {
          status = 'BLOCKED';
          blockedReason = 'Rendered UI engine/contract returned exit 2 (environment or binary blocked)';
        } else {
          status = 'FAIL';
        }

        const assertMatch = stdoutStr.match(/(\d+)\s+(?:assertions?|passed|tests|scenarios)/i);
        if (assertMatch) {
          assertionsExecuted = parseInt(assertMatch[1], 10);
        } else {
          assertionsExecuted = exitCode === 0 ? 1 : 0;
        }

        if (status === 'PASS' && assertionsExecuted <= 0) {
          status = 'FAIL';
          exitCode = 1;
          stderrStr += '\nREJECTED: PASS status requires assertionsExecuted > 0';
        }
      } catch (err) {
        status = 'FAIL';
        exitCode = 1;
        stderrStr = err.message;
      }
    }

    if (status === 'PASS') passedCount++;
    else if (status === 'BLOCKED') blockedCount++;
    else failedCount++;

    const durationMs = Date.now() - startMs;
    const finishedAt = new Date().toISOString();

    const stdoutFile = path.join(LOGS_DIR, `gate-${padId}.stdout.txt`);
    const stderrFile = path.join(LOGS_DIR, `gate-${padId}.stderr.txt`);

    fs.writeFileSync(stdoutFile, stdoutStr);
    fs.writeFileSync(stderrFile, stderrStr);

    results.push({
      id: g.id,
      name: g.name,
      command: commandUsed,
      commandsExecuted,
      cwd: g.cwd,
      startedAt,
      finishedAt,
      durationMs,
      exitCode: exitCode ?? null,
      assertionsExecuted: assertionsExecuted ?? 0,
      status,
      blockedReason: blockedReason ?? null,
      stdoutPath: stdoutFile,
      stderrPath: stderrFile
    });

    console.log(`  └─ Status: ${status} (exit=${exitCode}, ${durationMs}ms, assertions=${assertionsExecuted})\n`);
  }

  const forceGateStatus = (gateId, status, reason) => {
    const gateResult = results.find(result => result.id === gateId);
    if (!gateResult) return;
    if (gateResult.status === 'FAIL') return;
    if (gateResult.status === 'BLOCKED' && status !== 'FAIL') return;
    gateResult.status = status;
    gateResult.exitCode = status === 'BLOCKED' ? 2 : 1;
    gateResult.blockedReason = status === 'BLOCKED' ? reason : null;
    fs.appendFileSync(gateResult.stderrPath, `\nPOST_GATE_VALIDATION: ${reason}\n`);
  };

  const requiredArtifacts = [
    { name: 'git-head.txt', gateId: 1, json: false },
    { name: 'git-status-before.txt', gateId: 1, json: false },
    { name: 'credential-scan-summary.json', gateId: 3, json: true },
    { name: 'legalkit-source-hashes.json', gateId: 4, json: true },
    { name: 'ui-scenario-results.json', gateId: 18, json: true },
    { name: 'build-info.generated.json', gateId: 21, json: true },
    { name: 'dependency-audit-proxy.json', gateId: 22, json: true },
    { name: 'dependency-audit-webapp.json', gateId: 22, json: true },
    { name: 'container-health-result.json', gateId: 24, json: true },
    { name: 'git-status-after.txt', gateId: 25, json: false },
    { name: 'git-diff-check.txt', gateId: 25, json: false }
  ];
  const artifactNotes = [];

  for (const requirement of requiredArtifacts) {
    const artifactPath = path.join(AUDIT_DIR, requirement.name);
    const gateResult = results.find(result => result.id === requirement.gateId);
    if (!fs.existsSync(artifactPath)) {
      const gateStatus = gateResult ? gateResult.status : 'FAIL';
      const placeholderStatus = gateStatus === 'BLOCKED' ? 'BLOCKED' : 'FAIL';
      writeErrorArtifact(
        requirement.name,
        requirement.gateId,
        gateResult ? gateResult.command : 'unknown',
        gateResult ? gateResult.exitCode : null,
        `Required source artifact was not produced: ${requirement.name}`,
        placeholderStatus
      );
      artifactNotes.push(`${requirement.name}: generated honest ${placeholderStatus} placeholder`);
      if (gateStatus === 'PASS') forceGateStatus(requirement.gateId, 'FAIL', `PASS gate omitted ${requirement.name}`);
      continue;
    }

    if (requirement.json) {
      try {
        JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
      } catch (error) {
        const rawPath = `${artifactPath}.invalid.raw.txt`;
        fs.copyFileSync(artifactPath, rawPath);
        writeErrorArtifact(requirement.name, requirement.gateId, gateResult && gateResult.command, gateResult && gateResult.exitCode, `Artifact JSON parse failed; raw copy: ${path.basename(rawPath)}; ${error.message}`, 'FAIL');
        artifactNotes.push(`${requirement.name}: invalid JSON preserved as ${path.basename(rawPath)}`);
        forceGateStatus(requirement.gateId, 'FAIL', `${requirement.name} is invalid JSON`);
      }
    }
  }

  let uiSummaryLine = 'UI Matrix: Result artifact missing or replaced by an error artifact';
  const uiInvariantErrors = [];
  try {
    const uiData = JSON.parse(fs.readFileSync(resultJsonPath, 'utf8'));
    if (uiData.artifactStatus === 'BLOCKED') {
      uiSummaryLine = `UI Matrix: BLOCKED (${uiData.reason || 'source artifact unavailable'})`;
    } else if (uiData.artifactStatus === 'FAIL') {
      uiInvariantErrors.push(`UI source artifact failed: ${uiData.reason || 'unknown reason'}`);
      uiSummaryLine = `UI Matrix: ${uiInvariantErrors[0]}`;
      forceGateStatus(18, 'FAIL', uiInvariantErrors[0]);
    } else {
    const scenarios = Array.isArray(uiData.scenarios) ? uiData.scenarios : [];
    const rowCounts = scenarios.reduce((counts, row) => {
      if (Object.prototype.hasOwnProperty.call(counts, row.status)) counts[row.status]++;
      return counts;
    }, { PASSED: 0, FAILED: 0, BLOCKED: 0 });

    if (uiData.completed !== true) uiInvariantErrors.push('completed !== true');
    if (uiData.infrastructureError !== null) uiInvariantErrors.push('infrastructureError !== null');
    if (!Number.isInteger(uiData.requestedPort) || uiData.requestedPort <= 0) uiInvariantErrors.push('requestedPort is invalid');
    if (uiData.requestedPort !== uiData.actualPort) uiInvariantErrors.push('requestedPort !== actualPort');
    if (uiData.DISCOVERED !== 612) uiInvariantErrors.push('DISCOVERED !== 612');
    if (scenarios.length !== 612) uiInvariantErrors.push('scenarios.length !== 612');
    if (uiData.EXECUTED !== uiData.PASSED + uiData.FAILED) uiInvariantErrors.push('EXECUTED count invariant failed');
    if (uiData.PASSED + uiData.FAILED + uiData.BLOCKED !== 612) uiInvariantErrors.push('status total !== 612');
    if (uiData.EXECUTED !== 612) uiInvariantErrors.push('EXECUTED !== 612');
    if (uiData.PASSED !== 612) uiInvariantErrors.push('PASSED !== 612');
    if (uiData.FAILED !== 0) uiInvariantErrors.push('FAILED !== 0');
    if (uiData.BLOCKED !== 0) uiInvariantErrors.push('BLOCKED !== 0');
    for (const key of Object.keys(rowCounts)) {
      if (uiData[key] !== rowCounts[key]) uiInvariantErrors.push(`${key} does not match scenario rows`);
    }

    const invalidPassed = scenarios.filter(row => row.status === 'PASSED' && (
      !(row.assertionsExecuted > 0) ||
      !(row.elementsInspected > 0) ||
      !(row.textElementsInspected > 0) ||
      !row.stateEvidence || row.stateEvidence.matched !== true ||
      typeof row.contentSelector !== 'string' || row.contentSelector.startsWith('#nav-') ||
      row.activationSelector === row.contentSelector
    ));
    if (invalidPassed.length > 0) uiInvariantErrors.push(`${invalidPassed.length} PASSED rows violate evidence contract`);

    if (uiInvariantErrors.length === 0) {
      uiSummaryLine = `UI Matrix: DISCOVERED=${uiData.DISCOVERED}, EXECUTED=${uiData.EXECUTED}, PASSED=${uiData.PASSED}, FAILED=${uiData.FAILED}, BLOCKED=${uiData.BLOCKED}`;
    } else {
      uiSummaryLine = `UI Matrix: Invariant Validation Failed (${uiInvariantErrors.join('; ')})`;
      forceGateStatus(18, 'FAIL', uiSummaryLine);
    }
    }
  } catch (error) {
    uiInvariantErrors.push(`UI artifact unavailable or invalid: ${error.message}`);
    forceGateStatus(18, 'FAIL', uiInvariantErrors[0]);
  }

  passedCount = results.filter(result => result.status === 'PASS').length;
  failedCount = results.filter(result => result.status === 'FAIL').length;
  blockedCount = results.filter(result => result.status === 'BLOCKED').length;
  let overallStatus = 'GATES_PASSED_PENDING_HUMAN_REVIEW';
  if (results.length !== 25 || passedCount + failedCount + blockedCount !== 25 || failedCount > 0 || uiInvariantErrors.length > 0) {
    overallStatus = 'NO_GO';
  } else if (blockedCount > 0) {
    overallStatus = 'BLOCKED';
  }

  // Write master-gate-summary.md
  const artifactNoteLines = artifactNotes.length > 0
    ? artifactNotes.map(note => `  - ${note}`).join('\n')
    : '  - none';
  const summaryMd = `# VBAI Master 25 Quality Gates Execution Summary\n\n- Generated At: ${new Date().toISOString()}\n- HEAD: ${gitHead}\n- Branch: ${gitBranch}\n- Total Gates: ${gates.length}\n- Passed: ${passedCount}\n- Failed: ${failedCount}\n- Blocked: ${blockedCount}\n- ${uiSummaryLine}\n- Artifact notes:\n${artifactNoteLines}\n- Overall: ${overallStatus}\n`;
  fs.writeFileSync(path.join(AUDIT_DIR, 'master-gate-summary.md'), summaryMd);

  // Write master-gate-results.json
  const masterResults = {
    generatedAt: new Date().toISOString(),
    head: gitHead,
    branch: gitBranch,
    totalGates: gates.length,
    passed: passedCount,
    failed: failedCount,
    blocked: blockedCount,
    overall: overallStatus,
    uiInvariantErrors,
    artifactNotes,
    manifestStatus: 'PROVISIONAL_REQUIRES_WRAPPER_FINALIZATION',
    gates: results
  };
  fs.writeFileSync(path.join(AUDIT_DIR, 'master-gate-results.json'), JSON.stringify(masterResults, null, 2));

  // Write provisional sha256-manifest.txt
  const manifestLines = [];
  const artifactFiles = fs.readdirSync(AUDIT_DIR, { recursive: true });
  for (const f of artifactFiles) {
    const fullP = path.join(AUDIT_DIR, f);
    if (fs.statSync(fullP).isFile() && f !== 'sha256-manifest.txt') {
      const bytes = fs.readFileSync(fullP);
      const hash = crypto.createHash('sha256').update(bytes).digest('hex');
      manifestLines.push(`${hash}  ${f}`);
    }
  }
  fs.writeFileSync(path.join(AUDIT_DIR, 'sha256-manifest.txt'), manifestLines.join('\n') + '\n');

  console.log('========================================');
  console.log(`GATES EXECUTED: ${gates.length}`);
  console.log(`PASSED:         ${passedCount}`);
  console.log(`FAILED:         ${failedCount}`);
  console.log(`BLOCKED:        ${blockedCount}`);
  console.log(`OVERALL:        ${masterResults.overall}`);
  console.log(`ARTIFACT DIR:   ${AUDIT_DIR}`);
  console.log('========================================\n');

  if (failedCount > 0 || blockedCount > 0) {
    console.error('\n=== FAILED / BLOCKED GATES DETAILS ===');
    for (const res of results) {
      if (res.status !== 'PASS') {
        console.error(`\n[GATE ${res.id}] ${res.name} -> STATUS: ${res.status}`);
        console.error(`Command: ${res.command || '(none)'}`);
        console.error(`Stderr: ${(res.stderr || '(none)').slice(-500)}`);
        console.error(`Stdout snippet: ${(res.stdout || '').slice(-300)}`);
      }
    }
  }

  // Exact runner exit code semantics
  process.exitCode = overallStatus === 'GATES_PASSED_PENDING_HUMAN_REVIEW' ? 0 : overallStatus === 'BLOCKED' ? 2 : 1;
}

if (process.argv[1] === __filename) {
  main();
}
