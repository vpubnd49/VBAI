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
      <div class="home-info-columns" style="grid-template-columns: 1fr;">
        <!-- RECENT SEARCHES REGION -->
        <section class="home-card-panel recent-searches-card">
          <div class="panel-card-head">
            <h3>🕒 Tra cứu gần đây</h3>
            <div style="display:flex; gap:8px; align-items:center;">
              <span class="panel-head-tag">Lịch sử cá nhân</span>
              ${recentSearches.length > 0 ? `<button id="clear-all-recent" style="font-size:0.72rem; padding:3px 10px; border:1px solid var(--border-default,#CBD5E1); background:transparent; color:var(--danger,#DC2626); border-radius:12px; cursor:pointer; transition:all 0.2s;" title="Xóa tất cả lịch sử">Xóa tất cả</button>` : ''}
            </div>
          </div>
          <div class="panel-card-body" id="recent-searches-list">
            ${renderRecentSearchesHtml(recentSearches)}
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
        <div class="panel-card-body" style="display: flex; align-items: center; flex-wrap: wrap; gap: 12px; padding: 8px 0;">
          <span style="color: var(--text-secondary, #475569); font-size: 0.88rem;"><strong>Trương Hải Châu</strong> · VP UBND tỉnh Lâm Đồng</span>
          <span style="color: var(--border-default, #CBD5E1);">|</span>
          <a href="https://m.me/haichau2404" target="_blank" style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; background: var(--accent-soft, #E7F7F9); color: var(--brand-primary, #00778B); border-radius: 20px; font-size: 0.84rem; font-weight: 600; text-decoration: none; transition: all 0.2s;">💬 Messenger</a>
          <a href="https://zalo.me/0911667209" target="_blank" style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; background: #E8F5E9; color: #2E7D32; border-radius: 20px; font-size: 0.84rem; font-weight: 600; text-decoration: none; transition: all 0.2s;">💬 Zalo</a>
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

  bindRecentSearchEvents(container, navigateTo);
  bindClearRecentButton(container, container.querySelector('#clear-all-recent'));

  // Load Build SHA in Footer
  loadFooterBuildInfo(container);

  // Hydrate only after main.js has established window.currentUser/auth token.
  hydrateRecentSearches(container, navigateTo);
  hydrateVisitCounter(container);
}

async function hydrateRecentSearches(container, navigateTo) {
  try {
    const { backendFetch } = await import('./ai-proxy.js');
    const response = await backendFetch('/search-history?limit=10', { method: 'GET' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const logs = Array.isArray(data.logs) ? data.logs : [];
    const searches = logs.map((item) => ({
      id: item.id,
      query: item.query || '',
      mode: item.mode || 'legal-search',
      created_at: item.created_at || item.timestamp,
    })).filter((item) => item.query);
    const listEl = container.querySelector('#recent-searches-list');
    if (listEl) listEl.innerHTML = renderRecentSearchesHtml(searches);
    bindRecentSearchEvents(container, navigateTo, searches);
    const clearBtn = container.querySelector('#clear-all-recent');
    if (!clearBtn && searches.length > 0) {
      const head = container.querySelector('.recent-searches-card .panel-card-head > div');
      if (head) {
        const button = document.createElement('button');
        button.id = 'clear-all-recent';
        button.textContent = 'Xóa tất cả';
        button.title = 'Xóa tất cả lịch sử';
        button.style.cssText = 'font-size:0.72rem; padding:3px 10px; border:1px solid var(--border-default,#CBD5E1); background:transparent; color:var(--danger,#DC2626); border-radius:12px; cursor:pointer;';
        head.appendChild(button);
        bindClearRecentButton(container, button);
      }
    } else if (clearBtn) {
      bindClearRecentButton(container, clearBtn);
    }
  } catch (err) {
    // Keep the locally cached list when the backend is unavailable.
    console.warn('Recent searches backend hydration failed safely:', err);
  }
}

async function hydrateVisitCounter(container) {
  const visitEl = container.querySelector('#visit-count');
  if (!visitEl) return;
  // Auth restoration can finish between render and token availability.
  if (!window.currentUser) {
    visitEl.textContent = '--';
    return;
  }

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
    let items = JSON.parse(localStorage.getItem('vbai_recent_searches') || '[]');
    // Auto-trim: keep only the 10 most recent
    if (items.length > 10) {
      items = items.slice(0, 10);
      localStorage.setItem('vbai_recent_searches', JSON.stringify(items));
    }
    return items;
  } catch (e) {
    return [];
  }
}

function bindRecentSearchEvents(container, navigateTo, searches = getRecentSearches()) {
  container.querySelectorAll('.recent-search-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.closest('.recent-delete-btn')) return;
      const q = item.dataset.query;
      const mode = item.dataset.mode || 'legal-search';
      if (q) navigateTo('legal-search', q, mode);
    });
  });
  container.querySelectorAll('.recent-delete-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      if (id) {
        try {
          const { backendFetch } = await import('./ai-proxy.js');
          const response = await backendFetch(`/search-history/${encodeURIComponent(id)}`, { method: 'DELETE' });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
        } catch (err) {
          console.warn('Recent search deletion failed safely:', err);
          return;
        }
      } else {
        deleteRecentSearchByIndex(parseInt(btn.dataset.index, 10));
      }
      const listEl = container.querySelector('#recent-searches-list');
      const next = id ? searches.filter(item => String(item.id) !== String(id)) : getRecentSearches();
      if (listEl) listEl.innerHTML = renderRecentSearchesHtml(next);
      bindRecentSearchEvents(container, navigateTo, next);
    });
  });
}

