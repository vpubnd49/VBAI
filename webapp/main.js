/**
 * VBAI Main Application — Đà Lạt Edition
 * Handles navigation, state, and page rendering
 */

// VBAI Main Entry - Last Update: 2026-05-20 (Performance Optimized)
import { firebaseConfig } from './firebase-config.js';

const GLOBAL_AI_MODEL = 'gemini-2.5-pro';
const GLOBAL_MEETING_MODEL = 'gemini-2.5-flash';
const GLOBAL_TRANSCRIBE_MODEL = 'gemini-2.5-flash';

function applyGlobalModelDefaults() {
  if (!localStorage.getItem('vbai_gemini_model')) {
    localStorage.setItem('vbai_gemini_model', GLOBAL_AI_MODEL);
  }
  if (!localStorage.getItem('vbai_gemini_model_meeting')) {
    localStorage.setItem('vbai_gemini_model_meeting', GLOBAL_MEETING_MODEL);
  }
  if (!localStorage.getItem('vbai_transcribe_model')) {
    localStorage.setItem('vbai_transcribe_model', GLOBAL_TRANSCRIBE_MODEL);
  }
  if (!localStorage.getItem('vbai_transcribe_model_meeting')) {
    localStorage.setItem('vbai_transcribe_model_meeting', GLOBAL_MEETING_MODEL);
  }
}

// ============ STATE ============
const state = {
  currentPage: 'dashboard',
  sidebarOpen: false,
  version: 'v1.2.6'
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
  dashboard: 'Tổng quan',
  'chat-assistant': 'Tra cứu hành chính & pháp luật',
  'vb-dang': 'Soạn VB Đảng (HD36)',
  'vb-nd30': 'Soạn VB Hành chính (NĐ30)',
  'pdf-tool': 'Xử lý PDF / OCR',
  'docx-tool': 'Tạo & Xuất DOCX',
  'spell-check': 'Kiểm tra chính tả & thể thức',
  'meeting-minutes': 'Xử lý ghi âm cuộc họp',
  'pdf-publisher': 'Công cụ Tóm tắt - Xuất PDF',
  'admin-panel': 'Quản Trị Hệ Thống',
};

function showPageLoading(container) {
  container.innerHTML = `
    <div class="page-loading-wrapper">
      <div class="page-loading-spinner"></div>
      <div class="page-loading-text">Đang tải mô-đun...</div>
    </div>
  `;
}

function navigateTo(page) {
  if (!page || !PAGE_TITLES[page]) {
    console.warn('Attempted to navigate to invalid page:', page);
    return;
  }
  
  const previousPage = state.currentPage;
  state.currentPage = page;
  // Update nav
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.page === page);
  });

  // Nếu đang ở Dashboard mà bấm Tổng quan thì F5 (theo yêu cầu user)
  if (previousPage === 'dashboard' && page === 'dashboard' && !window.firstLoad) {
    window.location.reload();
    return;
  }
  window.firstLoad = false;

  // Update breadcrumb
  document.getElementById('breadcrumb').innerHTML = `<span class="breadcrumb-item">${PAGE_TITLES[page]}</span>`;
  // Render page
  renderPage(page);
}

async function renderPage(page) {
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
        container.innerHTML = '<div class="empty-state"><div class="empty-icon">🏔️</div><div class="empty-text">Trang không tồn tại</div></div>';
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

  console.log('Main: Loading Firebase SDKs...');
  try {
    const [firebaseApp, firebaseAuth] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js")
    ]);

    const { initializeApp, getApps, getApp } = firebaseApp;
    const { getAuth, onAuthStateChanged, signOut } = firebaseAuth;

    console.log('Main: Firebase initializing...');
    const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    const auth = getAuth(app);
    authInstance = auth;

    console.log('Main: Setting up onAuthStateChanged...');
    onAuthStateChanged(auth, async (user) => {
      console.log('Main: Auth state changed, user:', user ? user.email : 'null');
      const loginOverlay = document.getElementById('login-overlay');
      const mainApp = document.getElementById('app');
      if (!loginOverlay || !mainApp) return;

      if (user) {
        window.currentUser = user;
        try {
          const tokenResult = await user.getIdTokenResult(true);
          window.isAdmin = tokenResult?.claims?.admin === true;
          localStorage.setItem('vbai_is_admin', window.isAdmin ? 'true' : 'false');
        } catch (e) {
          window.isAdmin = false;
          localStorage.setItem('vbai_is_admin', 'false');
        }
        loginOverlay.style.display = 'none';
        mainApp.style.display = 'flex';

        // Update breadcrumb with user info
        document.querySelector('.top-bar-actions').innerHTML = `
          <div style="font-size:0.85rem; font-weight:500; color:var(--text-secondary); margin-right:16px;">
            ${user.email}
          </div>
          <div class="dalat-time" id="dalat-clock"></div>
        `;
        updateClock();

        const adminBtn = document.getElementById('nav-admin-panel');
        if (adminBtn) adminBtn.style.display = window.isAdmin ? 'flex' : 'none';

        // Always land on dashboard right after login/auth restore.
        state.currentPage = 'dashboard';
        try {
          await renderPage(state.currentPage);
          // Trigger preloading of all other modules in background to eliminate latency
          preloadModules();

          // Update breadcrumb and nav active state for the auto-redirected page
          document.getElementById('breadcrumb').innerHTML = `<span class="breadcrumb-item">${PAGE_TITLES[state.currentPage]}</span>`;
          document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.page === state.currentPage);
          });
        } catch (err) {
          console.error('Render page failed after login:', err);
          const container = document.getElementById('page-content');
          if (container) {
            container.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-text">Có lỗi khi tải trang chủ. Vui lòng tải lại trang.</div></div>';
          }
        }
      } else {
        window.currentUser = null;
        window.isAdmin = false;
        localStorage.setItem('vbai_is_admin', 'false');
        mainApp.style.display = 'none';
        loginOverlay.style.display = 'block';
        
        const { renderLogin } = await import('./modules/login.js');
        renderLogin(loginOverlay);
      }
    });

    document.getElementById('btn-logout').addEventListener('click', () => {
      signOut(authInstance).then(() => {
        showToast('Đã đăng xuất');
      });
    });

  } catch (err) {
    console.error('Lỗi khởi động ứng dụng (Firebase SDK):', err);
    showToast('Lỗi kết nối Firebase SDK', 'error');
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
