/**
 * Security Gate: Secret Scanner
 * Scans tracked repository files for accidentally hardcoded server credentials,
 * API keys, private keys, service account JSONs, and tokens.
 *
 * Excludes: node_modules, dist, docs/archive, .git, binary files.
 * Allowed Client Config: Firebase Web API Key in webapp/firebase-config.js
 * and proxy/test-client.html only.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');

// Approved client-side Firebase Web API Key SHA-256 Fingerprint
const ALLOWED_CLIENT_FIREBASE_KEY_SHA256 = '0eda5850ee4ce249456e7374d0459b2f33ab49fe3d80d9f2502f468cdabaef26';
const ALLOWED_CLIENT_KEY_FILES = [
  'webapp/firebase-config.js',
  'proxy/test-client.html',
];

const EXCLUDED_DIRS = [
  'node_modules',
  'dist',
  'docs/archive',
  '.git',
];

function sha256(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

const SECRET_PATTERNS = [
  {
    name: 'Google Server API Key (' + 'AIza' + 'Sy...)',
    regex: new RegExp('AIza' + 'Sy[A-Za-z0-9_\\-]{33}', 'g'),
    isAllowed: (filepath, match) => {
      const normPath = filepath.replace(/\\/g, '/');
      const isAllowedFile = ALLOWED_CLIENT_KEY_FILES.some((allowedPath) => normPath === allowedPath);
      return isAllowedFile && sha256(match) === ALLOWED_CLIENT_FIREBASE_KEY_SHA256;
    },
  },
  {
    name: 'OpenAI / Legacy Provider Key (sk-...)',
    regex: /sk-[a-zA-Z0-9_\-]{20,}/g,
    isAllowed: () => false,
  },
  {
    name: 'GitHub Personal Access Token (ghp_ / github_pat_)',
    regex: /(ghp_[a-zA-Z0-9]{20,}|github_pat_[a-zA-Z0-9]{20,})/g,
    isAllowed: () => false,
  },
  {
    name: 'PEM Private Key Header',
    regex: /-----BEGIN (RSA|EC|OPENSSH|DSA|PRIVATE) KEY-----/g,
    isAllowed: () => false,
  },
  {
    name: 'Service Account JSON Credentials',
    regex: /"private_key"\s*:\s*"-----BEGIN/g,
    isAllowed: () => false,
  },
  {
    name: 'OAuth Client Secret',
    regex: /"client_secret"\s*:\s*"[a-zA-Z0-9_\-]{10,}"/g,
    isAllowed: () => false,
  },
];

function maskSecret(str) {
  if (!str || str.length <= 8) return '***MASKED***';
  return str.substring(0, 6) + '...' + str.substring(str.length - 4);
}

function getTrackedFiles() {
  try {
    const output = execSync('git ls-files', { cwd: ROOT_DIR, encoding: 'utf8' });
    return output.split('\n').map((f) => f.trim()).filter(Boolean);
  } catch (err) {
    console.warn('git ls-files failed, falling back to filesystem walk...');
    return null;
  }
}

function shouldSkipFile(filepath) {
  const norm = filepath.replace(/\\/g, '/');
  if (EXCLUDED_DIRS.some((d) => norm.includes(`/${d}/`) || norm.startsWith(`${d}/`))) {
    return true;
  }
  // Skip binary files by extension
  if (/\.(png|jpg|jpeg|gif|ico|pdf|zip|tar|gz|7z|exe|dll|so|dylib|woff|woff2|eot|ttf|mp3|m4a|wav|ogg)$/i.test(filepath)) {
    return true;
  }
  return false;
}

function scanFile(relPath) {
  const fullPath = path.join(ROOT_DIR, relPath);
  if (!fs.existsSync(fullPath)) return [];

  const violations = [];
  try {
    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, lineIdx) => {
      for (const patternObj of SECRET_PATTERNS) {
        patternObj.regex.lastIndex = 0;
        let match;
        while ((match = patternObj.regex.exec(line)) !== null) {
          const secretValue = match[0];
          if (!patternObj.isAllowed(relPath, secretValue)) {
            violations.push({
              file: relPath,
              line: lineIdx + 1,
              category: patternObj.name,
              masked: maskSecret(secretValue),
            });
          }
        }
      }
    });
  } catch (err) {
    // Skip binary / unreadable files silently
  }

  return violations;
}

console.log('[SECURITY GATE] Scanning tracked source files for hardcoded secrets...');

let filesToScan = getTrackedFiles();
if (!filesToScan) {
  function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    for (const file of list) {
      const full = path.join(dir, file);
      const rel = path.relative(ROOT_DIR, full);
      if (shouldSkipFile(rel)) continue;
      const stat = fs.statSync(full);
      if (stat && stat.isDirectory()) {
        results = results.concat(walk(full));
      } else {
        results.push(rel);
      }
    }
    return results;
  }
  filesToScan = walk(ROOT_DIR);
}

filesToScan = filesToScan.filter((f) => !shouldSkipFile(f));

const violations = filesToScan.flatMap(scanFile);

if (violations.length > 0) {
  console.error(`\n❌ [SECURITY GATE FAILED] Found ${violations.length} hardcoded secret(s):`);
  violations.forEach((v) => {
    console.error(`  - ${v.file}:${v.line} -> Category: ${v.category} [Value: ${v.masked}]`);
  });
  console.error('\nPlease remove hardcoded server secrets before committing.\n');
  process.exit(1);
} else {
  console.log(`\n✅ [SECURITY GATE PASSED] Scanned ${filesToScan.length} files. Zero hardcoded server secrets detected!`);
  process.exit(0);
}
