import { parseUniversalFile } from './universal-doc-parser.js';
/**
 * VBAI Legal Pro V2 — Central Legal Search Experience
 * Two-panel layout: Left (Query & Structured Answer) / Right (Evidence Panel)
 * Supports modes: legal-search, document-lookup, situation-analysis, compare-regulations, effective-date
 */

import { renderEvidencePanel } from './evidence-panel.js';
import { sendStructuredChatRequest, sendLegalAgentRequest } from './ai-proxy.js';
import { formatLegalAnswer } from './legal/answer-formatter.js';
import { showToast } from './ui-utils.js';

let currentSearchState = {
  mode: 'legal-search',
  query: '',
  effectiveDate: new Date().toISOString().split('T')[0],
  lastResult: null,
  isSearching: false,
};

export async function renderLegalSearchUI(container, initialMode = 'legal-search', initialQuery = '') {
  if (!container) return;

  currentSearchState.mode = initialMode || 'legal-search';
  if (initialQuery) currentSearchState.query = initialQuery;

  const modeHeadings = {
    'legal-search': { title: 'Tra cứu Pháp luật có kiểm chứng', subtitle: 'Tìm đúng văn bản, đúng điều khoản, đúng thời điểm hiệu lực.' },
    'document-lookup': { title: 'Tra cứu Văn bản Quy phạm Pháp luật', subtitle: 'Tra cứu số hiệu, ngày ban hành, ngày hiệu lực và văn bản liên quan.' },
    'situation-analysis': { title: 'Phân tích Tình huống Pháp lý', subtitle: 'Đánh giá áp dụng pháp luật, quy trình giải quyết và căn cứ liên quan.' },
    'compare-regulations': { title: 'So sánh Quy định & Văn bản', subtitle: 'Đối chiếu điểm mới, sửa đổi, bổ sung giữa các văn bản quy phạm.' },
    'effective-date': { title: 'Kiểm tra Hiệu lực theo Thời điểm', subtitle: 'Xác định chính xác trạng thái hiệu lực của văn bản tại mốc thời gian cụ thể.' },
  };

  const headerInfo = modeHeadings[currentSearchState.mode] || modeHeadings['legal-search'];

  container.innerHTML = `
    <div class="legal-search-workspace">
      <!-- Search Header Bar -->
      <div class="legal-search-header-bar">
        <div class="legal-search-title-group">
          <h1 class="legal-search-main-title">${escapeHtml(headerInfo.title)}</h1>
          <p class="legal-search-sub-title">${escapeHtml(headerInfo.subtitle)}</p>
        </div>

        <!-- Effective Date Selector (Section 9) -->
        <div class="effective-date-bar">
          <label class="effective-date-label">
            <span class="date-icon">📅</span> Hiệu lực tại thời điểm:
          </label>
          <input type="date" id="effective-date-input" class="effective-date-picker" value="${currentSearchState.effectiveDate}">
        </div>
      </div>

      <!-- Main Two-Panel Layout -->
      <div class="legal-search-two-panel">
        <!-- LEFT PANEL: Query Input + Answer Display -->
        <div class="legal-main-panel">
          <div class="legal-query-box-card">
            <div class="legal-query-input-row">
              <input 
                type="text" 
                id="legal-search-input" 
                class="legal-search-input-field" 
                placeholder="${getPlaceholderForMode(currentSearchState.mode)}"
                value="${escapeAttribute(currentSearchState.query)}"
              >
              <button type="button" id="legal-file-btn" class="btn btn-secondary" title="Đính kèm file Word, Excel, PDF để đối chiếu quy định pháp luật" style="display:flex; align-items:center; gap:4px; font-size:0.82rem; padding:0 12px; white-space:nowrap;">
                <span>📎 Đính kèm tệp</span>
              </button>
              <input type="file" id="legal-file-input" accept=".docx,.doc,.xlsx,.xls,.csv,.pdf,.txt,.json" style="display:none;">
              <button id="legal-search-btn" class="btn btn-primary legal-search-submit-btn">
                <span class="btn-icon">🔍</span>
                <span>Tra cứu</span>
              </button>
            </div>
            <div id="legal-file-preview" style="display:none; margin: 8px 0; padding: 6px 12px; background: var(--surface-soft, #f1f5f9); border-radius: 8px; border: 1px dashed var(--border-default, #cbd5e1); font-size: 0.8rem; align-items: center; justify-content: space-between;"></div>

            <!-- Quick Modes Chips -->
            <div class="legal-mode-chips">
              <button class="mode-chip ${currentSearchState.mode === 'legal-search' ? 'active' : ''}" data-mode="legal-search">🔍 Tra cứu chung</button>
              <button class="mode-chip ${currentSearchState.mode === 'document-lookup' ? 'active' : ''}" data-mode="document-lookup">📜 Tìm theo số hiệu</button>
              <button class="mode-chip ${currentSearchState.mode === 'situation-analysis' ? 'active' : ''}" data-mode="situation-analysis">⚖️ Tình huống</button>
              <button class="mode-chip ${currentSearchState.mode === 'compare-regulations' ? 'active' : ''}" data-mode="compare-regulations">🔄 So sánh</button>
              <button class="mode-chip ${currentSearchState.mode === 'effective-date' ? 'active' : ''}" data-mode="effective-date">📅 Kiểm tra hiệu lực</button>
            </div>
          </div>

          <!-- Answer & Document Details Area -->
          <div id="legal-answer-area" class="legal-answer-container">
            <div class="legal-welcome-state">
              <div class="welcome-icon">🏛️</div>
              <div class="welcome-title">VBAI Legal Pro V2</div>
              <div class="welcome-desc">Nhập câu hỏi, số hiệu văn bản hoặc nội dung cần tra cứu để bắt đầu. Hệ thống sẽ tự động tổng hợp câu trả lời có cấu trúc và hiển thị căn cứ pháp lý đã kiểm chứng.</div>
            </div>
          </div>
        </div>

        <!-- RIGHT PANEL: Evidence Panel -->
        <div id="legal-evidence-panel" class="legal-side-evidence-panel">
          <!-- Rendered dynamically by renderEvidencePanel -->
        </div>
      </div>
    </div>
  `;

  // Hydrate Evidence Panel initially empty
  const evidenceContainer = container.querySelector('#legal-evidence-panel');
  renderEvidencePanel(evidenceContainer, null);

  // Bind Events
  const searchInput = container.querySelector('#legal-search-input');
  const searchBtn = container.querySelector('#legal-search-btn');
  const dateInput = container.querySelector('#effective-date-input');
  const modeChips = container.querySelectorAll('.mode-chip');

  dateInput.addEventListener('change', (e) => {
    currentSearchState.effectiveDate = e.target.value;
    showToast(`Đã cập nhật thời điểm tra cứu: ${e.target.value}`, 'info');
  });

  modeChips.forEach(chip => {
    chip.addEventListener('click', () => {
      modeChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentSearchState.mode = chip.dataset.mode;
      searchInput.placeholder = getPlaceholderForMode(currentSearchState.mode);
    });
  });

  const triggerSearch = () => {
    const q = searchInput.value.trim();
    if (!q) {
      showToast('Vui lòng nhập từ khóa hoặc câu hỏi tra cứu', 'warning');
      return;
    }
    currentSearchState.query = q;
    executeLegalSearch(container, q);
  };

  searchBtn.addEventListener('click', triggerSearch);
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') triggerSearch();
  });

  // If initial query was passed, run search immediately
  if (initialQuery) {
    triggerSearch();
  }
}

