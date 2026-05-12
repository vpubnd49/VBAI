/**
 * VBAI Main Application — Đà Lạt Edition
 * Handles navigation, state, and page rendering
 */

// VBAI Main Entry - Last Update: 2026-05-01 12:38
import { renderDashboard } from './modules/dashboard.js';
import { renderVBDang, handleVBDangAction } from './modules/vb-dang.js';
import { renderVBND30, handleVBND30Action } from './modules/vb-nd30.js';
import { renderPdfTool } from './modules/pdf-tool.js';
import { renderDocxTool } from './modules/docx-tool.js';
import { renderSpellCheck } from './modules/spell-check.js';
import { renderAdminPanel } from './modules/admin-panel.js';
import { renderLogin } from './modules/login.js';
import { renderChatUI, runDailyLegalSync } from './modules/chat-assistant.js';
import { renderMeetingMinutes } from './modules/meeting-minutes.js';
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

import { firebaseConfig } from './firebase-config.js';

const GLOBAL_AI_MODEL = 'gpt-4.4';
const GLOBAL_MEETING_MODEL = 'gemini-2.5-pro';
const GLOBAL_TRANSCRIBE_MODEL = 'whisper-1';

function applyGlobalModelDefaults() {
  if (!localStorage.getItem('vbai_router_model')) {
    localStorage.setItem('vbai_router_model', GLOBAL_AI_MODEL);
  }
  if (!localStorage.getItem('vbai_router_model_meeting')) {
    localStorage.setItem('vbai_router_model_meeting', GLOBAL_MEETING_MODEL);
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
  'chat-assistant': 'Trợ lý tra cứu pháp luật',
  'vb-dang': 'Soạn VB Đảng (HD36)',
  'vb-nd30': 'Soạn VB Hành chính (NĐ30)',
  'pdf-tool': 'Xử lý PDF / OCR',
  'docx-tool': 'Tạo & Xuất DOCX',
  'spell-check': 'Kiểm tra chính tả & thể thức',
  'meeting-minutes': 'Xử lý ghi âm cuộc họp',
  'admin-panel': 'Quản Trị Hệ Thống',
};

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

function renderPage(page) {
  const container = document.getElementById('page-content');
  if (!container) return;
  container.innerHTML = '';
  container.className = 'page-content page-enter';

  switch (page) {
    case 'dashboard': renderDashboard(container, navigateTo); break;
    case 'chat-assistant': renderChatUI(container); break;
    case 'vb-dang': renderVBDang(container); break;
    case 'vb-nd30': renderVBND30(container); break;
    case 'pdf-tool': renderPdfTool(container); break;
    case 'docx-tool': renderDocxTool(container); break;
    case 'spell-check': renderSpellCheck(container); break;
    case 'meeting-minutes': renderMeetingMinutes(container); break;
    case 'admin-panel':
      if (window.isAdmin === true || localStorage.getItem('vbai_is_admin') === 'true') {
        renderAdminPanel(container);
      } else {
        container.innerHTML = '<div class="empty-state"><div class="empty-icon">🔒</div><div class="empty-text">Bạn không có quyền truy cập</div></div>';
      }
      break;
    default: container.innerHTML = '<div class="empty-state"><div class="empty-icon">🏔️</div><div class="empty-text">Trang không tồn tại</div></div>';
  }
}

// ============ INIT ============
function init() {
  console.log('Main: init() starting...');
  applyGlobalModelDefaults();
  runDailyLegalSync();

  console.log('Main: Firebase initializing...');
  const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  const auth = getAuth(app);

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

      // Ensure a valid page is rendered
      if (!state.currentPage || !PAGE_TITLES[state.currentPage]) {
        state.currentPage = 'dashboard';
      }
      try {
        renderPage(state.currentPage);
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
      renderLogin(loginOverlay);
    }
  });

  document.getElementById('btn-logout').addEventListener('click', () => {
    signOut(auth).then(() => {
      showToast('Đã đăng xuất');
    });
  });

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
