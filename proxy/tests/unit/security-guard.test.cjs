'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  detectClassifiedContent,
  maskSensitivePII,
  guardMessagesForCloudAI,
} = require('../../services/security-guard.service');

test('detectClassifiedContent blocks TỐI MẬT, TUYỆT MẬT, ĐỘ MẬT, and -M document numbers', () => {
  assert.equal(detectClassifiedContent('TỐI MẬT\nBáo cáo nội bộ').blocked, true);
  assert.equal(detectClassifiedContent('TUYỆT MẬT: Danh sách nhân sự').blocked, true);
  assert.equal(detectClassifiedContent('Độ mật: Mật').blocked, true);
  assert.equal(detectClassifiedContent('Số: 12/UBND-M ngày 23/10/2026').blocked, true);
});

test('detectClassifiedContent allows normal legal/DX queries about security', () => {
  assert.equal(detectClassifiedContent('Luật Bảo vệ bí mật nhà nước quy định những gì?').blocked, false);
  assert.equal(detectClassifiedContent('Hệ thống quản lý văn bản mật của Chính phủ theo QĐ 1425/QĐ-TTg').blocked, false);
});

test('maskSensitivePII masks CCCD 12 digits, VN phone numbers, and bank accounts', () => {
  const res = maskSensitivePII('Ông Nguyễn Văn A, CCCD 068090001234, SĐT 0912345678, STK: 19034567890123.');
  assert.equal(res.maskedCount, 3);
  assert.ok(res.text.includes('[CCCD_ĐÃ_ẨN]'));
  assert.ok(res.text.includes('[SĐT_ĐÃ_ẨN]'));
  assert.ok(res.text.includes('[STK_ĐÃ_ẨN]'));
  assert.ok(!res.text.includes('068090001234'));
  assert.ok(!res.text.includes('0912345678'));
});

test('guardMessagesForCloudAI blocks user classified message and sanitizes PII', () => {
  const blocked = guardMessagesForCloudAI([
    { role: 'system', content: 'System prompt' },
    { role: 'user', content: 'TỐI MẬT\nNội dung mật' },
  ]);
  assert.equal(blocked.blocked, true);

  const safe = guardMessagesForCloudAI([
    { role: 'system', content: 'System prompt' },
    { role: 'user', content: 'Liên hệ cán bộ SĐT 0987654321 về NQ 57' },
  ]);
  assert.equal(safe.blocked, false);
  assert.equal(safe.piiMaskedCount, 1);
  assert.ok(safe.messages[1].content.includes('[SĐT_ĐÃ_ẨN]'));
});
