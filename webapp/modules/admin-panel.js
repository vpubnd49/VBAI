import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, query, orderBy, limit, getDocs, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { checkProxyStatus, getProxyModelIds } from './ai-proxy.js';
import { fetchSystemConfig, updateSystemConfig } from './system-config.js';

import { firebaseConfig } from '../firebase-config.js';

let allLogs = [];
let allUsers = [];
let currentPage = 1;
let currentUsersPage = 1;
const ITEMS_PER_PAGE = 10;

export function renderAdminPanel(container) {
  const isAdmin = window.isAdmin === true || localStorage.getItem('vbai_is_admin') === 'true';
  if (!isAdmin) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">🔒</div><div class="empty-text">Truy cập bị từ chối.</div></div>';
    return;
  }

  container.innerHTML = `
    <div class="panel-group" style="margin-bottom:20px;">
      <div class="panel-header">
        <div class="panel-header-icon">⚙️</div>
        Cấu hình AI Hệ thống
        <div style="flex:1"></div>
        <button id="refresh-config-btn" class="btn btn-secondary btn-sm" style="padding:4px 8px; font-size:0.8rem">Làm mới</button>
      </div>
      <div class="panel-body">
        <div id="config-status" style="margin-bottom:12px; padding:8px; background:#fef3c7; border:1px solid #fbbf24; border-radius:4px;">Đang tải cấu hình...</div>
        <form id="system-config-form" style="display:none;">
          <div class="form-group" style="margin-bottom:12px;">
            <label class="form-label">Nhà cung cấp AI</label>
            <div style="display:flex; gap:12px; margin-top:4px">
              <label style="display:flex; align-items:center; gap:6px; cursor:pointer"><input type="radio" name="active_provider" value="openai" checked> OpenAI</label>
              <label style="display:flex; align-items:center; gap:6px; cursor:pointer"><input type="radio" name="active_provider" value="gemini"> Gemini</label>
            </div>
          </div>
          <div style="margin:8px 0; font-size:0.82rem; font-weight:700; color:var(--pine-600);">Cấu hình OpenAI</div>
          <div class="form-group" style="margin-bottom:12px;">
            <label class="form-label">OpenAI Endpoint</label>
            <input type="text" id="openai_endpoint" class="form-input" placeholder="https://api.openai.com/v1">
          </div>
          <div class="form-group" style="margin-bottom:12px;">
            <label class="form-label">OpenAI API Key</label>
            <input type="password" id="openai_api_key" class="form-input" placeholder="sk-...">
            <small style="color:var(--text-muted); font-size:0.75rem">Để trống nếu không muốn thay đổi khóa hiện tại</small>
          </div>
          <div class="form-group" style="margin-bottom:12px;">
            <label class="form-label">Model (GPT/OpenAI)</label>
            <input type="text" id="router_model" class="form-input" placeholder="gpt-4.4">
          </div>
          <div style="margin:16px 0 8px; font-size:0.82rem; font-weight:700; color:var(--pine-600);">Cấu hình Gemini</div>
          <div class="form-group" style="margin-bottom:12px;">
            <label class="form-label">Gemini API Key</label>
            <input type="password" id="gemini_api_key" class="form-input" placeholder="AIza...">
            <small style="color:var(--text-muted); font-size:0.75rem">Để trống nếu không muốn thay đổi khóa hiện tại</small>
          </div>
          <div class="form-group" style="margin-bottom:12px;">
            <label class="form-label">Model Gemini</label>
            <input type="text" id="gemini_model" class="form-input" placeholder="gemini-2.5-pro">
          </div>
          <div class="form-group" style="margin-bottom:12px;">
            <label class="form-label">Google Search API Key</label>
            <input type="password" id="google_search_key" class="form-input" placeholder="AIza...">
            <small style="color:var(--text-muted); font-size:0.75rem">Tùy chọn cho tra cứu web pháp lý. Để trống nếu không muốn thay đổi khóa hiện tại</small>
          </div>
          <div class="form-group" style="margin-bottom:12px;">
            <label class="form-label">Google Search CX</label>
            <input type="password" id="google_search_cx" class="form-input" placeholder="Custom Search Engine ID">
            <small style="color:var(--text-muted); font-size:0.75rem">Để trống nếu không muốn thay đổi mã CX hiện tại</small>
          </div>
          <div class="form-group" style="margin-bottom:12px;">
            <label class="form-label">Model transcription</label>
            <input type="text" id="transcribe_model" class="form-input" placeholder="whisper-1">
          </div>
          <div class="btn-row" style="margin-top:12px;">
            <button id="save-system-config-btn" class="btn btn-primary" style="flex:1">Lưu cấu hình</button>
          </div>
          <div id="config-save-status" style="margin-top:10px; font-size:0.85rem;"></div>
        </form>
      </div>
    </div>

    <div class="panel-group" style="margin-bottom:20px;">
      <div class="panel-header">
        <div class="panel-header-icon">🛡️</div>
        Quản Trị Hệ Thống - Vết Tra Cứu (Mới nhất)
        <div style="flex:1"></div>
        <button id="delete-all-logs-btn" class="btn btn-sm" style="padding:4px 8px; font-size:0.8rem; background:#ef4444; color:white; border:none; margin-right:8px">Xóa tất cả</button>
        <button id="refresh-logs-btn" class="btn btn-secondary btn-sm" style="padding:4px 8px; font-size:0.8rem">Làm mới</button>
      </div>
      <div class="panel-body" style="padding:0; overflow-x:auto">
        <table style="width:100%; border-collapse: collapse; font-size:0.85rem">
          <thead>
            <tr style="background:var(--bg-secondary); border-bottom:1px solid var(--border-color); text-align:left">
              <th style="padding:12px; width:140px">Thời gian</th>
              <th style="padding:12px">Người dùng</th>
              <th style="padding:12px">Thao tác / Câu hỏi</th>
              <th style="padding:12px; width:150px">Model xử lý</th>
              <th style="padding:12px; width:80px; text-align:right">Hành động</th>
            </tr>
          </thead>
          <tbody id="logs-table-body">
            <tr><td colspan="5" style="padding:20px; text-align:center; color:var(--text-muted)">Đang tải dữ liệu...</td></tr>
          </tbody>
        </table>
        <div id="pagination-controls" style="display:none; justify-content:center; align-items:center; padding:12px; gap:16px; background:var(--bg-secondary); border-top:1px solid var(--border-color)">
          <button id="prev-page-btn" class="btn btn-secondary btn-sm" style="padding:4px 8px; font-size:0.8rem">⬅️ Trước</button>
          <span id="page-indicator" style="font-size:0.85rem; font-weight:500">Trang 1 / 1</span>
          <button id="next-page-btn" class="btn btn-secondary btn-sm" style="padding:4px 8px; font-size:0.8rem">Tiếp ➡️</button>
        </div>
      </div>
    </div>

    <div class="panel-group" style="margin-bottom:20px;">
      <div class="panel-header">
        <div class="panel-header-icon">👥</div>
        Danh sách Tài khoản Hệ thống
        <div style="flex:1"></div>
        <button id="refresh-users-btn" class="btn btn-secondary btn-sm" style="padding:4px 8px; font-size:0.8rem">Làm mới</button>
      </div>
      <div class="panel-body" style="padding:0; overflow-x:auto">
        <table style="width:100%; border-collapse: collapse; font-size:0.85rem">
          <thead>
            <tr style="background:var(--bg-secondary); border-bottom:1px solid var(--border-color); text-align:left">
              <th style="padding:12px">Email</th>
              <th style="padding:12px">Tên hiển thị</th>
              <th style="padding:12px; width:180px">Ngày tham gia</th>
              <th style="padding:12px; width:180px">Đăng nhập cuối</th>
            </tr>
          </thead>
          <tbody id="users-table-body">
            <tr><td colspan="4" style="padding:20px; text-align:center; color:var(--text-muted)">Đang tải dữ liệu...</td></tr>
          </tbody>
        </table>
        <div id="users-pagination-controls" style="display:none; justify-content:center; align-items:center; padding:12px; gap:16px; background:var(--bg-secondary); border-top:1px solid var(--border-color)">
          <button id="users-prev-page-btn" class="btn btn-secondary btn-sm" style="padding:4px 8px; font-size:0.8rem">⬅️ Trước</button>
          <span id="users-page-indicator" style="font-size:0.85rem; font-weight:500">Trang 1 / 1</span>
          <button id="users-next-page-btn" class="btn btn-secondary btn-sm" style="padding:4px 8px; font-size:0.8rem">Tiếp ➡️</button>
        </div>
      </div>
    </div>
  `;

  initSystemConfigPanel(container);
  loadLogs(container);
  loadUsers(container);

  container.querySelector('#refresh-logs-btn').addEventListener('click', () => loadLogs(container));
  container.querySelector('#refresh-users-btn').addEventListener('click', () => loadUsers(container));

  container.querySelector('#prev-page-btn').addEventListener('click', () => {
    if (currentPage > 1) { currentPage--; renderPage(container); }
  });

  container.querySelector('#next-page-btn').addEventListener('click', () => {
    const totalPages = Math.ceil(allLogs.length / ITEMS_PER_PAGE);
    if (currentPage < totalPages) { currentPage++; renderPage(container); }
  });

  container.querySelector('#users-prev-page-btn').addEventListener('click', () => {
    if (currentUsersPage > 1) { currentUsersPage--; renderUsersPage(container); }
  });

  container.querySelector('#users-next-page-btn').addEventListener('click', () => {
    const totalPages = Math.ceil(allUsers.length / ITEMS_PER_PAGE);
    if (currentUsersPage < totalPages) { currentUsersPage++; renderUsersPage(container); }
  });

  container.querySelector('#delete-all-logs-btn').addEventListener('click', async () => {
    if (!confirm('Bạn có chắc chắn muốn xóa TOÀN BỘ lịch sử tra cứu không?')) return;
    const btn = container.querySelector('#delete-all-logs-btn');
    btn.textContent = 'Đang xóa...';
    try {
      const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
      const db = getFirestore(app);
      const q = query(collection(db, "search_logs"), limit(500)); // batch process
      const snapshot = await getDocs(q);
      const deletePromises = snapshot.docs.map(document => deleteDoc(doc(db, "search_logs", document.id)));
      await Promise.all(deletePromises);
      loadLogs(container);
    } catch (e) {
      alert('Lỗi xóa tất cả: ' + e.message);
    } finally {
      btn.textContent = 'Xóa tất cả';
    }
  });
}

