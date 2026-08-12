/**
 * LegalKit V3 Source Validator (Corrective V2)
 *
 * Enumerates all files in legalkit-vn-master/ source, maps them to
 * skill/ canonical destination, and computes per-file sync status:
 *
 * - COPIED: source and destination exist with matching size
 * - DIFFERENT: both exist but sizes differ
 * - MISSING: source exists but destination is absent
 * - EXCLUDED_BY_POLICY: source file excluded from sync with reason
 *
 * Usage: node skill/validate-legalkit.cjs
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const args = process.argv.slice(2);
let checkOnly = false;
let customOutputPath = null;
let customSourcePath = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--check' || args[i] === '--no-write') {
    checkOnly = true;
  } else if (args[i] === '--output' && args[i + 1]) {
    customOutputPath = path.resolve(args[i + 1]);
    i++;
  } else if (args[i] === '--source' && args[i + 1]) {
    customSourcePath = path.resolve(args[i + 1]);
    i++;
  }
}

const REPO_ROOT = path.resolve(__dirname, '..');
const SOURCE_DIR = customSourcePath || path.join(REPO_ROOT, 'legalkit-vn-master');
const DEST_DIR = path.join(REPO_ROOT, 'skill');
const EXPECTED_COUNTS = Object.freeze({
  total: 54,
  COPIED: 41,
  EXCLUDED_BY_POLICY: 13,
  MISSING: 0,
  DIFFERENT: 0,
});

/**
 * Files excluded from sync with policy reasons
 */
const EXCLUSIONS = {
  '.gitignore': 'Git config not synced to skill/',
  'package.json': 'NPM config for standalone scripts, not needed in skill/',
  'package-lock.json': 'Lock file for standalone scripts',
  'README.md': 'Source README, skill/ has its own SKILL.md',
  'README_ND30.md': 'ND30-specific README, content embedded in resources/nd30-format-standard.md',
  'SKILL_ND30.md': 'ND30-specific skill doc, merged into main SKILL.md',
  'templates/engine/index.html': 'Template engine HTML (416KB), deployed separately, not bundled in skill/',
  'scripts/contract_builder.py': 'Python build script, runs standalone',
  'scripts/dashboard.py': 'Python dashboard script, runs standalone',
  'scripts/law_updater.py': 'Python law update script, runs standalone',
  'scripts/sot_validator.py': 'Python SOT validation script, runs standalone',
  'scripts/generate_cong_van.js': 'Node.js generator script, runs standalone',
  'scripts/generate_quyet_dinh.js': 'Node.js generator script, runs standalone',
};

/**
 * Mapping from source relative path to destination relative path
 */
const PATH_MAP = {
  'SKILL.md': 'SKILL.md',
  // manifest.json exists only in skill/
  'resources/citation-format.md': 'resources/citation-format.md',
  'resources/contract-schema.md': 'resources/contract-schema.md',
  'resources/cross-reference-guide.md': 'resources/cross-reference-guide.md',
  'resources/legal-system.md': 'resources/legal-system.md',
  'resources/lint-rules.md': 'resources/lint-rules.md',
  'resources/monitored-laws.json': 'resources/monitored-laws.json',
  'resources/nd30-format-standard.md': 'resources/nd30-format-standard.md',
  'resources/precedents-catalog.json': 'resources/precedents-catalog.json',
  'resources/search-sources.md': 'resources/search-sources.md',
  'resources/domains/01-dan-su.md': 'resources/domains/01-dan-su.md',
  'resources/domains/02-hinh-su-hanh-chinh.md': 'resources/domains/02-hinh-su-hanh-chinh.md',
  'resources/domains/03-doanh-nghiep-lao-dong.md': 'resources/domains/03-doanh-nghiep-lao-dong.md',
  'resources/domains/04-dat-dai-xay-dung.md': 'resources/domains/04-dat-dai-xay-dung.md',
  'resources/domains/05-thue-tai-chinh.md': 'resources/domains/05-thue-tai-chinh.md',
  'resources/domains/06-chuyen-nganh-khac.md': 'resources/domains/06-chuyen-nganh-khac.md',
  'resources/domains/07-hop-dong-catalog.md': 'resources/domains/07-hop-dong-catalog.md',
  'references/phan_quyen_ky.md': 'references/phan_quyen_ky.md',
  'references/quy_tac_the_thuc.md': 'references/quy_tac_the_thuc.md',
  'references/case-studies/dat-dai-tranh-chap-dat-coc.md': 'references/case-studies/dat-dai-tranh-chap-dat-coc.md',
  'references/case-studies/lao-dong-don-phuong-cham-dut.md': 'references/case-studies/lao-dong-don-phuong-cham-dut.md',
};

// Auto-generate mapping for 20 contract templates
const CONTRACT_DIR = 'templates/contracts';
const contractFiles = [
  'hop-dong-bao-lanh.json', 'hop-dong-chuyen-nhuong-dat-dai.json',
  'hop-dong-ctv.json', 'hop-dong-dai-ly.json', 'hop-dong-dat-coc.json',
  'hop-dong-dich-vu.json', 'hop-dong-gia-cong.json', 'hop-dong-gop-von.json',
  'hop-dong-hop-tac-kinh-doanh.json', 'hop-dong-lao-dong.json',
  'hop-dong-nguyen-tac.json', 'hop-dong-tang-cho.json',
  'hop-dong-thiet-ke-phan-mem.json', 'hop-dong-thue-nha.json',
  'hop-dong-thue-van-phong.json', 'hop-dong-vay-tien.json',
  'mua-ban-hh.json', 'nda.json', 'thoa-thuan-co-dong.json', 'uy-quyen.json',
];
for (const f of contractFiles) {
  PATH_MAP[`${CONTRACT_DIR}/${f}`] = `${CONTRACT_DIR}/${f}`;
}

