import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const webappRoot = path.resolve(testDirectory, '..');

function read(relativePath) {
  return fs.readFileSync(
    path.join(webappRoot, relativePath),
    'utf8'
  );
}

console.log('[TEST] Running runtime configuration wiring tests...');

const indexHtml = read('index.html');
const runtimePosition = indexHtml.indexOf(
  '<script src="/runtime-config.js"></script>'
);
const mainPosition = indexHtml.indexOf(
  '<script type="module" src="/main.js"></script>'
);

assert.ok(runtimePosition >= 0, 'index.html must load runtime-config.js');
assert.ok(
  runtimePosition < mainPosition,
  'runtime-config.js must load before main.js'
);

console.log('  PASS: runtime config loads before main module');

const template = read('runtime-config.template.js');

const stagingValues = {
  APP_ENV: 'staging',
  FIREBASE_API_KEY: 'test-staging-web-key',
  FIREBASE_AUTH_DOMAIN:
    'vbai-staging-7a17c2af.firebaseapp.com',
  FIREBASE_PROJECT_ID: 'vbai-staging-7a17c2af',
  FIREBASE_STORAGE_BUCKET:
    'vbai-staging-7a17c2af.firebasestorage.app',
  FIREBASE_MESSAGING_SENDER_ID: '684023952241',
  FIREBASE_APP_ID:
    '1:684023952241:web:teststagingappid',
};

const renderedTemplate = template.replace(
  /\$\{([A-Z0-9_]+)\}/g,
  (placeholder, variableName) => {
    assert.ok(
      Object.hasOwn(stagingValues, variableName),
      `Unknown runtime placeholder: ${variableName}`
    );

    return stagingValues[variableName];
  }
);

const sandbox = {
  window: {},
};

vm.runInNewContext(renderedTemplate, sandbox);

const renderedConfig = JSON.parse(
  JSON.stringify(sandbox.window.__VBAI_CONFIG__)
);

assert.deepEqual(renderedConfig, stagingValues);

console.log('  PASS: runtime template renders isolated staging values');

const publicRuntimeConfig = read('public/runtime-config.js');

assert.match(publicRuntimeConfig, /APP_ENV:\s*'production'/);
assert.doesNotMatch(
  publicRuntimeConfig,
  /FIREBASE_API_KEY|gen-lang-client-0462350485/,
  'Static fallback must not duplicate Firebase identifiers'
);

console.log('  PASS: static fallback contains no Firebase identifiers');

const dockerfile = read('Dockerfile');
const entrypoint = read('docker-entrypoint.sh');
const nginx = read('nginx.conf');
const aiProxy = read('modules/ai-proxy.js');

assert.match(
  dockerfile,
  /COPY runtime-config\.template\.js/
);
assert.match(
  dockerfile,
  /COPY docker-entrypoint\.sh/
);
assert.match(
  dockerfile,
  /CMD \["\/usr\/local\/bin\/vbai-entrypoint"\]/
);

assert.match(entrypoint, /Missing required environment variable/);
assert.match(entrypoint, /vbai-staging-7a17c2af/);
assert.match(entrypoint, /gen-lang-client-0462350485/);
assert.match(entrypoint, /envsubst/);

assert.match(
  nginx,
  /proxy_pass https:\/\/\$\{FIREBASE_AUTH_HOST\};/
);
assert.doesNotMatch(
  nginx,
  /proxy_pass https:\/\/gen-lang-client-0462350485\.firebaseapp\.com/
);

assert.doesNotMatch(
  aiProxy,
  /endsWith\('\.run\.app'\)/,
  'Arbitrary Cloud Run hosts must not be trusted'
);

console.log('  PASS: Docker, Nginx and backend host wiring fail closed');
console.log('Runtime configuration wiring tests passed.');
