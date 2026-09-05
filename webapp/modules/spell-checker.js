/**
 * spell-checker.js - Kiểm tra chính tả, ngữ pháp, thể thức NĐ30
 * Dùng Gemini AI để phát hiện lỗi trong văn bản tiếng Việt
 */

import { sendChatRequest } from './ai-proxy.js';

const SPELL_CHECK_SYSTEM_PROMPT = `Bạn là chuyên gia kiểm tra chính tả, ngữ pháp tiếng Việt và thể thức văn bản hành chính (Nghị định 30/2020/NĐ-CP).

NHIỆM VỤ: Phân tích văn bản và phát hiện:
1. Lỗi chính tả (sai dấu, viết sai từ, thiếu/thừa chữ)
2. Lỗi ngữ pháp (câu thiếu chủ vị, dùng sai từ loại)
3. Lỗi văn phong hành chính (dùng từ không trang trọng, thiếu kính ngữ)
4. Lỗi thể thức NĐ30 (sai cách viết số, ngày tháng, ký hiệu văn bản, chức danh)

TRẢ VỀ JSON THUẦN (không có markdown code block):
{
  "errors": [
    {
      "wrong": "từ/cụm từ sai trong văn bản GỐC",
      "correct": "từ/cụm từ đúng thay thế",
      "type": "spelling|grammar|style|nd30",
      "reason": "Giải thích ngắn gọn lý do sai",
      "context": "...15 ký tự trước...TỪ SAI...15 ký tự sau..."
    }
  ],
  "score": 95,
  "totalWords": 250,
  "errorCount": 3,
  "summary": "Nhận xét tổng quan về chất lượng văn bản"
}

QUY TẮC QUAN TRỌNG:
- "wrong" phải là chuỗi CHÍNH XÁC xuất hiện trong văn bản gốc (case-sensitive)
- Mỗi lỗi phải có "context" để xác định vị trí khi có nhiều từ giống nhau
- Không báo lỗi với tên riêng, địa danh, viết tắt chuyên ngành
- Chỉ trả JSON, không có văn bản ngoài JSON`;

/**
 * Kiểm tra chính tả một đoạn văn bản
 * @param {string} text - Văn bản cần kiểm tra
 * @param {{ onProgress?: (msg: string) => void }} options
 * @returns {Promise<SpellCheckResult>}
 */
export async function checkSpelling(text, options = {}) {
  const { onProgress = () => {} } = options;

  if (!text || text.trim().length < 10) {
    return { errors: [], score: 100, totalWords: 0, errorCount: 0, summary: 'Văn bản quá ngắn để kiểm tra.' };
  }

  onProgress('🔍 Đang phân tích chính tả và ngữ pháp...');

  const MAX_CHARS = 8000;
  const chunks = [];
  if (text.length > MAX_CHARS) {
    const paragraphs = text.split(/\n{2,}/);
    let current = '';
    for (const para of paragraphs) {
      if ((current + para).length > MAX_CHARS) {
        if (current) chunks.push(current.trim());
        current = para;
      } else {
        current += '\n\n' + para;
      }
    }
    if (current.trim()) chunks.push(current.trim());
  } else {
    chunks.push(text);
  }

  const allErrors = [];
  let totalScore = 0;
  let lastSummary = '';

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    if (chunks.length > 1) {
      onProgress(`🔍 Đang kiểm tra phần ${i + 1}/${chunks.length}...`);
    }
    try {
      const prompt = `Kiểm tra văn bản sau:\n\n${chunk}`;
      const response = await sendChatRequest({
        messages: [{ role: 'user', content: prompt }],
        systemPrompt: SPELL_CHECK_SYSTEM_PROMPT,
        model: 'gemini-2.0-flash',
        temperature: 0.1,
      });

      let rawJson = response.text || response.content || '';
      rawJson = rawJson.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();

      let parsed;
      try {
        parsed = JSON.parse(rawJson);
      } catch (_) {
        const match = rawJson.match(/\{[\s\S]*\}/);
        if (match) parsed = JSON.parse(match[0]);
        else throw new Error('Không parse được JSON từ AI');
      }

      allErrors.push(...(parsed.errors || []));
      totalScore += parsed.score || 100;
      lastSummary = parsed.summary || '';
    } catch (e) {
      console.warn('[SpellChecker] Chunk', i + 1, 'error:', e.message);
    }
  }

  onProgress('✅ Hoàn tất kiểm tra!');

  const seen = new Set();
  const uniqueErrors = allErrors.filter(e => {
    const key = e.wrong + '|' + e.context;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    errors: uniqueErrors,
    score: Math.round(totalScore / Math.max(chunks.length, 1)),
    totalWords: text.split(/\s+/).filter(Boolean).length,
    errorCount: uniqueErrors.length,
    summary: lastSummary,
    originalText: text,
  };
}

