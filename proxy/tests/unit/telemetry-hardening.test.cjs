'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const serviceSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'services', 'vbaibot-ingestion.service.js'),
  'utf8'
);
const serverSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'server.js'),
  'utf8'
);

assert.match(serviceSource, /crypto\.timingSafeEqual\(/, 'sync secret comparison is constant-time');
assert.match(serviceSource, /!hasValidSyncSecret\(authSecret\)/, 'sync secret is mandatory');
assert.match(serviceSource, /VBAIBOT_SYNC_SECRET\s*\|\|\s*''/, 'sync secret has no fallback value');
assert.match(serviceSource, /MAX_TELEMETRY_FIELD_LENGTH\s*=\s*100\s*\*\s*1024/, 'telemetry fields have a bounded size');
assert.match(serviceSource, /status:\s*413/, 'oversized telemetry is rejected');
assert.doesNotMatch(serverSource, /req\.body\?\.secret/, 'telemetry secret is not accepted from the body');
assert.match(serverSource, /express\.json\(\{\s*limit:\s*'1mb'/, 'JSON payload has a bounded size');
assert.match(serverSource, /!IS_PRODUCTION\s*&&[\s\S]*VBAI_LOCAL_TEST/, 'local test bypass is disabled in production');

console.log('PASS: telemetry hardening');
