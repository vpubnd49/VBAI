function cleanText(value = '') {
  return String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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
  const source = String(plain || '');
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
      ? new RegExp(`^\\s*${LEGAL_MARKERS.ARTICLE}\\s+${article}\\b[^\\n\\r]{0,300}`, 'iu')
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
};
