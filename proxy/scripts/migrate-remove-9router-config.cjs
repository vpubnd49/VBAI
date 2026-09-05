/**
 * Legacy AI configuration migration from an exported JSON snapshot to MongoDB.
 *
 * Usage:
 *   node proxy/scripts/migrate-remove-9router-config.cjs --input path/to/export.json
 *   node proxy/scripts/migrate-remove-9router-config.cjs --input path/to/export.json --apply
 *
 * Dry-run is the default. The source export is never modified or deleted.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const dbService = require('../services/db.service');

const args = process.argv.slice(2);
const isApply = args.includes('--apply');
const inputIndex = args.indexOf('--input');
const inputPath = inputIndex >= 0 ? args[inputIndex + 1] : null;

if (!inputPath || inputPath.startsWith('--')) {
  throw new Error('--input requires an export JSON path');
}

const LEGACY_FIELDS = [
  'nine_router_api_key',
  'nine_router_endpoint',
  'nine_router_model',
  'nine_router_models',
  'has_nine_router_key',
  'active_provider',
  'active_chat_provider',
];
const PROTECTED_FIELDS = [
  'gemini_api_key',
  'gemini_endpoint',
  'gemini_model',
  'transcribe_model',
  'meeting_model',
  'vertex_project_id',
  'vertex_location',
  'search_engine_id',
  'system_prompt',
];

function readExport(filePath) {
  const source = JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
  return source.collections && typeof source.collections === 'object'
    ? source.collections
    : source;
}

function getConfigRows(exported) {
  const rows = Array.isArray(exported.config) ? exported.config : [];
  return rows.filter((row) => row && (row._id === 'system' || row.id === 'system' || row.documentId === 'system'));
}

function sanitizeConfig(source) {
  const document = { ...source };
  delete document.id;
  delete document.documentId;
  if (!document._id) document._id = 'system';
  for (const field of LEGACY_FIELDS) delete document[field];
  document.updated_at = new Date();
  document.updated_by = 'legacy_config_migration_mongo';
  return document;
}

async function runMigration() {
  const exported = readExport(inputPath);
  const rows = getConfigRows(exported);
  const summary = { examined: rows.length, changed: 0, skipped: 0 };

  console.log('=== Legacy AI configuration export -> MongoDB ===');
  console.log(`Mode: ${isApply ? 'APPLY (MongoDB writes enabled)' : 'DRY-RUN (read-only)'}`);
  console.log(`Input: ${path.resolve(inputPath)}`);

  for (const row of rows) {
    const changedFields = LEGACY_FIELDS.filter((field) => row[field] !== undefined);
    if (changedFields.length === 0) {
      summary.skipped++;
      continue;
    }
    const document = sanitizeConfig(row);
    for (const field of PROTECTED_FIELDS) {
      if (document[field] !== row[field]) {
        throw new Error(`Protected field changed during migration: ${field}`);
      }
    }
    summary.changed++;
    console.log(`[${isApply ? 'APPLY' : 'DRY-RUN'}] config/system remove: ${changedFields.join(', ')}`);
    if (isApply) {
      const db = await dbService.getDb();
      await db.collection('config').replaceOne({ _id: 'system' }, document, { upsert: true });
    }
  }

  if (!rows.length) console.log('No config/system document found in export.');
  console.log(`Examined: ${summary.examined}`);
  console.log(`Changed: ${summary.changed}`);
  console.log(`Skipped: ${summary.skipped}`);
  console.log(isApply ? 'MongoDB migration complete; source export was not modified.' : 'Dry-run complete; zero MongoDB writes executed.');
}

runMigration().catch((error) => {
  console.error(`[Migration ERROR]: ${error.message}`);
  process.exitCode = 1;
});
