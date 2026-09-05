const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const proxyRoot = path.resolve(__dirname, '../..');

function read(relativePath) {
  return fs.readFileSync(
    path.join(proxyRoot, relativePath),
    'utf8'
  );
}

function count(text, needle) {
  return text.split(needle).length - 1;
}

console.log('[TEST] Running proxy Docker runtime file tests...');

const dockerfile = read('Dockerfile');
const server = read('server.js');

// 1. Verify Node base image version >= 22 (for firebase-admin 14.2.0)
const nodeVerMatch = dockerfile.match(/FROM node:(\d+)-alpine/i);
assert.ok(nodeVerMatch, 'Dockerfile must specify node alpine image');
const nodeMajor = parseInt(nodeVerMatch[1], 10);
assert.ok(nodeMajor >= 22, `Node major version (${nodeMajor}) must be >= 22`);

// 2. Required modular runtime directories
const REQUIRED_DIRS = [
  'controllers',
  'middleware',
  'models',
  'prompts',
  'repositories',
  'routers',
  'schemas',
  'services',
  'utils',
  'lib',
  'routes',
  'legal',
];

for (const dir of REQUIRED_DIRS) {
  assert.equal(
    count(dockerfile, `COPY ${dir} ./${dir}`),
    1,
    `Build stage must copy ${dir} exactly once`
  );
  assert.equal(
    count(dockerfile, `COPY --from=build /app/${dir} ./${dir}`),
    1,
    `Runtime stage must copy ${dir} exactly once`
  );
}

// 3. Excluded non-runtime assets
assert.equal(count(dockerfile, 'service-account.json'), 0, 'service-account.json must NOT be copied in Dockerfile');
assert.equal(count(dockerfile, '.env'), 0, '.env must NOT be copied in Dockerfile');
assert.equal(count(dockerfile, 'COPY tests'), 0, 'tests directory must NOT be copied in Dockerfile');

// 4. Server.js required modules exist in image layout
assert.match(
  server,
  /require\('\.\/routes\/legal-research\.routes'\)/,
  'server.js must import legal-research router'
);

assert.match(
  server,
  /app\.post\('\/api\/web-search'/,
  'server.js must have inline web-search handler'
);
assert.match(
  server,
  /app\.post\('\/api\/web-extract'/,
  'server.js must have inline web-extract handler'
);

// 5. Deployed Tree & Storage Exclusions Contract
const pkg = JSON.parse(read('package.json'));
assert.ok(!pkg.dependencies?.['@google-cloud/firestore'], 'Firestore SDK must not be a production dependency');

assert.ok(
  dockerfile.includes('npm ci --omit=dev --omit=optional'),
  'Dockerfile must specify npm ci --omit=dev --omit=optional'
);

// Verify firebase subpath imports
assert.doesNotThrow(() => {
  require('firebase-admin/app');
  require('firebase-admin/auth');
}, 'Firebase Admin Auth subpaths (/app, /auth) must load cleanly');

// firebase-admin 14 runtime must use modular clients, never removed namespace APIs.
assert.doesNotMatch(server, /require\(['"]firebase-admin['"]\)/, 'server.js must not import the legacy firebase-admin namespace');
assert.doesNotMatch(
  server,
  /\badmin\.(?:auth|firestore|credential|initializeApp|app|apps)\b/,
  'server.js must not use removed firebase-admin namespace APIs'
);
assert.match(server, /require\('\.\/services\/firebase-admin\.service'\)/, 'server.js must use the modular Firebase runtime boundary');
assert.match(server, /initLegalResearchRouter\(getFirebaseAuth\(\)\)/, 'legal research router must receive a modular Auth client');

// Verify zero Firebase Storage API calls across server.js and routes
assert.doesNotMatch(server, /firebase-admin\/storage|admin\.storage|getStorage\(|\.bucket\(|bucket\.file\(/i, 'server.js must not call Firebase Storage API');

console.log('Proxy Docker runtime file tests passed.');
