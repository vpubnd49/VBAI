import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webappRoot = path.resolve(__dirname, '..');

const indexPath = path.join(webappRoot, 'index.html');
const mainPath = path.join(webappRoot, 'main.js');
const dashboardPath = path.join(webappRoot, 'modules/dashboard.js');

const indexHtml = fs.readFileSync(indexPath, 'utf8');
const mainJs = fs.readFileSync(mainPath, 'utf8');
const dashboardJs = fs.readFileSync(dashboardPath, 'utf8');

console.log('[TEST] Running Old Shell Rejection Tests...');

// 1. Assert v1.2.6 is completely absent from primary shell files
assert.ok(!indexHtml.includes('v1.2.6'), 'index.html must not contain legacy version v1.2.6');
assert.ok(!mainJs.includes('v1.2.6'), 'main.js must not contain legacy version v1.2.6');
assert.ok(!dashboardJs.includes('v1.2.6'), 'dashboard.js must not contain legacy version v1.2.6');

// 2. Assert old title is not used as standalone branding
assert.ok(!indexHtml.includes('<title>Trợ lý hành chính</title>'), 'index.html title must not be legacy Trợ lý hành chính');

// 3. Assert Legal Pro V2 branding presence
assert.ok(indexHtml.includes('VBAI Legal Pro V2'), 'index.html must contain VBAI Legal Pro V2 badge');

console.log('PASS: Legacy shell v1.2.6 successfully purged.');
