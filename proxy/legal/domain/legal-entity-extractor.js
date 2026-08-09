/**
 * Legal Entity Extractor — Extracts structured legal entities from Vietnamese legal queries.
 * Recognizes: document types, document numbers (full, partial, bare), articles, clauses,
 * points, chapters, sections, issuers, years, and topics.
 */
const { normalizeVietnamese } = require('./normalize-vietnamese');

const DOCUMENT_TYPE_PATTERNS = [
  { type: 'luat', label: 'Luật', patterns: ['luat', 'bo luat'], issuerCodes: ['QH'] },
  { type: 'nghi_dinh', label: 'Nghị định', patterns: ['nghi dinh'], issuerCodes: ['ND-CP', 'NĐ-CP'] },
  { type: 'thong_tu', label: 'Thông tư', patterns: ['thong tu'], issuerCodes: ['TT'] },
  { type: 'quyet_dinh', label: 'Quyết định', patterns: ['quyet dinh'], issuerCodes: ['QD'] },
  { type: 'nghi_quyet', label: 'Nghị quyết', patterns: ['nghi quyet'], issuerCodes: ['NQ'] },
  { type: 'cong_van', label: 'Công văn', patterns: ['cong van'], issuerCodes: [] },
  { type: 'chi_thi', label: 'Chỉ thị', patterns: ['chi thi'], issuerCodes: ['CT'] },
  { type: 'thong_bao', label: 'Thông báo', patterns: ['thong bao'], issuerCodes: [] },
  { type: 'thong_tu_lien_tich', label: 'Thông tư liên tịch', patterns: ['thong tu lien tich'], issuerCodes: ['TTLT'] },
  { type: 'phap_lenh', label: 'Pháp lệnh', patterns: ['phap lenh'], issuerCodes: ['PL'] },
];

const ISSUER_PATTERNS = [
  { id: 'quoc_hoi', label: 'Quốc hội', patterns: ['quoc hoi', 'qh'] },
  { id: 'chinh_phu', label: 'Chính phủ', patterns: ['chinh phu', 'cp'] },
  { id: 'thu_tuong', label: 'Thủ tướng Chính phủ', patterns: ['thu tuong', 'ttg', 'ttcp'] },
  { id: 'bo', label: 'Bộ', patterns: ['bo '] },
  { id: 'ubnd', label: 'UBND', patterns: ['ubnd', 'uy ban nhan dan'] },
  { id: 'hdnd', label: 'HĐND', patterns: ['hdnd', 'hoi dong nhan dan'] },
];

function extractDocumentNumbers(query = '') {
  const numbers = [];
  const regex = /(\d{1,4})\s*\/\s*(\d{4})\s*\/\s*([A-Za-zĐđ\-]+\d*)/g;
  let match;
  while ((match = regex.exec(query)) !== null) {
    numbers.push({
      raw: match[0].replace(/\s/g, ''),
      number: match[1],
      year: match[2],
      issuerCode: match[3].toUpperCase(),
      normalized: `${match[1]}/${match[2]}/${match[3].toUpperCase()}`,
      type: 'full',
    });
  }
  return numbers;
}

function extractPartialDocumentNumbers(query = '') {
  const partials = [];
  const regex = /\b(\d{1,4})\s*\/\s*(\d{4})\b(?!\s*\/)/g;
  let match;
  while ((match = regex.exec(query)) !== null) {
    partials.push({
      raw: match[0].replace(/\s/g, ''),
      number: match[1],
      year: match[2],
      normalized: `${match[1]}/${match[2]}`,
      type: 'partial',
    });
  }
  return partials;
}

function extractBareDocumentNumberCandidates(query = '') {
  const candidates = [];
  const norm = normalizeVietnamese(query);

  const patterns = [
    { regex: /(?:luat|bo luat)\s+(?:so\s+)?(\d{1,4})\b/gi, docType: 'luat' },
    { regex: /(?:nghi\s+dinh)\s+(?:so\s+)?(\d{1,4})\b/gi, docType: 'nghi_dinh' },
    { regex: /(?:thong\s+tu)\s+(?:so\s+)?(\d{1,4})\b/gi, docType: 'thong_tu' },
    { regex: /(?:quyet\s+dinh)\s+(?:so\s+)?(\d{1,4})\b/gi, docType: 'quyet_dinh' },
    { regex: /(?:nghi\s+quyet)\s+(?:so\s+)?(\d{1,4})\b/gi, docType: 'nghi_quyet' },
    { regex: /(?:chi\s+thi)\s+(?:so\s+)?(\d{1,4})\b/gi, docType: 'chi_thi' },
    { regex: /(?:phap\s+lenh)\s+(?:so\s+)?(\d{1,4})\b/gi, docType: 'phap_lenh' },
    { regex: /(?:cong\s+van)\s+(?:so\s+)?(\d{1,4})\b/gi, docType: 'cong_van' },
  ];

  for (const { regex, docType } of patterns) {
    let m;
    while ((m = regex.exec(norm)) !== null) {
      candidates.push({
        number: m[1],
        docType,
        raw: m[0],
        type: 'bare',
      });
    }
  }

  return candidates;
}

