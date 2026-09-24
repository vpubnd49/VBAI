/**
 * VBAI Main Application — Đà Lạt Edition
 * Handles navigation, state, and page rendering
 */

// VBAI Main Entry - Last Update: 2026-09-20
const VBAI_BUILD_VERSION = '20260920v18';
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
  const timeStr = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  el.innerHTML = `<span class="clock-time">${timeStr}</span><span class="clock-region"> • Lâm Đồng</span>`;
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
  'zalo-bot': 'Bot Zalo',
  'tools-hub': 'Tiện ích',
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

  // Update bottom nav
  document.querySelectorAll('.bottom-nav-item, .bottom-nav-fab').forEach(bitem => {
    bitem.classList.toggle('active', bitem.dataset.page === page);
  });

  window.firstLoad = false;

  // Update breadcrumb
  const breadcrumb = document.getElementById('breadcrumb');
  if (breadcrumb) {
    breadcrumb.innerHTML = `
      <div style="display:flex; align-items:center; gap:8px; overflow:hidden;">
        <img src="/vbai-logo.png?v=20260923_white" alt="VBAI" style="height:26px; width:26px; object-fit:contain; border-radius:6px; flex-shrink:0; background:#fff; border:1px solid var(--border-subtle, #E2E8F0);">
        <span class="breadcrumb-item" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${PAGE_TITLES[page] || 'Trợ lý Tra cứu Pháp luật'}</span>
      </div>
    `;
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
      case 'zalo-bot': {
        const { renderZaloBot } = await import('./modules/zalo-bot.js');
        container.innerHTML = '';
        renderZaloBot(container);
        break;
      }
      case 'tools-hub': {
        const { renderToolsHub } = await import('./modules/tools-hub.js');
        container.innerHTML = '';
        renderToolsHub(container, navigateTo);
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

    // Update navbar user info
    const navUserName = document.getElementById('navbar-user-name');
    const navUserRole = document.getElementById('navbar-user-role');
    if (navUserName) navUserName.textContent = user.displayName || user.name || user.email || 'Thành viên';
    if (navUserRole) navUserRole.textContent = user.role === 'admin' ? 'Quản trị' : (user.email ? user.email.split('@')[0] : 'VBAI');

    const adminBtn = document.getElementById('nav-admin-panel');
    if (adminBtn) adminBtn.style.display = window.isAdmin ? 'flex' : 'none';

    // Admin xem lịch sử tra cứu qua admin panel > tab "Vết Tra Cứu", không cần menu riêng
    const searchHistoryBtn = document.getElementById('nav-search-history');
    if (searchHistoryBtn) searchHistoryBtn.style.display = window.isAdmin ? 'none' : 'flex';

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

  // Bottom Navigation event handlers
  document.querySelectorAll('.bottom-nav-item, .bottom-nav-fab').forEach(bitem => {
    bitem.addEventListener('click', () => {
      if (bitem.id === 'bnav-menu') {
        sidebar.classList.remove('collapsed');
        sidebar.classList.toggle('open');
        if (overlay) overlay.classList.toggle('active');
        return;
      }
      const page = bitem.dataset.page;
      if (page) {
        navigateTo(page);
        closeMobileSidebar();
      }
    });
  });

  // Top search button
  const topSearchBtn = document.getElementById('top-btn-search');
  if (topSearchBtn) {
    topSearchBtn.addEventListener('click', () => {
      navigateTo('legal-search');
      closeMobileSidebar();
    });
  }

  // Intercept links: PDFs → in-app download, external → in-app browser, hash → SPA
  document.addEventListener('click', async (e) => {
    const link = e.target.closest('a');
    if (!link) return;
    const href = link.getAttribute('href');
    if (!href) return;

    // Internal SPA hash routes
    if (href.startsWith('#')) {
      e.preventDefault();
      const page = href.replace(/^#\/?/, '').split('?')[0];
      if (page) navigateTo(page);
      return;
    }

    // External URLs (http/https)
    if (href.startsWith('http://') || href.startsWith('https://')) {
      e.preventDefault();

      // Check if it's a downloadable file (PDF, doc, etc.)
      const isPdfDownload = /\.(pdf|doc|docx|xls|xlsx)(\?|$)/i.test(href)
        || link.classList.contains('doc-card-btn-download')
        || link.textContent.includes('Tải về')
        || link.textContent.includes('Tải PDF');

      if (isPdfDownload) {
        // Download file directly to device
        await handleInAppDownload(href, link);
      } else {
        // Open web page in in-app browser
        try {
          const { Browser } = await import('@capacitor/browser');
          await Browser.open({ url: href });
        } catch (_) {
          window.open(href, '_blank', 'noopener,noreferrer');
        }
      }
      return;
    }
  }, true);

  // In-app file download handler
  async function handleInAppDownload(url, linkEl) {
    const originalText = linkEl ? linkEl.textContent : '';
    try {
      // Show downloading state
      if (linkEl) {
        linkEl.textContent = '⏳ Đang tải...';
        linkEl.style.pointerEvents = 'none';
        linkEl.style.opacity = '0.6';
      }
      showToast('📥 Đang tải file...', 'info');

      // Extract filename from URL
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/').filter(Boolean);
      let fileName = pathParts[pathParts.length - 1] || 'document.pdf';
      fileName = decodeURIComponent(fileName);
      if (!/\.\w{2,5}$/.test(fileName)) fileName += '.pdf';

      // Fetch the file
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();

      // Try Capacitor Filesystem (native Android)
      try {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');

        // Convert blob to base64
        const reader = new FileReader();
        const base64Data = await new Promise((resolve, reject) => {
          reader.onload = () => {
            const result = reader.result;
            resolve(result.split(',')[1]); // strip data:...;base64, prefix
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

        // Save to Downloads directory
        const savedFile = await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Documents,
          recursive: true
        });

        showToast(`✅ Đã lưu: ${fileName}`, 'success');
        console.log('File saved:', savedFile.uri);

      } catch (fsError) {
        // Fallback for web: create blob URL and trigger download
        console.log('Filesystem plugin unavailable, using blob download:', fsError);
        const blobUrl = URL.createObjectURL(blob);
        const tempLink = document.createElement('a');
        tempLink.href = blobUrl;
        tempLink.download = fileName;
        tempLink.style.display = 'none';
        document.body.appendChild(tempLink);
        tempLink.click();
        document.body.removeChild(tempLink);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
        showToast(`✅ Đã tải: ${fileName}`, 'success');
      }
    } catch (err) {
      console.error('Download failed:', err);
      showToast('❌ Không tải được file. Đang mở trình duyệt...', 'error');
      // Fallback: open in browser
      try {
        const { Browser } = await import('@capacitor/browser');
        await Browser.open({ url: url });
      } catch (_) {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    } finally {
      // Restore button state
      if (linkEl) {
        linkEl.textContent = originalText;
        linkEl.style.pointerEvents = '';
        linkEl.style.opacity = '';
      }
    }
  }


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
