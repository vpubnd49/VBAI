import { getVisitCount, recordVisitSession } from './ai-proxy.js';

export function renderDashboard(container, navigateTo) {
  const recentSearches = getRecentSearches();


  container.innerHTML = `
    <div class="legal-home-wrapper">
      <!-- HERO SECTION -->
      <section class="legal-home-hero">
        <div class="hero-brand-header">
          <img src="/legal-pro-logo.svg" alt="VBAI Legal Pro" class="legal-pro-main-logo">
          <div class="hero-tagline-badge">VBAI · Tra cứu chính xác, không suy đoán</div>
        </div>

        <h1 class="hero-main-title">Tra cứu pháp luật có kiểm chứng</h1>
        <p class="hero-sub-title">Tìm đúng văn bản, đúng điều khoản, đúng thời điểm hiệu lực.</p>

        <!-- LARGE CENTRAL SEARCH BOX -->
        <div class="legal-home-search-box">
          <div class="search-box-inner">
            <span class="search-box-icon">🔍</span>
            <input 
              type="text" 
              id="home-main-search-input" 
              class="home-search-input" 
              placeholder="Nhập câu hỏi, số hiệu văn bản, điều/khoản hoặc tình huống pháp lý..."
            >
            <button id="home-main-search-btn" class="btn btn-primary home-search-btn">
              <span>Tra cứu ngay</span>
            </button>
          </div>
        </div>

        <!-- QUICK ACTIONS GRID -->
        <div class="legal-quick-actions">
          <button class="quick-action-card" data-mode="legal-search">
            <span class="action-icon">🔍</span>
            <span class="action-title">Tra cứu pháp luật</span>
            <span class="action-sub">Hỏi đáp quy định & trích dẫn</span>
          </button>

          <button class="quick-action-card" data-mode="document-lookup">
            <span class="action-icon">📜</span>
            <span class="action-title">Tra cứu văn bản</span>
            <span class="action-sub">Số hiệu, ngày ban hành, hiệu lực</span>
          </button>

          <button class="quick-action-card" data-mode="effective-date">
            <span class="action-icon">📅</span>
            <span class="action-title">Kiểm tra hiệu lực</span>
            <span class="action-sub">Rà soát theo mốc thời gian</span>
          </button>

          <button class="quick-action-card" data-mode="compare-regulations">
            <span class="action-icon">🔄</span>
            <span class="action-title">So sánh quy định</span>
            <span class="action-sub">Đối chiếu điểm mới & sửa đổi</span>
          </button>

          <button class="quick-action-card" data-mode="situation-analysis">
            <span class="action-icon">⚖️</span>
            <span class="action-title">Phân tích tình huống</span>
            <span class="action-sub">Đánh giá rủi ro & áp dụng</span>
          </button>
        </div>
      </section>

      <!-- TWO COLUMN INFO REGION: Recent Searches + Legal Sources -->
      <div class="home-info-columns">
        <!-- RECENT SEARCHES REGION -->
        <section class="home-card-panel recent-searches-card">
          <div class="panel-card-head">
            <h3>🕒 Tra cứu gần đây</h3>
            <span class="panel-head-tag">Lịch sử cá nhân</span>
          </div>
          <div class="panel-card-body" id="recent-searches-list">
            ${renderRecentSearchesHtml(recentSearches)}
          </div>
        </section>

        <!-- LEGAL SOURCES TRUST REGION -->
        <section class="home-card-panel legal-sources-card">
          <div class="panel-card-head">
            <h3>🏛️ Nguyên tắc Nguồn Pháp Lý</h3>
            <span class="panel-head-tag verified-tag">Đã kiểm chứng</span>
          </div>
          <div class="panel-card-body">
            <ul class="legal-principles-list">
              <li>
                <strong class="principle-title">🏛️ Nguồn chính thức:</strong>
                <span class="principle-desc">Ưu tiên Cổng VBPL (vbpl.vn), Công báo, Báo Chính phủ, Cổng QH.</span>
              </li>
              <li>
                <strong class="principle-title">✓ Trạng thái kiểm chứng:</strong>
                <span class="principle-desc">Chỉ gắn mác "Đã kiểm chứng" khi hệ thống xác minh được điều khoản thật.</span>
              </li>
              <li>
                <strong class="principle-title">📅 Ngày hiệu lực thực tế:</strong>
                <span class="principle-desc">Tự động phân biệt văn bản Hiện hành, Hết hiệu lực, Bị bãi bỏ, Sửa đổi.</span>
              </li>
            </ul>
          </div>
        </section>
      </div>

      <!-- ANCILLARY TOOLS SHORTCUTS -->
      <section class="home-ancillary-section">
        <div class="section-head-row">
          <h2>Công cụ Phụ trợ & Soạn thảo</h2>
          <span>Nghiệp vụ hành chính số</span>
        </div>
        <div class="modules-grid ancillary-grid">
          <div class="ancillary-card" data-page="vb-nd30">
            <div class="card-icon ocean">📄</div>
            <div class="card-info">
              <div class="card-title">Soạn VB Hành chính (NĐ30)</div>
              <div class="card-desc">Công văn, Quyết định, Báo cáo chuẩn Nghị định 30/2020/NĐ-CP</div>
            </div>
          </div>

          <div class="ancillary-card" data-page="vb-dang">
            <div class="card-icon daquy">✍️</div>
            <div class="card-info">
              <div class="card-title">Soạn VB Đảng (HD05)</div>
              <div class="card-desc">Nghị quyết, Chỉ thị, Quyết định chuẩn Hướng dẫn 05-HD/VPTW</div>
            </div>
          </div>

          <div class="ancillary-card" data-page="spell-check">
            <div class="card-icon daquy">🔍</div>
            <div class="card-info">
              <div class="card-title">Kiểm tra Thể thức & Chính tả</div>
              <div class="card-desc">Rà soát lỗi thể thức văn bản hành chính & văn bản Đảng</div>
            </div>
          </div>

          <div class="ancillary-card" data-page="pdf-tool">
            <div class="card-icon sunset">⚙️</div>
            <div class="card-info">
              <div class="card-title">Nhận dạng & Xử lý tài liệu</div>
              <div class="card-desc">Trích xuất văn bản, gộp/tách trang và quét tài liệu PDF</div>
            </div>
          </div>

          <div class="ancillary-card" data-page="meeting-minutes">
            <div class="card-icon pine">🎙️</div>
            <div class="card-info">
              <div class="card-title">Xử lý Ghi âm Cuộc họp</div>
              <div class="card-desc">Chuyển ghi âm thành biên bản và thông báo kết luận</div>
            </div>
          </div>

          <div class="ancillary-card" data-page="docx-tool">
            <div class="card-icon pine">📝</div>
            <div class="card-info">
              <div class="card-title">Tạo & Xuất văn bản</div>
              <div class="card-desc">Biên tập tài liệu Word chuyên nghiệp và xuất file chuẩn</div>
            </div>
          </div>
        </div>
      </section>

      <!-- LIÊN HỆ HỖ TRỢ -->
      <section id="contact-section" class="home-card-panel" style="margin-top: 24px; border-left: 4px solid var(--brand-primary, #00778B);">
        <div class="panel-card-head">
          <h3>📞 Liên hệ hỗ trợ</h3>
          <span class="panel-head-tag">Hỗ trợ kỹ thuật</span>
        </div>
        <div class="panel-card-body" style="display: flex; flex-wrap: wrap; gap: 20px; padding: 16px 0;">
          <div style="flex: 1; min-width: 220px;">
            <div style="font-weight: 600; color: var(--text-primary, #0F172A); margin-bottom: 8px;">Người phụ trách</div>
            <div style="color: var(--text-secondary, #475569); font-size: 0.9rem; line-height: 1.7;">
              <strong>Trương Hải Châu</strong><br>
              Văn phòng UBND tỉnh Lâm Đồng
            </div>
          </div>
          <div style="flex: 1; min-width: 220px;">
            <div style="font-weight: 600; color: var(--text-primary, #0F172A); margin-bottom: 8px;">Thông tin liên hệ</div>
            <div style="color: var(--text-secondary, #475569); font-size: 0.9rem; line-height: 1.7;">
              📧 Email: <a href="mailto:chauth@lamdong.gov.vn" style="color: var(--brand-primary, #00778B); text-decoration: none;">chauth@lamdong.gov.vn</a><br>
              📱 Điện thoại: <a href="tel:0985559988" style="color: var(--brand-primary, #00778B); text-decoration: none;">0985 559 988</a><br>
              💬 Messenger: <a href="https://m.me/haichau2404" target="_blank" style="color: var(--brand-primary, #00778B); text-decoration: none;">@haichau2404</a><br>
              💬 Zalo: <a href="https://zalo.me/0911677209" target="_blank" style="color: var(--brand-primary, #00778B); text-decoration: none;">0911 677 209</a><br>
              🏛️ Địa chỉ: Số 04, Trần Hưng Đạo, P.3, TP. Đà Lạt, Lâm Đồng
            </div>
          </div>
        </div>
      </section>

      <!-- SUPPORT & FOOTER SECTION -->
      <footer class="legal-pro-footer">
        <div class="footer-build-badge">
          <span>Trợ lý Tra cứu Pháp luật</span>
          <span class="dot-sep">•</span>
          <span>Văn phòng UBND tỉnh Lâm Đồng</span>
        </div>
        <div class="footer-credit">Phát triển bởi: Trương Hải Châu</div>
        <div class="footer-visit-counter">
          Lượt truy cập hệ thống: <strong id="visit-count">...</strong>
        </div>
      </footer>
    </div>
  `;

  // Bind Central Search Input & Button
  const mainInput = container.querySelector('#home-main-search-input');
  const mainBtn = container.querySelector('#home-main-search-btn');

  const executeHomeSearch = () => {
    const q = mainInput.value.trim();
    if (!q) return;
    window.location.hash = `#legal-search?q=${encodeURIComponent(q)}`;
    navigateTo('legal-search', q);
  };

  mainBtn.addEventListener('click', executeHomeSearch);
  mainInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') executeHomeSearch();
  });

  // Bind Quick Actions
  container.querySelectorAll('.quick-action-card').forEach(card => {
    card.addEventListener('click', () => {
      const mode = card.dataset.mode || 'legal-search';
      navigateTo('legal-search', '', mode);
    });
  });

  // Bind Ancillary Cards
  container.querySelectorAll('.ancillary-card').forEach(card => {
    card.addEventListener('click', () => {
      const page = card.dataset.page;
      if (page) navigateTo(page);
    });
  });

  // Bind Recent Search Clicks
  container.querySelectorAll('.recent-search-item').forEach(item => {
    item.addEventListener('click', () => {
      const q = item.dataset.query;
      const mode = item.dataset.mode || 'legal-search';
      if (q) navigateTo('legal-search', q, mode);
    });
  });

  // Load Build SHA in Footer
  loadFooterBuildInfo(container);

  // Hydrate Visit Counter safely from backend API
  hydrateVisitCounter(container);
}

