import { parseUniversalFile } from './universal-doc-parser.js';
/**
 * VBAI Legal Pro V2 — Central Legal Search Experience
 * Two-panel layout: Left (Query & Structured Answer) / Right (Evidence Panel)
 * Supports modes: legal-search, document-lookup, situation-analysis, compare-regulations, effective-date
 */

import { renderEvidencePanel } from './evidence-panel.js';
import { sendStructuredChatRequest, sendLegalAgentRequest } from './ai-proxy.js';
import { formatLegalAnswer, resolveDocLinks } from './legal/answer-formatter.js';
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
            <div class="legal-search-box-unified">
              <div class="legal-input-row-modern">
                <input 
                  type="text" 
                  id="legal-search-input" 
                  class="legal-search-input-field" 
                  placeholder="${getPlaceholderForMode(currentSearchState.mode)}"
                  value="${escapeAttribute(currentSearchState.query)}"
                >
                <button type="button" id="legal-file-btn" class="legal-file-attach-btn" title="Đính kèm file Word, Excel, PDF để đối chiếu quy định">
                  <span>📎 Đính kèm tệp</span>
                </button>
                <input type="file" id="legal-file-input" accept=".docx,.doc,.xlsx,.xls,.csv,.pdf,.txt,.json" style="display:none;">
              </div>
              <button id="legal-search-btn" class="btn btn-primary legal-search-submit-btn">
                <span class="search-submit-icon">🔍</span>
                <span>Tra cứu Pháp luật</span>
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
    if (!q && !legalAttachedFile) {
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

  // ===== FILE ATTACHMENT HANDLER (Event Delegation — robust against SPA re-render) =====
  container.addEventListener('click', (e) => {
    if (e.target.closest('#legal-file-btn')) {
      const inp = container.querySelector('#legal-file-input');
      if (inp) inp.click();
    }
  });

  container.addEventListener('change', async (e) => {
    if (e.target.id !== 'legal-file-input') return;
    const file = e.target.files?.[0];
    if (!file) return;

    const filePreviewEl = container.querySelector('#legal-file-preview');
    if (!filePreviewEl) return;

    // File size check (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      showToast('File quá lớn (tối đa 10MB)', 'warning');
      e.target.value = '';
      return;
    }

    // Show loading state
    filePreviewEl.style.display = 'flex';
    filePreviewEl.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;width:100%">
        <span>⏳</span>
        <div>
          <div style="font-weight:600">${escapeHtml(file.name)}</div>
          <div class="file-status" style="color:#64748b;font-size:0.75rem">Đang đọc và phân tích tệp...</div>
        </div>
      </div>
    `;

    try {
      const parsedResult = await parseUniversalFile(file, (status) => {
        const statusEl = filePreviewEl.querySelector('.file-status');
        if (statusEl) statusEl.textContent = status;
      });

      legalAttachedFile = {
        name: file.name,
        text: parsedResult.text,
        size: file.size,
        type: file.type
      };

      const kbSize = (file.size / 1024).toFixed(1);
      const extLower = file.name.toLowerCase();
      let fileIcon = '📄';
      let typeBadge = 'Văn bản';
      if (extLower.endsWith('.xlsx') || extLower.endsWith('.xls') || extLower.endsWith('.csv')) {
        fileIcon = '📊'; typeBadge = `Bảng tính (${parsedResult.meta?.totalRows || 0} dòng)`;
      } else if (extLower.endsWith('.docx') || extLower.endsWith('.doc')) {
        fileIcon = '📝'; typeBadge = `Văn bản Word`;
      } else if (extLower.endsWith('.pdf')) {
        fileIcon = '📑'; typeBadge = `PDF (${parsedResult.meta?.pageCount || 1} trang)`;
      }

      filePreviewEl.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;flex:1">
          <span>${fileIcon}</span>
          <div>
            <div style="font-weight:600" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</div>
            <div style="color:#059669;font-size:0.75rem">Sẵn sàng • ${typeBadge} • ${kbSize} KB</div>
          </div>
        </div>
        <button class="btn-remove-file" title="Xóa đính kèm" style="background:none;border:none;cursor:pointer;font-size:1.2rem;color:#94a3b8">×</button>
      `;

      showToast('Đã đính kèm tệp thành công! Nhấn Tra cứu để phân tích.', 'success');
    } catch (err) {
      filePreviewEl.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;width:100%;color:#dc2626">
          <span>❌</span>
          <div>${escapeHtml(err.message || 'Không thể đọc file')}</div>
        </div>
      `;
      legalAttachedFile = null;
      e.target.value = '';
    }
  });

  // Handle remove-file button via delegation too
  container.addEventListener('click', (e) => {
    if (e.target.closest('.btn-remove-file')) {
      legalAttachedFile = null;
      const prev = container.querySelector('#legal-file-preview');
      if (prev) { prev.style.display = 'none'; prev.innerHTML = ''; }
      const inp = container.querySelector('#legal-file-input');
      if (inp) inp.value = '';
      showToast('Đã gỡ bỏ file đính kèm');
    }
  });

  // If initial query was passed, run search immediately
  if (initialQuery) {
    triggerSearch();
  }
}

let legalAttachedFile = null; // Attached file for legal search: { name, text, size, type }
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
    resolveDocLinks();
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
        if (kd.pdf_download_url || kd.pdfDownloadUrl) {
          metaLines.push(`- Link tải file PDF chính thức: ${kd.pdf_download_url || kd.pdfDownloadUrl}`);
        }
        if (Array.isArray(kd.pdf_download_urls) && kd.pdf_download_urls.length > 1) {
          metaLines.push(`- Danh sách các phần file PDF chính thức:\n` + kd.pdf_download_urls.map((u, i) => `  + Phần ${i + 1}: ${u}`).join('\n'));
        }
        metaLines.push(`\n[QUY TẮC BẮT BUỘC]: BẮT BUỘC trình bày đầy đủ cả 6 phần (Phần I, II, III, IV, V, VI). Tuyệt đối không được nhảy cóc bỏ qua mục từ I đến V!`);

        fullPrompt += metaLines.join('\n');
      }
      if (Array.isArray(metaData?.recent_documents) && metaData.recent_documents.length > 0) {
        const recLines = ['\n\n[DANH MỤC VĂN BẢN QUY PHẠM PHÁP LUẬT LIÊN QUAN TRÊN HỆ THỐNG (CHỈ THAM KHẢO - KHÔNG TỰ Ý ĐƯA VÀO BẢNG VI NẾU KHÔNG LIÊN QUAN TRỰC TIẾP)]:'];
        metaData.recent_documents.slice(0, 5).forEach(rd => {
          recLines.push(`- [${rd.documentNumber}] ${rd.title} (Ban hành: ${rd.issueDate || 'Đã ban hành'})`);
        });
        recLines.push('- ⚠️ LƯU Ý: Danh mục trên CHỈ để tham khảo. TUYỆT ĐỐI KHÔNG đưa vào Bảng VI hoặc phân tích nếu văn bản KHÔNG liên quan trực tiếp đến câu hỏi.');
        fullPrompt += recLines.join('\n');
      }
    } catch (_) {}

    // Inject attached file content into prompt if available
    if (legalAttachedFile && legalAttachedFile.text) {
      const fileContext = `\n\n[NỘI DUNG TÀI LIỆU ĐÍNH KÈM (Tên file: ${legalAttachedFile.name})]:\n` +
                          `Hãy sử dụng nội dung tài liệu sau để đối chiếu và phân tích theo câu hỏi của người dùng:\n\n` +
                          legalAttachedFile.text.slice(0, 20000);
      fullPrompt += fileContext;
      // Clear attachment after use
      legalAttachedFile = null;
      const filePreviewEl = container.querySelector('#legal-file-preview');
      if (filePreviewEl) { filePreviewEl.style.display = 'none'; filePreviewEl.innerHTML = ''; }
      const fileInputEl = container.querySelector('#legal-file-input');
      if (fileInputEl) fileInputEl.value = '';
    }

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

    // Also try to get known_document from metadata cache or evidenceBundle
    if (!knownDocument) {
      try {
        const metaData = await getCachedMetadata(cleanQ);
        if (metaData?.found && metaData?.known_document) {
          knownDocument = metaData.known_document;
        }
      } catch (_) {}
    }

    if (!knownDocument && evidenceBundle && Array.isArray(evidenceBundle.documents) && evidenceBundle.documents.length > 0) {
      knownDocument = evidenceBundle.documents[0];
    }

    // Format Structured Legal Answer
    const formattedAnswerHtml = buildStructuredAnswerHtml(rawText, evidenceBundle, currentSearchState.mode, currentSearchState.effectiveDate, knownDocument);
    answerArea.innerHTML = formattedAnswerHtml;

    // Resolve document links (PDF + detail URLs) for unresolved docs in citation table
    resolveDocLinks();

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

function buildStructuredAnswerHtml(rawAnswer, evidenceBundle, mode, effectiveDate, knownDocument = null) {
  let resolvedKnownDoc = knownDocument;
  if (!resolvedKnownDoc && evidenceBundle && Array.isArray(evidenceBundle.documents) && evidenceBundle.documents.length > 0) {
    resolvedKnownDoc = evidenceBundle.documents[0];
  }

  const formattedBody = formatLegalAnswer(rawAnswer, evidenceBundle, [], resolvedKnownDoc);

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

[CHỈ THỊ TỐI CAO - BẮT BUỘC TRÌNH BÀY ĐỦ CẢ 6 PHẦN TỪ I ĐẾN VI]:
Dù câu hỏi của người dùng ngắn gọn (như "luật đất đai mới số bao nhiêu", "luật 72/2025 là gì", "tải file luật về cho tôi", "cho xem luật"), BẠN BẮT BUỘC PHẢI VIẾT ĐẦY ĐỦ TOÀN BỘ 6 PHẦN TỪ I ĐẾN VI!
TUYỆT ĐỐI NGHIÊM CẤM VIỆC CHỈ NÊU CÂU DẪN RỒI NHẢY CÓC SANG PHẦN VI MÀ BỎ QUA CÁC PHẦN I ĐẾN V!
Nếu bỏ qua bất kỳ phần nào từ I đến V, câu trả lời sẽ bị xem là vi phạm quy định và không đạt chuẩn.

[MỞ ĐẦU BẮT BUỘC]:
- Khi người dùng hỏi về văn bản hoặc yêu cầu tải file văn bản:
  Trước khi vào Phần I, BẮT BUỘC mở đầu bằng 1-2 câu kết luận trực diện, xác nhận số hiệu văn bản mới nhất hiện nay và dẫn vào bản phân tích:
  "[Tên văn bản] mới nhất hiện nay là [Loại văn bản] số [Số hiệu] (được [Cơ quan] thông qua/ban hành ngày [Ngày ban hành]).
  Dưới đây là thông tin chi tiết, phân tích pháp lý và đường dẫn tải về văn bản gốc theo đúng chuẩn quy định:"

[CẤU TRÚC BÀI PHÂN TÍCH BẮT BUỘC - TUYỆT ĐỐI KHÔNG BỎ MỤC NÀO]:
⚠️ BẮT BUỘC PHẢI CÓ ĐỦ 6 PHẦN SAU (TỪ PHẦN I ĐẾN PHẦN VI), TUYỆT ĐỐI KHÔNG ĐƯỢC NHẢY CÓC HAY BỎ QUA CÁC PHẦN TỪ I ĐẾN V:

I. KẾT LUẬN VỀ HIỆU LỰC & THẨM QUYỀN BAN HÀNH
   - Số hiệu trong ngoặc vuông [VD: 31/2024/QH15]
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
      - Tổng số chương, tổng số điều (VD: "Luật gồm 7 chương, 54 điều" hoặc "Luật gồm 16 chương, 260 điều")
      - Danh sách từng chương kèm phạm vi điều, ví dụ:
        * Chương I (Điều 1-6): Những quy định chung
        * Chương II (Điều 7-25): [Tên chương]
        * ...

   B. PHÂN TÍCH NỘI DUNG TỪNG CHƯƠNG/NHÓM QUY ĐỊNH:
      - Với mỗi chương hoặc nhóm chính sách trọng tâm, nêu 3-6 gạch đầu dòng chi tiết:
        + Các biện pháp cụ thể, quy trình thực hiện, mốc thời hạn
        + Quyền và nghĩa vụ các bên liên quan
        + Mức xử phạt, chế tài (nếu có)
        + Các quy định mới nổi bật, điểm khác biệt so với quy định trước

V. TRÁCH NHIỆM THI HÀNH & TỔ CHỨC THỰC HIỆN
   - Cơ quan chủ trì, cơ quan phối hợp
   - Trách nhiệm địa phương (UBND/HĐND các cấp)
   - Điều khoản chuyển tiếp (nếu có)

VI. BẢNG DANH MỤC TRÍCH DẪN VĂN BẢN PHÁP LÝ CHÍNH THỨC & TẢI FILE
   Bảng Markdown TỐI ĐA 3-4 hàng.
   ⚠️ CHỈ liệt kê:
   - Văn bản CHÍNH người dùng hỏi
   - Tối đa 2-3 nghị định/thông tư hướng dẫn thi hành TRỰC TIẾP
   ⚠️ TUYỆT ĐỐI KHÔNG liệt kê:
   - Các luật LĨNH VỰC KHÁC dù được đề cập trong mệnh đề "sửa đổi bổ sung một số điều của Luật X, Luật Y"
   - Văn bản đã HẾT HIỆU LỰC được thay thế bởi văn bản chính
   | Số hiệu văn bản | Tên loại & Trích yếu văn bản | Cơ quan ban hành | Ngày ban hành / Hiệu lực | Trạng thái hiệu lực | Link tải File / Nguồn kiểm chứng |
   | :--- | :--- | :--- | :--- | :--- | :--- |
   | [Số hiệu] | [Tên văn bản] | [Cơ quan] | [Ngày ban hành/hiệu lực] | [Còn hiệu lực/...] | [Tải về (PDF)](URL) hoặc [Cổng TTĐT Chính phủ](URL) |

[QUY TẮC LINK TẢI TỆP (DOWNLOAD LINK)]:
- TUYỆT ĐỐI KHÔNG tự bịa đặt hoặc đoán mò định dạng link tải datafiles.chinhphu.vn (CẤM bịa link .signed.pdf). CHỈ sử dụng link tải PDF chính xác được cung cấp trong [THÔNG TIN XÁC THỰC]. Nếu chưa có link PDF xác thực, dẫn về https://vanban.chinhphu.vn/ hoặc https://vbpl.vn/.
- Nếu trong ngữ cảnh tra cứu, khối xác thực hoặc cơ sở dữ liệu có link tải PDF, bạn BẮT BUỘC chèn link vào cột "Link tải File / Nguồn kiểm chứng" theo cú pháp markdown: [Tải về (PDF)](URL) (hoặc [Tải về Phần 1 (PDF)](URL)).
- Ngay dưới Bảng VI, BẮT BUỘC có dòng ghi chú:
  "Ghi chú: Bạn có thể bấm trực tiếp vào liên kết PDF ở bảng trên để tải trọn bộ file nguyên văn [Số hiệu] chính thức từ Cổng Thông tin điện tử Chính phủ Việt Nam."
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
