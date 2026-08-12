/**
 * Transcription Prompt Templates
 *
 * System and user prompts for audio transcription via Gemini.
 */
'use strict';

const TRANSCRIPTION_SYSTEM_PROMPT = `Bạn là trợ lý chuyên nghiệp chuyển đổi âm thanh tiếng Việt thành văn bản.
Quy tắc:
- Trả lời bằng nội dung phiên âm thuần túy, không thêm ghi chú.
- Giữ nguyên dấu câu và phân đoạn.
- Nếu không nghe rõ, đánh dấu [không rõ].
- Giữ thuật ngữ pháp lý/hành chính chính xác.`;

/**
 * Build the user prompt for transcription
 * @param {Object} opts
 * @param {string} [opts.context] - Optional context hint
 * @returns {string}
 */
function buildTranscriptionPrompt(opts = {}) {
  let prompt = 'Phiên âm nội dung âm thanh sau đây thành văn bản tiếng Việt.';
  if (opts.context) {
    prompt += `\nBối cảnh: ${opts.context}`;
  }
  return prompt;
}

module.exports = {
  TRANSCRIPTION_SYSTEM_PROMPT,
  buildTranscriptionPrompt,
};
