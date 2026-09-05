/**
 * Regression test for firebase-admin 14 modular runtime startup.
 *
 * Gate 24 previously built a valid image but the server crashed because a
 * legacy namespace object without `.auth()` was passed into auth middleware.
 */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');

const proxyRoot = path.resolve(__dirname, '../..');

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

function requestHealth(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/health`, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ statusCode: res.statusCode, body, error: null }));
    });
    req.setTimeout(1000, () => req.destroy(new Error('timeout')));
    req.on('error', (error) => resolve({ statusCode: 0, body: '', error: error.message }));
  });
}

function terminate(child) {
  return new Promise((resolve) => {
    if (child.exitCode !== null) return resolve();
    const timer = setTimeout(() => {
      if (child.exitCode === null) child.kill('SIGKILL');
    }, 3000);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
    child.kill('SIGTERM');
  });
}

(async () => {
  const serverSource = fs.readFileSync(path.join(proxyRoot, 'server.js'), 'utf8');
  const authSource = fs.readFileSync(path.join(proxyRoot, 'middleware/auth.middleware.js'), 'utf8');
  const limiterSource = fs.readFileSync(path.join(proxyRoot, 'middleware/rate-limit.middleware.js'), 'utf8');

  assert.doesNotMatch(serverSource, /require\(['"]firebase-admin['"]\)/);
  assert.doesNotMatch(serverSource, /\badmin\.(?:auth|firestore|credential|initializeApp|app|apps)\b/);
  assert.match(serverSource, /getFirebaseAuth\(\)/);
  assert.doesNotMatch(serverSource, /getFirebaseFirestore|FieldValue|FieldPath|Timestamp|firebase-admin\/firestore/);
  assert.match(serverSource, /initLegalResearchRouter\(getFirebaseAuth\(\)\)/);
  assert.match(authSource, /authClient\.verifyIdToken\(token\)/);
  assert.doesNotMatch(authSource, /adminApp\.auth\(\)/);
  assert.match(limiterSource, /setDatabaseService\(databaseService\)/);
  assert.doesNotMatch(limiterSource, /this\.adminApp/);

  const service = require(path.join(proxyRoot, 'services/firebase-admin.service.js'));
  const app = service.initFirebase();
  assert.ok(app && typeof app.name === 'string');
  assert.equal(typeof service.getFirebaseAuth().verifyIdToken, 'function');
  assert.equal(typeof service.getFirebaseAuth().getUser, 'function');

  const port = await getFreePort();
  const childEnv = {
    ...process.env,
    APP_ENV: 'test',
    FIREBASE_PROJECT_ID: 'gen-lang-client-0462350485',
    PORT: String(port),
  };
  delete childEnv.FIREBASE_SERVICE_ACCOUNT;
  delete childEnv.GOOGLE_APPLICATION_CREDENTIALS;

  const child = spawn(process.execPath, ['server.js'], {
    cwd: proxyRoot,
    env: childEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });

  try {
    const deadline = Date.now() + 15000;
    let health = null;
    while (Date.now() < deadline) {
      if (child.exitCode !== null) {
        throw new Error(`proxy exited before health check (exit=${child.exitCode})\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`);
      }
      health = await requestHealth(port);
      if (health.statusCode === 200) break;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    assert.equal(health && health.statusCode, 200, `health endpoint did not become ready\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`);
    const body = JSON.parse(health.body);
    assert.equal(body.status, 'ok');
    assert.equal(body.service, 'vbai-proxy');
  } finally {
    await terminate(child);
  }

  console.log('PASS firebase-admin-modular-runtime.test.cjs (17 assertions)');
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