function bindClearRecentButton(container, button) {
  if (!button || button.dataset.bound === 'true') return;
  button.dataset.bound = 'true';
  button.addEventListener('click', async () => {
    if (!confirm('Xóa tất cả lịch sử tra cứu gần đây?')) return;
    try {
      const { backendFetch } = await import('./ai-proxy.js');
      const response = await backendFetch('/search-history', { method: 'DELETE' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch (err) {
      console.warn('Recent search clear failed safely:', err);
      return;
    }
    localStorage.removeItem('vbai_recent_searches');
    const listEl = container.querySelector('#recent-searches-list');
    if (listEl) listEl.innerHTML = renderRecentSearchesHtml([]);
    button.remove();
  });
}

function deleteRecentSearchByIndex(index) {
  try {
    const items = JSON.parse(localStorage.getItem('vbai_recent_searches') || '[]');
    if (index >= 0 && index < items.length) {
      items.splice(index, 1);
      localStorage.setItem('vbai_recent_searches', JSON.stringify(items));
    }
  } catch (e) { /* ignore */ }
}

function rebindRecentSearchEvents(container, navigateTo) {
  bindRecentSearchEvents(container, navigateTo); /* backward-compatible internal alias */
  return;
  /* istanbul ignore next */
  container.querySelectorAll('.recent-search-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.closest('.recent-delete-btn')) return;
      const q = item.dataset.query;
      const mode = item.dataset.mode || 'legal-search';
      if (q) navigateTo('legal-search', q, mode);
    });
  });
  container.querySelectorAll('.recent-delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.index, 10);
      deleteRecentSearchByIndex(idx);
      const listEl = container.querySelector('#recent-searches-list');
      if (listEl) listEl.innerHTML = renderRecentSearchesHtml(getRecentSearches());
      rebindRecentSearchEvents(container, navigateTo);
    });
  });
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

  return searches.map((item, idx) => `
    <div class="recent-search-item" data-query="${escapeAttribute(item.query)}" data-mode="${escapeAttribute(item.mode || 'legal-search')}">
      <span class="recent-icon">🔍</span>
      <span class="recent-query-text">${escapeHtml(item.query)}</span>
      <span class="recent-mode-tag">${getModeTagLabel(item.mode)}</span>
      <button class="recent-delete-btn" data-index="${idx}" data-id="${escapeAttribute(item.id || '')}" title="Xóa" style="background:none; border:none; color:var(--text-muted,#94A3B8); cursor:pointer; font-size:0.9rem; padding:2px 6px; border-radius:4px; transition:all 0.15s; line-height:1;" onmouseover="this.style.color='var(--danger,#DC2626)'" onmouseout="this.style.color='var(--text-muted,#94A3B8)'">✕</button>
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
