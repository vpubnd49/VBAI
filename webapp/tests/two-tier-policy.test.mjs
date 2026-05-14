import assert from 'node:assert/strict';
import { enforceTwoTierTerminology, shouldEnforceTwoTierTerminology } from '../modules/legal-two-tier-policy.js';

function normalizeVietnamese(text = '') {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0111/g, 'd');
}

const q = 'mô hình chính quyền địa phương hiện nay';
assert.equal(shouldEnforceTwoTierTerminology(normalizeVietnamese, q), true);
assert.equal(shouldEnforceTwoTierTerminology(normalizeVietnamese, 'câu hỏi khác'), false);

const oldAnswer = 'Mô hình hiện tại tổ chức theo cấp tỉnh, cấp huyện, cấp xã.';
const fixed = enforceTwoTierTerminology({
  answer: oldAnswer,
  query: q,
  normalizeFn: normalizeVietnamese,
  isCitation: false,
  isComparison: false,
});
assert.ok(fixed.includes('cấp tỉnh và cấp xã'));
assert.ok(!fixed.includes('cấp huyện, cấp xã'));

const citationAnswer = 'Trích dẫn nguyên văn: cấp tỉnh, cấp huyện, cấp xã.';
const untouchedCitation = enforceTwoTierTerminology({
  answer: citationAnswer,
  query: q,
  normalizeFn: normalizeVietnamese,
  isCitation: true,
  isComparison: false,
});
assert.equal(untouchedCitation, citationAnswer);

const comparisonAnswer = 'So sánh điều: cấp tỉnh, cấp huyện, cấp xã.';
const untouchedComparison = enforceTwoTierTerminology({
  answer: comparisonAnswer,
  query: q,
  normalizeFn: normalizeVietnamese,
  isCitation: false,
  isComparison: true,
});
assert.equal(untouchedComparison, comparisonAnswer);

console.log('Two-tier policy tests passed.');