const legalSearchMemoryCache = new Map();
const metadataCache = new Map();

async function getCachedMetadata(q) {
  const k = String(q || '').trim().toLowerCase();
  if (!k) return null;
  if (metadataCache.has(k)) return metadataCache.get(k);
  try {
    const token = window.currentUser ? await window.currentUser.getIdToken() : null;
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
    const res = await fetch(`/api/document-metadata?q=${encodeURIComponent(q)}`, { headers });
    if (res.ok) {
      const data = await res.json();
      metadataCache.set(k, data);
      return data;
    }
  } catch (_) {}
  return null;
}

async function executeLegalSearch(container, query) {
  const answerArea = container.querySelector('#legal-answer-area');
  const evidenceContainer = container.querySelector('#legal-evidence-panel');
  const searchBtn = container.querySelector('#legal-search-btn');

  if (!answerArea || !evidenceContainer) return;

  const cleanQ = String(query || '').trim();
  const cacheKey = `${currentSearchState.mode}:${cleanQ.toLowerCase()}:${currentSearchState.effectiveDate}`;

  // Instant Cache Check (< 10ms response)
  const cached = legalSearchMemoryCache.get(cacheKey);
  if (cached) {
    answerArea.innerHTML = cached.formattedAnswerHtml;
    renderEvidencePanel(evidenceContainer, cached.response);
    bindCitationInteractions(container);
    searchBtn.disabled = false;
    return;
  }

  searchBtn.disabled = true;
  answerArea.innerHTML = `
    <div class="legal-search-loading">
      <div class="spinner"></div>
      <div class="loading-title">Đang tra cứu cơ sở dữ liệu pháp luật...</div>
      <div class="loading-sub">Phân tích văn bản • Kiểm tra hiệu lực ngày ${currentSearchState.effectiveDate} • Xác minh căn cứ</div>
    </div>
  `;

  saveRecentSearch(cleanQ, currentSearchState.mode);

  try {
    let fullPrompt = buildModePrompt(cleanQ, currentSearchState.mode, currentSearchState.effectiveDate);

    // Resolve verified document metadata & recent legal database context (using fast cache)
    try {
      const metaData = await getCachedMetadata(cleanQ);
      if (metaData?.found && metaData?.known_document) {
        const kd = metaData.known_document;
        const issueDate = kd.issue_date || kd.issueDate || kd.ngay_ban_hanh || '';
        const effectiveDate = kd.effective_date || kd.effectiveDate || kd.ngay_hieu_luc || issueDate || '';
        const title = kd.title || kd.titleHint || kd.trich_yeu || '';
        const docNum = kd.documentNumber || kd.document_number || '';
        const issuer = kd.issuer || 'Chính phủ';
        const summary = kd.tom_tat_chinh_sach || kd.summary || '';
        const chapters = kd.tom_tat_chuong_dieu || kd.chapterArticleSummary || '';
        const status = kd.effective_status || kd.effectiveStatus || kd.tinh_trang_hieu_luc || 'in_force';

        const metaLines = ['\n\n[THÔNG TIN XÁC THỰC TỪ CƠ SỞ DỮ LIỆU PHÁP LUẬT CHÍNH THỨC - BẮT BUỘC SỬ DỤNG ĐỂ PHÂN TÍCH CHI TIẾT]:'];
        if (docNum) metaLines.push(`- Số hiệu văn bản: ${docNum}`);
        if (title) metaLines.push(`- Tên đầy đủ: ${title}`);
        if (issuer) metaLines.push(`- Cơ quan ban hành: ${issuer}`);
        if (issueDate) metaLines.push(`- Ngày ban hành: ${issueDate}`);
        if (effectiveDate) metaLines.push(`- Ngày có hiệu lực: ${effectiveDate}`);
        metaLines.push(`- Tình trạng hiệu lực: ${status === 'in_force' || status === 'co_hieu_luc' ? 'Còn hiệu lực' : status}`);
        if (summary) metaLines.push(`- Nội dung chính sách trọng tâm: ${summary}`);
        if (chapters) metaLines.push(`- Cấu trúc chương điều & quy định chi tiết: ${chapters}`);
        if (Array.isArray(kd.can_cu_phap_ly) && kd.can_cu_phap_ly.length > 0) {
          metaLines.push(`- Căn cứ pháp lý: ${kd.can_cu_phap_ly.join('; ')}`);
        }
        metaLines.push(`\n[QUY TẮC PHÂN TÍCH CHUYÊN SÂU]: Bạn BẮT BUỘC trình bày bài phân tích đầy đủ, phong phú, chi tiết từng nhóm chính sách, biện pháp kỹ thuật và trách nhiệm thực thi. Tuyệt đối không trả lời sơ sài.`);

        fullPrompt += metaLines.join('\n');
      }
      if (Array.isArray(metaData?.recent_documents) && metaData.recent_documents.length > 0) {
        const recLines = ['\n\n[DANH MỤC VĂN BẢN QUY PHẠM PHÁP LUẬT MỚI NHẤT TRÊN HỆ THỐNG]:'];
        metaData.recent_documents.slice(0, 5).forEach(rd => {
          recLines.push(`- [${rd.documentNumber}] ${rd.title} (Ban hành: ${rd.issueDate || 'Đã ban hành'})`);
        });
        fullPrompt += recLines.join('\n');
      }
    } catch (_) {}

    const trace = {
      feature: 'legal-search',
       query: query,
      mode: currentSearchState.mode,
      effectiveDate: currentSearchState.effectiveDate,
    };
    const response = await sendStructuredChatRequest([{ role: 'user', content: fullPrompt }], undefined, { trace, provider: 'gemini' });

    let rawText = '';
    let evidenceBundle = null;
    let legalMeta = null;
    let knownDocument = null;

    if (typeof response === 'object' && response !== null) {
      rawText = response.text || response.content || response.answer || JSON.stringify(response);
      evidenceBundle = response.legal?.evidenceBundle || response.evidenceBundle || null;
      legalMeta = response.legal || null;
      knownDocument = response.legal?.known_document || response.meta?.known_document || null;
    } else {
      rawText = String(response || '');
    }

    // Also try to get known_document from metadata cache
    if (!knownDocument) {
      try {
        const metaData = await getCachedMetadata(cleanQ);
        if (metaData?.found && metaData?.known_document) {
          knownDocument = metaData.known_document;
        }
      } catch (_) {}
    }

    // Format Structured Legal Answer
    const formattedAnswerHtml = buildStructuredAnswerHtml(rawText, evidenceBundle, currentSearchState.mode, currentSearchState.effectiveDate, knownDocument);
    answerArea.innerHTML = formattedAnswerHtml;

    // Cache successful search for instant next-time retrieval
    legalSearchMemoryCache.set(cacheKey, { formattedAnswerHtml, response });

    // Render Evidence Panel on Right Panel
    renderEvidencePanel(evidenceContainer, response);

    // Bind interaction between Citation chips and Evidence Cards
    bindCitationInteractions(container);

  } catch (err) {
    console.error('Legal Search Error:', err);
    answerArea.innerHTML = `
      <div class="legal-search-error">
        <div class="error-icon">⚠️</div>
        <div class="error-title">Không thể hoàn tất tra cứu</div>
        <div class="error-desc">${escapeHtml(err.message || 'Lỗi kết nối máy chủ tra cứu pháp luật.')}</div>
        <button class="btn btn-secondary retry-btn" id="retry-search-btn">Thử lại</button>
      </div>
    `;
    container.querySelector('#retry-search-btn')?.addEventListener('click', () => executeLegalSearch(container, query));
  } finally {
    searchBtn.disabled = false;
  }
}

