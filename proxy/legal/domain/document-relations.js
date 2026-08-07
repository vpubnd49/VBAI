/**
 * Legal document relationships (amends, replaces, superseded_by).
 */
const { normalizeVietnamese } = require('./normalize-vietnamese');
const { extractFullDocumentNumber } = require('./document-number');

function parseDocumentRelations(text = '') {
  const norm = normalizeVietnamese(text);
  const relations = {
    replaces: [],
    amends: [],
    supersededBy: [],
    repeals: [],
  };

  const replacesMatch = text.match(/(?:thay thế|thay the cho)\s+([A-Za-z0-9\/\s.,-]+)/i);
  if (replacesMatch) {
    const num = extractFullDocumentNumber(replacesMatch[1]);
    if (num && !relations.replaces.includes(num)) relations.replaces.push(num);
  }

  const amendsMatch = text.match(/(?:sửa đổi, bổ sung|sua doi bo sung|sua doi|sửa đổi)\s+([A-Za-z0-9\/\s.,-]+)/i);
  if (amendsMatch) {
    const num = extractFullDocumentNumber(amendsMatch[1]);
    if (num && !relations.amends.includes(num)) relations.amends.push(num);
  }

  const supersededMatch = text.match(/(?:bị thay thế bởi|bi thay the boi|bi bai bo boi|bị bãi bỏ bởi)\s+([A-Za-z0-9\/\s.,-]+)/i);
  if (supersededMatch) {
    const num = extractFullDocumentNumber(supersededMatch[1]);
    if (num && !relations.supersededBy.includes(num)) relations.supersededBy.push(num);
  }

  const repealsMatch = text.match(/(?:bãi bỏ|bai bo)\s+([A-Za-z0-9\/\s.,-]+)/i);
  if (repealsMatch) {
    const num = extractFullDocumentNumber(repealsMatch[1]);
    if (num && !relations.repeals.includes(num)) relations.repeals.push(num);
  }

  return relations;
}

module.exports = {
  parseDocumentRelations,
};
