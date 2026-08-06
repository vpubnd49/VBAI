/**
 * Legal answer formatting helper.
 */
export function formatLegalAnswer(rawAnswer = '', citations = [], warnings = []) {
  let formatted = String(rawAnswer || '').trim();

  if (warnings && warnings.length > 0) {
    formatted += '\n\n---\n⚠️ **CẢNH BÁO PHÁP LÝ**:\n' + warnings.map((w) => `- ${w}`).join('\n');
  }

  if (citations && citations.length > 0) {
    formatted += '\n\n---\n📌 **CĂN CỨ VĂN BẢN & NGUỒN TRÍCH DẪN**:\n' + citations.map((c, i) => `${i + 1}. [${c.title}](${c.url})`).join('\n');
  }

  return formatted;
}
