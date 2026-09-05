/**
 * Legacy Runtime Support Gate Test for 9Router Removal.
 * Scans active codebase to ensure zero remaining active 9Router or DevGOVietnam provider integrations.
 *
 * Allowed references:
 *   - Explicit rejection guards (if (provider === '9router') return 400)
 *   - Client-side sanitization (delete cleaned.nine_router_*)
 *   - Migration script (migrate-remove-9router-config.cjs)
 *   - Test files (all files under tests/)
 *   - Documentation & build output
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '../../..');

const FORBIDDEN_PATTERNS = [
  /9router/i,
  /devgovietnam/i,
  /nine_router/i,
];

// Directories/files to completely skip from active runtime scan
const EXCLUDED_PATHS = [
  'node_modules',
  '.git',
  'docs',
  'dist',
  'proxy/tests',
  'webapp/tests',
  'tests',
  'migrate-remove-9router-config.cjs',
  'zero-occurrence.test.cjs',
  'gemini-only.test.cjs',
  'seed-system-config.cjs',
];

// Per-file allowlists for legitimate rejection guards & sanitization
const ALLOWED_LINE_PATTERNS = {
  'server.js': [
    "provider === '9router'",
    "req.body.active_chat_provider === '9router'",
    "req.body.active_provider === '9router'",
    "req.body.nine_router_api_key",
    "req.body.nine_router_endpoint",
    "req.body.nine_router_model",
    "req.body.nine_router_models",
    "req.body.has_nine_router_key",
    'UNSUPPORTED_AI_PROVIDER',
    'LEGACY_AI_CONFIG_NOT_SUPPORTED',
    "norm.includes('devgovietnam')",
    "norm.includes('9router')",
  ],
  'system-config.js': [
    'delete cleaned.',
    'delete t.nine_router',
    'delete t.has_nine_router',
    'delete cleaned.nine_router',
  ],
  'set_9router_config.js': [
    'Obsolete file archived',
  ],
  'list_9router_models.js': [
    'Obsolete file archived',
  ],
  'test_9router_transcribe.js': [
    'Obsolete file archived',
  ],
};

function shouldExcludePath(filepath) {
  const norm = filepath.replace(/\\/g, '/');
  return EXCLUDED_PATHS.some((ex) => norm.includes(ex));
}

function isAllowedMatch(filepath, lineContent) {
  const basename = path.basename(filepath);
  for (const [fileKey, patterns] of Object.entries(ALLOWED_LINE_PATTERNS)) {
    if (basename === fileKey || filepath.replace(/\\/g, '/').includes(fileKey)) {
      for (const allowed of patterns) {
        if (lineContent.includes(allowed)) {
          return true;
        }
      }
    }
  }
  return false;
}

function scanDirectory(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const violations = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (shouldExcludePath(fullPath)) continue;

    if (entry.isDirectory()) {
      violations.push(...scanDirectory(fullPath));
    } else if (entry.isFile() && /\.(js|cjs|mjs|json|css|html)$/i.test(entry.name)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        if (isAllowedMatch(fullPath, line)) return;

        for (const pattern of FORBIDDEN_PATTERNS) {
          if (pattern.test(line)) {
            violations.push({
              file: path.relative(ROOT_DIR, fullPath),
              line: index + 1,
              match: line.trim().substring(0, 200),
              pattern: pattern.toString(),
            });
          }
        }
      });
    }
  }

  return violations;
}

function runSelfTests() {
  console.log('  [Self-Test] Running Zero-Gate Self Tests (A-G)...');

  // Test A: active_provider alone is not a violation
  const lineA = "const provider = config.active_provider || 'gemini';";
  assert.strictEqual(isAllowedMatch('server.js', lineA) || !FORBIDDEN_PATTERNS.some(p => p.test(lineA)), true);
  console.log('    ✔ Test A PASS: active_provider is not a violation');

  // Test B: provider === '9router' in rejection guard is allowed
  const lineB = "if (provider === '9router') return res.status(400);";
  assert.strictEqual(isAllowedMatch('server.js', lineB), true);
  console.log('    ✔ Test B PASS: Explicit 9router rejection guard allowed');

  // Test C: delete cleaned.nine_router_api_key is allowed
  const lineC = 'delete cleaned.nine_router_api_key;';
  assert.strictEqual(isAllowedMatch('system-config.js', lineC), true);
  console.log('    ✔ Test C PASS: Client sanitization delete allowed');

  // Test D: fetch('https://9router...') IS a violation
  const lineD = "fetch('https://9router.com/v1/chat/completions')";
  assert.strictEqual(isAllowedMatch('server.js', lineD), false);
  assert.strictEqual(FORBIDDEN_PATTERNS.some(p => p.test(lineD)), true);
  console.log('    ✔ Test D PASS: Active 9router fetch URL correctly flagged as violation');

  // Test E: config.nine_router_api_key usage IS a violation
  const lineE = 'const key = config.nine_router_api_key;';
  assert.strictEqual(isAllowedMatch('server.js', lineE), false);
  assert.strictEqual(FORBIDDEN_PATTERNS.some(p => p.test(lineE)), true);
  console.log('    ✔ Test E PASS: Runtime key extraction correctly flagged as violation');

  // Test F: DevGOVietnam model runtime IS a violation
  const lineF = "const model = 'devgovietnam/gemini-pro';";
  assert.strictEqual(isAllowedMatch('server.js', lineF), false);
  assert.strictEqual(FORBIDDEN_PATTERNS.some(p => p.test(lineF)), true);
  console.log('    ✔ Test F PASS: DevGOVietnam model runtime correctly flagged as violation');

  // Test G: legacy field removal is allowed only in the migration boundary
  const lineG = 'delete document.nine_router_api_key;';
  assert.strictEqual(isAllowedMatch('migrate-remove-9router-config.cjs', lineG), false);
  assert.strictEqual(FORBIDDEN_PATTERNS.some(p => p.test(lineG)), true);
  console.log('    ✔ Test G PASS: Legacy field references remain blocked in runtime code');
}

runSelfTests();

console.log('\n[LEGACY RUNTIME SUPPORT GATE] Scanning active codebase for legacy 9Router / DevGOVietnam references...');

const scanDirs = ['proxy', 'webapp', 'skill'].filter(d => fs.existsSync(path.join(ROOT_DIR, d)));
const violations = scanDirs.flatMap(d => scanDirectory(path.join(ROOT_DIR, d)));

if (violations.length > 0) {
  console.error(`❌ [LEGACY RUNTIME SUPPORT GATE FAILED] Found ${violations.length} active runtime violation(s):`);
  violations.forEach((v) => {
    console.error(`  - ${v.file}:${v.line} -> "${v.match}" (Matched: ${v.pattern})`);
  });
  process.exit(1);
} else {
  console.log('✅ [LEGACY RUNTIME SUPPORT GATE PASSED] 0 active 9Router provider integrations found.\n');
}
