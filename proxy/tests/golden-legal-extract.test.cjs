const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { extractStrictLegalText, parsePositiveInt, parsePointToken } = require('../lib/legal-extract');

function loadSample() {
  const p = path.join(__dirname, 'fixtures', 'legal-sample.txt');
  return fs.readFileSync(p, 'utf8');
}

function run() {
  const sample = loadSample();
  const tests = [
    { name: 'parsePositiveInt valid', fn: () => assert.strictEqual(parsePositiveInt('14'), 14) },
    { name: 'parsePositiveInt invalid zero', fn: () => assert.strictEqual(parsePositiveInt('0'), null) },
    { name: 'parsePositiveInt invalid text', fn: () => assert.strictEqual(parsePositiveInt('abc'), null) },
    { name: 'parsePointToken valid a', fn: () => assert.strictEqual(parsePointToken('a'), 'a') },
    { name: 'parsePointToken valid đ', fn: () => assert.strictEqual(parsePointToken('đ'), 'đ') },
    { name: 'parsePointToken invalid', fn: () => assert.strictEqual(parsePointToken('aa'), null) },
  ];

  const strictCases = [
    { article: 1, clause: null, point: null, mustInclude: '02 cấp' },
    { article: 1, clause: 1, point: null, mustInclude: 'được tổ chức thành 02 cấp' },
    { article: 14, clause: null, point: null, mustInclude: 'Điều 14' },
    { article: 14, clause: 1, point: null, mustInclude: 'ủy quyền cho cơ quan hành chính' },
    { article: 14, clause: 2, point: null, mustInclude: 'thực hiện bằng văn bản' },
    { article: 14, clause: 2, point: 'a', mustInclude: 'Cơ quan được ủy quyền chịu trách nhiệm' },
    { article: 14, clause: 2, point: 'b', mustInclude: 'không được ủy quyền lại' },
    { article: 15, clause: 1, point: null, mustInclude: 'nguồn lực và năng lực' },
  ];

  strictCases.forEach((c, idx) => {
    tests.push({
      name: `strict exact #${idx + 1}`,
      fn: () => {
        const out = extractStrictLegalText(sample, c);
        assert.strictEqual(out.strict_match, true);
        assert.ok(String(out.text || '').includes(c.mustInclude), `missing snippet: ${c.mustInclude}`);
      },
    });
  });

  const negativeCases = [
    { article: 99, clause: null, point: null, flag: 'article_found' },
    { article: 14, clause: 9, point: null, flag: 'clause_found' },
    { article: 14, clause: 2, point: 'z', flag: 'point_found' },
  ];

  negativeCases.forEach((c, idx) => {
    tests.push({
      name: `strict negative #${idx + 1}`,
      fn: () => {
        const out = extractStrictLegalText(sample, c);
        assert.strictEqual(out.strict_match, false);
        assert.strictEqual(String(out.text || ''), '');
        if (c.flag && out[c.flag] !== null) {
          assert.strictEqual(out[c.flag], false);
        }
      },
    });
  });

  const followUpMatrix = [
    { article: 14, clause: 2, point: 'a' },
    { article: 14, clause: 2, point: 'b' },
    { article: 14, clause: 1, point: null },
    { article: 1, clause: 1, point: null },
    { article: 15, clause: 1, point: null },
  ];
  for (let i = 0; i < 25; i += 1) {
    const target = followUpMatrix[i % followUpMatrix.length];
    tests.push({
      name: `follow-up strict matrix #${i + 1}`,
      fn: () => {
        const out = extractStrictLegalText(sample, target);
        assert.strictEqual(out.strict_match, true);
        assert.ok(out.text.length > 20);
      },
    });
  }

  let passed = 0;
  for (const t of tests) {
    try {
      t.fn();
      passed += 1;
      process.stdout.write(`PASS ${t.name}\n`);
    } catch (err) {
      process.stderr.write(`FAIL ${t.name}: ${err.message}\n`);
      process.exitCode = 1;
      return;
    }
  }

  process.stdout.write(`\nGolden legal extract tests passed: ${passed}/${tests.length}\n`);
}

run();
