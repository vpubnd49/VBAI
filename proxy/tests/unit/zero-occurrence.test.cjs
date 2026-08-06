/**
 * Zero-Occurrence Gate Test for 9Router Removal.
 * Scans active codebase to ensure zero remaining active runtime references to 9Router or DevGOVietnam.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT_DIR = path.resolve(__dirname, '../../..');

const FORBIDDEN_PATTERNS = [
  /9router/i,
  /devgovietnam/i,
  /active_chat_provider/i,
  /nine_router_api_key/i,
];

// Folders/files to scan
const SCAN_DIRECTORIES = ['proxy', 'webapp', 'skill'];

// Explicit file/folder exclusions (historical audits, migration script documentation, archived legacy stubs)
const EXCLUSIONS = [
  'node_modules',
  '.git',
  'docs',
  'migrate-remove-9router-config.cjs',
  'zero-occurrence.test.cjs',
  'gemini-only.test.cjs',
];

function shouldExclude(filepath) {
  const norm = filepath.replace(/\\/g, '/');
  return EXCLUSIONS.some((ex) => norm.includes(ex));
}

function scanDirectory(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const violations = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (shouldExclude(fullPath)) continue;

    if (entry.isDirectory()) {
      violations.push(...scanDirectory(fullPath));
    } else if (entry.isFile() && /\.(js|cjs|mjs|json|css|html|md)$/i.test(entry.name)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        // Skip sanitization/deletion keys and validation error check lines in backend/system-config
        const isSanitizationOrValidationLine =
          line.includes('admin.firestore.FieldValue.delete()') ||
          line.includes('delete cleaned.') ||
          line.includes('UNSUPPORTED_AI_PROVIDER') ||
          line.includes('LEGACY_AI_CONFIG_NOT_SUPPORTED') ||
          line.includes('!norm.includes');

        if (isSanitizationOrValidationLine) return;

        for (const pattern of FORBIDDEN_PATTERNS) {
          if (pattern.test(line)) {
            violations.push({
              file: path.relative(ROOT_DIR, fullPath),
              line: index + 1,
              match: line.trim(),
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

const violations = scanDirectory(path.join(ROOT_DIR, 'proxy'))
  .concat(scanDirectory(path.join(ROOT_DIR, 'webapp')))
  .concat(scanDirectory(path.join(ROOT_DIR, 'skill')));

if (violations.length > 0) {
  console.error(`❌ [ZERO-OCCURRENCE GATE FAILED] Found ${violations.length} active runtime violation(s):`);
  violations.forEach((v) => {
    console.error(`  - ${v.file}:${v.line} -> "${v.match}" (Matched: ${v.pattern})`);
  });
  process.exit(1);
} else {
  console.log('✅ [ZERO-OCCURRENCE GATE PASSED] 0 active runtime occurrences of 9Router, DevGOVietnam, active_chat_provider in active codebase!');
}
