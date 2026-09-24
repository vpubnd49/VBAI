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
  let rawUrl = doc.url || doc.link || doc.sourceUrl || '#';

  // Validate URL: reject generic homepages/search pages that don't point to a specific document
  const isGenericUrl = (u) => {
    if (!u || u === '#') return true;
    try {
      const parsed = new URL(u);
      // Reject bare homepage (path is / with no meaningful query)
      if (parsed.pathname === '/' && !parsed.search) return true;
      if (parsed.pathname === '/' && parsed.searchParams.get('pageid') && !parsed.searchParams.get('docid')) return true;
      // Reject search listing pages (mode=0 without docid)
      if (parsed.searchParams.get('mode') === '0' && !parsed.searchParams.get('docid')) return true;
    } catch (_) {}
    return false;
  };

  // If URL is generic, try chinhphuDetailUrl, then fall back to VBPL search
  let url = rawUrl;
  if (isGenericUrl(url)) {
    if (doc.chinhphuDetailUrl && !isGenericUrl(doc.chinhphuDetailUrl)) {
      url = doc.chinhphuDetailUrl;
    } else if (docNumber) {
      url = `https://vanban.chinhphu.vn/tim-kiem?q=${encodeURIComponent(docNumber)}`;
    }
  }

  // Resolve PDF URLs: support both single and array
  const pdfUrls = doc.pdfDownloadUrls && doc.pdfDownloadUrls.length > 0
    ? doc.pdfDownloadUrls
    : (doc.pdfDownloadUrl ? [doc.pdfDownloadUrl] : []);

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

  // User requested: "bên khung sơ đồ không cần phải liệt kê chi tiết như vậy"
  // Keep the sidebar evidence card clean, concise, and focused on metadata without lengthy quotes or chapter listings
  const issuer = doc.issuer || doc.co_quan_ban_hanh || '';
  const issueDate = doc.issueDate || doc.issue_date || doc.ngay_ban_hanh || '';
  const effectiveDate = doc.effectiveDate || doc.effective_date || doc.ngay_hieu_luc || '';
  const cardId = doc.id ? ('card-' + String(doc.id)) : ('evidence-card-' + index);

  // Build footer links
  let footerLinks = '';

  // "Xem văn bản gốc" — only if URL is meaningful
  if (url && url !== '#') {
    footerLinks += `<a href="${url}" target="_blank" rel="noopener noreferrer" class="evidence-link">Xem văn bản gốc ↗</a>`;
  }

  // Cổng Chính phủ detail link (if different from main URL)
  const cpUrl = doc.chinhphuDetailUrl || '';
  if (cpUrl && !isGenericUrl(cpUrl) && cpUrl !== url) {
    footerLinks += `<a href="${cpUrl}" target="_blank" rel="noopener noreferrer" class="evidence-link" style="margin-left:8px;color:#0d6efd;font-size:13px">🏛️ Cổng Chính phủ</a>`;
  }

  // PDF download button(s) — always show when available
  if (pdfUrls.length > 1) {
    pdfUrls.forEach((pUrl, i) => {
      footerLinks += `<a href="${pUrl}" target="_blank" rel="noopener noreferrer" class="evidence-link evidence-link-pdf" style="margin-left:8px;display:inline-flex;align-items:center;gap:4px;color:#0d6efd;font-weight:600;background:#e7f1ff;padding:4px 10px;border-radius:6px;text-decoration:none;font-size:13px">📥 Tải PDF P${i + 1}</a>`;
    });
  } else if (pdfUrls.length === 1) {
    footerLinks += `<a href="${pdfUrls[0]}" target="_blank" rel="noopener noreferrer" class="evidence-link evidence-link-pdf" style="margin-left:8px;display:inline-flex;align-items:center;gap:4px;color:#0d6efd;font-weight:600;background:#e7f1ff;padding:4px 10px;border-radius:6px;text-decoration:none;font-size:13px">📥 Tải PDF</a>`;
  }

  if (!footerLinks) {
    footerLinks = '<span class="evidence-link disabled">Nguồn lưu trữ nội bộ</span>';
  }

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
      ${issuer || issueDate ? `
        <div class="evidence-meta-info" style="font-size:12px;color:#6c757d;margin:4px 0">
          ${issuer ? `<span>🏛️ ${escapeHtml(issuer)}</span>` : ''}
          ${issueDate ? `<span style="margin-left:8px">📅 ${escapeHtml(issueDate)}</span>` : ''}
        </div>
      ` : ''}

      <div class="evidence-card-foot" style="margin-top:10px">
        ${footerLinks}
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
      <div class="relation-nodes-flow" style="display:flex;flex-direction:column;align-items:center;gap:0">
        ${nodes.map((node, i) => `
          ${i > 0 ? '<div class="relation-arrow" style="display:flex;flex-direction:column;align-items:center;color:#6c757d;font-size:20px;line-height:1;margin:2px 0"><svg width="16" height="24" viewBox="0 0 16 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 0v18M3 14l5 6 5-6" stroke="#6c757d" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>' : ''}
          <div class="relation-node-item" style="width:100%;max-width:500px;min-width:0;box-sizing:border-box">
            <div class="relation-node-box">${escapeHtml(node.label || node.id)}</div>
            ${node.type ? `<span class="relation-type-tag">${escapeHtml(node.type)}</span>` : ''}
          </div>
        `).join('')}
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