function extractArticleReferences(query = '') {
  const refs = [];
  const norm = normalizeVietnamese(query);

  const dieuRegex = /dieu\s+(\d+[a-z]?)/gi;
  let m;
  while ((m = dieuRegex.exec(norm)) !== null) {
    refs.push({ type: 'article', value: m[1], raw: m[0] });
  }

  const khoanRegex = /khoan\s+(\d+)/gi;
  while ((m = khoanRegex.exec(norm)) !== null) {
    refs.push({ type: 'clause', value: m[1], raw: m[0] });
  }

  const diemRegex = /diem\s+([a-zđ])/gi;
  while ((m = diemRegex.exec(norm)) !== null) {
    refs.push({ type: 'point', value: m[1], raw: m[0] });
  }

  const chuongRegex = /chuong\s+([ivxlcdm]+|\d+)/gi;
  while ((m = chuongRegex.exec(norm)) !== null) {
    refs.push({ type: 'chapter', value: m[1], raw: m[0] });
  }

  const mucRegex = /muc\s+(\d+)/gi;
  while ((m = mucRegex.exec(norm)) !== null) {
    refs.push({ type: 'section', value: m[1], raw: m[0] });
  }

  return refs;
}

function detectDocumentType(query = '') {
  const norm = normalizeVietnamese(query);
  for (const dt of DOCUMENT_TYPE_PATTERNS) {
    for (const p of dt.patterns) {
      if (norm.includes(p)) {
        return { type: dt.type, label: dt.label };
      }
    }
  }
  return null;
}

function detectIssuer(query = '') {
  const norm = normalizeVietnamese(query);
  for (const iss of ISSUER_PATTERNS) {
    for (const p of iss.patterns) {
      if (norm.includes(p)) {
        return { id: iss.id, label: iss.label };
      }
    }
  }
  return null;
}

function extractYears(query = '') {
  const years = [];
  const regex = /\b(19\d{2}|20\d{2})\b/g;
  let m;
  while ((m = regex.exec(query)) !== null) {
    years.push(parseInt(m[1], 10));
  }
  return [...new Set(years)];
}

function extractTopicKeywords(query = '') {
  const norm = normalizeVietnamese(query);
  const topics = [];

  const topicPatterns = [
    { keyword: 'chinh quyen dia phuong', topic: 'chính quyền địa phương' },
    { keyword: 'dat dai', topic: 'đất đai' },
    { keyword: 'lao dong', topic: 'lao động' },
    { keyword: 'moi truong', topic: 'môi trường' },
    { keyword: 'thue', topic: 'thuế' },
    { keyword: 'ngan sach', topic: 'ngân sách' },
    { keyword: 'giao duc', topic: 'giáo dục' },
    { keyword: 'an ninh mang', topic: 'an ninh mạng' },
    { keyword: 'bao hiem', topic: 'bảo hiểm' },
    { keyword: 'doanh nghiep', topic: 'doanh nghiệp' },
    { keyword: 'quang cao', topic: 'quảng cáo' },
    { keyword: 'hoa chat', topic: 'hóa chất' },
    { keyword: 'duong sat', topic: 'đường sắt' },
    { keyword: 'du lieu ca nhan', topic: 'dữ liệu cá nhân' },
  ];

  for (const { keyword, topic } of topicPatterns) {
    if (norm.includes(keyword)) {
      topics.push(topic);
    }
  }

  return topics;
}

function extractLegalEntities(query = '') {
  if (!query || typeof query !== 'string') {
    return {
      documentNumbers: [],
      partialDocumentNumbers: [],
      bareNumberCandidates: [],
      articleReferences: [],
      documentType: null,
      issuer: null,
      years: [],
      topics: [],
      hasDocumentRef: false,
      hasPartialRef: false,
      hasBareNumberRef: false,
      hasArticleRef: false,
    };
  }

  const documentNumbers = extractDocumentNumbers(query);
  const partialDocumentNumbers = extractPartialDocumentNumbers(query);
  const bareNumberCandidates = extractBareDocumentNumberCandidates(query);
  const articleReferences = extractArticleReferences(query);
  const documentType = detectDocumentType(query);
  const issuer = detectIssuer(query);
  const years = extractYears(query);
  const topics = extractTopicKeywords(query);

  return {
    documentNumbers,
    partialDocumentNumbers,
    bareNumberCandidates,
    articleReferences,
    documentType,
    issuer,
    years,
    topics,
    hasDocumentRef: documentNumbers.length > 0,
    hasPartialRef: partialDocumentNumbers.length > 0,
    hasBareNumberRef: bareNumberCandidates.length > 0,
    hasArticleRef: articleReferences.length > 0,
  };
}

module.exports = {
  DOCUMENT_TYPE_PATTERNS,
  ISSUER_PATTERNS,
  extractDocumentNumbers,
  extractPartialDocumentNumbers,
  extractBareDocumentNumberCandidates,
  extractArticleReferences,
  detectDocumentType,
  detectIssuer,
  extractYears,
  extractTopicKeywords,
  extractLegalEntities,
};
