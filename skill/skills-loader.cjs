/**
 * LegalKit Manifest Loader and Integrity Validator.
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

function loadAndValidateLegalKitManifest() {
  const manifestPath = path.join(__dirname, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    return { valid: false, errors: ['manifest.json not found in skill directory'] };
  }

  try {
    const raw = fs.readFileSync(manifestPath, 'utf8');
    const manifest = JSON.parse(raw);
    const errors = [];
    const filesChecked = [];

    const allPaths = [...(manifest.core || []), ...(manifest.domains || []).map((d) => d.path)];

    for (const relPath of allPaths) {
      const fullPath = path.join(__dirname, relPath);
      if (!fs.existsSync(fullPath)) {
        errors.push(`Missing file: ${relPath}`);
      } else {
        const content = fs.readFileSync(fullPath, 'utf8');
        const hash = crypto.createHash('sha256').update(content).digest('hex');
        filesChecked.push({ path: relPath, size: content.length, sha256: hash });
      }
    }

    return {
      valid: errors.length === 0,
      version: manifest.version,
      coreCount: manifest.core ? manifest.core.length : 0,
      domainCount: manifest.domains ? manifest.domains.length : 0,
      filesChecked,
      errors,
    };
  } catch (e) {
    return { valid: false, errors: [`Failed to load manifest: ${e.message}`] };
  }
}

if (require.main === module) {
  const result = loadAndValidateLegalKitManifest();
  console.log('[LegalKit Validator]', JSON.stringify(result, null, 2));
  process.exit(result.valid ? 0 : 1);
}

module.exports = {
  loadAndValidateLegalKitManifest,
};
