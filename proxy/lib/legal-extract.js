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

function extractStrictLegalText(plain = '', target = {}) {
  const source = String(plain || '');
  const article = parsePositiveInt(target.article);
  const clause = parsePositiveInt(target.clause);
  const point = parsePointToken(target.point);

  let articleText = source;
  let articleFound = false;
  if (article) {
    const articleRegex = new RegExp(
      `(?:^|\\n|\\r)\\s*Điều\\s+${article}\\b[\\s\\S]{0,9000}?(?=(?:\\n|\\r)\\s*Điều\\s+\\d+\\b|(?:\\n|\\r)\\s*Chương\\s+[IVXLCDM]+\\b|$)`,
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
    const clauseHead = `(?:Khoản|Khoan)\\s+${clause}\\b|${clause}\\.`;
    const nextClauseHead = `(?:Khoản|Khoan)\\s+\\d+\\b|\\d+\\.`;
    const clauseRegex = new RegExp(
      `(?:^|\\n|\\r)\\s*(?:${clauseHead})\\s*[\\s\\S]{0,3500}?(?=(?:\\n|\\r)\\s*(?:${nextClauseHead})\\s+|$)`,
      'iu',
    );
    const clauseMatch = articleText.match(clauseRegex);
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
    const pointHead = `(?:Điểm|Diem)\\s+${point}\\)|${point}\\)`;
    const nextPointHead = `(?:Điểm|Diem)\\s+[a-zđ]\\)|[a-zđ]\\)`;
    const pointRegex = new RegExp(
      `(?:^|\\n|\\r)\\s*(?:${pointHead})\\s*[\\s\\S]{0,1800}?(?=(?:\\n|\\r)\\s*(?:${nextPointHead})\\s+|$)`,
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
