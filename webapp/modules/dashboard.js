/**
 * Dashboard Module — Landing page with stats and module cards
 */
export function renderDashboard(container, navigateTo) {
  container.innerHTML = `
    <div class="dashboard-hero">
      <h1 class="hero-title">Trợ Lý Soạn Văn Bản AI</h1>
      <p class="hero-sub">Soạn văn bản hành chính & văn bản Đảng chuẩn thể thức — nhanh chóng, chính xác, chuyên nghiệp</p>
    </div>

    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-icon">📜</div>
        <div class="stat-value">14</div>
        <div class="stat-label">Loại VB Đảng (HD36)</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">📋</div>
        <div class="stat-value">20+</div>
        <div class="stat-label">Loại VB Hành Chính (NĐ30)</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">⚡</div>
        <div class="stat-value">3s</div>
        <div class="stat-label">Thời gian tạo VB</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">✅</div>
        <div class="stat-value">100%</div>
        <div class="stat-label">Chuẩn thể thức</div>
      </div>
    </div>

    <h2 style="font-size: 1rem; font-weight: 700; margin-bottom: 4px; color: var(--text-primary);">Chọn Công Cụ</h2>
    <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 16px;">Bắt đầu soạn văn bản hoặc xử lý tài liệu</p>

    <div class="modules-grid">
      <div class="module-card" data-accent="pine" data-page="vb-dang" id="card-vb-dang">
        <div class="module-icon pine">📜</div>
        <div class="module-title">Văn Bản Đảng (HD36)</div>
        <div class="module-desc">Sinh VB Đảng chuẩn Hướng dẫn 36-HD/VPTW: Nghị quyết, Chỉ thị, Quyết định, Công văn, Biên bản...</div>
        <div class="module-badge">14 loại VB • HD 36-HD/VPTW</div>
      </div>

      <div class="module-card" data-accent="mist" data-page="vb-nd30" id="card-vb-nd30">
        <div class="module-icon mist">📋</div>
        <div class="module-title">Văn Bản Hành Chính (NĐ30)</div>
        <div class="module-desc">Sinh VB hành chính nhà nước chuẩn NĐ 30/2020: Quyết định, Thông báo, Báo cáo, Kế hoạch, Công văn...</div>
        <div class="module-badge">20+ loại VB • NĐ 30/2020/NĐ-CP</div>
      </div>

      <div class="module-card" data-accent="earth" data-page="pdf-tool" id="card-pdf-tool">
        <div class="module-icon earth">📄</div>
        <div class="module-title">Xử Lý PDF</div>
        <div class="module-desc">Upload PDF để trích xuất nội dung văn bản, bảng biểu. Hỗ trợ OCR cho file scan.</div>
        <div class="module-badge">Trích xuất • OCR • Merge</div>
      </div>

      <div class="module-card" data-accent="rose" data-page="docx-tool" id="card-docx-tool">
        <div class="module-icon rose">📝</div>
        <div class="module-title">Tạo File DOCX</div>
        <div class="module-desc">Tạo nhanh file Word (.docx) với định dạng chuyên nghiệp. Hỗ trợ header, footer, bảng biểu.</div>
        <div class="module-badge">Tạo mới • Phân tích • Chỉnh sửa</div>
      </div>
    </div>

    <footer class="app-footer">
      <div class="footer-line">Ver 1.0 - Văn phòng UBND tỉnh Lâm Đồng</div>
      <div class="footer-line">PHÁT TRIỂN BỞI: <a href="https://www.facebook.com/haichau2404" target="_blank" rel="noopener" class="footer-link">TRƯƠNG HẢI CHÂU</a></div>
    </footer>
  `;

  // Module card clicks
  container.querySelectorAll('.module-card').forEach(card => {
    card.addEventListener('click', () => navigateTo(card.dataset.page));
  });
}