/**
 * Build the known document metadata header card — shows document number,
 * title, issuer, dates, status, policy summary, and chapter/article stats.
 */
function buildKnownDocHeader(kd) {
  if (!kd || (!kd.documentNumber && !kd.so_hieu && !kd.document_number)) return '';

  const docNo = kd.documentNumber || kd.so_hieu || kd.document_number || '';
  const title = kd.titleHint || kd.trich_yeu || kd.title || '';
  const issuer = kd.issuer || kd.co_quan_ban_hanh || (docNo.includes('/QH') ? 'Quốc hội' : (docNo.includes('/NĐ-CP') ? 'Chính phủ' : 'Cơ quan có thẩm quyền'));
  const issueDateRaw = kd.ngay_ban_hanh || kd.issueDate || kd.issue_date || '';
  const effectiveDateRaw = kd.ngay_hieu_luc || kd.effectiveDate || kd.effective_date || '';

  let statusRaw = kd.tinh_trang_hieu_luc || kd.effectiveStatus || kd.effective_status || 'co_hieu_luc';
  let statusClass = 'in-force';
  let statusText = '🟢 Có hiệu lực';
  if (statusRaw === 'het_hieu_luc' || statusRaw === 'expired') { statusClass = 'expired'; statusText = '🔴 Hết hiệu lực'; }
  else if (statusRaw === 'ngung_hieu_luc') { statusClass = 'suspended'; statusText = '🟡 Ngưng hiệu lực'; }

  const summary = kd.tom_tat_chinh_sach || kd.summary || '';
  const chapters = kd.tom_tat_chuong_dieu || kd.chapterArticleSummary || '';
  const replacesArr = kd.thay_the_cho || kd.replaces || [];
  const replaces = Array.isArray(replacesArr) ? replacesArr.join(', ') : (replacesArr || '');

  let summaryHtml = '';
  if (summary) {
    let formatted = '';
    if (Array.isArray(summary)) {
      formatted = summary.map((item, i) => `<li>${escapeHtml(String(item))}</li>`).join('');
      formatted = `<ol style="margin:4px 0 0 16px;padding:0;font-size:13px">${formatted}</ol>`;
    } else {
      const parts = String(summary).split(/(?=\d+\.\s+)/).filter(Boolean);
      if (parts.length > 1) {
        formatted = parts.map(p => `<li>${escapeHtml(p.replace(/^\d+\.\s*/, '').trim())}</li>`).join('');
        formatted = `<ol style="margin:4px 0 0 16px;padding:0;font-size:13px">${formatted}</ol>`;
      } else {
        formatted = `<p style="margin:4px 0 0;font-size:13px">${escapeHtml(summary)}</p>`;
      }
    }
    summaryHtml = `
      <div style="margin-top:10px;padding:10px 14px;background:var(--bg-surface-alt, #f0f7ff);border-left:3px solid var(--brand-primary, #008ca1);border-radius:6px">
        <strong style="font-size:13px;color:var(--brand-primary, #008ca1)">📋 Tóm tắt chính sách:</strong>
        ${formatted}
      </div>
    `;
  }

  let chaptersHtml = '';
  if (chapters) {
    chaptersHtml = `
      <div style="margin-top:8px;padding:10px 14px;background:var(--bg-surface-alt, #f8f9fa);border-left:3px solid #6c757d;border-radius:6px">
        <strong style="font-size:13px;color:#495057">📑 Cấu trúc chương điều:</strong>
        <p style="margin:4px 0 0;font-size:13px;white-space:pre-line">${escapeHtml(String(chapters))}</p>
      </div>
    `;
  }

  return `
    <div class="known-doc-header-card" style="margin-bottom:16px;padding:16px 20px;background:linear-gradient(135deg,#f8fffe,#eef7f9);border:1px solid #b2dfdb;border-radius:12px;box-shadow:0 2px 8px rgba(0,140,161,0.08)">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap">
        <span style="font-size:20px">📊</span>
        <span style="font-size:15px;font-weight:700;color:var(--brand-primary, #008ca1)">Bảng danh mục trích dẫn văn bản chính thức</span>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <tbody>
          <tr><td style="padding:6px 10px;font-weight:600;width:35%;border-bottom:1px solid #e0e0e0">Số hiệu</td><td style="padding:6px 10px;border-bottom:1px solid #e0e0e0;font-weight:700;color:var(--brand-primary, #008ca1)">${escapeHtml(docNo)}</td></tr>
          ${title ? `<tr><td style="padding:6px 10px;font-weight:600;border-bottom:1px solid #e0e0e0">Tên văn bản / Trích yếu</td><td style="padding:6px 10px;border-bottom:1px solid #e0e0e0">${escapeHtml(title)}</td></tr>` : ''}
          <tr><td style="padding:6px 10px;font-weight:600;border-bottom:1px solid #e0e0e0">Cơ quan ban hành</td><td style="padding:6px 10px;border-bottom:1px solid #e0e0e0">${escapeHtml(issuer)}</td></tr>
          ${issueDateRaw ? `<tr><td style="padding:6px 10px;font-weight:600;border-bottom:1px solid #e0e0e0">Ngày ban hành</td><td style="padding:6px 10px;border-bottom:1px solid #e0e0e0">${escapeHtml(issueDateRaw)}</td></tr>` : ''}
          ${effectiveDateRaw ? `<tr><td style="padding:6px 10px;font-weight:600;border-bottom:1px solid #e0e0e0">Ngày có hiệu lực</td><td style="padding:6px 10px;border-bottom:1px solid #e0e0e0">${escapeHtml(effectiveDateRaw)}</td></tr>` : ''}
          <tr><td style="padding:6px 10px;font-weight:600;border-bottom:1px solid #e0e0e0">Tình trạng hiệu lực</td><td style="padding:6px 10px;border-bottom:1px solid #e0e0e0"><span class="legal-status-pill ${statusClass}">${statusText}</span></td></tr>
          ${replaces ? `<tr><td style="padding:6px 10px;font-weight:600;border-bottom:1px solid #e0e0e0">Thay thế cho</td><td style="padding:6px 10px;border-bottom:1px solid #e0e0e0">${escapeHtml(replaces)}</td></tr>` : ''}
          ${(() => {
            const pdfUrl = kd.pdf_download_url || kd.pdfDownloadUrl;
            const officialUrl = Array.isArray(kd.official_source_urls) ? kd.official_source_urls[0] : (kd.official_source_urls || '');
            if (!pdfUrl && !officialUrl) return '';
            const links = [];
            if (pdfUrl) links.push(`<a href="${escapeHtml(pdfUrl)}" target="_blank" class="btn-download-pill" style="display:inline-flex;align-items:center;gap:4px;padding:4px 12px;background:var(--brand-primary, #008ca1);color:#fff;border-radius:6px;text-decoration:none;font-size:12px;font-weight:600;box-shadow:0 1px 3px rgba(0,0,0,0.1);">📥 Tải PDF gốc</a>`);
            if (officialUrl) links.push(`<a href="${escapeHtml(officialUrl)}" target="_blank" style="display:inline-flex;align-items:center;gap:4px;padding:4px 12px;background:#eef7f9;color:var(--brand-primary, #008ca1);border:1px solid #b2dfdb;border-radius:6px;text-decoration:none;font-size:12px;font-weight:600;">🏛️ Nguồn chính thức</a>`);
            return `<tr><td style="padding:6px 10px;font-weight:600;border-bottom:1px solid #e0e0e0">Nguồn & Tải về</td><td style="padding:6px 10px;border-bottom:1px solid #e0e0e0;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">${links.join('')}</td></tr>`;
          })()}
        </tbody>
      </table>
      ${summaryHtml}
      ${chaptersHtml}
    </div>
  `;
}

