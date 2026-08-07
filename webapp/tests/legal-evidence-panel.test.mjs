import assert from 'node:assert/strict';
import { renderEvidenceCard } from '../modules/evidence-panel.js';

console.log('[TEST] Running Legal Evidence Panel Tests...');

// 1. Test verified evidence card rendering
const verifiedDoc = {
  documentNumber: '30/2020/NĐ-CP',
  title: 'Nghị định về công tác văn thư',
  article: '15',
  clause: '1',
  snippet: 'Văn bản hành chính phải đúng thể thức',
  sourceTier: 'official',
  verified: true,
  effectiveStatus: 'ACTIVE',
  url: 'https://vbpl.vn/doc/30-2020-ND-CP'
};

const cardHtml = renderEvidenceCard(verifiedDoc, 1);

assert.ok(cardHtml.includes('30/2020/NĐ-CP'), 'Card must render document number');
assert.ok(cardHtml.includes('✓ Đã kiểm chứng'), 'Verified card MUST render ✓ Đã kiểm chứng badge');
assert.ok(cardHtml.includes('🏛️ Nguồn chính thức'), 'Official source card MUST render official source chip');
assert.ok(cardHtml.includes('is-verified'), 'Card must have is-verified CSS class');

// 2. Test unverified evidence card rendering
const unverifiedDoc = {
  documentNumber: '99/2024/TT-BTP',
  title: 'Thông tư tham khảo',
  sourceTier: 'reference',
  verified: false,
  effectiveStatus: 'ACTIVE'
};

const unverifiedHtml = renderEvidenceCard(unverifiedDoc, 2);

assert.ok(!unverifiedHtml.includes('✓ Đã kiểm chứng'), 'Unverified card MUST NOT render ✓ Đã kiểm chứng badge');
assert.ok(unverifiedHtml.includes('Tham khảo'), 'Unverified card MUST render Tham khảo badge');

console.log('PASS: Legal evidence card rendering verified.');
