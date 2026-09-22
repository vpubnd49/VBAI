/**
 * Legal query intent analysis — Enhanced edition.
 * Detects 10+ intent types for nuanced AI prompt construction.
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

// B1: Enhanced intent patterns
const COMPARISON_PATTERNS = [
  'so sanh', 'doi chieu', 'khac nhau giua', 'khac biet',
  'giong nhau', 'thay doi gi', 'diem moi so voi', 'cu va moi',
];

const CONSEQUENCE_PATTERNS = [
  'he qua', 'hau qua', 'trach nhiem', 'xu phat', 'muc phat',
  'boi thuong', 'truy cuu', 'phat tien', 'phat tu', 'xu ly',
  'bi phat', 'muc xu phat', 'khung hinh phat', 'che tai',
];

const PROCEDURE_PATTERNS = [
  'trinh tu', 'thu tuc', 'quy trinh', 'cac buoc', 'ho so',
  'giay to can', 'dieu kien', 'yeu cau', 'nop ho so',
  'thoi han', 'bao lau', 'bao nhieu ngay',
];

const TIMELINE_PATTERNS = [
  'tu ngay nao', 'hieu luc tu', 'bat dau tu', 'ket thuc',
  'chuyen tiep', 'ap dung tu', 'thoi diem', 'moc thoi gian',
  'giai doan', 'lo trinh',
];

const PENALTY_PATTERNS = [
  'xu phat hanh chinh', 'vi pham hanh chinh', 'muc phat',
  'phat tien', 'phat tu', 'truc xuat', 'tich thu',
  'dinh chi', 'cam', 'rut giay phep',
];

const DEFINITION_PATTERNS = [
  'la gi', 'dinh nghia', 'khai niem', 'giai thich tu ngu',
  'the nao la', 'hieu nhu the nao',
];

const DELEGATION_PATTERNS = [
  'uy quyen', 'phan cap', 'phan quyen',
  'tham quyen', 'co quan nao', 'ai co quyen',
];

const LATEST_DOC_PATTERNS = [
  'moi nhat', 'so bao nhieu', 'van ban moi nhat',
  'hien hanh la', 'la so bao nhieu',
];

// --- Intent Types ---
const INTENT_TYPES = {
  GENERAL_SEARCH: 'general_search',
  STRICT_NUMBER: 'strict_number',
  FRESHNESS_SEARCH: 'freshness_search',
  EXTRACT_SEARCH: 'extract_search',
  COMPARISON: 'comparison',
  CONSEQUENCE_ANALYSIS: 'consequence_analysis',
  PROCEDURE_LOOKUP: 'procedure_lookup',
  TIMELINE_CHECK: 'timeline_check',
  PENALTY_LOOKUP: 'penalty_lookup',
  DEFINITION: 'definition',
  DELEGATION_FOCUS: 'delegation_focus',
  LATEST_DOC_LOOKUP: 'latest_doc_lookup',
};

function isFreshnessQuery(query = '') {
  const norm = normalizeVietnamese(query);
  return FRESHNESS_KEYWORDS.some((kw) => norm.includes(kw));
}

function isExtractQuery(query = '') {
  const norm = normalizeVietnamese(query);
  return EXTRACT_KEYWORDS.some((kw) => norm.includes(kw));
}

function matchesPatterns(norm = '', patterns = []) {
  return patterns.some((p) => norm.includes(p));
}

function detectQueryIntent(query = '') {
  const docNumber = extractFullDocumentNumber(query);
  const norm = normalizeVietnamese(query);
  const fresh = isFreshnessQuery(query);
  const extract = isExtractQuery(query);

  // B1: Multi-intent detection — ordered by specificity
  let mode = INTENT_TYPES.GENERAL_SEARCH;
  const intents = [];

  if (docNumber) {
    mode = INTENT_TYPES.STRICT_NUMBER;
    intents.push(INTENT_TYPES.STRICT_NUMBER);
  }

  // Check all secondary intents (can co-exist with strict_number)
  if (matchesPatterns(norm, COMPARISON_PATTERNS)) {
    if (!docNumber) mode = INTENT_TYPES.COMPARISON;
    intents.push(INTENT_TYPES.COMPARISON);
  }
  if (matchesPatterns(norm, CONSEQUENCE_PATTERNS)) {
    if (!docNumber && mode === INTENT_TYPES.GENERAL_SEARCH) mode = INTENT_TYPES.CONSEQUENCE_ANALYSIS;
    intents.push(INTENT_TYPES.CONSEQUENCE_ANALYSIS);
  }
  if (matchesPatterns(norm, PROCEDURE_PATTERNS)) {
    if (!docNumber && mode === INTENT_TYPES.GENERAL_SEARCH) mode = INTENT_TYPES.PROCEDURE_LOOKUP;
    intents.push(INTENT_TYPES.PROCEDURE_LOOKUP);
  }
  if (matchesPatterns(norm, TIMELINE_PATTERNS)) {
    if (!docNumber && mode === INTENT_TYPES.GENERAL_SEARCH) mode = INTENT_TYPES.TIMELINE_CHECK;
    intents.push(INTENT_TYPES.TIMELINE_CHECK);
  }
  if (matchesPatterns(norm, PENALTY_PATTERNS)) {
    if (!docNumber && mode === INTENT_TYPES.GENERAL_SEARCH) mode = INTENT_TYPES.PENALTY_LOOKUP;
    intents.push(INTENT_TYPES.PENALTY_LOOKUP);
  }
  if (matchesPatterns(norm, DEFINITION_PATTERNS)) {
    if (!docNumber && mode === INTENT_TYPES.GENERAL_SEARCH) mode = INTENT_TYPES.DEFINITION;
    intents.push(INTENT_TYPES.DEFINITION);
  }
  if (matchesPatterns(norm, DELEGATION_PATTERNS)) {
    if (!docNumber && mode === INTENT_TYPES.GENERAL_SEARCH) mode = INTENT_TYPES.DELEGATION_FOCUS;
    intents.push(INTENT_TYPES.DELEGATION_FOCUS);
  }
  if (matchesPatterns(norm, LATEST_DOC_PATTERNS)) {
    if (!docNumber && mode === INTENT_TYPES.GENERAL_SEARCH) mode = INTENT_TYPES.LATEST_DOC_LOOKUP;
    intents.push(INTENT_TYPES.LATEST_DOC_LOOKUP);
  }

  // Fallback to legacy classification
  if (mode === INTENT_TYPES.GENERAL_SEARCH) {
    if (fresh) {
      mode = INTENT_TYPES.FRESHNESS_SEARCH;
      intents.push(INTENT_TYPES.FRESHNESS_SEARCH);
    } else if (extract) {
      mode = INTENT_TYPES.EXTRACT_SEARCH;
      intents.push(INTENT_TYPES.EXTRACT_SEARCH);
    }
  }

  return {
    query,
    mode,
    intents,  // B1: Array of ALL detected intents (multi-intent)
    docNumber,
    isFreshness: fresh,
    isExtract: extract,
    isComparison: intents.includes(INTENT_TYPES.COMPARISON),
    isConsequence: intents.includes(INTENT_TYPES.CONSEQUENCE_ANALYSIS),
    isProcedure: intents.includes(INTENT_TYPES.PROCEDURE_LOOKUP),
    isTimeline: intents.includes(INTENT_TYPES.TIMELINE_CHECK),
    isPenalty: intents.includes(INTENT_TYPES.PENALTY_LOOKUP),
    isDefinition: intents.includes(INTENT_TYPES.DEFINITION),
    isDelegation: intents.includes(INTENT_TYPES.DELEGATION_FOCUS),
    isLatestDoc: intents.includes(INTENT_TYPES.LATEST_DOC_LOOKUP),
  };
}

module.exports = {
  INTENT_TYPES,
  FRESHNESS_KEYWORDS,
  EXTRACT_KEYWORDS,
  isFreshnessQuery,
  isExtractQuery,
  detectQueryIntent,
};