function sha256File(filePath) {
  try {
    const content = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
  } catch (_) {
    return null;
  }
}

function walkDir(dir, base = '') {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      results.push(...walkDir(path.join(dir, entry.name), rel));
    } else {
      results.push(rel);
    }
  }
  return results;
}

// Run
console.log('=== LegalKit V3 Source Sync Validator ===\n');

const sourceFiles = walkDir(SOURCE_DIR);
const results = [];

if (!fs.existsSync(SOURCE_DIR) || sourceFiles.length === 0) {
  console.error(`BLOCKED: LegalKit Source Master is missing or empty: ${SOURCE_DIR}`);
  process.exit(2);
}

for (const srcRel of sourceFiles) {
  const srcAbsPath = path.join(SOURCE_DIR, srcRel);
  const srcStat = fs.statSync(srcAbsPath);

  // Check exclusions
  if (EXCLUSIONS[srcRel]) {
    results.push({
      source: srcRel,
      destination: null,
      status: 'EXCLUDED_BY_POLICY',
      reason: EXCLUSIONS[srcRel],
      sourceSize: srcStat.size,
      sourceSha256: null,
      destSize: null,
      destSha256: null,
    });
    continue;
  }

  // Find mapped destination
  const destRel = PATH_MAP[srcRel];
  if (!destRel) {
    results.push({
      source: srcRel,
      destination: null,
      status: 'MISSING',
      reason: 'No mapping defined for this source file',
      sourceSize: srcStat.size,
      sourceSha256: sha256File(srcAbsPath),
      destSize: null,
      destSha256: null,
    });
    continue;
  }

  const destAbsPath = path.join(DEST_DIR, destRel);
  if (!fs.existsSync(destAbsPath)) {
    results.push({
      source: srcRel,
      destination: destRel,
      status: 'MISSING',
      reason: 'Destination file does not exist',
      sourceSize: srcStat.size,
      sourceSha256: sha256File(srcAbsPath),
      destSize: null,
      destSha256: null,
    });
    continue;
  }

  const destStat = fs.statSync(destAbsPath);
  const srcHash = sha256File(srcAbsPath);
  const destHash = sha256File(destAbsPath);

  if (srcHash === destHash) {
    results.push({
      source: srcRel,
      destination: destRel,
      status: 'COPIED',
      reason: null,
      sourceSize: srcStat.size,
      sourceSha256: srcHash,
      destSize: destStat.size,
      destSha256: destHash,
    });
  } else {
    results.push({
      source: srcRel,
      destination: destRel,
      status: 'DIFFERENT',
      reason: `Size: source=${srcStat.size} dest=${destStat.size}, Hash mismatch`,
      sourceSize: srcStat.size,
      sourceSha256: srcHash,
      destSize: destStat.size,
      destSha256: destHash,
    });
  }
}

// Summary
const counts = { COPIED: 0, DIFFERENT: 0, MISSING: 0, EXCLUDED_BY_POLICY: 0 };
for (const r of results) counts[r.status]++;

console.log(`Total source files: ${sourceFiles.length}`);
console.log(`COPIED: ${counts.COPIED}`);
console.log(`DIFFERENT: ${counts.DIFFERENT}`);
console.log(`MISSING: ${counts.MISSING}`);
console.log(`EXCLUDED_BY_POLICY: ${counts.EXCLUDED_BY_POLICY}`);
console.log('');

// Print details for non-COPIED / non-EXCLUDED
for (const r of results) {
  if (r.status === 'DIFFERENT' || r.status === 'MISSING') {
    console.log(`  [${r.status}] ${r.source} -> ${r.destination || '(none)'}`);
    if (r.reason) console.log(`    Reason: ${r.reason}`);
  }
}

// Overall sync status
const syncedGroup = results.filter(r => r.status !== 'EXCLUDED_BY_POLICY');
const hasMissingOrDifferent = syncedGroup.some(r => r.status === 'MISSING' || r.status === 'DIFFERENT');
const countMismatch = sourceFiles.length !== EXPECTED_COUNTS.total ||
  counts.COPIED !== EXPECTED_COUNTS.COPIED ||
  counts.EXCLUDED_BY_POLICY !== EXPECTED_COUNTS.EXCLUDED_BY_POLICY ||
  counts.MISSING !== EXPECTED_COUNTS.MISSING ||
  counts.DIFFERENT !== EXPECTED_COUNTS.DIFFERENT;
const overallStatus = hasMissingOrDifferent || countMismatch ? 'NOT_SYNCHRONIZED' : 'SYNCHRONIZED';
console.log(`\nOverall LegalKit Sync Status: ${overallStatus}`);

if (countMismatch) {
  console.error(`EXPECTED_COUNTS=${JSON.stringify(EXPECTED_COUNTS)}`);
  console.error(`ACTUAL_COUNTS=${JSON.stringify({ total: sourceFiles.length, ...counts })}`);
}

if (customOutputPath) {
  const outputDir = path.dirname(customOutputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  const output = {
    inventory_date: new Date().toISOString(),
    source_dir: 'legalkit-vn-master',
    dest_dir: 'skill',
    total_files: sourceFiles.length,
    counts,
    overall_status: overallStatus,
    files: results,
  };
  fs.writeFileSync(customOutputPath, JSON.stringify(output, null, 2));
  console.log(`\nWrote detailed inventory to external path: ${customOutputPath}`);
} else {
  console.log('\n[READ-ONLY MODE] Verification completed without modifying repository files.');
}

if (hasMissingOrDifferent || countMismatch) {
  console.log('\n\u26A0 NOT_SYNCHRONIZED: Fix MISSING/DIFFERENT files before release.');
  process.exit(1);
}