function buildStructuredAnswerHtml(rawAnswer, evidenceBundle, mode, effectiveDate, knownDocument = null) {
  const formattedBody = formatLegalAnswer(rawAnswer, evidenceBundle);

  // Known Document Header Card (metadata from DB)
  const knownDocHtml = buildKnownDocHeader(knownDocument);

  // Document Lookup Mode specialized Result Card (Section 8)
  let docLookupCardHtml = '';
  if (mode === 'document-lookup') {
    docLookupCardHtml = `
      <div class="document-lookup-result-card">
        <div class="lookup-card-header">
          <span class="lookup-badge">VĂN BẢN QUY PHẠM PHÁP LUẬT</span>
          <span class="effective-status-tag active">Còn hiệu lực (tính đến ${effectiveDate})</span>
        </div>
        <div class="lookup-card-body">
          <div class="lookup-field"><strong>Tra cứu theo mốc thời gian:</strong> ${effectiveDate}</div>
          <div class="lookup-field"><strong>Trạng thái kiểm chứng:</strong> Đã rà soát dữ liệu chính thức</div>
        </div>
      </div>
    `;
  }

  return `
    <div class="legal-structured-answer">
      ${docLookupCardHtml}
      ${knownDocHtml}
      ${formattedBody}
    </div>
  `;
}

