'use strict';

const fs = require('node:fs');
const path = require('node:path');

const CATALOG_PATH = path.join(__dirname, '..', 'data', 'document-template-catalog.json');
const TEMPLATE_TYPES = Object.freeze([
  'QUYET_DINH', 'THONG_BAO', 'KE_HOACH', 'CONG_VAN', 'GIAY_MOI',
  'KET_LUAN', 'BIEN_BAN', 'TO_TRINH', 'NGHI_QUYET',
]);
const PLACEHOLDER_RE = /\{\{\s*([A-Za-z][A-Za-z0-9_.-]*)\s*\}\}/g;
let cachedCatalog;

function asString(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function loadCatalog(forceReload = false) {
  if (cachedCatalog && !forceReload) return cachedCatalog;
  const parsed = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
  if (!parsed || parsed.schemaVersion !== 1 || !Array.isArray(parsed.templates)) {
    throw new Error('Invalid document template catalog');
  }
  const result = validateCatalog(parsed);
  if (!result.valid) throw new Error(`Invalid document template catalog: ${result.errors.join('; ')}`);
  cachedCatalog = parsed;
  return cachedCatalog;
}

function validateCatalog(catalog = loadCatalog()) {
  const errors = [];
  const seen = new Set();
  if (!catalog || catalog.schemaVersion !== 1 || !Array.isArray(catalog.templates)) {
    return { valid: false, errors: ['schemaVersion=1 and templates[] are required'] };
  }
  for (const template of catalog.templates) {
    if (!template || typeof template !== 'object') { errors.push('template must be an object'); continue; }
    if (!/^[a-z0-9][a-z0-9._-]*$/.test(asString(template.id)) || seen.has(template.id)) errors.push(`invalid or duplicate id: ${template.id}`);
    seen.add(template.id);
    if (!TEMPLATE_TYPES.includes(template.type)) errors.push(`${template.id}: unsupported type`);
    if (!asString(template.sourcePath) || path.isAbsolute(template.sourcePath) || template.sourcePath.includes('..')) errors.push(`${template.id}: unsafe sourcePath`);
    for (const field of ['requiredFields', 'optionalFields', 'keywords', 'sections']) {
      if (!Array.isArray(template[field])) errors.push(`${template.id}: ${field} must be an array`);
    }
    if (!['high', 'medium', 'low'].includes(template.extractionQuality)) errors.push(`${template.id}: invalid extractionQuality`);
  }
  return { valid: errors.length === 0, errors };
}

function publicTemplate(template) {
  if (!template) return null;
  return JSON.parse(JSON.stringify(template));
}

function listTemplates(filters = {}) {
  const templates = loadCatalog().templates;
  const type = asString(filters.type).toUpperCase();
  const keyword = asString(filters.keyword).toLocaleLowerCase('vi-VN');
  return templates.filter((item) => (!type || item.type === type) &&
    (!keyword || item.keywords.some((value) => value.toLocaleLowerCase('vi-VN').includes(keyword))))
    .map((item) => ({ ...publicTemplate(item), templateVersion: item.templateVersion || `catalog-${loadCatalog().schemaVersion}` }));
}

function getTemplate(id) {
  const wanted = asString(id).toLowerCase();
  const item = loadCatalog().templates.find((template) => template.id === wanted);
  return item ? { ...publicTemplate(item), templateVersion: item.templateVersion || `catalog-${loadCatalog().schemaVersion}` } : null;
}

// Deterministic metadata-only selection. It never reads or returns source document content.
function selectTemplate({ type = '', format = '', purpose = '', keyword = '' } = {}) {
  const wantedType = asString(type).toUpperCase();
  const wantedFormat = asString(format).toUpperCase();
  const terms = [keyword, purpose].join(' ').toLocaleLowerCase('vi-VN');
  const candidates = listTemplates({ type: wantedType, keyword: '' });
  return candidates
    .map((template) => {
      let score = 0;
      if (wantedType && template.type === wantedType) score += 100;
      if (wantedFormat && (template.standard || '').toUpperCase() === wantedFormat) score += 30;
      for (const value of template.keywords || []) {
        if (terms.includes(String(value).toLocaleLowerCase('vi-VN'))) score += 10;
      }
      return { template, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.template.id.localeCompare(b.template.id))[0]?.template || null;
}

function extractPlaceholders(text) {
  const found = new Set();
  const source = asString(text);
  PLACEHOLDER_RE.lastIndex = 0;
  let match;
  while ((match = PLACEHOLDER_RE.exec(source))) found.add(match[1]);
  PLACEHOLDER_RE.lastIndex = 0;
  return [...found];
}

function applyPlaceholders(text, values = {}) {
  const supplied = values && typeof values === 'object' ? values : {};
  const source = asString(text);
  PLACEHOLDER_RE.lastIndex = 0;
  const rendered = source.replace(PLACEHOLDER_RE, (whole, field) =>
    Object.prototype.hasOwnProperty.call(supplied, field) ? asString(supplied[field]) : whole
  );
  PLACEHOLDER_RE.lastIndex = 0;
  return rendered;
}

function resolveTemplate(id, values = {}) {
  const template = getTemplate(id);
  if (!template) return null;
  const supplied = values && typeof values === 'object' ? values : {};
  const requiredFields = template.requiredFields.map(asString);
  const missingRequired = requiredFields.filter((field) => !asString(supplied[field]));
  const knownFields = new Set([...requiredFields, ...template.optionalFields.map(asString)]);
  const resolvedFields = {};
  for (const field of knownFields) {
    if (asString(supplied[field])) resolvedFields[field] = asString(supplied[field]);
  }
  return {
    template,
    resolvedFields,
    missingRequired,
    valid: missingRequired.length === 0,
    unresolvedPlaceholders: template.placeholders
      ? template.placeholders.filter((field) => !asString(supplied[field]))
      : [],
  };
}

function validateTemplate(id, values = {}) {
  const resolved = resolveTemplate(id, values);
  if (!resolved) return { valid: false, errors: ['Template not found'] };
  return {
    valid: resolved.valid,
    errors: resolved.missingRequired.map((field) => `Missing required field: ${field}`),
    templateId: resolved.template.id,
  };
}

module.exports = {
  TEMPLATE_TYPES,
  CATALOG_PATH,
  loadCatalog,
  listTemplates,
  getTemplate,
  select: selectTemplate,
  resolve: resolveTemplate,
  validate: validateTemplate,
  extractPlaceholders,
  applyPlaceholders,
  validateCatalog,
};
