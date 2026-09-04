'use strict';

function extractAssistantText(data) {
  if (typeof data === 'string') return data;
  if (!data || typeof data !== 'object') return '';
  const contentToText = (content) => {
    if (typeof content === 'string') return content;
    if (!Array.isArray(content)) return '';
    return content.map((part) => typeof part === 'string' ? part : String(part?.text || part?.content || '')).filter(Boolean).join('');
  };
  for (const choice of Array.isArray(data.choices) ? data.choices : []) {
    const text = contentToText(choice?.message?.content) || String(choice?.text || '');
    if (text.trim()) return text.trim();
  }
  if (typeof data.output_text === 'string' && data.output_text.trim()) return data.output_text;
  if (Array.isArray(data.content)) {
    const text = contentToText(data.content);
    if (text.trim()) return text.trim();
  }
  if (Array.isArray(data.candidates)) {
    const text = data.candidates.map((candidate) => (candidate?.content?.parts || []).map((part) => part?.text || '').join('')).join('\n');
    if (text.trim()) return text.trim();
  }
  return '';
}

module.exports = { extractAssistantText };