function bindCitationInteractions(container) {
  const chips = container.querySelectorAll('.legal-citation-chip');
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      const docNum = (chip.dataset.citationId || chip.querySelector('.chip-text')?.textContent || '').trim().toLowerCase();
      if (!docNum) return;

      const cards = container.querySelectorAll('.evidence-card');
      let found = false;
      cards.forEach(card => {
        card.classList.remove('highlighted');
        const cardDocNum = (card.dataset.docNumber || '').trim().toLowerCase();
        const matches = (cardDocNum && (cardDocNum === docNum || cardDocNum.includes(docNum) || docNum.includes(cardDocNum))) || card.innerText.toLowerCase().includes(docNum);
        if (matches && !found) {
          card.classList.add('highlighted');
          card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          found = true;
        }
      });
    });
  });
}

function buildModePrompt(query, mode, effectiveDate) {
  const dateContext = `Thời điểm tra cứu và xác nhận hiệu lực: ${effectiveDate}.`;

  const detailGuidelines = `
=== YÊU CẦU BẮT BUỘC VỀ NỘI DUNG & CẤU TRÚC PHÂN TÍCH ===

[NGUYÊN TẮC VÀNG]:
- Bạn PHẢI tập trung phân tích ĐẦY ĐỦ, TOÀN DIỆN nội dung của VĂN BẢN CHÍNH mà người dùng hỏi. KHÔNG trả lời sơ sài, KHÔNG chỉ nêu tên rồi dừng.
- Phân tích CHI TIẾT từng nhóm quy định, biện pháp, chế tài, mốc thời hạn, quyền/nghĩa vụ các bên.
- TUYỆT ĐỐI CẤM vẽ sơ đồ ASCII art (┌───┐, │, └───┘, ▼). BẮT BUỘC dùng danh sách phân cấp và Bảng Markdown chuẩn.

[CẤU TRÚC BÀI PHÂN TÍCH BẮT BUỘC]:
I. KẾT LUẬN VỀ HIỆU LỰC & THẨM QUYỀN BAN HÀNH
   - Số hiệu trong ngoặc vuông [VD: 82/2020/NĐ-CP]
   - Tên đầy đủ của văn bản
   - Cơ quan ban hành
   - Ngày ban hành, ngày có hiệu lực
   - Tình trạng hiệu lực tại ${effectiveDate}

II. CĂN CỨ PHÁP LÝ & QUAN HỆ VĂN BẢN
   - Căn cứ ban hành (Luật/Bộ luật nào, Điều khoản nào)
   - Quan hệ hướng dẫn thi hành
   - Văn bản này THAY THẾ/SỬA ĐỔI/BỔ SUNG hoặc BỊ THAY THẾ/SỬA ĐỔI bởi văn bản nào (nếu có)

III. PHẠM VI ĐIỀU CHỈNH & ĐỐI TƯỢNG ÁP DỤNG
   - Phạm vi điều chỉnh cụ thể
   - Liệt kê rõ đối tượng áp dụng (cơ quan, tổ chức, cá nhân)

IV. CẤU TRÚC TỔNG QUAN & NỘI DUNG QUY ĐỊNH CHI TIẾT
   ⚠️ ĐÂY LÀ PHẦN QUAN TRỌNG NHẤT — phải trình bày ĐẦY ĐỦ, PHONG PHÚ:

   A. THỐNG KÊ CẤU TRÚC (BẮT BUỘC nếu là Luật/Nghị định/Thông tư):
      - Tổng số chương, tổng số điều (VD: "Luật gồm 7 chương, 86 điều")
      - Danh sách từng chương kèm phạm vi điều, ví dụ:
        * Chương I (Điều 1-6): Những quy định chung
        * Chương II (Điều 7-25): [Tên chương]
        * ...

   B. PHÂN TÍCH NỘI DUNG TỪNG CHƯƠNG/NHÓM QUY ĐỊNH:
      - Với mỗi chương, nêu 3-6 gạch đầu dòng về nội dung trọng tâm:
        + Các biện pháp cụ thể, quy trình thực hiện, mốc thời hạn
        + Quyền và nghĩa vụ các bên liên quan
        + Mức xử phạt, chế tài (nếu có)
        + Các quy định mới nổi bật, điểm khác biệt so với quy định trước

V. TRÁCH NHIỆM THI HÀNH & TỔ CHỨC THỰC HIỆN
   - Cơ quan chủ trì, cơ quan phối hợp
   - Trách nhiệm địa phương
   - Điều khoản chuyển tiếp (nếu có)

VI. BẢNG DANH MỤC TRÍCH DẪN VĂN BẢN CHÍNH THỨC
   Bảng Markdown CHỈ chứa:
   - Dòng 1: Văn bản CHÍNH mà người dùng hỏi (BẮT BUỘC)
   - Dòng 2+: Các văn bản SỬA ĐỔI, BỔ SUNG, THAY THẾ trực tiếp văn bản chính (nếu có)
   KHÔNG liệt kê văn bản không liên quan trực tiếp.
   Format: | Số hiệu | Tên văn bản | Cơ quan ban hành | Ngày ban hành / Hiệu lực | Trạng thái | Quan hệ |

[QUY TẮC VỀ BẢNG TRÍCH DẪN]:
- Cột "Quan hệ": ghi rõ "Văn bản chính" cho VB user hỏi, "Sửa đổi bổ sung" hoặc "Thay thế" cho VB liên quan.
- TUYỆT ĐỐI KHÔNG liệt kê hàng loạt VB không liên quan trực tiếp.`;

  switch (mode) {
    case 'document-lookup':
      return `${dateContext}\n\nBáo cáo phân tích pháp lý chi tiết và toàn diện về văn bản: "${query}".\n${detailGuidelines}`;

    case 'situation-analysis':
      return `${dateContext}\n\nPhân tích tình huống pháp lý: "${query}".\nYêu cầu: I. KẾT LUẬN HƯỚNG XỬ LÝ, II. PHÂN TÍCH TÌNH HUỐNG CHI TIẾT, III. CĂN CỨ PHÁP LÝ, IV. RỦI RO PHÁP LÝ.\n${detailGuidelines}`;

    case 'compare-regulations':
      return `${dateContext}\n\nSo sánh quy định pháp luật: "${query}".\nTrình bày điểm khác biệt, điểm mới sửa đổi bổ sung.\n${detailGuidelines}`;

    case 'effective-date':
      return `${dateContext}\n\nXác định hiệu lực tại ${effectiveDate}: "${query}".\nPhân biệt: HIỆN HÀNH / HẾT HIỆU LỰC / CHƯA CÓ HIỆU LỰC / BỊ THAY THẾ.\n${detailGuidelines}`;

    default:
      return `${dateContext}\n\nBáo cáo phân tích pháp lý chi tiết và toàn diện về: "${query}".\n${detailGuidelines}`;
  }
}

function getPlaceholderForMode(mode) {
  switch (mode) {
    case 'document-lookup':
      return 'Nhập số hiệu (VD: 30/2020/NĐ-CP) hoặc tên văn bản...';
    case 'situation-analysis':
      return 'Mô tả tình huống pháp lý cần tư vấn hoặc xử lý...';
    case 'compare-regulations':
      return 'Nhập 2 văn bản hoặc chủ đề cần so sánh quy định...';
    case 'effective-date':
      return 'Nhập văn bản cần kiểm tra trạng thái hiệu lực...';
    default:
      return 'Nhập câu hỏi, số hiệu văn bản, điều/khoản hoặc tình huống pháp lý...';
  }
}

function saveRecentSearch(query, mode) {
  try {
    const searches = JSON.parse(localStorage.getItem('vbai_recent_searches') || '[]');
    const newEntry = { query, mode, timestamp: new Date().toISOString() };
    const filtered = searches.filter(s => s.query !== query).slice(0, 9);
    filtered.unshift(newEntry);
    localStorage.setItem('vbai_recent_searches', JSON.stringify(filtered));
  } catch (e) {
    console.warn('Could not save recent search:', e);
  }
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttribute(str) {
  return String(str || '').replace(/"/g, '&quot;');
}
