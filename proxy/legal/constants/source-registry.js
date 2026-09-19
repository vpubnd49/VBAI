/**
 * Canonical registry for legal search sources and their user-facing aliases.
 */
const SOURCE_REGISTRY = Object.freeze({
  phapluat_gov: Object.freeze({
    id: 'phapluat_gov',
    source: 'phapluat.gov.vn',
    sourceKind: 'official',
    tier: 2,
    allowedHosts: Object.freeze(['phapluat.gov.vn']),
    aliases: Object.freeze([
      'trung ương', 'trung uong', 'luật', 'nghị định', 'thông tư',
      'chính phủ', 'quốc hội', 'bộ tư pháp', 'phapluat.gov.vn', 'vbqppl',
      'phapluat_gov',
    ]),
  }),
});

function normalizeSourceAlias(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^www\./, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

function resolveSourceAlias(value = '') {
  const normalized = normalizeSourceAlias(value);
  if (!normalized) return null;
  for (const source of Object.values(SOURCE_REGISTRY)) {
    const aliases = [source.id, source.source, ...source.aliases].map(normalizeSourceAlias);
    if (aliases.includes(normalized)) return source;
  }
  return null;
}

module.exports = { SOURCE_REGISTRY, normalizeSourceAlias, resolveSourceAlias };
