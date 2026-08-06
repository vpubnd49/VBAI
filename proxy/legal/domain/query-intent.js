/**
 * Legal query intent analysis.
 */
const { normalizeVietnamese } = require('./normalize-vietnamese');
const { extractFullDocumentNumber } = require('./document-number');

const FRESHNESS_KEYWORDS = [
  'moi nhat',
  'hien hanh',
  'hieu luc',
  'sua doi',
  'thay the',
  'bai bo',
  'ngung hieu luc',
  'con hieu luc',
  'het hieu luc',
  'moi nhat nam',
];

const EXTRACT_KEYWORDS = [
  'dieu',
  'khoan',
  'diem',
  'trich',
  'trich dieu',
  'noi dung dieu',
];

function isFreshnessQuery(query = '') {
  const norm = normalizeVietnamese(query);
  return FRESHNESS_KEYWORDS.some((kw) => norm.includes(kw));
}

function isExtractQuery(query = '') {
  const norm = normalizeVietnamese(query);
  return EXTRACT_KEYWORDS.some((kw) => norm.includes(kw));
}

function detectQueryIntent(query = '') {
  const docNumber = extractFullDocumentNumber(query);
  const fresh = isFreshnessQuery(query);
  const extract = isExtractQuery(query);

  let mode = 'general_search';
  if (docNumber) {
    mode = 'strict_number';
  } else if (fresh) {
    mode = 'freshness_search';
  } else if (extract) {
    mode = 'extract_search';
  }

  return {
    query,
    mode,
    docNumber,
    isFreshness: fresh,
    isExtract: extract,
  };
}

module.exports = {
  FRESHNESS_KEYWORDS,
  EXTRACT_KEYWORDS,
  isFreshnessQuery,
  isExtractQuery,
  detectQueryIntent,
};
