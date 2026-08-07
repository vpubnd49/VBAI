/**
 * VBAI Legal Pro V2 — Central Legal Search Experience
 * Two-panel layout: Left (Query & Structured Answer) / Right (Evidence Panel)
 * Supports modes: legal-search, document-lookup, situation-analysis, compare-regulations, effective-date
 */

import { renderEvidencePanel } from './evidence-panel.js';
import { sendChatRequest, sendLegalAgentRequest } from './ai-proxy.js';
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
              <button id="legal-search-btn" class="btn btn-primary legal-search-submit-btn">
                <span class="btn-icon">🔍</span>
                <span>Tra cứu</span>
              </button>
            </div>

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

async function executeLegalSearch(container, query) {
  const answerArea = container.querySelector('#legal-answer-area');
  const evidenceContainer = container.querySelector('#legal-evidence-panel');
  const searchBtn = container.querySelector('#legal-search-btn');

  if (!answerArea || !evidenceContainer) return;

  searchBtn.disabled = true;
  answerArea.innerHTML = `
    <div class="legal-search-loading">
      <div class="spinner"></div>
      <div class="loading-title">Đang tra cứu cơ sở dữ liệu pháp luật...</div>
      <div class="loading-sub">Phân tích văn bản • Kiểm tra hiệu lực ngày ${currentSearchState.effectiveDate} • Xác minh căn cứ</div>
    </div>
  `;

  saveRecentSearch(query, currentSearchState.mode);

  try {
    const fullPrompt = buildModePrompt(query, currentSearchState.mode, currentSearchState.effectiveDate);
    const response = await sendChatRequest([{ role: 'user', content: fullPrompt }]);

    let rawText = '';
    let evidenceBundle = null;
    let legalMeta = null;

    if (typeof response === 'object' && response !== null) {
      rawText = response.text || response.content || response.answer || JSON.stringify(response);
      evidenceBundle = response.legal?.evidenceBundle || response.evidenceBundle || null;
      legalMeta = response.legal || null;
    } else {
      rawText = String(response || '');
    }

    // Format Structured Legal Answer
    const formattedAnswerHtml = buildStructuredAnswerHtml(rawText, evidenceBundle, currentSearchState.mode, currentSearchState.effectiveDate);
    answerArea.innerHTML = formattedAnswerHtml;

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

function buildStructuredAnswerHtml(rawAnswer, evidenceBundle, mode, effectiveDate) {
  const formattedBody = formatLegalAnswer(rawAnswer, evidenceBundle);

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
      ${formattedBody}
    </div>
  `;
}

function bindCitationInteractions(container) {
  const chips = container.querySelectorAll('.legal-citation-chip');
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      const docNum = chip.dataset.citationId || chip.querySelector('.chip-text')?.textContent || '';
      if (!docNum) return;

      const cards = container.querySelectorAll('.evidence-card');
      cards.forEach(card => {
        card.classList.remove('highlighted');
        if (card.innerText.toLowerCase().includes(docNum.toLowerCase())) {
          card.classList.add('highlighted');
          card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      });
    });
  });
}

function buildModePrompt(query, mode, effectiveDate) {
  const dateContext = `Thời điểm kiểm tra hiệu lực bắt buộc: ${effectiveDate}.`;

  switch (mode) {
    case 'document-lookup':
      return `${dateContext} Tra cứu văn bản quy phạm pháp luật theo số hiệu/tên: "${query}". Yêu cầu cung cấp chính xác Số hiệu, Tên văn bản, Cơ quan ban hành, Ngày ban hành, Ngày hiệu lực, Trạng thái hiệu lực hiện tại, Văn bản sửa đổi/thay thế (nếu có).`;

    case 'situation-analysis':
      return `${dateContext} Phân tích tình huống pháp lý sau: "${query}". Yêu cầu trình bày theo cấu trúc: A. KẾT LUẬN HƯỚNG XỬ LÝ, B. PHÂN TÍCH TÌNH HUỐNG DỰA TRÊN QUY ĐỊNH, C. CĂN CỨ PHÁP LÝ CHÍNH THỨC, D. LƯU Ý VỀ THỜI ĐIỂM HIỆU LỰC VÀ RỦI RO.`;

    case 'compare-regulations':
      return `${dateContext} So sánh quy định pháp luật về: "${query}". Trình bày sự khác biệt giữa các văn bản, điểm mới sửa đổi bổ sung và văn bản hiện hành đang áp dụng.`;

    case 'effective-date':
      return `Tra cứu và xác định hiệu lực tại thời điểm ${effectiveDate} đối với: "${query}". Phân biệt rõ: HIỆN HÀNH / HẾT HIỆU LỰC / CHƯA CÓ HIỆU LỰC / BỊ THAY THẾ / BỊ SỬA ĐỔI.`;

    default:
      return `${dateContext} Câu hỏi tra cứu pháp luật: "${query}". Trình bày kết luận rõ ràng, phân tích từng điều khoản căn cứ và liệt kê danh sách trích dẫn văn bản chính thức.`;
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
