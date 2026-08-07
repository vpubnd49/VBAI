/**
 * VBAI Legal Pro V2 — Evidence Panel Component
 * Displays verified legal evidence cards, citation details, and legal relation graph.
 */

export function renderEvidencePanel(container, evidenceData = null) {
  if (!container) return;

  const bundle = evidenceData?.legal?.evidenceBundle || evidenceData?.evidenceBundle || evidenceData || {};
  const documents = Array.isArray(bundle.documents) ? bundle.documents : (Array.isArray(bundle) ? bundle : []);
  const crossReferences = evidenceData?.legal?.crossReferences || bundle.crossReferences || null;
  const verification = evidenceData?.legal?.verification || bundle.verification || {};

  const totalDocs = documents.length;
  const verifiedDocs = documents.filter(d => d.verified === true || d.verificationStatus === 'verified').length;
  const officialDocs = documents.filter(d => d.sourceTier === 'official' || d.isOfficial).length;

  let contentHtml = '';

  if (totalDocs === 0) {
    contentHtml = `
      <div class="evidence-empty-state">
        <div class="evidence-empty-icon">⚖️</div>
        <div class="evidence-empty-title">Chưa có căn cứ được kiểm chứng từ hệ thống.</div>
        <div class="evidence-empty-desc">Nhập câu hỏi hoặc số hiệu văn bản để tìm kiếm căn cứ trích dẫn chính thức.</div>
      </div>
    `;
  } else {
    const cardsHtml = documents.map((doc, idx) => renderEvidenceCard(doc, idx + 1)).join('');

    let relationGraphHtml = '';
    if (crossReferences && Array.isArray(crossReferences.nodes) && crossReferences.nodes.length > 0) {
      relationGraphHtml = renderRelationGraph(crossReferences);
    }

    contentHtml = `
      <div class="evidence-summary-bar">
        <div class="evidence-stat">
          <span class="evidence-stat-num">${totalDocs}</span>
          <span class="evidence-stat-label">Căn cứ</span>
        </div>
        <div class="evidence-stat">
          <span class="evidence-stat-num verified-num">${verifiedDocs}</span>
          <span class="evidence-stat-label">Đã xác minh</span>
        </div>
        <div class="evidence-stat">
          <span class="evidence-stat-num official-num">${officialDocs}</span>
          <span class="evidence-stat-label">Nguồn chính thức</span>
        </div>
      </div>

      ${relationGraphHtml}

      <div class="evidence-cards-list">
        ${cardsHtml}
      </div>
    `;
  }

  container.innerHTML = `
    <div class="evidence-panel-inner">
      <div class="evidence-panel-header">
        <div class="evidence-header-title">
          <span class="evidence-header-icon">📜</span>
          Căn cứ pháp lý & Chứng cứ
        </div>
        <span class="evidence-header-badge">${verifiedDocs > 0 ? 'Đã kiểm chứng' : 'Tham khảo'}</span>
      </div>
      <div class="evidence-panel-body">
        ${contentHtml}
      </div>
    </div>
  `;
}

