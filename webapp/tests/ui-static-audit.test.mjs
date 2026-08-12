/**
 * UI Static Audit Test
 * Validates CSS rules, WCAG contrast variables, and static element tokens.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webappDir = path.resolve(__dirname, '..');

export async function runUiStaticAuditTest() {
  console.log('--- UI Static Audit Test ---');
  const cssPath = path.join(webappDir, 'style.css');
  const cssContent = fs.readFileSync(cssPath, 'utf8');

  // Check CSS variables & contrast semantic tokens
  const requiredTokens = [
    '--bg-primary',
    '--text-primary',
    '--status-success-text',
    '--status-error-text',
    '--btn-primary-bg',
    '--btn-danger-bg',
  ];

  for (const token of requiredTokens) {
    if (!cssContent.includes(token)) {
      throw new Error(`Missing required CSS token: ${token}`);
    }
  }

  // Ensure low contrast inline hex colors are replaced in modules
  const adminPanelPath = path.join(webappDir, 'modules', 'admin-panel.js');
  const adminContent = fs.readFileSync(adminPanelPath, 'utf8');
  if (adminContent.includes("color: '#34d399'") || adminContent.includes("color: '#f87171'")) {
    throw new Error('Low contrast inline hex color found in admin-panel.js');
  }

  console.log('  ✔ UI Static Audit PASS');
  return { status: 'PASS' };
}

if (process.argv[1] === __filename) {
  runUiStaticAuditTest().catch(err => {
    console.error('UI Static Audit Failed:', err);
    process.exit(1);
  });
}
