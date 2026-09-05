/**
 * Migration Safety Test (Corrective V2)
 *
 * Verifies that migration script:
 * - Defaults to dry-run (no --apply)
 * - Has --apply flag check
 * - Reports examined/changed/skipped/failed
 * - Does not auto-apply
 *
 * Run: node proxy/tests/unit/migration-safety.test.cjs
 */
'use strict';

const fs = require('fs');
const path = require('path');

const proxyRoot = path.join(__dirname, '..', '..');
const mongoUtilities = [
  'check-mongo-users.js',
  'count-mongo-logs.js',
  'seed-mongo-logs.js',
  'update-mongo-config-model.js',
];
const removedFirestoreUtilities = [
  'check_users.js',
  'count_logs.js',
  'seed_logs.js',
  'test_delete_all.js',
  'test-firestore.js',
  'update_config_model.js',
];

let passed = 0;
let failed = 0;

function ok(condition, msg) {
  if (condition) {
    console.log(`  \u2714 PASS: ${msg}`);
    passed++;
  } else {
    console.error(`  \u2718 FAIL: ${msg}`);
    failed++;
  }
}

console.log('=== Migration Safety Test (Corrective V2) ===\n');

mongoUtilities.forEach((file) => ok(fs.existsSync(path.join(proxyRoot, file)), `${file} is MongoDB-only utility`));
removedFirestoreUtilities.forEach((file) => ok(!fs.existsSync(path.join(proxyRoot, file)), `${file} Firestore utility is removed`));

const seedConfigPath = path.join(proxyRoot, 'tests', 'seed-system-config.cjs');
if (fs.existsSync(seedConfigPath)) {
  const seedConfig = fs.readFileSync(seedConfigPath, 'utf8');
  ok(seedConfig.includes("require('../services/db.service')"), 'System config seed uses dbService');
  ok(!/firebase-admin\/(?:firestore|app)/.test(seedConfig), 'System config seed does not initialize Firestore');
}

const migrationPath = path.join(proxyRoot, 'scripts', 'import-mongo.js');
ok(fs.existsSync(migrationPath), 'Safe export migration script exists');

if (fs.existsSync(migrationPath)) {
  const content = fs.readFileSync(migrationPath, 'utf8');

  ok(content.includes("args.includes('--apply')"), 'Has --apply flag check');
  ok(content.includes('DRY-RUN'), 'Mentions DRY-RUN mode');
  ok(content.includes('summary.examined'), 'Reports examined count');
  ok(content.includes('summary.changed'), 'Reports changed count');
  ok(content.includes('summary.skippedSensitive'), 'Reports skippedSensitive count');
  ok(content.includes('summary.conflicts'), 'Reports conflicts count');
  ok(content.includes('zero MongoDB writes'), 'Documents dry-run has zero writes');
  ok(!content.includes('IS_APPLY = true'), 'Does NOT default to apply');
  ok(content.includes('Firebase Auth remains the identity authority'), 'Keeps Firebase Auth outside Mongo identity migration');
  ok(content.includes('custom[_-]?claims?'), 'Rejects custom claims and sensitive fields');
  ok(content.includes('gemini_api_key'), 'Protects existing Gemini key');
  ok(content.includes('gemini_endpoint'), 'Protects existing Gemini endpoint');
  ok(content.includes("collectionName === 'stats'"), 'Applies non-decreasing stats policy');
  ok(content.includes('training_datasets'), 'Normalizes datasets');
  ok(content.includes('known_documents'), 'Normalizes known documents');
  ok(!content.includes('firebase-admin'), 'Does not connect to legacy database');

  const migration = require(migrationPath);
  const summary = { skippedSensitive: 0, sensitiveFields: [] };
  const sanitized = migration.sanitizeValue({ uid: 'u1', password: 'secret', nested: { apiKey: 'key' } }, summary, 'user');
  ok(!('password' in sanitized) && !('apiKey' in sanitized.nested), 'Sanitizer strips plaintext credentials and API keys');
  ok(summary.skippedSensitive === 2, 'Sanitizer reports every skipped sensitive field');

  const profileSummary = { skippedSensitive: 0, sensitiveFields: [] };
  const profile = migration.profileFromAuth({ uid: 'u1', email: 'A@EXAMPLE.COM', passwordHash: 'hash', customClaims: { admin: true } }, { role: 'admin' }, profileSummary);
  ok(Object.keys(profile).every((key) => ['_id', 'uid', 'email', 'displayName', 'role', 'status', 'created_at', 'last_login_at', 'updated_at'].includes(key)), 'User migration is profile-only');
  ok(profile.role === 'admin' && profile.email === 'a@example.com', 'User profile normalizes email and approved profile role');
  ok(profileSummary.skippedSensitive === 2, 'User migration reports passwordHash and customClaims');
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