async function initSystemConfigPanel(container) {
  const statusEl = container.querySelector('#config-status');
  const formEl = container.querySelector('#system-config-form');
  const saveBtn = container.querySelector('#save-system-config-btn');
  const refreshBtn = container.querySelector('#refresh-config-btn');
  const saveStatusEl = container.querySelector('#config-save-status');

  const providerRadios = formEl.querySelectorAll('input[name="active_provider"]');
  const openaiEndpointInput = formEl.querySelector('#openai_endpoint');
  const openaiKeyInput = formEl.querySelector('#openai_api_key');
  const routerModelInput = formEl.querySelector('#router_model');
  const geminiKeyInput = formEl.querySelector('#gemini_api_key');
  const geminiModelInput = formEl.querySelector('#gemini_model');
  const googleSearchKeyInput = formEl.querySelector('#google_search_key');
  const googleSearchCxInput = formEl.querySelector('#google_search_cx');
  const transcribeModelInput = formEl.querySelector('#transcribe_model');

  async function loadConfig() {
    statusEl.textContent = 'Đang tải cấu hình...';
    try {
      const config = await fetchSystemConfig();
      if (!config) {
        statusEl.textContent = 'Chưa có cấu hình hệ thống.';
        return;
      }
      
      openaiEndpointInput.value = config.openai_endpoint || '';
      routerModelInput.value = config.router_model || '';
      geminiModelInput.value = config.gemini_model || '';
      transcribeModelInput.value = config.transcribe_model || '';

      const provider = config.active_provider === 'gemini' ? 'gemini' : 'openai';
      providerRadios.forEach(r => r.checked = r.value === provider);

      if (config.has_openai_key) openaiKeyInput.value = '••••••••••••';
      if (config.has_gemini_key) geminiKeyInput.value = '••••••••••••';
      if (config.google_search_configured) {
        googleSearchKeyInput.value = '••••••••••••';
        googleSearchCxInput.value = '••••••••••••';
      }

      formEl.style.display = 'block';
      statusEl.textContent = 'Đã tải cấu hình';
    } catch (error) {
      statusEl.textContent = 'Lỗi tải: ' + error.message;
    }
  }

  async function saveConfig() {
    const provider = formEl.querySelector('input[name="active_provider"]:checked').value;
    const payload = {
      active_provider: provider,
      openai_endpoint: openaiEndpointInput.value,
      router_model: routerModelInput.value,
      gemini_model: geminiModelInput.value,
      transcribe_model: transcribeModelInput.value,
      openai_api_key: openaiKeyInput.value.includes('•') ? '' : openaiKeyInput.value,
      gemini_api_key: geminiKeyInput.value.includes('•') ? '' : geminiKeyInput.value,
      google_search_key: googleSearchKeyInput.value.includes('•') ? '' : googleSearchKeyInput.value,
      google_search_cx: googleSearchCxInput.value.includes('•') ? '' : googleSearchCxInput.value
    };

    saveBtn.disabled = true;
    saveBtn.textContent = 'Đang lưu...';
    try {
      await updateSystemConfig(payload);
      saveStatusEl.textContent = 'Đã lưu thành công!';
      setTimeout(loadConfig, 1000);
    } catch (error) {
      saveStatusEl.textContent = 'Lỗi lưu: ' + error.message;
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Lưu cấu hình';
    }
  }

  saveBtn.addEventListener('click', (e) => {
    e.preventDefault();
    saveConfig();
  });
  refreshBtn.addEventListener('click', loadConfig);
  loadConfig();
}

