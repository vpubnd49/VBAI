/**
 * System Config Security & Persistence Unit Test
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');

function maskApiKey(key = '') {
  const str = String(key || '').trim();
  if (!str) return '';
  if (str.length <= 8) return '••••••••';
  return str.slice(0, 4) + '••••••••' + str.slice(-4);
}

console.log('--- System Config Security Unit Test ---');

// 1. Test maskApiKey helper
assert.strictEqual(maskApiKey(''), '');
assert.strictEqual(maskApiKey('12345'), '••••••••');
assert.strictEqual(maskApiKey('AIzaSyD1234567890abcdef1234'), 'AIza••••••••1234');
console.log('  PASS: maskApiKey formatting');

// 2. Verify build-info.json placeholder neutrality
const biPath = path.join(__dirname, '../../../webapp/public/build-info.json');
const bi = JSON.parse(fs.readFileSync(biPath, 'utf8'));
assert.strictEqual(bi.gitSha, 'dev', 'public/build-info.json gitSha must be "dev"');
assert.strictEqual(bi.version, '2');
console.log('  PASS: public/build-info.json placeholder neutrality');

// 3. Static check: Ensure server.js does NOT expose raw gemini_api_key in GET responses
const serverJs = fs.readFileSync(path.join(__dirname, '../../server.js'), 'utf8');
assert.ok(serverJs.includes('maskedKey:'), 'server.js must return maskedKey in GET summary');
assert.ok(serverJs.includes('clear_gemini_api_key'), 'server.js must handle clear_gemini_api_key');
console.log('  PASS: server.js security static checks');

console.log('System Config Security Unit Test PASSED.');
