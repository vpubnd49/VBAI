#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  buildBosungMetadataIndex,
  parseBosungMetadata,
} = require('../../proxy/legal/repositories/bosung-metadata-index.js');

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const sourcePath = path.resolve(option('--source', 'proxy/bosung_metadata.json'));
const policyPath = path.resolve(option('--resolutions', 'proxy/legal/data/bosung-duplicate-resolutions.json'));
const outputPath = path.resolve(option('--output', 'bosung-metadata-governance.json'));

try {
  const raw = parseBosungMetadata(fs.readFileSync(sourcePath, 'utf8'));
  const policy = JSON.parse(fs.readFileSync(policyPath, 'utf8'));
  const { records, diagnostics } = buildBosungMetadataIndex(raw, policy);
  const report = {
    schemaVersion: 1,
    source: path.relative(process.cwd(), sourcePath).replaceAll('\\', '/'),
    policy: path.relative(process.cwd(), policyPath).replaceAll('\\', '/'),
    sourceRecords: Object.keys(raw).length,
    indexedDocumentNumbers: records.size,
    ...diagnostics,
    overall: diagnostics.unresolvedConflicts.length === 0 ? 'PASS' : 'NO_GO',
  };
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.overall === 'PASS' ? 0 : 1);
} catch (error) {
  const report = { schemaVersion: 1, overall: 'BLOCKED', error: error.message };
  try {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  } catch (_) {}
  console.error(JSON.stringify(report, null, 2));
  process.exit(2);
}