async function loadLogs(container) {
  const tbody = container.querySelector('#logs-table-body');
  try {
    const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    const db = getFirestore(app);
    const q = query(collection(db, "search_logs"), orderBy("timestamp", "desc"), limit(500));
    const snapshot = await getDocs(q);
    allLogs = snapshot.docs.map(doc => ({ id: doc.id, data: doc.data() }));
    currentPage = 1;
    renderPage(container);
  } catch (error) {
    console.error("Error loading logs:", error);
  }
}

function renderPage(container) {
  const tbody = container.querySelector('#logs-table-body');
  if (!tbody) return;
  const start = (currentPage - 1) * ITEMS_PER_PAGE;
  const pageLogs = allLogs.slice(start, start + ITEMS_PER_PAGE);
  tbody.innerHTML = pageLogs.map(item => `
    <tr style="border-bottom:1px solid var(--border-color)">
      <td style="padding:12px;">${item.data.timestamp?.toDate().toLocaleString('vi-VN') || ''}</td>
      <td style="padding:12px;">${escapeHtml(item.data.userEmail || '')}</td>
      <td style="padding:12px;">${escapeHtml(item.data.query || '')}</td>
      <td style="padding:12px;">${escapeHtml(item.data.model || '')}</td>
      <td style="padding:12px;"><button class="btn-delete" data-id="${item.id}">Xóa</button></td>
    </tr>
  `).join('');
}

