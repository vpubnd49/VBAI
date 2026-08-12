/**
 * Authoritative Sync Script for LegalKit Source Master -> skill/
 *
 * Performs exact binary copy of source files from legalkit-vn-master/
 * to skill/ canonical destination, enforcing exact byte-level sync.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const REPO_ROOT = path.resolve(__dirname, '..');
const SOURCE_DIR = path.join(REPO_ROOT, 'legalkit-vn-master');
const DEST_DIR = path.join(REPO_ROOT, 'skill');

const EXCLUSIONS = new Set([
  '.gitignore',
  'package.json',
  'package-lock.json',
  'README.md',
  'README_ND30.md',
  'SKILL_ND30.md',
  'templates/engine/index.html',
  'scripts/contract_builder.py',
  'scripts/dashboard.py',
  'scripts/law_updater.py',
  'scripts/sot_validator.py',
  'scripts/generate_cong_van.js',
  'scripts/generate_quyet_dinh.js',
]);

const PATH_MAP = {
  'SKILL.md': 'SKILL.md',
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

function sync() {
  let copied = 0;
  let skipped = 0;

  for (const [srcRel, destRel] of Object.entries(PATH_MAP)) {
    if (EXCLUSIONS.has(srcRel)) {
      skipped++;
      continue;
    }
    const srcAbs = path.join(SOURCE_DIR, srcRel);
    const destAbs = path.join(DEST_DIR, destRel);

    if (!fs.existsSync(srcAbs)) {
      console.error(`Source missing: ${srcRel}`);
      continue;
    }

    const destParent = path.dirname(destAbs);
    if (!fs.existsSync(destParent)) {
      fs.mkdirSync(destParent, { recursive: true });
    }

    fs.copyFileSync(srcAbs, destAbs);
    copied++;
  }

  console.log(`Sync complete: ${copied} copied, ${skipped} excluded.`);
}

sync();
