#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { verifyReleaseState } from './lib/release-invariants.mjs';

function option(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

const inputPath = option('--input');
const outputPath = option('--output');

if (!inputPath || !outputPath) {
  console.error('Usage: node tools/release/verify-release.mjs --input <release-state.json> --output <verification.json>');
  process.exit(2);
}

try {
  const input = JSON.parse(fs.readFileSync(path.resolve(inputPath), 'utf8'));
  const result = verifyReleaseState(input);
  const absoluteOutput = path.resolve(outputPath);
  fs.mkdirSync(path.dirname(absoluteOutput), { recursive: true });
  fs.writeFileSync(absoluteOutput, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exit(result.overall === 'DEPLOYED_VERIFIED' ? 0 : 1);
} catch (error) {
  const result = {
    schemaVersion: 1,
    overall: 'BLOCKED',
    errors: [{ code: 'VERIFIER_INPUT_ERROR', message: error.message }],
  };
  try {
    const absoluteOutput = path.resolve(outputPath);
    fs.mkdirSync(path.dirname(absoluteOutput), { recursive: true });
    fs.writeFileSync(absoluteOutput, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  } catch (_) {
    // The original input/output failure is the actionable error.
  }
  console.error(JSON.stringify(result, null, 2));
  process.exit(2);
}
