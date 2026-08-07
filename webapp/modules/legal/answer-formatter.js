/**
 * Structured Legal Answer Formatter.
 * Formats AI responses into structured legal sections:
 * Summary -> Executive Basis -> Main Arguments -> Legal Conclusion -> Verified Citations.
 * Backward compatible with both formatLegalAnswer(text, citations, warnings) and formatLegalAnswer(text, evidenceBundle, warnings).
 */
import { renderCitationChip, renderCitationBadge } from './citation-renderer.js';

export function formatLegalAnswer(rawAnswer = '', evidenceBundle = {}, warnings = []) {
  let actualWarnings = Array.isArray(warnings) ? warnings : [];
  let docsInput = evidenceBundle;

  if (Array.isArray(evidenceBundle)) {
    docsInput = evidenceBundle;
  }

  const documents = Array.isArray(docsInput)
    ? docsInput
    : (Array.isArray(docsInput?.documents) ? docsInput.documents : []);

  const bundleObj = Array.isArray(docsInput)
    ? {
        documents: docsInput,
        verificationLevel: docsInput.some((d) => d.sourceTier === 'official' || d.verified) ? 'VERIFIED' : 'UNVERIFIED',
        officialSourcesCount: docsInput.filter((d) => d.sourceTier === 'official' || d.verified).length,
      }
    : (docsInput || {});

  let formatted = String(rawAnswer || '').trim();

  // Attach warnings at top if present
  let warningHtml = '';
  if (actualWarnings && actualWarnings.length > 0) {
    warningHtml = `
      <div class="legal-warning-banner">
        <div class="warning-header">⚠️ CẢNH BÁO PHÁP LÝ & HIỆU LỰC</div>
        <ul>
          ${actualWarnings.map((w) => `<li>${w}</li>`).join('')}
        </ul>
      </div>
    `;
  }

  // Verification Level Badge
  const level = bundleObj.verificationLevel || 'UNVERIFIED';
  const levelClass = level === 'VERIFIED' ? 'verify-verified' : level === 'PARTIAL' ? 'verify-partial' : 'verify-unverified';
  const levelLabel = level === 'VERIFIED' ? 'Đã xác thực nguồn chính thức' : level === 'PARTIAL' ? 'Xác thực một phần (Nguồn tham khảo)' : 'Chưa xác thực nguồn chính thức';

  const headerHtml = `
    <div class="legal-answer-meta">
      <span class="legal-verify-badge ${levelClass}">
        <span class="dot"></span> ${levelLabel}
      </span>
      ${bundleObj.officialSourcesCount ? `<span class="sources-count">${bundleObj.officialSourcesCount} văn bản chính thức</span>` : ''}
    </div>
  `;

  // Process citations footer if documents present
  let sourcesHtml = '';
  if (documents.length > 0) {
    sourcesHtml = `
      <div class="legal-sources-section">
        <div class="sources-header">📌 CĂN CỨ VĂN BẢN & NGUỒN TRÍCH DẪN (${documents.length})</div>
        <div class="sources-grid">
          ${documents.map((doc, idx) => renderCitationChip({ ...doc, id: doc.id || String(idx + 1) })).join('')}
        </div>
      </div>
    `;
  }

  return `
    <div class="legal-answer-wrapper">
      ${headerHtml}
      ${warningHtml}
      <div class="legal-answer-body">
        ${formatted}
      </div>
      ${sourcesHtml}
    </div>
  `;
}
