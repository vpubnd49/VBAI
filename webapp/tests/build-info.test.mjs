import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const buildInfoPath = path.resolve(__dirname, '../public/build-info.json');

console.log('[TEST] Running Build Info Identity Tests...');

assert.ok(fs.existsSync(buildInfoPath), 'public/build-info.json must exist');

const content = JSON.parse(fs.readFileSync(buildInfoPath, 'utf8'));

assert.equal(content.product, 'VBAI Legal Pro', 'build-info.json product must be VBAI Legal Pro');
assert.equal(content.version, '2', 'build-info.json version must be 2');
assert.ok(content.gitSha, 'build-info.json must contain gitSha');

// Regression: tracked placeholder must remain neutral
assert.equal(
  content.gitSha,
  'dev',
  'tracked public/build-info.json must remain a neutral placeholder'
);

assert.equal(
  content.builtAt,
  '',
  'tracked public/build-info.json must not contain build timestamps'
);

assert.equal(
  Object.prototype.hasOwnProperty.call(content, 'shortSha'),
  false,
  'tracked public/build-info.json must not contain generated shortSha'
);

console.log('PASS: build-info.json structure and placeholder neutrality validated.');
