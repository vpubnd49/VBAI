/**
 * Safe migration of exported identity and application data into MongoDB.
 *
 * Usage:
 *   node proxy/scripts/import-mongo.js [--input-dir path/to/export] [--apply]
 *
 * Dry-run is the default. Firebase Auth remains the identity authority; this
 * script imports only a profile projection and never imports credentials.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const dbService = require('../services/db.service');

const args = process.argv.slice(2);
const isApply = args.includes('--apply');
const inputDirIndex = args.indexOf('--input-dir');
const inputDir = inputDirIndex >= 0 && args[inputDirIndex + 1]
  ? path.resolve(args[inputDirIndex + 1])
  : path.resolve(__dirname, '../../backup_database');

const SENSITIVE_FIELD = /(?:^|[_-])(password|passwordhash|passwd|secret|api[_-]?key|token|access[_-]?token|refresh[_-]?token|private[_-]?key|client[_-]?secret|service[_-]?account|credential|credentials|custom[_-]?claims?)(?:$|[_-])/i;
const CONFIG_PROTECTED_FIELDS = new Set(['gemini_api_key', 'gemini_endpoint']);
const DATA_FILES = {
  auth: 'firebase_auth_users.json',
  collections: 'firestore_collections.json',
};
const COLLECTION_ALIASES = {
  logs: 'search_logs',
  searchLogs: 'search_logs',
  knownDocs: 'known_documents',
  known_documents: 'known_documents',
  datasets: 'training_datasets',
  training_datasets: 'training_datasets',
  stats: 'stats',
  visits: 'stats',
  visit_stats: 'stats',
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function getExportCollections(data) {
  return data && data.collections && typeof data.collections === 'object'
    ? data.collections
    : (data || {});
}

function addSkipped(summary, field) {
  summary.skippedSensitive++;
  if (!summary.sensitiveFields.includes(field)) summary.sensitiveFields.push(field);
}

function sanitizeValue(value, summary, field = '') {
  if (Array.isArray(value)) return value.map((item) => sanitizeValue(item, summary, field));
  if (!value || typeof value !== 'object' || value instanceof Date) return value;

  const result = {};
  for (const [key, child] of Object.entries(value)) {
    if (SENSITIVE_FIELD.test(key)) {
      addSkipped(summary, field ? `${field}.${key}` : key);
      continue;
    }
    result[key] = sanitizeValue(child, summary, field ? `${field}.${key}` : key);
  }
  return result;
}

function normalizeDate(value, fallback = null) {
  if (value === undefined || value === null || value === '') return fallback;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

function profileFromAuth(auth, profile, summary) {
  const source = profile || {};
  const uid = String(auth?.uid || auth?._id || source.uid || source._id || '').trim();
  if (!uid) return null;
  // Read only profile fields. In particular, custom claims are not an input for role.
  const email = String(auth?.email || source.email || '').trim().toLowerCase();
  const displayName = String(auth?.displayName || source.displayName || source.name || '').trim();
  const role = String(source.role || '').trim().toLowerCase();
  for (const [key, value] of Object.entries({ ...auth, ...source })) {
    if (SENSITIVE_FIELD.test(key)) addSkipped(summary, `users.${key}`);
  }
  return {
    _id: uid,
    uid,
    email: email || null,
    displayName: displayName || null,
    role: role || 'user',
    status: auth?.disabled === true || source.status === 'disabled' ? 'disabled' : (source.status || 'active'),
    created_at: normalizeDate(auth?.creationTime || source.created_at || source.createdAt, new Date()),
    last_login_at: normalizeDate(auth?.lastSignInTime || source.last_login_at || source.lastLoginAt),
    updated_at: new Date(),
  };
}

function normalizeConfig(row, summary) {
  const safe = sanitizeValue(row, summary, 'config');
  delete safe.id;
  delete safe.documentId;
  safe._id = safe._id || 'system';
  for (const field of CONFIG_PROTECTED_FIELDS) {
    if (row[field] !== undefined) addSkipped(summary, `config.${field}`);
    delete safe[field];
  }
  safe.updated_at = new Date();
  safe.updated_by = 'safe_export_migration_mongo';
  return safe;
}

function normalizeRecord(record, collection, summary) {
  const safe = sanitizeValue(record, summary, collection);
  if (safe._id === undefined && safe.id !== undefined) safe._id = safe.id;
  delete safe.id;
  delete safe.documentId;
  if (collection === 'search_logs') {
    safe.timestamp = normalizeDate(safe.timestamp || safe.createdAt, new Date());
  }
  if (collection === 'stats' && safe.count !== undefined) {
    const count = Number(safe.count);
    safe.count = Number.isFinite(count) && count >= 0 ? count : 0;
  }
  return safe;
}

function rowsFor(collections, name) {
  const rows = [];
  for (const [sourceName, targetName] of Object.entries(COLLECTION_ALIASES)) {
    if (targetName !== name || !Array.isArray(collections[sourceName])) continue;
    rows.push(...collections[sourceName]);
  }
  return rows;
}

function incrementConflict(summary) {
  summary.conflicts++;
}

async function upsert(db, collectionName, document, summary) {
  if (!document || document._id === undefined || document._id === null) {
    summary.skipped++;
    return;
  }
  const collection = isApply ? db.collection(collectionName) : null;
  const existing = isApply ? await collection.findOne({ _id: document._id }) : null;
  let update = { $set: document };

  if (collectionName === 'stats' && existing && document.count !== undefined) {
    const oldCount = Number(existing.count || 0);
    const incomingCount = Number(document.count || 0);
    if (oldCount > incomingCount) {
      document.count = oldCount;
      incrementConflict(summary);
    } else if (oldCount !== incomingCount) {
      incrementConflict(summary);
    }
  } else if (existing && JSON.stringify(existing) !== JSON.stringify(document)) {
    incrementConflict(summary);
  }

  summary.changed++;
  if (isApply) await collection.updateOne({ _id: document._id }, update, { upsert: true });
}

async function runMigration() {
  const authPath = path.join(inputDir, DATA_FILES.auth);
  const collectionsPath = path.join(inputDir, DATA_FILES.collections);
  if (!fs.existsSync(authPath) || !fs.existsSync(collectionsPath)) {
    throw new Error(`Missing export files in ${inputDir}`);
  }

  const authUsers = readJson(authPath);
  const collections = getExportCollections(readJson(collectionsPath));
  const summary = { examined: 0, changed: 0, skipped: 0, skippedSensitive: 0, conflicts: 0, sensitiveFields: [] };
  const db = isApply ? await dbService.getDb() : null;

  console.log(`=== Safe export migration -> MongoDB (${isApply ? 'APPLY' : 'DRY-RUN'}) ===`);
  console.log(`Input: ${inputDir}`);
  const profiles = new Map((Array.isArray(collections.users) ? collections.users : [])
    .filter((row) => row && (row._id || row.uid))
    .map((row) => [String(row._id || row.uid), row]));

  for (const auth of Array.isArray(authUsers) ? authUsers : []) {
    summary.examined++;
    await upsert(db, 'users', profileFromAuth(auth, profiles.get(String(auth.uid)), summary), summary);
  }

  const configRows = Array.isArray(collections.config) ? collections.config : [];
  for (const row of configRows) {
    summary.examined++;
    await upsert(db, 'config', normalizeConfig(row, summary), summary);
  }

  for (const collectionName of ['search_logs', 'stats', 'training_datasets', 'known_documents']) {
    for (const row of rowsFor(collections, collectionName)) {
      summary.examined++;
      await upsert(db, collectionName, normalizeRecord(row, collectionName, summary), summary);
    }
  }

  console.log(`Examined: ${summary.examined}`);
  console.log(`Changed: ${summary.changed}`);
  console.log(`Skipped: ${summary.skipped}`);
  console.log(`Skipped sensitive: ${summary.skippedSensitive}`);
  console.log(`Conflicts: ${summary.conflicts}`);
  if (summary.sensitiveFields.length) console.log(`Sensitive fields skipped: ${summary.sensitiveFields.join(', ')}`);
  console.log(isApply ? 'Apply complete; Firebase Auth remains the identity authority.' : 'Dry-run complete; zero MongoDB writes executed.');
  return summary;
}

if (require.main === module) runMigration().catch((error) => {
  console.error(`[Migration ERROR]: ${error.message}`);
  process.exitCode = 1;
});

module.exports = { sanitizeValue, profileFromAuth, normalizeConfig, normalizeRecord, runMigration };
