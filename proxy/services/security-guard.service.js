/**
 * VBAI Security Guard Service (Security-by-design — QĐ 1425/QĐ-TTg & NQ 57-NQ/TW)
 * 1. Phát hiện & chặn cứng văn bản có dấu MẬT / TỐI MẬT / TUYỆT MẬT trước khi gửi lên AI cloud.
 * 2. Che ẩn dữ liệu cá nhân nhạy cảm (PII: CCCD 12 số, SĐT di động, STK ngân hàng).
 */
'use strict';

// Mẫu nhận diện dấu độ mật thực tế trên văn bản (tránh nhầm với câu hỏi chung về "bảo mật", "văn bản mật")
const CLASSIFIED_PATTERNS = [
  { level: 'TUYỆT MẬT', regex: /(?:^|[\n\r\s\[\(])TUYỆT\s+MẬT(?:\s*[\]\)]|\s*$|\s*[:\-])/m },
  { level: 'TỐI MẬT', regex: /(?:^|[\n\r\s\[\(])TỐI\s+MẬT(?:\s*[\]\)]|\s*$|\s*[:\-])/m },
  { level: 'MẬT', regex: /(?:ĐỘ\s*MẬT|DẤU\s*ĐỘ\s*MẬT)\s*[:\-]\s*(?:MẬT|TỐI\s*MẬT|TUYỆT\s*MẬT)/i },
  { level: 'MẬT', regex: /(?:^|[\n\r])\s*[\[\(]?\s*MẬT\s*[\]\)]?\s*(?:$|[\n\r])/m },
  { level: 'MẬT', regex: /Số\s*[:.]?\s*\d{1,5}(?:\s*-\s*|\s*\/\s*)[A-ZĐ0-9-]+-(?:M|TM|TUM)\b/i },
  { level: 'MẬT', regex: /(?:^|[\n\r])\s*TÀI\s+LIỆU\s+(?:MẬT|TỐI\s+MẬT|TUYỆT\s+MẬT)\b/im },
];

// Mẫu nhận diện PII nhạy cảm
const CCCD_REGEX = /\b(0[0-9]{2}[0-9]{9})\b/g; // CCCD 12 chữ số bắt đầu bằng mã tỉnh 0xx
const PHONE_VN_REGEX = /(?<!\d)(?:\+84|84|0)(?:3[2-9]|5[25689]|7[06-9]|8[1-9]|9[0-9])\d{7}(?!\d)/g;
const BANK_ACCOUNT_REGEX = /(?:STK|số\s+tài\s+khoản|tài\s+khoản\s+ngân\s+hàng)\s*[:\-]?\s*(\d{8,18})\b/gi;

function extractTextFromContent(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter((part) => part && part.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text)
      .join('\n');
  }
  return '';
}

/**
 * Kiểm tra xem văn bản có chứa dấu hiệu tài liệu mật hay không.
 * @param {string} text
 * @returns {{ blocked: boolean, level: string|null, reason: string|null }}
 */
function detectClassifiedContent(text = '') {
  const input = String(text || '');
  if (!input.trim()) return { blocked: false, level: null, reason: null };

  for (const rule of CLASSIFIED_PATTERNS) {
    if (rule.regex.test(input)) {
      return {
        blocked: true,
        level: rule.level,
        reason: `Phát hiện dấu hiệu tài liệu thuộc độ mật "${rule.level}". Theo quy định bảo vệ bí mật nhà nước và Khung kiến trúc quốc gia số (QĐ 1425/QĐ-TTg), hệ thống tự động chặn không gửi nội dung này lên mô hình AI đám mây.`,
      };
    }
  }

  return { blocked: false, level: null, reason: null };
}

/**
 * Che ẩn dữ liệu cá nhân nhạy cảm (CCCD, SĐT, STK) trước khi gửi ra AI cloud.
 * @param {string} text
 * @returns {{ text: string, maskedCount: number, types: string[] }}
 */
function maskSensitivePII(text = '') {
  let out = String(text || '');
  if (!out) return { text: out, maskedCount: 0, types: [] };

  let maskedCount = 0;
  const types = new Set();

  out = out.replace(BANK_ACCOUNT_REGEX, (full, digits) => {
    maskedCount += 1;
    types.add('STK');
    return full.replace(digits, '[STK_ĐÃ_ẨN]');
  });

  out = out.replace(CCCD_REGEX, () => {
    maskedCount += 1;
    types.add('CCCD');
    return '[CCCD_ĐÃ_ẨN]';
  });

  out = out.replace(PHONE_VN_REGEX, () => {
    maskedCount += 1;
    types.add('SDT');
    return '[SĐT_ĐÃ_ẨN]';
  });

  return { text: out, maskedCount, types: [...types] };
}

/**
 * Quét & lọc toàn bộ mảng messages (chỉ kiểm tra tin nhắn user để tránh chặn system prompt).
 * @param {Array} messages
 * @returns {{ blocked: boolean, level: string|null, reason: string|null, messages: Array, piiMaskedCount: number, piiTypes: string[] }}
 */
function guardMessagesForCloudAI(messages = []) {
  if (!Array.isArray(messages)) {
    return { blocked: false, level: null, reason: null, messages: [], piiMaskedCount: 0, piiTypes: [] };
  }

  let totalPii = 0;
  const piiTypes = new Set();
  const sanitized = [];

  for (const msg of messages) {
    if (!msg || typeof msg !== 'object') {
      sanitized.push(msg);
      continue;
    }
    const role = String(msg.role || '').toLowerCase();
    if (role !== 'user') {
      sanitized.push(msg);
      continue;
    }

    const rawText = extractTextFromContent(msg.content);
    const classified = detectClassifiedContent(rawText);
    if (classified.blocked) {
      return {
        blocked: true,
        level: classified.level,
        reason: classified.reason,
        messages: [],
        piiMaskedCount: totalPii,
        piiTypes: [...piiTypes],
      };
    }

    if (typeof msg.content === 'string') {
      const masked = maskSensitivePII(msg.content);
      totalPii += masked.maskedCount;
      masked.types.forEach((t) => piiTypes.add(t));
      sanitized.push({ ...msg, content: masked.text });
    } else if (Array.isArray(msg.content)) {
      const nextParts = msg.content.map((part) => {
        if (part && part.type === 'text' && typeof part.text === 'string') {
          const masked = maskSensitivePII(part.text);
          totalPii += masked.maskedCount;
          masked.types.forEach((t) => piiTypes.add(t));
          return { ...part, text: masked.text };
        }
        return part;
      });
      sanitized.push({ ...msg, content: nextParts });
    } else {
      sanitized.push(msg);
    }
  }

  return {
    blocked: false,
    level: null,
    reason: null,
    messages: sanitized,
    piiMaskedCount: totalPii,
    piiTypes: [...piiTypes],
  };
}

module.exports = {
  detectClassifiedContent,
  maskSensitivePII,
  guardMessagesForCloudAI,
};
