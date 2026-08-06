import assert from 'node:assert/strict';
import { formatLegalAnswer } from '../modules/legal/answer-formatter.js';

const formatted = formatLegalAnswer('Nội dung trả lời', [{ title: 'VBPL', url: 'https://vbpl.vn' }], ['Cảnh báo test']);
assert.ok(formatted.includes('Nội dung trả lời'));
assert.ok(formatted.includes('CẢNH BÁO PHÁP LÝ'));
assert.ok(formatted.includes('VBPL'));

console.log('PASS legal-answer-formatter.test.mjs');
