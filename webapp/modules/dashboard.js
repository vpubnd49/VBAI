import { getVisitCount, recordVisitSession } from './ai-proxy.js';

export function renderDashboard(container, navigateTo) {
  const recentSearches = getRecentSearches();

  let userObj = {};
  try {
    userObj = JSON.parse(localStorage.getItem('vbai_user') || '{}');
  } catch (_) {}
  const userName = userObj.displayName || userObj.name || window.currentUser?.displayName || 'Cán bộ tham mưu';
  const userSub = userObj.role === 'admin' ? 'Quản trị hệ thống' : (userObj.email || 'VBAI Legal Pro');

  container.innerHTML = `
    <div class="dash-wrapper">
      <!-- KHUNG TRA CỨU -->
      <section class="dash-search-section">
        <!-- Logo & Branding -->
        <div class="dash-brand-hero">
          <img src="/vbai-logo.png?v=20260923_white" alt="VBAI" class="dash-brand-logo">
          <div class="dash-brand-name">VBAI</div>
          <div class="dash-brand-sub">LEGAL INTELLIGENCE PLATFORM</div>
          <div class="dash-brand-badge">Tra cứu chính xác, không suy đoán</div>
        </div>
        <h2 class="dash-search-title">Tra cứu pháp luật có kiểm chứng</h2>
        <p class="dash-search-desc">Tìm đúng văn bản, đúng điều khoản, đúng thời điểm hiệu lực.</p>
        <div class="dash-search-box">
          <div class="dash-search-inner">
            <span class="dash-search-icon-wrapper">
              <svg class="dash-search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" stroke-width="2.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            </span>
            <input type="text" id="home-main-search-input" class="dash-search-input" placeholder="Nhập câu hỏi, số hiệu văn bản, điều/khoản hoặc tình huống pháp lý...">
            <button id="home-main-search-btn" class="dash-search-btn dash-search-btn-desktop">Tra cứu ngay</button>
          </div>
          <button id="home-main-search-btn-mobile" class="dash-search-btn dash-search-btn-mobile">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <span>Tra cứu ngay</span>
          </button>
        </div>
        <div class="dash-mode-chips">
          <button class="dash-chip" data-mode="legal-search">Tra cứu chung</button>
          <button class="dash-chip" data-mode="document-lookup">Tìm theo số hiệu</button>
          <button class="dash-chip" data-mode="situation-analysis">Tình huống</button>
          <button class="dash-chip" data-mode="compare-regulations">So sánh</button>
          <button class="dash-chip" data-mode="effective-date">Kiểm tra hiệu lực</button>
        </div>
      </section>

      <!-- NHÓM DỊCH VỤ -->
      <section class="dash-services-section">
        <div class="dash-section-header">
          <h3 class="dash-section-title">Dịch vụ</h3>
          <span class="dash-section-count">${window.isAdmin ? '9' : '8'} chức năng</span>
        </div>
        <div class="dash-service-grid">
          <button class="dash-svc-btn" data-page="vb-nd30">
            <div class="dash-svc-icon teal"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></div>
            <span>Soạn thảo<br>NĐ 30</span>
          </button>
          <button class="dash-svc-btn" data-page="vb-dang">
            <div class="dash-svc-icon coral"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg></div>
            <span>VB Đảng<br>HD 05</span>
          </button>
          <button class="dash-svc-btn" data-page="docx-tool">
            <div class="dash-svc-icon blue"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg></div>
            <span>Tạo & Xuất<br>file Word</span>
          </button>
          <button class="dash-svc-btn" data-page="pdf-tool">
            <div class="dash-svc-icon cyan"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg></div>
            <span>Nhận dạng<br>PDF/OCR</span>
          </button>
          <button class="dash-svc-btn" data-page="spell-check">
            <div class="dash-svc-icon amber"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg></div>
            <span>Kiểm tra<br>thể thức</span>
          </button>
          <button class="dash-svc-btn" data-page="pdf-publisher">
            <div class="dash-svc-icon emerald"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg></div>
            <span>Tóm tắt<br>hồ sơ</span>
          </button>
          <button class="dash-svc-btn" data-page="meeting-minutes">
            <div class="dash-svc-icon purple"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg></div>
            <span>Biên bản<br>cuộc họp</span>
          </button>
          <button class="dash-svc-btn" data-page="search-history">
            <div class="dash-svc-icon indigo"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg></div>
            <span>Lịch sử<br>tra cứu</span>
          </button>
          <button class="dash-svc-btn" id="btn-zalo-bot-catalog" data-page="zalo-bot">
            <div class="dash-svc-icon blue"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zm4 0h3v3h-3zm-4 4h3v3h-3zm4 4h3v3h-3z"/></svg></div>
            <span>Bot Zalo<br>VBAI</span>
          </button>
          <button class="dash-svc-btn" data-page="admin-panel" id="btn-admin-panel-catalog" style="${window.isAdmin ? '' : 'display:none;'}">
            <div class="dash-svc-icon amber"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg></div>
            <span>Quản trị<br>hệ thống</span>
          </button>
        </div>
      </section>

      <!-- TRA CỨU GẦN ĐÂY -->
      <div class="home-info-columns" style="grid-template-columns: 1fr; margin-top: 10px;">
        <div id="recent-searches-region"></div>
      </div>

      <!-- LIÊN HỆ -->
      <section id="contact-section" class="dash-contact-section">
        <div class="dash-contact-head">📞 <strong>Liên hệ hỗ trợ</strong> <span class="dash-contact-tag">VP UBND tỉnh</span></div>
        <div class="dash-contact-body">
          <span>Trương Hải Châu · VP UBND tỉnh Lâm Đồng</span>
          <div class="dash-contact-links">
            <a href="https://m.me/haichau2404" target="_blank" class="dash-link msg">💬 Messenger</a>
            <a href="https://zalo.me/0911667209" target="_blank" class="dash-link zalo">💬 Zalo</a>
          </div>
        </div>
      </section>

      <!-- FOOTER -->
      <footer class="legal-pro-footer" style="padding-top: 14px;">
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
    const q = mainInput ? mainInput.value.trim() : '';
    if (!q) {
      if (mainInput) mainInput.focus();
      return;
    }
    navigateTo('legal-search', q);
  };

  container.querySelectorAll('#home-main-search-btn, #home-main-search-btn-mobile, .dash-search-btn').forEach(btn => {
    btn.addEventListener('click', executeHomeSearch);
  });
  mainInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') executeHomeSearch();
  });

  // Bind Dashboard Mode Chips
  container.querySelectorAll('.dash-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode || 'legal-search';
      const q = mainInput ? mainInput.value.trim() : '';
      navigateTo('legal-search', q, mode);
    });
  });

  // Bind quick chips
  container.querySelectorAll('.search-chip-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const q = btn.dataset.query;
      if (q) {
        mainInput.value = q;
        executeHomeSearch();
      }
    });
  });

  // Bind Mobile Quick Service Buttons (4 nút chức năng hay dùng)
  container.querySelectorAll('.service-action-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const page = btn.dataset.page || 'legal-search';
      const mode = btn.dataset.mode || '';
      navigateTo(page, '', mode);
    });
  });

  // Bind Dashboard Service Buttons
  container.querySelectorAll('.dash-svc-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const page = btn.dataset.page;
      if (page) navigateTo(page);
    });
  });

  // Bind Refresh Dashboard Button
  const btnRefresh = container.querySelector('#btn-refresh-dashboard');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => {
      btnRefresh.style.transform = 'rotate(180deg)';
      btnRefresh.style.transition = 'transform 0.3s ease';
      setTimeout(() => {
        renderDashboard(container, navigateTo);
      }, 300);
    });
  }

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

  // Bind Zalo Bot banner link
  const btnZaloHome = container.querySelector('.btn-zalo-home');
  if (btnZaloHome) {
    btnZaloHome.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo('zalo-bot');
    });
  }

  // Populate recent searches region based on role
  const recentRegion = container.querySelector('#recent-searches-region');
  const infoCols = container.querySelector('.home-info-columns');
  if (recentRegion) {
    if (window.isAdmin) {
      // Ẩn vùng tra cứu gần đây đối với Quản trị viên (không hiển thị banner quản trị viên)
      recentRegion.innerHTML = '';
      recentRegion.style.display = 'none';
      if (infoCols) infoCols.style.display = 'none';
    } else {
      const clearBtnHtml = recentSearches.length > 0 ? '<button id="clear-all-recent" style="font-size:0.72rem; padding:3px 10px; border:1px solid var(--border-default,#CBD5E1); background:transparent; color:var(--danger,#DC2626); border-radius:12px; cursor:pointer; transition:all 0.2s;" title="Xóa tất cả lịch sử">Xóa tất cả</button>' : '';
      recentRegion.innerHTML = `
        <section class="home-card-panel recent-searches-card">
          <div class="panel-card-head">
            <h3>🕒 Tra cứu gần đây</h3>
            <div style="display:flex; gap:8px; align-items:center;">
              <span class="panel-head-tag">Lịch sử cá nhân</span>
              ${clearBtnHtml}
            </div>
          </div>
          <div class="panel-card-body" id="recent-searches-list">
            ${renderRecentSearchesHtml(recentSearches)}
          </div>
        </section>
      `;
    }
  }

  if (!window.isAdmin) {
    bindRecentSearchEvents(container, navigateTo);
    bindClearRecentButton(container, container.querySelector('#clear-all-recent'));
  }

  // Load Build SHA in Footer
  loadFooterBuildInfo(container);

  // Hydrate only after main.js has established window.currentUser/auth token.
  // Admin không cần hydrate recent searches (xem qua admin panel)
  if (!window.isAdmin) {
    hydrateRecentSearches(container, navigateTo);
  }
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
