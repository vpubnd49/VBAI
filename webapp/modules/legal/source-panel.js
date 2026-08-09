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
