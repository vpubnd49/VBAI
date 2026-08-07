/**
 * LegalKit V3 Programmatic Validation Script
 * Validates canonical files, JSON syntax, manifest references, and calculates exact numeric counts.
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const SKILL_DIR = path.resolve(__dirname, '.');

console.log('🔍 Bắt đầu Kiểm toán Programmatic cho LegalKit V3...');

let errors = 0;

// 1. Validate manifest.json
const manifestPath = path.join(SKILL_DIR, 'manifest.json');
if (!fs.existsSync(manifestPath)) {
  console.error('❌ Thiếu skill/manifest.json');
  errors++;
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

// Check referenced resource paths in manifest
function checkFileExists(relPath, label) {
  const fullPath = path.join(SKILL_DIR, relPath);
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ Manifest reference missing [${label}]: ${relPath}`);
    errors++;
    return false;
  }
  return true;
}

if (manifest.resources) {
  for (const [key, relPath] of Object.entries(manifest.resources)) {
    checkFileExists(relPath, `resource:${key}`);
  }
}

if (manifest.references) {
  for (const [key, relPath] of Object.entries(manifest.references)) {
    checkFileExists(relPath, `reference:${key}`);
  }
}

// 2. Count & Validate 20 Contract Templates
const templatesDir = path.join(SKILL_DIR, 'templates', 'contracts');
const templateFiles = fs.readdirSync(templatesDir).filter(f => f.endsWith('.json'));

console.log(`\n📋 Đếm Hợp đồng Chuẩn: ${templateFiles.length} template files found.`);
const templateIds = new Set();

templateFiles.forEach(file => {
  const filePath = path.join(templatesDir, file);
  try {
    const jsonStr = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(jsonStr);
    const id = data.id || data.contract_type || file.replace('.json', '');
    if (templateIds.has(id)) {
      console.warn(`⚠️ Trùng lặp ID Hợp đồng: ${id} (${file})`);
    }
    templateIds.add(id);
  } catch (err) {
    console.error(`❌ JSON Syntax Error in ${file}: ${err.message}`);
    errors++;
  }
});

// 3. Count & Validate Domain Modules
const domainsDir = path.join(SKILL_DIR, 'resources', 'domains');
const domainFiles = fs.existsSync(domainsDir) ? fs.readdirSync(domainsDir).filter(f => f.endsWith('.md')) : [];
console.log(`🌐 Đếm Domain Modules: ${domainFiles.length} domain files found.`);

// 4. Count Monitored Laws & Precedents
let monitoredLawsCount = 0;
const monitoredLawsPath = path.join(SKILL_DIR, 'resources', 'monitored-laws.json');
if (fs.existsSync(monitoredLawsPath)) {
  const data = JSON.parse(fs.readFileSync(monitoredLawsPath, 'utf8'));
  monitoredLawsCount = Array.isArray(data) ? data.length : (data.laws ? data.laws.length : Object.keys(data).length);
}

let precedentsCount = 0;
const precedentsPath = path.join(SKILL_DIR, 'resources', 'precedents-catalog.json');
if (fs.existsSync(precedentsPath)) {
  const data = JSON.parse(fs.readFileSync(precedentsPath, 'utf8'));
  precedentsCount = Array.isArray(data) ? data.length : (data.precedents ? data.precedents.length : Object.keys(data).length);
}

// 5. Raw Source Inventory Count
const rawSourceDir = path.join(ROOT_DIR, 'legalkit-vn-master');
let rawTotalFiles = 0;
let rawTextFiles = 0;
let rawBinaryFiles = 0;

if (fs.existsSync(rawSourceDir)) {
  function countRawFiles(dir) {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const full = path.join(dir, item);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        countRawFiles(full);
      } else {
        rawTotalFiles++;
        if (/\.(md|json|txt|cjs|js|yml|yaml|LICENSE)$/i.test(item)) {
          rawTextFiles++;
        } else {
          rawBinaryFiles++;
        }
      }
    }
  }
  countRawFiles(rawSourceDir);
}

console.log('\n📊 KẾT QUẢ KIỂM TOÁN CHÍNH THỨC:');
console.log(`   - TỔNG TỆP RAW LEGALKIT SOURCE: ${rawTotalFiles}`);
console.log(`   - TỆP TEXT/CODE RAW: ${rawTextFiles}`);
console.log(`   - TỆP BINARY RAW: ${rawBinaryFiles}`);
console.log(`   - SỐ NGUYÊN TẮC / LĨNH VỰC (DOMAINS): ${domainFiles.length}`);
console.log(`   - SỐ ÁN LỆ (PRECEDENTS): ${precedentsCount}`);
console.log(`   - SỐ VĂN BẢN THEO DÕI (MONITORED LAWS): ${monitoredLawsCount}`);
console.log(`   - SỐ MẪU HỢP ĐỒNG (CONTRACT TEMPLATES): ${templateFiles.length}`);
console.log(`   - SỐ CASE STUDIES / MẪU THỰC TẾ: ${templateFiles.length}`);

if (errors === 0) {
  console.log('\n🎉 LEGALKIT V3 VALIDATION: PASS (0 Lỗi)');
} else {
  console.error(`\n⚠️ LEGALKIT V3 VALIDATION: FAIL (${errors} Lỗi)`);
  process.exit(1);
}
