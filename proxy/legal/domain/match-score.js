/**
 * Legal document match score & candidate evaluation — Enhanced edition.
 * B2: Adds fuzzy matching via n-gram similarity alongside exact matching.
 */
const { normalizeVietnamese } = require('./normalize-vietnamese');
const { extractFullDocumentNumber } = require('./document-number');

const LEGAL_MATCH_PASS_SCORE = 70;

/**
 * B2: Calculate n-gram similarity between two strings (bigram-based Dice coefficient).
 * Returns a value between 0 and 1.
 */
function ngramSimilarity(a = '', b = '', n = 2) {
  const strA = String(a || '').toLowerCase().trim();
  const strB = String(b || '').toLowerCase().trim();
  if (!strA || !strB) return 0;
  if (strA === strB) return 1;

  function getNgrams(str, size) {
    const ngrams = new Set();
    for (let i = 0; i <= str.length - size; i++) {
      ngrams.add(str.slice(i, i + size));
    }
    return ngrams;
  }

  const ngramsA = getNgrams(strA, n);
  const ngramsB = getNgrams(strB, n);
  if (ngramsA.size === 0 || ngramsB.size === 0) return 0;

  let intersection = 0;
  for (const ng of ngramsA) {
    if (ngramsB.has(ng)) intersection++;
  }

  // Dice coefficient
  return (2 * intersection) / (ngramsA.size + ngramsB.size);
}

/**
 * B2: Levenshtein distance (for short strings like document numbers).
 */
function levenshteinDistance(a = '', b = '') {
  const strA = String(a || '');
  const strB = String(b || '');
  if (strA === strB) return 0;
  if (!strA.length) return strB.length;
  if (!strB.length) return strA.length;

  const matrix = [];
  for (let i = 0; i <= strA.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= strB.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= strA.length; i++) {
    for (let j = 1; j <= strB.length; j++) {
      const cost = strA[i - 1] === strB[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }
  return matrix[strA.length][strB.length];
}

function calculateMatchScore({ queryDocNumber, candidateDocNumber, queryTitle, candidateTitle, sourceTier }) {
  let score = 0;

  if (queryDocNumber && candidateDocNumber) {
    if (queryDocNumber === candidateDocNumber) {
      score += 60;
    } else {
      // B2: Fuzzy match for document numbers (handle typos like "30/2020/ND-CP" vs "30/2020/NĐ-CP")
      const dist = levenshteinDistance(
        String(queryDocNumber).toUpperCase(),
        String(candidateDocNumber).toUpperCase()
      );
      if (dist <= 2) {
        score += 45; // Close match — likely a typo or encoding difference
      } else {
        return 0; // Strict mismatch when numbers significantly differ
      }
    }
  }

  if (sourceTier === 'official') {
    score += 25;
  } else if (sourceTier === 'reference') {
    score += 15;
  }

  if (queryTitle && candidateTitle) {
    const qNorm = normalizeVietnamese(queryTitle);
    const cNorm = normalizeVietnamese(candidateTitle);
    if (qNorm === cNorm) {
      score += 20;
    } else if (qNorm && cNorm && (qNorm.includes(cNorm) || cNorm.includes(qNorm))) {
      score += 10;
    } else {
      // B2: Fuzzy title matching via n-gram similarity
      const similarity = ngramSimilarity(qNorm, cNorm);
      if (similarity >= 0.7) {
        score += 15; // High fuzzy match
      } else if (similarity >= 0.4) {
        score += 7;  // Moderate fuzzy match
      }
    }
  }

  return Math.min(score, 100);
}

function selectBestAlternative(candidates = [], query = '') {
  if (!candidates || candidates.length === 0) return null;
  const sorted = [...candidates].sort((a, b) => (b.score || 0) - (a.score || 0));
  const top = sorted[0];
  if (top && top.score && top.score >= 40) {
    return {
      documentNumber: top.documentNumber || top.so_hieu || null,
      title: top.title || top.trich_yeu || null,
      score: top.score,
      reason: top.score >= LEGAL_MATCH_PASS_SCORE
        ? 'Best matching candidate with high confidence'
        : 'Best alternative candidate found with partial confidence',
    };
  }
  return null;
}

module.exports = {
  LEGAL_MATCH_PASS_SCORE,
  calculateMatchScore,
  selectBestAlternative,
  ngramSimilarity,
  levenshteinDistance,
};