async function loadUsers(container) {
  const tbody = container.querySelector('#users-table-body');
  try {
    const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    const db = getFirestore(app);
    const q = query(collection(db, "users"), orderBy("createdAt", "desc"), limit(500));
    const snapshot = await getDocs(q);
    allUsers = snapshot.docs.map(doc => ({ id: doc.id, data: doc.data() }));
    currentUsersPage = 1;
    renderUsersPage(container);
  } catch (error) {
    console.error("Error loading users:", error);
  }
}

function renderUsersPage(container) {
  const tbody = container.querySelector('#users-table-body');
  if (!tbody) return;
  const start = (currentUsersPage - 1) * ITEMS_PER_PAGE;
  const pageUsers = allUsers.slice(start, start + ITEMS_PER_PAGE);
  tbody.innerHTML = pageUsers.map(item => `
    <tr style="border-bottom:1px solid var(--border-color)">
      <td style="padding:12px;">${escapeHtml(item.data.email || '')}</td>
      <td style="padding:12px;">${escapeHtml(item.data.displayName || '')}</td>
      <td style="padding:12px;">${item.data.createdAt?.toDate().toLocaleString('vi-VN') || ''}</td>
      <td style="padding:12px;">${item.data.lastLogin?.toDate().toLocaleString('vi-VN') || ''}</td>
    </tr>
  `).join('');
}

function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return String(unsafe)
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}
