const assert = require('assert');
const { calculateMatchScore, selectBestAlternative } = require('../../legal/domain/match-score');

function testMatchScore() {
  const scoreExact = calculateMatchScore({
    queryDocNumber: '72/2025/QH15',
    candidateDocNumber: '72/2025/QH15',
    sourceTier: 'official',
  });
  assert.strictEqual(scoreExact >= 80, true);

  const scoreMismatch = calculateMatchScore({
    queryDocNumber: '72/2025/QH15',
    candidateDocNumber: '73/2025/QH15',
    sourceTier: 'official',
  });
  assert.strictEqual(scoreMismatch, 0);

  const bestAlt = selectBestAlternative(
    [
      { documentNumber: '72/2025/QH15', title: 'Luật An ninh mạng', score: 85 },
      { documentNumber: '73/2025/QH15', title: 'Luật khác', score: 45 },
    ],
    'Luật an ninh mạng'
  );
  assert.strictEqual(bestAlt.documentNumber, '72/2025/QH15');

  console.log('PASS match-score.test.cjs');
}

testMatchScore();
