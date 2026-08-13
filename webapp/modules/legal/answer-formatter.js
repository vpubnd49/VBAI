/**
 * Structured Legal Answer Formatter.
 * Formats AI responses into structured legal sections:
 * Summary -> Executive Basis -> Main Arguments -> Legal Conclusion -> Verified Citations.
 * Backward compatible with both formatLegalAnswer(text, citations, warnings) and formatLegalAnswer(text, evidenceBundle, warnings).
 */
import { renderCitationChip, renderCitationBadge } from './citation-renderer.js';

export function parseMarkdownToStructuredHtml(rawText = '') {
  if (!rawText) return '';
  let str = String(rawText).trim();

  // Escape HTML entities safely
  str = str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Bold **text** & Italic *text*
  str = str.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  str = str.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  const lines = str.split('\n');
  const htmlBlocks = [];
  let inList = false;
  let currentSectionTitle = null;
  let sectionBuffer = [];

  const flushSection = () => {
    if (sectionBuffer.length > 0 || currentSectionTitle) {
      let contentHtml = sectionBuffer.join('');
      if (inList) {
        contentHtml += '</ul>';
        inList = false;
      }
      if (currentSectionTitle) {
        htmlBlocks.push(`
          <div class="legal-section-card">
            <div class="legal-section-header">
              <span class="section-icon">⚖️</span>
              <h3 class="legal-section-heading">${currentSectionTitle}</h3>
            </div>
            <div class="legal-section-content">${contentHtml}</div>
          </div>
        `);
      } else if (contentHtml) {
        htmlBlocks.push(`<div class="legal-section-block">${contentHtml}</div>`);
      }
      sectionBuffer = [];
      currentSectionTitle = null;
    }
  };

  for (let line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (inList) {
        sectionBuffer.push('</ul>');
        inList = false;
      }
      continue;
    }

    // Check for Section Headers (### A. KẾT LUẬN, **A. KẾT LUẬN**, [A. KẾT LUẬN], A. KẾT LUẬN)
    const isHeaderLine = trimmed.startsWith('#') || trimmed.startsWith('[') || /^(?:\*\*)?[A-D1-9]\.\s/.test(trimmed);
    if (isHeaderLine) {
      flushSection();
      currentSectionTitle = trimmed
        .replace(/^#{1,4}\s*/, '')
        .replace(/^\[/, '')
        .replace(/\]$/, '')
        .replace(/^\*\*/, '')
        .replace(/\*\*$/, '')
        .trim();
      continue;
    }

    // Check for list items (- item, * item, 1. item)
    const listMatch = trimmed.match(/^(?:[\-\*\•]|(?:\d+\.))\s+(.*)/);
    if (listMatch) {
      if (!inList) {
        sectionBuffer.push('<ul class="legal-bullet-list">');
        inList = true;
      }
      sectionBuffer.push(`<li>${listMatch[1]}</li>`);
      continue;
    }

    if (inList) {
      sectionBuffer.push('</ul>');
      inList = false;
    }

    sectionBuffer.push(`<p class="legal-answer-paragraph">${trimmed}</p>`);
  }

  flushSection();
  return htmlBlocks.join('');
}

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

  const formattedHtml = parseMarkdownToStructuredHtml(rawAnswer);

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
        ${formattedHtml}
      </div>
      ${sourcesHtml}
    </div>
  `;
}
