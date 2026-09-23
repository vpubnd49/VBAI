/**
 * Tools Hub — Trang Tiện ích tổng hợp
 * Hiển thị lưới các công cụ hay dùng, phân nhóm rõ ràng
 */
export function renderToolsHub(container, navigateTo) {
  container.innerHTML = `
    <div class="tools-hub-page">
      <!-- Header -->
      <div class="tools-hub-header">
        <h2 class="tools-hub-title">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
            <polyline points="2 17 12 22 22 17"></polyline>
            <polyline points="2 12 12 17 22 12"></polyline>
          </svg>
          Tiện ích
        </h2>
        <span class="tools-hub-subtitle">Công cụ thường dùng</span>
      </div>

      <!-- NHÓM 1: Tra cứu & Phân tích -->
      <section class="tools-group">
        <div class="tools-group-label">
          <span class="tools-group-dot teal"></span>
          Tra cứu & Phân tích
        </div>
        <div class="tools-grid">
          <button class="tool-card" data-page="legal-search">
            <div class="tool-card-icon teal">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            </div>
            <span class="tool-card-name">Tra cứu<br>pháp luật</span>
          </button>
          <button class="tool-card" data-page="document-lookup">
            <div class="tool-card-icon blue">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
            </div>
            <span class="tool-card-name">Tra cứu<br>văn bản</span>
          </button>
          <button class="tool-card" data-page="compare-regulations">
            <div class="tool-card-icon purple">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 3 21 3 21 8"></polyline><line x1="4" y1="20" x2="21" y2="3"></line><polyline points="21 16 21 21 16 21"></polyline><line x1="15" y1="15" x2="21" y2="21"></line></svg>
            </div>
            <span class="tool-card-name">So sánh<br>quy định</span>
          </button>
          <button class="tool-card" data-page="situation-analysis">
            <div class="tool-card-icon amber">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
            </div>
            <span class="tool-card-name">Phân tích<br>tình huống</span>
          </button>
          <button class="tool-card" data-page="effective-date">
            <div class="tool-card-icon emerald">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            </div>
            <span class="tool-card-name">Hiệu lực<br>& sửa đổi</span>
          </button>
          <button class="tool-card" data-page="search-history">
            <div class="tool-card-icon indigo">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            </div>
            <span class="tool-card-name">Lịch sử<br>tra cứu</span>
          </button>
        </div>
      </section>

      <!-- NHÓM 2: Soạn thảo văn bản -->
      <section class="tools-group">
        <div class="tools-group-label">
          <span class="tools-group-dot coral"></span>
          Soạn thảo văn bản
        </div>
        <div class="tools-grid">
          <button class="tool-card" data-page="vb-nd30">
            <div class="tool-card-icon teal">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </div>
            <span class="tool-card-name">VB Hành chính<br>NĐ 30</span>
          </button>
          <button class="tool-card" data-page="vb-dang">
            <div class="tool-card-icon coral">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
            </div>
            <span class="tool-card-name">VB Đảng<br>HD 05</span>
          </button>
          <button class="tool-card" data-page="docx-tool">
            <div class="tool-card-icon blue">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
            </div>
            <span class="tool-card-name">Tạo & Xuất<br>file Word</span>
          </button>
        </div>
      </section>

      <!-- NHÓM 3: Công cụ tài liệu -->
      <section class="tools-group">
        <div class="tools-group-label">
          <span class="tools-group-dot cyan"></span>
          Công cụ tài liệu
        </div>
        <div class="tools-grid">
          <button class="tool-card" data-page="pdf-tool">
            <div class="tool-card-icon cyan">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
            </div>
            <span class="tool-card-name">Nhận dạng<br>PDF / OCR</span>
          </button>
          <button class="tool-card" data-page="spell-check">
            <div class="tool-card-icon amber">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>
            </div>
            <span class="tool-card-name">Kiểm tra<br>thể thức</span>
          </button>
          <button class="tool-card" data-page="pdf-publisher">
            <div class="tool-card-icon emerald">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
            </div>
            <span class="tool-card-name">Tóm tắt<br>hồ sơ</span>
          </button>
          <button class="tool-card" data-page="meeting-minutes">
            <div class="tool-card-icon purple">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
            </div>
            <span class="tool-card-name">Biên bản<br>cuộc họp</span>
          </button>
        </div>
      </section>

      <!-- NHÓM 4: Trợ lý & Kết nối -->
      <section class="tools-group">
        <div class="tools-group-label">
          <span class="tools-group-dot blue"></span>
          Trợ lý & Kết nối
        </div>
        <div class="tools-grid">
          <button class="tool-card" data-page="chat-assistant">
            <div class="tool-card-icon teal">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path><circle cx="9" cy="10" r="1.5" fill="currentColor"></circle><circle cx="15" cy="10" r="1.5" fill="currentColor"></circle></svg>
            </div>
            <span class="tool-card-name">Trợ lý AI<br>pháp luật</span>
          </button>
          <button class="tool-card" data-page="zalo-bot">
            <div class="tool-card-icon blue">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zm4 0h3v3h-3zm-4 4h3v3h-3zm4 4h3v3h-3z"/></svg>
            </div>
            <span class="tool-card-name">Bot Zalo<br>VBAI</span>
          </button>
        </div>
      </section>
    </div>
  `;

  // Attach click handlers
  container.querySelectorAll('.tool-card[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      const page = btn.dataset.page;
      if (page && navigateTo) navigateTo(page);
    });
  });
}
