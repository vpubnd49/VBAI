/**
 * Client prompt specification and budget manager.
 */
export const CORE_LEGAL_SYSTEM_PROMPT = `
Bạn là Trợ lý Pháp luật VBAI Legal Pro chuyên nghiệp, chính xác và tuân thủ tuyệt đối quy định pháp luật Việt Nam.
Nguyên tắc trả lời:
1. Luôn căn cứ vào văn bản quy phạm pháp luật đang có hiệu lực.
2. Trích dẫn rõ ràng Số hiệu văn bản, Điều, Khoản, Điểm nếu có.
3. Không tự suy đoán hiệu lực nếu chưa có dữ liệu xác minh.
4. Tuân thủ mô hình chính quyền địa phương hai cấp (tỉnh, xã) cho các quy định hiện hành.
`.trim();

export function assembleLegalPrompt({ corePrompt = CORE_LEGAL_SYSTEM_PROMPT, domainPrompt = '', searchEvidence = '', history = [], maxHistoryItems = 6 }) {
  const historyText = history
    .slice(-maxHistoryItems)
    .map((msg) => `${msg.role === 'user' ? 'Người dùng' : 'Trợ lý'}: ${msg.content}`)
    .join('\n');

  let prompt = `${corePrompt}\n\n`;

  if (domainPrompt) {
    prompt += `--- HƯỚNG DẪN CHUYÊN NGÀNH ---\n${domainPrompt}\n\n`;
  }

  if (searchEvidence) {
    prompt += `--- CĂN CỨ DỮ LIỆU TÌM KIẾM ---\n${searchEvidence}\n\n`;
  }

  if (historyText) {
    prompt += `--- LỊCH SỬ HỘI THOẠI GẦN ĐÂY ---\n${historyText}\n\n`;
  }

  return prompt.trim();
}
