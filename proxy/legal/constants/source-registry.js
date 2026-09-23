/**
 * Canonical registry for legal search sources and their user-facing aliases.
 */
const SOURCE_REGISTRY = Object.freeze({
  chinhphu_gov: Object.freeze({
    id: 'chinhphu_gov',
    source: 'chinhphu.vn',
    sourceKind: 'official',
    tier: 1,
    allowedHosts: Object.freeze(['chinhphu.vn', 'vanban.chinhphu.vn', 'datafiles.chinhphu.vn']),
    aliases: Object.freeze([
      'chính phủ', 'chinh phu', 'cổng chính phủ', 'cong chinh phu',
      'thủ tướng', 'thu tuong', 'chinhphu.vn', 'vanban.chinhphu.vn',
      'quyết định thủ tướng', 'qd-ttg', 'nd-cp', 'ct-ttg',
      'nghị định', 'nghi dinh', 'công điện', 'cong dien',
      'chỉ thị thủ tướng', 'chinhphu_gov',
    ]),
  }),
  phapluat_gov: Object.freeze({
    id: 'phapluat_gov',
    source: 'phapluat.gov.vn',
    sourceKind: 'official',
    tier: 2,
    allowedHosts: Object.freeze(['phapluat.gov.vn']),
    aliases: Object.freeze([
      'trung ương', 'trung uong', 'luật', 'thông tư',
      'quốc hội', 'bộ tư pháp', 'phapluat.gov.vn', 'vbqppl',
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
