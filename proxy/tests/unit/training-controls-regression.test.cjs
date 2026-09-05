'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const server = fs.readFileSync(path.join(__dirname, '../../server.js'), 'utf8');
const adminPanel = fs.readFileSync(path.join(__dirname, '../../../webapp/modules/admin-panel.js'), 'utf8');

const syncRoute = server.slice(server.indexOf("app.post('/api/admin/training-datasets/sync-vbaibot'"), server.indexOf("// POST /api/admin/training-datasets/trigger-tuning"));
const tuningRoute = server.slice(server.indexOf("app.post('/api/admin/training-datasets/trigger-tuning'"), server.indexOf("// POST: Chat completion proxy"));
const trainingUi = adminPanel.slice(adminPanel.indexOf("const syncVbaibotBtn"), adminPanel.indexOf("const exportDatasetBtn"));

assert.match(syncRoute, /await verifyAdminToken\(req\)/);
assert.match(syncRoute, /missingSources/);
assert.match(syncRoute, /administrative_divisions\.json/);
assert.match(syncRoute, /bulkWrite\(/);
assert.match(server, /tinNhan/);
assert.match(server, /mongDoi/);
assert.match(syncRoute, /parsedCaseCount/);
assert.match(syncRoute, /ingestedCaseCount/);
assert.match(syncRoute, /skippedCaseCount/);
assert.match(syncRoute, /success: status === 'SYNCED'/);
assert.match(syncRoute, /status === 'PARTIAL' \? 502 : 200/);
assert.doesNotMatch(syncRoute, /success:\s*true[\s\S]{0,200}if \(.*fetch/i);

assert.match(tuningRoute, /configuredModel/);
assert.match(tuningRoute, /configuredModel,\n\s*epochs/);
assert.match(tuningRoute, /status: 'NOT_IMPLEMENTED'/);
assert.match(tuningRoute, /status\(501\)/);
assert.match(tuningRoute, /training_datasets/);
assert.doesNotMatch(tuningRoute, /ai_tuning_jobs.*insertOne/);
assert.doesNotMatch(tuningRoute, /baseModel/);

assert.doesNotMatch(trainingUi, /currentUser\.getIdToken/);
assert.match(trainingUi, /readResponsePayload/);
assert.match(trainingUi, /finally/);
assert.match(adminPanel, /updateDatasetStats/);

console.log('PASS training-controls-regression.test.cjs');
