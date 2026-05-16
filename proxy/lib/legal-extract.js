function cleanText(value = '') {
  return String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeHtmlEntities(value = '') {
  let text = String(value || '');
  // Decode multiple times to handle double-encoded entities
  for (let i = 0; i < 3; i += 1) {
    text = text
      .replace(/&nbsp;/gi, ' ')
      .replace(/&/gi, '&')
      .replace(/"/gi, '"')
      .replace(/&apos;/gi, "'")
      .replace(/</gi, '<')
      .replace(/>/gi, '>')
      .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
        const code = parseInt(hex, 16);
        return Number.isFinite(code) ? String.fromCodePoint(code) : '';
      })
      .replace(/&#(\d+);/g, (_, dec) => {
        const code = parseInt(dec, 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : '';
      });
  }
  return text;
}

function filterBoilerplate(text = '') {
  const normalized = String(text || '').toLowerCase();

  // Common boilerplate patterns to remove
  const boilerplatePatterns = [
    // Phone/hotline sections
    /hotline[:\s]*[\d\s-]+/gi,
    /t\u1ed5ng \u0111\u00e0i[:\s]*[\d\s-]+/gi,
    /\u0111\u01b0\u1eddng d\u00e2y n\u00f3ng[:\s]*[\d\s-]+/gi,
    /call center[:\s]*[\d\s-]+/gi,

    // Footer/copyright
    /copyright\s*[\u00a9\u00a9]\s*\d{4}/gi,
    /\u00a9\s*\d{4}\s*.+all\s*rights\s*reserved/i,
    /b\u1ea3n quy\u1ec1n thu\u1ed9c v\u1ec1/gi,

    // Navigation/menu
    /trang\s*ch\u00ednh|trang\s*ch\u1ee7|home\s*page/gi,
    /danh\s*m\u1ee5c|menu/gi,
    /th\u00f4ng\s*tin\s*li\u00ean\s*\u7cfb\u7edf/gi,

    // Website credits
    /ph\u00e1t\s*tri\u1ec3n\s*b\u1edfi|developed\s*by/gi,
    /h\u1ec7\s*th\u1ed1ng\s*th\u00f4ng\s*tin/gi,

    // Contact sections
    /li\u00ean\s*h\u1ec7\s*to\u00e0n\s*\u0111o\u1ea1n|li\u00ean\s*h\u1ec7\s*ban\s*bi\u00ean/gi,
    /g\u00f3p\s*\u00fd|\u00fd\s*ki\u1ebfn\s*b\u1ea1n\s*\u0111\u1ecdc/gi,
  ];

  let filtered = text;
  for (const pattern of boilerplatePatterns) {
    filtered = filtered.replace(pattern, ' ').replace(/\s+/g, ' ').trim();
  }

  return filtered;
}

function parsePositiveInt(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

function parsePointToken(value = '') {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return null;
  const m = raw.match(/^[a-zđ]$/i);
  return m ? m[0] : null;
}

const LEGAL_MARKERS = {
  ARTICLE: '(?:Điều|Dieu|Äiá»u)',
  CLAUSE: '(?:Khoản|Khoan|Khoáº£n)',
  POINT: '(?:Điểm|Diem|Äiá»ƒm)',
  CHAPTER: '(?:Chương|Chuong|ChÆ°Æ¡ng)',
  POINT_LETTER: '[a-zđÄ‘]',
};

function extractStrictLegalText(plain = '', target = {}) {
  const source = filterBoilerplate(cleanText(decodeHtmlEntities(String(plain || ''))));
  const article = parsePositiveInt(target.article);
  const clause = parsePositiveInt(target.clause);
  const point = parsePointToken(target.point);

  let articleText = source;
  let articleFound = false;
  if (article) {
    const articleRegex = new RegExp(
      `${LEGAL_MARKERS.ARTICLE}\\s+${article}\\b[\\s\\S]{0,12000}?(?=${LEGAL_MARKERS.ARTICLE}\\s+\\d+\\b|${LEGAL_MARKERS.CHAPTER}\\s+[IVXLCDM]+\\b|$)`,
      'iu',
    );
    const articleMatch = source.match(articleRegex);
    if (!articleMatch || !articleMatch[0]) {
      return {
        extracted: false,
        strict_match: false,
        article_found: false,
        clause_found: false,
        point_found: false,
        text: '',
      };
    }
    articleText = articleMatch[0];
    articleFound = true;
  }

  let clauseText = articleText;
  let clauseFound = false;
  if (clause) {
    const articleHeadRegex = article
      ? new RegExp(`^\\s*${LEGAL_MARKERS.ARTICLE}\\s+${article}\\b\\s*[.:)]?\\s*`, 'iu')
      : null;
    const articleBody = articleHeadRegex ? articleText.replace(articleHeadRegex, ' ') : articleText;

    const clausePatterns = [
      new RegExp(
        `${LEGAL_MARKERS.CLAUSE}\\s+${clause}\\b[\\s\\S]{0,5000}?(?=${LEGAL_MARKERS.CLAUSE}\\s+\\d+\\b|(?:^|[\\n\\r;])\\s*\\d+\\.|$)`,
        'iu',
      ),
      new RegExp(
        `(?:^|[\\n\\r;])\\s*${clause}\\.\\s*[\\s\\S]{0,5000}?(?=(?:^|[\\n\\r;])\\s*\\d+\\.|$)`,
        'iu',
      ),
      new RegExp(
        `(?:^|\\s)${clause}\\.\\s*[\\s\\S]{0,5000}?(?=(?:\\s)\\d+\\.\\s+|$)`,
        'iu',
      ),
    ];

    let clauseMatch = null;
    for (const pattern of clausePatterns) {
      const matched = articleBody.match(pattern);
      if (matched && matched[0]) {
        clauseMatch = matched;
        break;
      }
    }

    if (!clauseMatch || !clauseMatch[0]) {
      return {
        extracted: false,
        strict_match: false,
        article_found: articleFound || !article,
        clause_found: false,
        point_found: false,
        text: '',
      };
    }
    clauseText = clauseMatch[0];
    clauseFound = true;
  }

  let pointText = clauseText;
  let pointFound = false;
  if (point) {
    const pointHead = `(?:${LEGAL_MARKERS.POINT}\\s+${point}\\)|${point}\\))`;
    const nextPointHead = `(?:${LEGAL_MARKERS.POINT}\\s+${LEGAL_MARKERS.POINT_LETTER}\\)|${LEGAL_MARKERS.POINT_LETTER}\\))`;
    const pointRegex = new RegExp(
      `${pointHead}[\\s\\S]{0,2500}?(?=${nextPointHead}|$)`,
      'iu',
    );
    const pointMatch = clauseText.match(pointRegex);
    if (!pointMatch || !pointMatch[0]) {
      return {
        extracted: false,
        strict_match: false,
        article_found: articleFound || !article,
        clause_found: clauseFound || !clause,
        point_found: false,
        text: '',
      };
    }
    pointText = pointMatch[0];
    pointFound = true;
  }

  const selected = cleanText(point ? pointText : (clause ? clauseText : articleText));
  const strictMatch = (!article || articleFound) && (!clause || clauseFound) && (!point || pointFound) && selected.length > 0;
  return {
    extracted: strictMatch,
    strict_match: strictMatch,
    article_found: article ? articleFound : null,
    clause_found: clause ? clauseFound : null,
    point_found: point ? pointFound : null,
    text: strictMatch ? selected : '',
  };
}

module.exports = {
  cleanText,
  parsePositiveInt,
  parsePointToken,
  extractStrictLegalText,
  decodeHtmlEntities,
  filterBoilerplate,
};
