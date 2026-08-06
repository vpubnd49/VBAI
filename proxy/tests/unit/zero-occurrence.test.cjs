/**
 * Zero-Occurrence Gate Test for 9Router Removal.
 * Scans active codebase to ensure zero remaining active runtime references to 9Router or DevGOVietnam.
 *
 * Allowed references:
 *   - Explicit rejection guards (if (provider === '9router') return 400)
 *   - Firestore field deletion lines (FieldValue.delete())
 *   - Client-side sanitization (delete cleaned.nine_router_*)
 *   - Migration script (migrate-remove-9router-config.cjs)
 *   - Test files (gemini-only.test.cjs, zero-occurrence.test.cjs)
 *   - docs/archive, docs/audits
 *   - Build output (dist/)
 */
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '../../..');

const FORBIDDEN_PATTERNS = [
  /9router/i,
  /devgovietnam/i,
  /active_chat_provider/i,
  /active_provider/i,
  /nine_router/i,
];

// Directories/files to completely skip (never scan)
const EXCLUDED_PATHS = [
  'node_modules',
  '.git',
  'docs',
  'dist',
  'migrate-remove-9router-config.cjs',
  'zero-occurrence.test.cjs',
  'gemini-only.test.cjs',
  'seed-system-config.cjs',
];

// Per-file allowlists: specific line patterns that are legitimate
// Each key is a basename or partial path; values are substrings that make a match acceptable
const ALLOWED_LINE_PATTERNS = {
  'server.js': [
    // Rejection guard: returns HTTP 400 for 9router provider
    "provider === '9router'",
    // Rejection guard: rejects legacy payloads
    "req.body.active_chat_provider === '9router'",
    "req.body.active_provider === '9router'",
    "req.body.nine_router_api_key",
    "req.body.nine_router_endpoint",
    "req.body.nine_router_model",
    // Firestore field deletion
    'admin.firestore.FieldValue.delete()',
    // UNSUPPORTED_AI_PROVIDER / LEGACY_AI_CONFIG_NOT_SUPPORTED error codes
    'UNSUPPORTED_AI_PROVIDER',
    'LEGACY_AI_CONFIG_NOT_SUPPORTED',
    // isAllowedGeminiModel filter guards
    "norm.includes('devgovietnam')",
    "norm.includes('9router')",
  ],
  'system-config.js': [
    // Client-side sanitization: deleting legacy fields from config objects
    'delete cleaned.',
    'delete t.active_provider',
    'delete t.active_chat_provider',
    'delete t.nine_router',
    'delete t.has_nine_router',
  ],
  'set_9router_config.js': [
    // Emptied stub file with archive comment
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
  // Check basename match first, then partial path match
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

console.log('[ZERO-OCCURRENCE GATE] Scanning active codebase for legacy 9Router / DevGOVietnam references...');

const scanDirs = ['proxy', 'webapp', 'skill'].filter(d => fs.existsSync(path.join(ROOT_DIR, d)));
const violations = scanDirs.flatMap(d => scanDirectory(path.join(ROOT_DIR, d)));

if (violations.length > 0) {
  console.error(`\u274C [ZERO-OCCURRENCE GATE FAILED] Found ${violations.length} active runtime violation(s):`);
  violations.forEach((v) => {
    console.error(`  - ${v.file}:${v.line} -> "${v.match}" (Matched: ${v.pattern})`);
  });
  process.exit(1);
} else {
  console.log('\u2705 [ZERO-OCCURRENCE GATE PASSED] 0 active runtime occurrences in active codebase!');
}
