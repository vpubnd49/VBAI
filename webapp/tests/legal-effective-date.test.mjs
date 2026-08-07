import assert from 'node:assert/strict';
import { formatLegalAnswer } from '../modules/legal/answer-formatter.js';

console.log('[TEST] Running Legal Effective Date & Structured Answer Tests...');

const answerText = 'Quy định áp dụng theo Nghị định 30/2020/NĐ-CP.';
const bundleObj = {
  documents: [
    { documentNumber: '30/2020/NĐ-CP', title: 'Nghị định 30/2020/NĐ-CP', sourceTier: 'official', verified: true, effectiveStatus: 'ACTIVE' }
  ],
  verificationLevel: 'VERIFIED',
  officialSourcesCount: 1
};

const warnings = ['Văn bản 12/2010/NĐ-CP đã HẾT HIỆU LỰC từ 05/03/2020'];

const formatted = formatLegalAnswer(answerText, bundleObj, warnings);

assert.ok(formatted.includes('legal-answer-wrapper'), 'Must format inside legal-answer-wrapper');
assert.ok(formatted.includes('legal-warning-banner'), 'Must include warning banner when warnings are provided');
assert.ok(formatted.includes('HẾT HIỆU LỰC'), 'Warning text must accurately preserve effective status');
assert.ok(formatted.includes('Đã xác thực nguồn chính thức'), 'Must display verified sources level badge');

console.log('PASS: Legal effective date and answer formatting verified.');
