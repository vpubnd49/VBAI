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

// web-search and web-extract have full inline handlers in server.js
// with auth + rate limiting. Route files exist but are NOT mounted.
// Only legal-research.routes is mounted as a router.
assert.match(
  server,
  /require\('\.\/routes\/legal-research\.routes'\)/,
  'server.js must import legal-research router'
);

// Verify the inline handlers exist
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
