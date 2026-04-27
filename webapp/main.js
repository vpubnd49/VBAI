/**
 * VBAI Main Application — Đà Lạt Edition
 * Handles navigation, state, and page rendering
 */

import { renderDashboard } from './modules/dashboard.js';
import { renderVBDang, handleVBDangAction } from './modules/vb-dang.js';
import { renderVBND30, handleVBND30Action } from './modules/vb-nd30.js';
import { renderPdfTool } from './modules/pdf-tool.js';
import { renderDocxTool } from './modules/docx-tool.js';

// ============ STATE ============
const state = {
  currentPage: 'dashboard',
  sidebarOpen: true,
};

// ============ CLOCK ============
function updateClock() {
  const el = document.getElementById('dalat-clock');
  if (!el) return;
  const now = new Date();
  el.textContent = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' • Đà Lạt';
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
  'vb-dang': 'Văn Bản Đảng (HD36)',
  'vb-nd30': 'Văn Bản Hành Chính (NĐ30)',
  'pdf-tool': 'Xử lý PDF',
  'docx-tool': 'Tạo DOCX',
};

function navigateTo(page) {
  state.currentPage = page;
  // Update nav
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.page === page);
  });
  // Update breadcrumb
  document.getElementById('breadcrumb').innerHTML = `<span class="breadcrumb-item">${PAGE_TITLES[page] || page}</span>`;
  // Render page
  renderPage(page);
}

function renderPage(page) {
  const container = document.getElementById('page-content');
  container.innerHTML = '';
  container.className = 'page-content page-enter';

  switch (page) {
    case 'dashboard': renderDashboard(container, navigateTo); break;
    case 'vb-dang': renderVBDang(container); break;
    case 'vb-nd30': renderVBND30(container); break;
    case 'pdf-tool': renderPdfTool(container); break;
    case 'docx-tool': renderDocxTool(container); break;
    default: container.innerHTML = '<div class="empty-state"><div class="empty-icon">🏔️</div><div class="empty-text">Trang không tồn tại</div></div>';
  }
}

// ============ INIT ============
function init() {
  // Nav clicks
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => navigateTo(item.dataset.page));
  });

  // Sidebar toggle
  document.getElementById('toggle-sidebar').addEventListener('click', () => {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('collapsed');
    state.sidebarOpen = !sidebar.classList.contains('collapsed');
  });

  // Clock
  updateClock();

  // Initial render
  renderPage('dashboard');
}

document.addEventListener('DOMContentLoaded', init);