export function renderEvidenceCard(doc = {}, index = 1) {
  const docNumber = doc.documentNumber || doc.so_hieu || doc.number || '';
  const title = doc.title || doc.ten_van_ban || 'Văn bản pháp luật';
  const article = doc.article || doc.dieu || '';
  const clause = doc.clause || doc.khoan || '';
  const point = doc.point || doc.diem || '';
  const snippet = doc.snippet || doc.trich_doan || doc.summary || '';
  const effectiveStatus = doc.effectiveStatus || doc.tinh_trang_hieu_luc || 'co_hieu_luc';
  const isOfficial = doc.sourceTier === 'official' || doc.isOfficial === true;
  const isVerified = doc.verified === true || doc.verificationStatus === 'verified';
  const url = doc.url || doc.link || doc.sourceUrl || '#';

  let coordLabel = '';
  if (point) coordLabel += `Điểm ${point} `;
  if (clause) coordLabel += `Khoản ${clause} `;
  if (article) coordLabel += `Điều ${article}`;
  coordLabel = coordLabel.trim();

  // Status Badge Logic
  let statusBadgeClass = 'status-active';
  let statusText = 'Còn hiệu lực';
  if (effectiveStatus === 'EXPIRED' || effectiveStatus === 'het_hieu_luc') {
    statusBadgeClass = 'status-expired';
    statusText = 'Hết hiệu lực';
  } else if (effectiveStatus === 'PARTIALLY_EXPIRED' || effectiveStatus === 'het_hieu_luc_mot_phan') {
    statusBadgeClass = 'status-partial';
    statusText = 'Hết hiệu lực một phần';
  } else if (effectiveStatus === 'SUSPENDED' || effectiveStatus === 'ngung_hieu_luc') {
    statusBadgeClass = 'status-suspended';
    statusText = 'Ngưng hiệu lực';
  } else if (effectiveStatus === 'unknown') {
    statusBadgeClass = 'status-unknown';
    statusText = 'Chưa xác định hiệu lực';
  }

  // Verification Badge: ONLY render 'Đã kiểm chứng' if verified === true
  const verificationBadgeHtml = isVerified
    ? `<span class="verify-chip verified-true">✓ Đã kiểm chứng</span>`
    : `<span class="verify-chip verified-false">Tham khảo</span>`;

  const sourceTierBadgeHtml = isOfficial
    ? `<span class="source-chip source-official">🏛️ Nguồn chính thức</span>`
    : `<span class="source-chip source-reference">📄 Nguồn tham khảo</span>`;

  const cardId = `evidence-card-${doc.id || index}`;

  return `
    <div class="evidence-card ${isVerified ? 'is-verified' : ''}" id="${cardId}" data-doc-number="${escapeAttribute(docNumber)}">
      <div class="evidence-card-head">
        <span class="evidence-index">#${index}</span>
        <div class="evidence-card-badges">
          ${sourceTierBadgeHtml}
          ${verificationBadgeHtml}
          <span class="status-chip ${statusBadgeClass}">${statusText}</span>
        </div>
      </div>

      <div class="evidence-card-title">${escapeHtml(title)}</div>

      ${docNumber ? `<div class="evidence-docnum">Số hiệu: <strong>${escapeHtml(docNumber)}</strong></div>` : ''}
      ${coordLabel ? `<div class="evidence-coord">Căn cứ: <strong>${escapeHtml(coordLabel)}</strong></div>` : ''}

      ${snippet ? `
        <div class="evidence-snippet">
          <span class="snippet-quote">“</span>${escapeHtml(snippet)}<span class="snippet-quote">”</span>
        </div>
      ` : ''}

      <div class="evidence-card-foot">
        ${url && url !== '#' ? `<a href="${url}" target="_blank" rel="noopener noreferrer" class="evidence-link">Xem văn bản gốc ↗</a>` : '<span class="evidence-link disabled">Nguồn lưu trữ nội bộ</span>'}
      </div>
    </div>
  `;
}

function renderRelationGraph(crossReferences) {
  const nodes = crossReferences.nodes || [];
  const edges = crossReferences.edges || [];
  if (nodes.length === 0) return '';

  return `
    <div class="legal-relation-graph">
      <div class="relation-graph-title">🔗 Sơ đồ mối quan hệ văn bản</div>
      <div class="relation-nodes-flow">
        ${nodes.map(node => `
          <div class="relation-node-item">
            <div class="relation-node-box">${escapeHtml(node.label || node.id)}</div>
            ${node.type ? `<span class="relation-type-tag">${escapeHtml(node.type)}</span>` : ''}
          </div>
        `).join('<div class="relation-arrow">↓</div>')}
      </div>
    </div>
  `;
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttribute(str) {
  return String(str || '').replace(/"/g, '&quot;');
}
