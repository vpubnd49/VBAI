/**
 * daily-run.cjs
 * Tổng hợp tất cả các tác vụ bảo trì và cập nhật dữ liệu hàng ngày cho VBAI.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function runStep(name, command) {
  console.log(`\n>>> [STEP] ${name}`);
  try {
    const output = execSync(command, { encoding: 'utf8' });
    console.log(output);
    console.log(`✅ ${name} thành công!`);
  } catch (error) {
    console.error(`❌ ${name} thất bại!`);
    console.error(error.message);
  }
}

console.log('=========================================');
console.log('   VBAI DAILY RUN - CẬP NHẬT DỮ LIỆU     ');
console.log('=========================================');

// Step 1: Biên dịch Skills
runStep('Biên dịch Skills', 'node compile-skills.cjs');

// Step 2: Cập nhật Knowledge từ Templates
runStep('Cập nhật Knowledge từ Templates', 'node read-templates.cjs');

// Step 3: Kiểm tra tệp manifest
const manifestPath = path.join(__dirname, 'public', 'skills-manifest.json');
if (fs.existsSync(manifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  console.log(`\n📍 Manifest hiện có ${manifest.length} skills.`);
}

console.log('\n=========================================');
console.log('   DAILY RUN HOÀN TẤT! SẴN SÀNG ĐỂ BUILD ');
console.log('=========================================');
