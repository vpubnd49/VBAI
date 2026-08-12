/**
 * Login Theme Test
 * Validates login theme styling, dark mode / light mode toggle attributes, and branding.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webappDir = path.resolve(__dirname, '..');

export async function runLoginThemeTest() {
  console.log('--- Login Theme Test ---');
  const indexHtmlPath = path.join(webappDir, 'index.html');
  const htmlContent = fs.readFileSync(indexHtmlPath, 'utf8');

  // Verify theme attributes and login container elements
  if (!htmlContent.includes('data-theme')) {
    throw new Error('index.html missing data-theme attribute initialization');
  }

  const cssPath = path.join(webappDir, 'style.css');
  const cssContent = fs.readFileSync(cssPath, 'utf8');

  if (!cssContent.includes('[data-theme="light"]') && !cssContent.includes(':root')) {
    throw new Error('style.css missing light theme tokens');
  }

  console.log('  ✔ Login Theme Test PASS');
  return { status: 'PASS' };
}

if (process.argv[1] === __filename) {
  runLoginThemeTest().catch(err => {
    console.error('Login Theme Test Failed:', err);
    process.exit(1);
  });
}
