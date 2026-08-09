/**
 * Route Uniqueness Test
 *
 * Scans server.js and route files to detect duplicate
 * method+path registrations that cause shadowing.
 *
 * Run: node proxy/tests/route-uniqueness.test.cjs
 */
'use strict';

const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) {
    console.log(`  PASS: ${msg}`);
    passed++;
  } else {
    console.error(`  FAIL: ${msg}`);
    failed++;
  }
}

function extractRoutes(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const routes = [];

  // Match app.METHOD('path' or router.METHOD('path'
  const pattern = /(?:app|router)\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g;
  let match;
  while ((match = pattern.exec(content)) !== null) {
    routes.push({
      method: match[1].toUpperCase(),
      path: match[2],
      line: content.substring(0, match.index).split('\n').length,
      file: path.basename(filePath),
    });
  }

  return routes;
}

function extractRouterMounts(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const mounts = [];
  const pattern = /app\.use\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*(\w+)/g;
  let match;
  while ((match = pattern.exec(content)) !== null) {
    mounts.push({ prefix: match[1], varName: match[2] });
  }
  return mounts;
}

console.log('=== Route Uniqueness Test ===\n');

const serverPath = path.join(__dirname, '..', 'server.js');
const routesDir = path.join(__dirname, '..', 'routes');

// 1. Extract routes from server.js
const serverRoutes = extractRoutes(serverPath);
console.log(`Found ${serverRoutes.length} routes in server.js`);

// 2. Extract routes from route files that are ACTUALLY MOUNTED
// Only include route files whose require() appears in server.js
const serverContent = fs.readFileSync(serverPath, 'utf8');
const routeFiles = fs.readdirSync(routesDir)
  .filter(f => f.endsWith('.js'))
  .filter(f => {
    // Check if this route file is imported (required) in server.js
    const baseName = f.replace(/\.js$/, '');
    return serverContent.includes(`./routes/${baseName}`) ||
           serverContent.includes(`'./routes/${f}'`);
  })
  .map(f => path.join(routesDir, f));

const routerRoutes = [];
for (const rf of routeFiles) {
  const routes = extractRoutes(rf);
  // Resolve full path: router routes are mounted with prefix
  const baseName = path.basename(rf);
  for (const r of routes) {
    // Routes from files mounted at /api get /api prefix
    routerRoutes.push({
      ...r,
      path: '/api' + (r.path.startsWith('/') ? r.path : '/' + r.path),
      sourceFile: baseName,
    });
  }
}
console.log(`Found ${routerRoutes.length} routes in ${routeFiles.length} route files\n`);

// 3. Combine all routes
const allRoutes = [
  ...serverRoutes.map(r => ({ ...r, sourceFile: 'server.js' })),
  ...routerRoutes,
];

// 4. Check for duplicates (same method + same path)
const seen = new Map();
const duplicates = [];

for (const route of allRoutes) {
  const key = `${route.method} ${route.path}`;
  if (seen.has(key)) {
    duplicates.push({
      key,
      first: seen.get(key),
      second: route,
    });
  } else {
    seen.set(key, route);
  }
}

assert(
  duplicates.length === 0,
  `No duplicate routes found (${allRoutes.length} total routes)`
);

if (duplicates.length > 0) {
  console.error('\n  Duplicates found:');
  for (const dup of duplicates) {
    console.error(`    ${dup.key}`);
    console.error(`      First:  ${dup.first.sourceFile}:${dup.first.line}`);
    console.error(`      Second: ${dup.second.sourceFile}:${dup.second.line}`);
  }
}

// 5. Check that health and build-info are public
const healthRoutes = allRoutes.filter(r => r.path.includes('health'));
assert(
  healthRoutes.length >= 1,
  `Health endpoints exist (found ${healthRoutes.length})`
);

const buildInfoRoutes = allRoutes.filter(r => r.path.includes('build-info'));
assert(
  buildInfoRoutes.length === 1,
  `Exactly one build-info endpoint (found ${buildInfoRoutes.length})`
);

// 6. Check admin routes all start with /api/admin/
const adminRoutes = allRoutes.filter(r => r.path.includes('/admin/'));
assert(
  adminRoutes.length > 0,
  `Admin routes exist (found ${adminRoutes.length})`
);
assert(
  adminRoutes.every(r => r.path.startsWith('/api/admin/')),
  'All admin routes are under /api/admin/ namespace'
);

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