/**
 * Render kết quả spell check thành HTML để hiển thị trong chat
 */
export function renderSpellCheckResult(result) {
  const { errors, score, totalWords, errorCount, summary } = result;
  const scoreColor = score >= 90 ? '#059669' : score >= 70 ? '#d97706' : '#dc2626';
  const scoreLabel = score >= 90 ? 'Tốt' : score >= 70 ? 'Trung bình' : 'Cần sửa nhiều';

  const errorsByType = {
    spelling: errors.filter(e => e.type === 'spelling'),
    grammar: errors.filter(e => e.type === 'grammar'),
    style: errors.filter(e => e.type === 'style'),
    nd30: errors.filter(e => e.type === 'nd30'),
  };
  const typeLabels = {
    spelling: '🔤 Chính tả',
    grammar: '📖 Ngữ pháp',
    style: '✍️ Văn phong',
    nd30: '📋 Thể thức NĐ30',
  };

  const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  let html = `
    <div class="spell-check-result">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;padding:12px 16px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;">
        <div style="text-align:center;min-width:56px;">
          <div style="font-size:1.8rem;font-weight:900;color:${scoreColor};line-height:1;">${score}</div>
          <div style="font-size:0.68rem;color:#64748b;font-weight:600;letter-spacing:0.05em;">ĐIỂM</div>
        </div>
        <div style="flex:1;">
          <div style="font-size:0.95rem;font-weight:700;color:${scoreColor};">${scoreLabel}</div>
          <div style="font-size:0.82rem;color:#475569;margin-top:2px;">${esc(summary) || `Phát hiện ${errorCount} lỗi / ${totalWords} từ.`}</div>
        </div>
        ${errorCount === 0
          ? '<span style="font-size:1.5rem;">✅</span>'
          : `<span style="font-size:0.85rem;font-weight:700;color:#dc2626;background:#fef2f2;padding:4px 10px;border-radius:20px;">${errorCount} lỗi</span>`}
      </div>`;

  if (errorCount === 0) {
    html += `<div style="text-align:center;padding:12px;color:#059669;font-weight:600;">🎉 Không phát hiện lỗi nào!</div>`;
  } else {
    for (const [type, typeErrors] of Object.entries(errorsByType)) {
      if (!typeErrors.length) continue;
      html += `<div style="margin-bottom:12px;">
        <div style="font-size:0.8rem;font-weight:700;color:#475569;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.04em;">${typeLabels[type]} (${typeErrors.length})</div>
        <div style="display:flex;flex-direction:column;gap:5px;">`;
      for (const err of typeErrors) {
        html += `<div style="padding:8px 12px;background:white;border-radius:6px;border:1px solid #fca5a5;border-left:3px solid #ef4444;">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:3px;">
            <span style="background:#fef2f2;color:#dc2626;padding:2px 8px;border-radius:4px;font-size:0.88rem;font-weight:700;text-decoration:line-through;">${esc(err.wrong)}</span>
            <span style="color:#94a3b8;font-size:1.1rem;">→</span>
            <span style="background:#f0fdf4;color:#059669;padding:2px 8px;border-radius:4px;font-size:0.88rem;font-weight:700;">${esc(err.correct)}</span>
          </div>
          <div style="font-size:0.78rem;color:#64748b;">${esc(err.reason||'')}</div>
        </div>`;
      }
      html += `</div></div>`;
    }
  }

  html += `</div>`;
  return html;
}
