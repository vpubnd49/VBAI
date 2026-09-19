/**
 * Legal Source Panel UI Component.
 */
let panelElement = null;

export function initSourcePanel() {
  if (typeof document === 'undefined') return;
  let el = document.getElementById('vbai-source-panel');
  if (!el) {
    el = document.createElement('div');
    el.id = 'vbai-source-panel';
    el.className = 'vbai-source-panel-drawer hidden';
    el.innerHTML = `
      <div class="source-panel-header">
        <h3>Thông tin Nguồn Pháp lý</h3>
        <button id="source-panel-close-btn" class="close-btn">&times;</button>
      </div>
      <div id="source-panel-content" class="source-panel-body">
        <p class="text-muted">Chọn một trích dẫn để xem nguồn đầy đủ.</p>
      </div>
    `;
    document.body.appendChild(el);
  }
  panelElement = el;

  const closeBtn = document.getElementById('source-panel-close-btn');
  if (closeBtn) {
    closeBtn.onclick = () => hideSourcePanel();
  }
}

export function hideSourcePanel() {
  if (panelElement) {
    panelElement.classList.add('hidden');
  }
}

export async function openSourcePanel(docNumber, article = null) {
  if (!panelElement) initSourcePanel();
  if (!panelElement) return;

  panelElement.classList.remove('hidden');
  const contentEl = document.getElementById('source-panel-content');
  if (!contentEl) return;

  contentEl.innerHTML = `<div class="loading-spinner">Đang tải thông tin văn bản ${docNumber}...</div>`;

  try {
    const res = await fetch(`/api/legal-sources/${encodeURIComponent(docNumber)}`);
    if (!res.ok) throw new Error('Không thể lấy thông tin văn bản');
    const data = await res.json();
    const doc = data?.document;

    if (!doc) {
      contentEl.innerHTML = `<div class="alert alert-warning">Không tìm thấy thông tin chi tiết cho văn bản ${docNumber}.</div>`;
      return;
    }

    let html = `
      <div class="doc-card">
        <h4 class="doc-title">${doc.title || 'Văn bản pháp luật'}</h4>
        <div class="doc-meta-grid">
          <div><strong>Số hiệu:</strong> ${doc.documentNumber}</div>
          <div><strong>Cơ quan ban hành:</strong> ${doc.issuer || 'Quốc hội'}</div>
          <div><strong>Ngày ban hành:</strong> ${doc.issueDate || 'Đã ban hành'}</div>
          <div><strong>Hiệu lực:</strong> ${doc.effectiveDate || 'Đã có hiệu lực'}</div>
          <div><strong>Tình trạng:</strong> <span class="badge ${doc.effectiveStatus === 'co_hieu_luc' ? 'badge-success' : 'badge-warning'}">${doc.effectiveStatus || 'Có hiệu lực'}</span></div>
        </div>
    `;

    // PDF download button
    if (doc.pdfDownloadUrl) {
      html += `
        <div class="doc-pdf-download" style="margin: 12px 0;">
          <a href="${doc.pdfDownloadUrl}" target="_blank" rel="noopener noreferrer"
             class="btn-download-pdf"
             style="display:inline-flex;align-items:center;gap:6px;padding:8px 16px;background:linear-gradient(135deg,#0d6efd,#0b5ed7);color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;box-shadow:0 2px 8px rgba(13,110,253,.3);transition:all .2s ease">
            <span style="font-size:18px">📥</span> Tải PDF gốc từ Cổng Chính phủ
          </a>
        </div>
      `;
    } else if (doc.chinhphuDetailUrl) {
      html += `
        <div class="doc-chinhphu-link" style="margin: 12px 0;">
          <a href="${doc.chinhphuDetailUrl}" target="_blank" rel="noopener noreferrer"
             style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;background:#f0f7ff;color:#0d6efd;border:1px solid #b8daff;border-radius:6px;text-decoration:none;font-size:13px;transition:all .2s ease">
            🏛️ Xem trên Cổng Chính phủ
          </a>
        </div>
      `;
    }

    if (doc.summary) {
      html += `<div class="doc-summary"><h5>Tóm tắt chính sách</h5><p>${typeof doc.summary === 'string' ? doc.summary : ''}</p></div>`;
    }

    if (doc.chapterArticleSummary) {
      html += `<div class="doc-structure"><h5>Cấu trúc Chương/Điều</h5><pre>${doc.chapterArticleSummary}</pre></div>`;
    }

    html += `</div>`;
    contentEl.innerHTML = html;
  } catch (err) {
    contentEl.innerHTML = `<div class="alert alert-danger">Lỗi khi tải thông tin văn bản: ${err.message}</div>`;
  }
}
