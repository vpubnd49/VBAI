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
  };

  const replacesMatch = text.match(/(?:thay thế|thay the cho)\s+([A-Za-z0-9\/\s-]+)/i);
  if (replacesMatch) {
    const num = extractFullDocumentNumber(replacesMatch[1]);
    if (num) relations.replaces.push(num);
  }

  const amendsMatch = text.match(/(?:sửa đổi, bổ sung|sua doi bo sung)\s+([A-Za-z0-9\/\s-]+)/i);
  if (amendsMatch) {
    const num = extractFullDocumentNumber(amendsMatch[1]);
    if (num) relations.amends.push(num);
  }

  const supersededMatch = text.match(/(?:bị thay thế bởi|bi thay the boi)\s+([A-Za-z0-9\/\s-]+)/i);
  if (supersededMatch) {
    const num = extractFullDocumentNumber(supersededMatch[1]);
    if (num) relations.supersededBy.push(num);
  }

  return relations;
}

module.exports = {
  parseDocumentRelations,
};
