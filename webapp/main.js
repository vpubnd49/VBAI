/**
 * VBAI Main Application — Đà Lạt Edition
 * Handles navigation, state, and page rendering
 */

// VBAI Main Entry - Last Update: 2026-05-20 (Performance Optimized)
import { firebaseConfig } from './firebase-config.js';

function applyGlobalModelDefaults() {
  // Model, endpoint and API key are supplied only by admin configuration.
}

// ============ STATE ============
const gitSha = typeof __VBAI_GIT_SHA__ !== 'undefined' ? __VBAI_GIT_SHA__ : 'dev';
const state = {
  currentPage: 'dashboard',
  sidebarOpen: false,
  version: `Trợ lý Tra cứu Pháp luật`
};

// ============ CLOCK ============
function updateClock() {
  const el = document.getElementById('dalat-clock');
  if (!el) return;
  const now = new Date();
  el.textContent = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' • Lâm Đồng';
}
setInterval(updateClock, 1000);

// ============ TOAST ============
export function showToast(msg, type = 'success') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(100%)'; toast.style.transition = 'all 0.3s'; }, 2500);
  setTimeout(() => toast.remove(), 3000);
}

// ============ NAVIGATION ============
const PAGE_TITLES = {
  dashboard: 'Trợ lý Tra cứu Pháp luật - Tổng quan',
  'legal-search': 'Tra cứu Pháp luật',
  'document-lookup': 'Tra cứu Văn bản',
  'situation-analysis': 'Phân tích Tình huống',
  'compare-regulations': 'So sánh Quy định',
  'effective-date': 'Hiệu lực & Sửa đổi',
  'chat-assistant': 'Trợ lý Pháp luật AI',
  'vb-dang': 'Văn bản Đảng (HD05)',
  'vb-nd30': 'Văn bản Hành chính (NĐ30)',
  'pdf-tool': 'Nhận dạng & Đọc tài liệu',
  'docx-tool': 'Tạo & Xuất văn bản',
  'spell-check': 'Kiểm tra Văn bản & Thể thức',
  'meeting-minutes': 'Xử lý Ghi âm & Biên bản',
  'pdf-publisher': 'Tóm tắt Hồ sơ & Xuất bản',
  'search-history': 'Lịch sử Tra cứu',
  'admin-panel': 'Quản trị Hệ thống',
};

function showPageLoading(container) {
  container.innerHTML = `
    <div class="page-loading-wrapper">
      <div class="page-loading-spinner"></div>
      <div class="page-loading-text">Đang tải chức năng...</div>
    </div>
  `;
}

function parseRouteFromHash() {
  const rawHash = (window.location.hash || '').replace(/^#\/?/, '').trim();
  if (!rawHash) return { page: 'dashboard', query: '', mode: '' };
  
  const [routePart, searchPart] = rawHash.split('?');
  const page = routePart || 'dashboard';
  let query = '';
  let mode = '';
  if (searchPart) {
    try {
      const params = new URLSearchParams(searchPart);
      query = params.get('q') || '';
      mode = params.get('mode') || '';
    } catch (_) {}
  }
  return {
    page: PAGE_TITLES[page] ? page : 'dashboard',
    query,
    mode,
  };
}

export function navigateTo(page, initialQuery = '', initialMode = '', updateHash = true) {
  if (!page || !PAGE_TITLES[page]) {
    console.warn('Attempted to navigate to invalid page:', page);
    return;
  }
  
  const previousPage = state.currentPage;
  state.currentPage = page;

  if (updateHash) {
    let targetHash = `#${page}`;
    const params = new URLSearchParams();
    if (initialQuery) params.set('q', initialQuery);
    if (initialMode && initialMode !== page) params.set('mode', initialMode);
    const qs = params.toString();
    if (qs) targetHash += `?${qs}`;
    if (window.location.hash !== targetHash) {
      window.location.hash = targetHash;
    }
  }

  // Update nav
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.page === page);
  });

  window.firstLoad = false;

  // Update breadcrumb
  const breadcrumb = document.getElementById('breadcrumb');
  if (breadcrumb) {
    breadcrumb.innerHTML = `<span class="breadcrumb-item">${PAGE_TITLES[page]}</span>`;
  }
  // Render page
  renderPage(page, initialQuery, initialMode);
}


