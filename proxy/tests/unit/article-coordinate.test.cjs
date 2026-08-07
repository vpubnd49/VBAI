/**
 * Unit Test: Article Coordinate Domain Parser.
 */
const assert = require('assert');
const { parseArticleCoordinate, formatArticleCoordinate } = require('../../legal/domain/article-coordinate');

function runArticleCoordinateTests() {
  console.log('[Test Suite]: Legal Article Coordinate Parsing');

  // Test 1: Full coordinate (Point, Clause, Article)
  const res1 = parseArticleCoordinate('Căn cứ điểm a khoản 2 điều 15 Nghị định 30/2020/NĐ-CP');
  assert.strictEqual(res1.article, '15');
  assert.strictEqual(res1.clause, '2');
  assert.strictEqual(res1.point, 'a');
  console.log('  ✔ Test 1 PASS: Full coordinate (Điểm a Khoản 2 Điều 15)');

  // Test 2: Clause and Article
  const res2 = parseArticleCoordinate('Theo khoản 3 điều 20 Luật Ngân sách');
  assert.strictEqual(res2.article, '20');
  assert.strictEqual(res2.clause, '3');
  assert.strictEqual(res2.point, null);
  console.log('  ✔ Test 2 PASS: Clause and Article (Khoản 3 Điều 20)');

  // Test 3: Article only
  const res3 = parseArticleCoordinate('Quy định tại Điều 10');
  assert.strictEqual(res3.article, '10');
  assert.strictEqual(res3.clause, null);
  assert.strictEqual(res3.point, null);
  console.log('  ✔ Test 3 PASS: Article only (Điều 10)');

  // Test 4: Formatter
  const formatted = formatArticleCoordinate({ article: '15', clause: '2', point: 'a' });
  assert.strictEqual(formatted, 'Điểm a Khoản 2 Điều 15');
  console.log('  ✔ Test 4 PASS: Formatter (Điểm a Khoản 2 Điều 15)');

  console.log('[ALL ARTICLE COORDINATE TESTS PASSED]\n');
}

runArticleCoordinateTests();