async function hydrateVisitCounter(container) {
  const visitEl = container.querySelector('#visit-count');
  if (!visitEl) return;

  const SESSION_KEY = 'vbai_visit_session_v2';
  const isNewSession = !sessionStorage.getItem(SESSION_KEY);

  try {
    let count = null;
    if (isNewSession) {
      count = await recordVisitSession();
      if (count !== null) {
        sessionStorage.setItem(SESSION_KEY, '1');
      }
    }

    if (count === null) {
      count = await getVisitCount();
    }

    if (count !== null && typeof count === 'number') {
      visitEl.textContent = count.toLocaleString('vi-VN');
    } else {
      visitEl.textContent = '--';
    }
  } catch (err) {
    console.warn('Visit counter hydration failed safely:', err);
    visitEl.textContent = '--';
  }
}


function getRecentSearches() {
  try {
    return JSON.parse(localStorage.getItem('vbai_recent_searches') || '[]');
  } catch (e) {
    return [];
  }
}

function renderRecentSearchesHtml(searches) {
  if (!searches || searches.length === 0) {
    return `
      <div class="recent-empty">
        <span class="empty-icon">📂</span>
        <span>Chưa có lịch sử tra cứu. Nhập tìm kiếm đầu tiên ở trên!</span>
      </div>
    `;
  }

  return searches.map(item => `
    <div class="recent-search-item" data-query="${escapeAttribute(item.query)}" data-mode="${escapeAttribute(item.mode || 'legal-search')}">
      <span class="recent-icon">🔍</span>
      <span class="recent-query-text">${escapeHtml(item.query)}</span>
      <span class="recent-mode-tag">${getModeTagLabel(item.mode)}</span>
    </div>
  `).join('');
}

function getModeTagLabel(mode) {
  switch (mode) {
    case 'document-lookup': return 'Văn bản';
    case 'situation-analysis': return 'Tình huống';
    case 'compare-regulations': return 'So sánh';
    case 'effective-date': return 'Hiệu lực';
    default: return 'Pháp luật';
  }
}

function loadFooterBuildInfo() {
  // Build SHA display removed per user directive
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttribute(str) {
  return String(str || '').replace(/"/g, '&quot;');
}