async function renderPage(page, initialQuery = '', initialMode = '') {
  const container = document.getElementById('page-content');
  if (!container) return;
  
  container.innerHTML = '';
  container.className = 'page-content page-enter';
  showPageLoading(container);

  try {
    switch (page) {
      case 'dashboard': {
        const { renderDashboard } = await import('./modules/dashboard.js');
        container.innerHTML = '';
        renderDashboard(container, navigateTo);
        break;
      }
      case 'legal-search':
      case 'document-lookup':
      case 'situation-analysis':
      case 'compare-regulations':
      case 'effective-date': {
        const { renderLegalSearchUI } = await import('./modules/legal-search.js');
        container.innerHTML = '';
        renderLegalSearchUI(container, initialMode || page, initialQuery);
        break;
      }
      case 'search-history': {
        const { renderSearchHistory } = await import('./modules/search-history.js');
        container.innerHTML = '';
        renderSearchHistory(container, navigateTo);
        break;
      }
      case 'chat-assistant': {
        const { renderChatUI } = await import('./modules/chat-assistant.js');
        container.innerHTML = '';
        renderChatUI(container);
        break;
      }
      case 'vb-dang': {
        const { renderVBDang } = await import('./modules/vb-dang.js');
        container.innerHTML = '';
        renderVBDang(container);
        break;
      }
      case 'vb-nd30': {
        const { renderVBND30 } = await import('./modules/vb-nd30.js');
        container.innerHTML = '';
        renderVBND30(container);
        break;
      }
      case 'pdf-tool': {
        const { renderPdfTool } = await import('./modules/pdf-tool.js');
        container.innerHTML = '';
        renderPdfTool(container);
        break;
      }
      case 'docx-tool': {
        const { renderDocxTool } = await import('./modules/docx-tool.js');
        container.innerHTML = '';
        renderDocxTool(container);
        break;
      }
      case 'pdf-publisher': {
        const { renderPdfPublisher } = await import('./modules/pdf-publisher.js');
        container.innerHTML = '';
        renderPdfPublisher(container);
        break;
      }
      case 'spell-check': {
        const { renderSpellCheck } = await import('./modules/spell-check.js');
        container.innerHTML = '';
        renderSpellCheck(container);
        break;
      }
      case 'meeting-minutes': {
        const { renderMeetingMinutes } = await import('./modules/meeting-minutes.js');
        container.innerHTML = '';
        renderMeetingMinutes(container);
        break;
      }
      case 'admin-panel': {
        if (window.isAdmin === true || localStorage.getItem('vbai_is_admin') === 'true') {
          const { renderAdminPanel } = await import('./modules/admin-panel.js');
          container.innerHTML = '';
          renderAdminPanel(container);
        } else {
          container.innerHTML = '<div class="empty-state"><div class="empty-icon">🔒</div><div class="empty-text">Bạn không có quyền truy cập</div></div>';
        }
        break;
      }
      default:
        container.innerHTML = '<div class="empty-state"><div class="empty-icon">🏛️</div><div class="empty-text">Trang không tồn tại</div></div>';
    }
  } catch (err) {
    console.error(`Lỗi khi tải trang ${page}:`, err);
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <div class="empty-text">Có lỗi khi tải trang. Vui lòng thử lại.</div>
        <button class="btn btn-primary" onclick="window.location.reload()" style="margin-top: 16px;">Tải lại trang</button>
      </div>
    `;
  }
}


function preloadModules() {
  const triggerPreloads = () => {
    console.log('Main: Preloading modules in background...');
    import('./modules/dashboard.js').catch(() => {});
    import('./modules/chat-assistant.js').catch(() => {});
    import('./modules/vb-dang.js').catch(() => {});
    import('./modules/vb-nd30.js').catch(() => {});
    import('./modules/pdf-tool.js').catch(() => {});
    import('./modules/docx-tool.js').catch(() => {});
    import('./modules/pdf-publisher.js').catch(() => {});
    import('./modules/spell-check.js').catch(() => {});
    import('./modules/meeting-minutes.js').catch(() => {});
    import('./modules/admin-panel.js').catch(() => {});
  };

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(() => triggerPreloads());
  } else {
    setTimeout(triggerPreloads, 2000);
  }
}

let authInstance = null;

// ============ INIT ============
async function init() {
  console.log('Main: init() starting...');
  applyGlobalModelDefaults();
  
  // Chạy đồng bộ văn bản pháp luật nền sau khi ứng dụng đã tải xong và ổn định (tránh nghẽn mạng lúc khởi động)
  setTimeout(async () => {
    try {
      const { runDailyLegalSync } = await import('./modules/chat-assistant.js');
      runDailyLegalSync().catch(err => console.warn('Lỗi đồng bộ nền:', err));
    } catch (err) {
      console.warn('Lỗi load chat-assistant cho đồng bộ nền:', err);
    }
  }, 8000);

  // Unified Local & Google Authentication Handler
  const loginOverlay = document.getElementById('login-overlay');
  const mainApp = document.getElementById('app');

  async function handleUserLoggedIn(user) {
    if (!user || !loginOverlay || !mainApp) return;
    window.currentUser = user;
    window.isAdmin = user.isAdmin === true || user.role === 'admin';
    localStorage.setItem('vbai_is_admin', window.isAdmin ? 'true' : 'false');

    loginOverlay.style.display = 'none';
    mainApp.style.display = 'flex';

    // Update top bar with user info
    const topBar = document.querySelector('.top-bar-actions');
    if (topBar) {
      topBar.innerHTML = `
        <div style="font-size:0.85rem; font-weight:500; color:var(--text-secondary); margin-right:16px;">
          ${user.email || user.displayName || 'Thành viên'}
        </div>
        <div class="dalat-time" id="dalat-clock"></div>
      `;
      updateClock();
    }

    const adminBtn = document.getElementById('nav-admin-panel');
    if (adminBtn) adminBtn.style.display = window.isAdmin ? 'flex' : 'none';

    const initial = parseRouteFromHash();
    state.currentPage = initial.page;
    try {
      navigateTo(initial.page, initial.query, initial.mode, false);
      preloadModules();
    } catch (err) {
      console.error('Render page failed after login:', err);
    }
  }

  // Handle browser back/forward and hash changes
  window.addEventListener('hashchange', () => {
    if (!window.currentUser) return;
    const { page, query, mode } = parseRouteFromHash();
    if (page !== state.currentPage || query || mode) {
      navigateTo(page, query, mode, false);
    }
  });

  async function handleUserLoggedOut() {
    window.currentUser = null;
    window.isAdmin = false;
    localStorage.removeItem('vbai_token');
    localStorage.removeItem('vbai_user');
    localStorage.setItem('vbai_is_admin', 'false');
    if (mainApp) mainApp.style.display = 'none';
    if (loginOverlay) {
      loginOverlay.style.display = 'block';
      const { renderLogin } = await import('./modules/login.js');
      renderLogin(loginOverlay);
    }
  }

  // Listen to custom auth events
  window.addEventListener('auth-changed', (e) => {
    if (e.detail) {
      handleUserLoggedIn(e.detail);
    } else {
      handleUserLoggedOut();
    }
  });

  // Check existing session
  const savedToken = localStorage.getItem('vbai_token');
  const savedUserStr = localStorage.getItem('vbai_user');

  if (savedToken && savedUserStr) {
    try {
      const savedUser = JSON.parse(savedUserStr);
      const userObj = {
        uid: savedUser.uid || savedUser._id,
        user_id: savedUser.uid || savedUser._id,
        email: savedUser.email,
        displayName: savedUser.displayName || savedUser.name,
        role: savedUser.role,
        isAdmin: savedUser.role === 'admin' || savedUser.isAdmin === true,
        getIdToken: async () => localStorage.getItem('vbai_token') || '',
        getIdTokenResult: async () => ({ claims: { admin: savedUser.role === 'admin' || savedUser.isAdmin === true } })
      };
      await handleUserLoggedIn(userObj);
    } catch (err) {
      console.warn('Session restore failed:', err);
      handleUserLoggedOut();
    }
  } else {
    // Show login page
    handleUserLoggedOut();
  }

  // Setup logout button
  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      handleUserLoggedOut();
    });
  }

  // Sidebar toggle logic
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const toggleBtn = document.getElementById('toggle-sidebar');

  function closeMobileSidebar() {
    sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('active');
  }

  toggleBtn.addEventListener('click', () => {
    if (window.innerWidth <= 768) {
      sidebar.classList.remove('collapsed');
      sidebar.classList.toggle('open');
      if (overlay) overlay.classList.toggle('active');
    } else {
      sidebar.classList.toggle('collapsed');
      state.sidebarOpen = !sidebar.classList.contains('collapsed');
    }
  });

  if (overlay) {
    overlay.addEventListener('click', closeMobileSidebar);
  }

  // Nav clicks
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      if (item.id === 'nav-contact') {
        navigateTo('dashboard');
        setTimeout(() => {
          const el = document.getElementById('contact-section');
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }, 300);
        return;
      }
      
      const page = item.dataset.page;
      if (page) {
        navigateTo(page);
        if (window.innerWidth <= 768) {
          closeMobileSidebar();
        }
      }
    });
  });

  // Logo click = Home / Refresh
  const logo = document.getElementById('logo-refresh');
  if (logo) {
    logo.addEventListener('click', () => {
      if (state.currentPage === 'dashboard') {
        window.location.reload();
      } else {
        navigateTo('dashboard');
      }
    });
  }

  // Version
  const versionEl = document.getElementById('app-version');
  if (versionEl) versionEl.textContent = state.version;

  // Clock
  updateClock();

  // Initial render is handled by onAuthStateChanged to avoid
  // racing with auth state restoration.
  window.firstLoad = true;
}

console.log('Main: Script loaded, adding DOMContentLoaded listener...');
document.addEventListener('DOMContentLoaded', init);
