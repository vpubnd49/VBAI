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
const webSearchRoute = read('routes/web-search.routes.js');
const webExtractRoute = read('routes/web-extract.routes.js');

assert.match(
  server,
  /require\('\.\/routes\/web-search\.routes'\)/
);

assert.match(
  server,
  /require\('\.\/routes\/web-extract\.routes'\)/
);

assert.match(
  webSearchRoute,
  /require\('\.\.\/legal\/services\/legal-search-orchestrator'\)/
);

assert.match(
  webExtractRoute,
  /require\('\.\.\/legal\/services\/legal-content-fetcher'\)/
);

assert.equal(
  count(dockerfile, 'COPY routes ./routes'),
  1,
  'Build stage must copy routes exactly once'
);

assert.equal(
  count(dockerfile, 'COPY legal ./legal'),
  1,
  'Build stage must copy legal exactly once'
);

assert.equal(
  count(
    dockerfile,
    'COPY --from=build /app/routes ./routes'
  ),
  1,
  'Runtime stage must copy routes exactly once'
);

assert.equal(
  count(
    dockerfile,
    'COPY --from=build /app/legal ./legal'
  ),
  1,
  'Runtime stage must copy legal exactly once'
);

console.log('Proxy Docker runtime file tests passed.');
