/**
 * Firestore export -> MongoDB migration (DRY-RUN by default).
 *
 * Usage:
 *   node scripts/migrate-search-logs.cjs --input path/to/firestore_collections.json
 *   node scripts/migrate-search-logs.cjs --input path/to/firestore_collections.json --apply
 *
 * --apply is mandatory for writes. This script never deletes source data.
 */
'use strict';

const fs = require('fs');
const path = require('path');
let ObjectId;
try {
  ({ ObjectId } = require('../proxy/node_modules/mongodb'));
} catch (_) {
  ObjectId = class ObjectIdFallback {
    constructor(value) { this.value = String(value); }
    toString() { return this.value; }
    static isValid(value) { return /^[a-f\d]{24}$/i.test(String(value)); }
  };
}
const dbService = require('../proxy/services/db.service');

const IS_APPLY = process.argv.includes('--apply');
const inputIndex = process.argv.indexOf('--input');
const inputPath = inputIndex >= 0 ? process.argv[inputIndex + 1] : path.join(__dirname, '..', 'backup_database', 'firestore_collections.json');
if (inputIndex >= 0 && (!process.argv[inputIndex + 1] || process.argv[inputIndex + 1].startsWith('--'))) {
  throw new Error('--input requires a Firestore export JSON path');
}
const COLLECTIONS = ['config', 'search_logs', 'stats', 'users', 'training_datasets', 'known_documents', 'crawler_logs', 'ai_tuning_jobs'];

function normalizeValue(value) {
  if (value && typeof value === 'object' && value._seconds !== undefined) {
    return new Date(Number(value._seconds) * 1000 + Math.floor(Number(value._nanoseconds || 0) / 1e6));
  }
  if (Array.isArray(value)) return value.map(normalizeValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeValue(item)]));
  }
  return value;
}

function normalizeDocument(collection, source) {
  const doc = normalizeValue({ ...source });
  const sourceId = doc._id ?? doc.id ?? doc.documentId;
  if (sourceId && ObjectId.isValid(String(sourceId))) doc._id = new ObjectId(String(sourceId));
  else if (sourceId) doc._id = String(sourceId);
  else delete doc._id;
  if (collection === 'search_logs') {
    doc.timestamp = new Date(doc.timestamp || doc.created_at || Date.now());
    doc.created_at = new Date(doc.created_at || doc.timestamp);
    delete doc.userEmail;
    delete doc.ip_address;
    delete doc.raw_provider_response;
  }
  if (collection === 'known_documents' && doc.document_number) {
    doc.normalized_document_number = String(doc.document_number).trim().replace(/\s+/g, ' ').toUpperCase();
  }
  return doc;
}

function readExport(filePath) {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return raw.collections && typeof raw.collections === 'object' ? raw.collections : raw;
}

async function run() {
  if (!fs.existsSync(inputPath)) throw new Error(`Firestore export not found: ${inputPath}`);
  const exported = readExport(inputPath);
  const summary = { examined: 0, changed: 0, skipped: 0, failed: 0 };
  console.log(`=== Firestore export -> MongoDB migration ===\nMode: ${IS_APPLY ? 'APPLY' : 'DRY-RUN (read-only)'}\nInput: ${inputPath}`);
  for (const collection of COLLECTIONS) {
    const rows = Array.isArray(exported[collection]) ? exported[collection] : [];
    for (const row of rows) {
      summary.examined++;
      try {
        const doc = normalizeDocument(collection, row);
        if (!doc._id) { summary.skipped++; continue; }
        summary.changed++;
        if (IS_APPLY) {
          const db = await dbService.getDb();
          await db.collection(collection).replaceOne({ _id: doc._id }, doc, { upsert: true });
        } else {
          console.log(`[DRY-RUN] ${collection}/${String(doc._id)}`);
        }
      } catch (error) {
        summary.failed++;
        console.error(`[FAILED] ${collection}: ${error.message}`);
      }
    }
  }
  console.log(`Examined: ${summary.examined}\nChanged: ${summary.changed}\nSkipped: ${summary.skipped}\nFailed: ${summary.failed}`);
  if (IS_APPLY) console.log('Apply completed; source Firestore export was not modified or deleted.');
  process.exitCode = summary.failed ? 1 : 0;
}

run().catch((error) => { console.error(`Migration failed: ${error.message}`); process.exitCode = 1; });
