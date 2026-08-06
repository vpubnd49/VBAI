/**
 * Legal document match score & candidate evaluation.
 */
const { normalizeVietnamese } = require('./normalize-vietnamese');
const { extractFullDocumentNumber } = require('./document-number');

const LEGAL_MATCH_PASS_SCORE = 70;

function calculateMatchScore({ queryDocNumber, candidateDocNumber, queryTitle, candidateTitle, sourceTier }) {
  let score = 0;

  if (queryDocNumber && candidateDocNumber) {
    if (queryDocNumber === candidateDocNumber) {
      score += 60;
    } else {
      return 0; // Strict mismatch when numbers differ
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
      reason: 'Best alternative candidate found with partial confidence',
    };
  }
  return null;
}

module.exports = {
  LEGAL_MATCH_PASS_SCORE,
  calculateMatchScore,
  selectBestAlternative,
};
