/**
 * VBAI Legal Pro V2 — CSS & Light UI Integrity Audit Test
 * Programmatically scans all CSS files and JS modules to ensure NO dark navy backgrounds
 * are used on cards, panels, forms, containers, upload zones, or meeting/admin modules.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WEBAPP_DIR = path.resolve(__dirname, '..');

const DARK_NAVY_PATTERNS = [
  /background(?:-color)?\s*:\s*#(?:0f172a|1e293b|0b0f19|111827|1f2937|0d1117|161b22)/i,
  /background(?:-color)?\s*:\s*rgba\(\s*(?:15|30|11|22)\s*,\s*(?:23|41|24|27)\s*,\s*(?:42|59|39|38)/i,
];

// Elements that MUST NOT have dark backgrounds
const TARGET_ELEMENTS = [
  '.panel-group',
  '.panel-header',
  '.panel-body',
  '.section-card',
  'upload-zone',
  'config-section-card',
  'meeting-recorder',
  'meeting-upload',
  'vb-nd30',
  'vb-dang',
  'pdf-tool',
  'docx-tool',
  'spell-check',
  'pdf-publisher'
];

console.log('🎨 Bắt đầu Kiểm toán Giao diện Light-Only (CSS & JS Audit)...');

let violations = 0;

function scanFile(filePath) {
  const relPath = path.relative(WEBAPP_DIR, filePath);
  const content = fs.readFileSync(filePath, 'utf8');

  // Check dark background rules
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    // Ignore dark mode media queries if present or modal overlay / code blocks
    if (line.includes('.modal-overlay') || line.includes('code-block') || line.includes('pre code')) {
      return;
    }

    for (const pattern of DARK_NAVY_PATTERNS) {
      if (pattern.test(line)) {
        // Check if it's setting background
        console.error(`  ❌ [VIOLATION] Dark navy background found in ${relPath}:${idx + 1}`);
        console.error(`     Line: ${line.trim()}`);
        violations++;
      }
    }
  });
}

function walkDir(dir) {
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (item !== 'node_modules' && item !== 'dist') {
        walkDir(fullPath);
      }
    } else if (item.endsWith('.css') || item.endsWith('.js')) {
      scanFile(fullPath);
    }
  }
}

walkDir(WEBAPP_DIR);

console.log(`\n📊 KẾT QUẢ CSS LIGHT AUDIT: ${violations === 0 ? 'PASS (0 Lỗi)' : `FAIL (${violations} Lỗi)`}`);

if (violations === 0) {
  console.log('🎉 TẤT CẢ GIAO DIỆN V2 ĐÃ ĐẠT CHUẨN LIGHT-ONLY 100%!');
} else {
  console.error('⚠️ PHÁT HIỆN GIAO DIỆN TỐI KHÔNG HỢP LỆ.');
  process.exit(1);
}
