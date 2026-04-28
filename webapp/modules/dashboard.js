import { renderChatUI } from "./chat-assistant.js";

/**
 * Dashboard Module — Landing page with stats and module cards
 */
export function renderDashboard(container, navigateTo) {
  container.innerHTML = `
    <div class="dashboard-hero">
      <h1 class="hero-title">Trợ Lý Soạn Văn Bản AI</h1>
      <p class="hero-sub">Soạn văn bản hành chính & văn bản Đảng chuẩn thể thức — nhanh chóng, chính xác, chuyên nghiệp</p>
    </div>

    <!-- Chat Assistant Panel (Full-width, Top) -->
    <div id="chat-assistant-container" style="margin-bottom: 32px;"></div>

    <section>
      <h2 style="font-size: 1rem; font-weight: 700; margin-bottom: 4px; color: var(--text-primary);">Chọn Công Cụ Soạn Thảo</h2>
      <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 16px;">Bắt đầu soạn văn bản hoặc xử lý tài liệu</p>

      <div class="modules-grid">
        <div class="module-card" data-accent="pine" data-page="vb-dang" id="card-vb-dang">
          <div class="module-icon pine">📜</div>
          <div class="module-title">Văn Bản Đảng (HD36)</div>
          <div class="module-desc">Chuẩn Hướng dẫn 36-HD/VPTW</div>
          <div class="module-badge">Nghị quyết, Chỉ thị...</div>
        </div>

        <div class="module-card" data-accent="mist" data-page="vb-nd30" id="card-vb-nd30">
          <div class="module-icon mist">📋</div>
          <div class="module-title">Hành Chính (NĐ30)</div>
          <div class="module-desc">Chuẩn NĐ 30/2020/NĐ-CP</div>
          <div class="module-badge">Quyết định, Báo cáo...</div>
        </div>

        <div class="module-card" data-accent="earth" data-page="pdf-tool" id="card-pdf-tool">
          <div class="module-icon earth">📄</div>
          <div class="module-title">Xử Lý PDF</div>
          <div class="module-desc">Trích xuất nội dung, OCR</div>
          <div class="module-badge">Merge • OCR • Text</div>
        </div>

        <div class="module-card" data-accent="rose" data-page="docx-tool" id="card-docx-tool">
          <div class="module-icon rose">📝</div>
          <div class="module-title">Tạo File DOCX</div>
          <div class="module-desc">Soạn thảo văn bản Word</div>
          <div class="module-badge">Chỉnh sửa • Tạo mới</div>
        </div>
      </div>
    </section>

    <footer class="app-footer">
      <div class="footer-line">Ver 1.0 - Văn phòng UBND tỉnh Lâm Đồng</div>
      <div class="footer-line">PHÁT TRIỂN BỞI: <a href="https://www.facebook.com/haichau2404" target="_blank" rel="noopener" class="footer-link">TRƯƠNG HẢI CHÂU</a></div>
      <div class="footer-line" style="margin-top: 8px;">
        <img src="https://komarev.com/ghpvc/?username=vpubnd49-vbai&label=LƯỢT+TRUY+CẬP&color=e6a200&style=flat" alt="Hits" style="height: 18px; opacity: 0.9; vertical-align: middle;">
      </div>
    </footer>
  `;

  // Render Chat UI
  const chatContainer = container.querySelector('#chat-assistant-container');
  renderChatUI(chatContainer);

  // Module card clicks
  container.querySelectorAll('.module-card').forEach(card => {
    card.addEventListener('click', () => navigateTo(card.dataset.page));
  });
}

