import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const indexPath = path.resolve(__dirname, '../index.html');
const indexHtml = fs.readFileSync(indexPath, 'utf8');

console.log('[TEST] Running Legal Pro V2 App Shell Tests...');

// 1. Title & Product Identity
assert.ok(
  indexHtml.includes('VBAI Legal Pro V2'),
  'index.html title must contain VBAI Legal Pro V2'
);

// 2. Navigation Section Labels (I through VI)
assert.ok(indexHtml.includes('I. VBAI LEGAL PRO'), 'Must have section I. VBAI LEGAL PRO');
assert.ok(indexHtml.includes('II. TRA CỨU PHÁP LUẬT'), 'Must have section II. TRA CỨU PHÁP LUẬT');
assert.ok(indexHtml.includes('III. CÔNG CỤ PHÁP LÝ'), 'Must have section III. CÔNG CỤ PHÁP LÝ');
assert.ok(indexHtml.includes('IV. SOẠN THẢO'), 'Must have section IV. SOẠN THẢO');
assert.ok(indexHtml.includes('V. CUỘC HỌP'), 'Must have section V. CUỘC HỌP');
assert.ok(indexHtml.includes('VI. HỆ THỐNG'), 'Must have section VI. HỆ THỐNG');

// 3. Central Legal Search Nav Item
assert.ok(indexHtml.includes('data-page="legal-search"'), 'Must have legal-search nav item');
assert.ok(indexHtml.includes('data-page="document-lookup"'), 'Must have document-lookup nav item');

console.log('PASS: Legal Pro V2 App Shell structure validated successfully.');
