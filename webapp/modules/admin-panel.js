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
    <div class="panel-group admin-config-panel">
      <div class="panel-header">
        <div class="panel-header-icon">⚙️</div>
        Cấu hình AI Hệ thống
        <div class="admin-config-spacer"></div>
        <button id="refresh-config-btn" class="btn btn-secondary btn-sm admin-config-toolbar-btn">Làm mới</button>
      </div>
      <div class="panel-body">
        <div id="config-status" class="config-status-banner config-status-info">Đang tải cấu hình...</div>
        <form id="system-config-form" class="system-config-form is-hidden">
          <div class="form-group">
            <label class="form-label">Nhà cung cấp AI mặc định</label>
            <div class="config-radio-row">
              <label class="config-radio-option"><input type="radio" name="active_provider" value="openai"> OpenAI</label>
              <label class="config-radio-option"><input type="radio" name="active_provider" value="gemini"> Gemini</label>
              <label class="config-radio-option"><input type="radio" name="active_provider" value="vertex"> Vertex AI</label>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Chế độ Tra cứu Web / RAG</label>
            <div class="config-radio-col">
              <label class="config-radio-option">
                <input type="radio" name="search_mode" value="google_cse" checked> 
                <span>Tìm kiếm Google (CSE) - Truyền thống</span>
              </label>
              <label class="config-radio-option">
                <input type="radio" name="search_mode" value="vertex_answer"> 
                <span class="config-strong-label">Vertex AI Answer (Native RAG)</span>
                <span class="config-recommend-badge">Khuyên dùng</span>
              </label>
            </div>
          </div>

          <!-- ===== OpenAI Section ===== -->
          <div class="config-section-card">
            <div class="config-section-title">
              <span class="config-section-icon">●</span> Cấu hình OpenAI
            </div>
            <div class="form-group">
              <label class="form-label">OpenAI Endpoint</label>
              <input type="text" id="openai_endpoint" class="form-input" placeholder="https://api.openai.com/v1">
            </div>
            <div class="form-group">
              <label class="form-label">OpenAI API Key</label>
              <input type="password" id="openai_api_key" class="form-input" placeholder="sk-...">
              <small class="config-hint">Để trống nếu không muốn thay đổi khóa hiện tại</small>
            </div>
            <div class="form-group">
              <label class="form-label">Model mặc định (OpenAI)</label>
              <input type="text" id="router_model" class="form-input" placeholder="gpt-4o-mini">
            </div>
            <div class="form-group">
              <label class="form-label">Danh sách Model OpenAI</label>
              <div class="config-inline-row">
                <input type="text" id="openai_model_input" class="form-input config-inline-grow" placeholder="Nhập tên model (VD: gpt-4o, gpt-4.4-mini)">
                <button type="button" id="add-openai-model-btn" class="btn btn-primary btn-sm config-inline-add-btn">+ Thêm</button>
              </div>
              <div id="openai-models-list" class="config-chip-list"></div>
            </div>
          </div>

          <!-- ===== Gemini Section ===== -->
          <div class="config-section-card">
            <div class="config-section-title">
              <span class="config-section-icon">●</span> Cấu hình Gemini
            </div>
            <div class="form-group">
              <label class="form-label">Gemini API Key</label>
              <input type="password" id="gemini_api_key" class="form-input" placeholder="AIza...">
              <small class="config-hint">Để trống nếu không muốn thay đổi khóa hiện tại</small>
            </div>
            <div class="form-group">
              <label class="form-label">Model mặc định (Gemini)</label>
              <input type="text" id="gemini_model" class="form-input" placeholder="gemini-1.5-flash">
            </div>
            <div class="form-group">
              <label class="form-label">Danh sách Model Gemini</label>
              <div class="config-inline-row">
                <input type="text" id="gemini_model_input" class="form-input config-inline-grow" placeholder="Nhập tên model (VD: gemini-2.5-flash, gemini-2.0-pro)">
                <button type="button" id="add-gemini-model-btn" class="btn btn-primary btn-sm config-inline-add-btn">+ Thêm</button>
              </div>
              <div id="gemini-models-list" class="config-chip-list"></div>
            </div>
          </div>

          <!-- ===== Vertex AI Section ===== -->
          <div class="config-section-card">
            <div class="config-section-title">
              <span class="config-section-icon">●</span> Cấu hình Vertex AI
            </div>
            <div class="form-group">
              <label class="form-label">Google Cloud Project ID</label>
              <input type="text" id="vertex_project_id" class="form-input" placeholder="vbai-project-123">
            </div>
            <div class="form-group">
              <label class="form-label">Vertex Location (Region)</label>
              <input type="text" id="vertex_location" class="form-input" placeholder="us-central1">
            </div>
            <div class="form-group">
              <label class="form-label">Vertex AI Search Data Store ID</label>
              <input type="text" id="vertex_data_store_id" class="form-input" placeholder="legal-data-store-id">
              <small class="config-hint">Bắt buộc nếu dùng Vertex AI Answer API</small>
            </div>
          </div>

          <!-- ===== Google Search Section ===== -->
          <div class="config-section-card">
            <div class="config-section-title">
              <span class="config-section-icon">●</span> Google Custom Search
            </div>
            <div class="form-group">
              <label class="form-label">Google Search API Key</label>
              <input type="password" id="google_search_key" class="form-input" placeholder="AIza...">
              <small class="config-hint">Tùy chọn cho tra cứu web pháp lý. Để trống nếu không muốn thay đổi khóa hiện tại</small>
            </div>
            <div class="form-group">
              <label class="form-label">Google Search CX</label>
              <input type="password" id="google_search_cx" class="form-input" placeholder="Custom Search Engine ID">
              <small class="config-hint">Để trống nếu không muốn thay đổi mã CX hiện tại</small>
            </div>
          </div>

          <!-- ===== Transcription Section ===== -->
          <div class="form-group config-transcribe-group">
            <label class="form-label">Model transcription (Whisper)</label>
            <input type="text" id="transcribe_model" class="form-input" placeholder="whisper-1">
          </div>

          <div class="btn-row config-save-row">
            <button id="save-system-config-btn" class="btn btn-primary config-save-btn">💾 Lưu cấu hình</button>
          </div>
          <div id="config-save-status" class="config-save-status"></div>
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

  // Individual log deletion
  container.querySelector('#logs-table-body').addEventListener('click', async (e) => {
    if (e.target.classList.contains('btn-delete')) {
      const logId = e.target.dataset.id;
      if (!confirm('Bạn có chắc muốn xóa bản ghi này?')) return;
      
      e.target.disabled = true;
      e.target.textContent = '...';
      try {
        const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
        const db = getFirestore(app);
        await deleteDoc(doc(db, "search_logs", logId));
        loadLogs(container);
      } catch (err) {
        alert('Lỗi xóa: ' + err.message);
        e.target.disabled = false;
        e.target.textContent = 'Xóa';
      }
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
  const searchModeRadios = formEl.querySelectorAll('input[name="search_mode"]');
  const openaiEndpointInput = formEl.querySelector('#openai_endpoint');
  const openaiKeyInput = formEl.querySelector('#openai_api_key');
  const routerModelInput = formEl.querySelector('#router_model');
  const geminiKeyInput = formEl.querySelector('#gemini_api_key');
  const geminiModelInput = formEl.querySelector('#gemini_model');
  const vertexProjectIdInput = formEl.querySelector('#vertex_project_id');
  const vertexLocationInput = formEl.querySelector('#vertex_location');
  const vertexDataStoreIdInput = formEl.querySelector('#vertex_data_store_id');
  const googleSearchKeyInput = formEl.querySelector('#google_search_key');
  const googleSearchCxInput = formEl.querySelector('#google_search_cx');
  const transcribeModelInput = formEl.querySelector('#transcribe_model');

  // Model lists state
  let openaiModels = [];
  let geminiModels = [];

  function renderModelChips(listEl, models, type) {
    listEl.innerHTML = models.length === 0
      ? `<span class="config-chip-empty">Chưa có model nào. Hãy thêm model bên trên.</span>`
      : models.map((m, i) => `
        <span class="model-chip ${type}-chip" data-index="${i}">
          <span>${escapeHtml(m)}</span>
          <span class="chip-remove" data-index="${i}" title="Xóa model này">×</span>
        </span>
      `).join('');

    // Bind remove clicks
    listEl.querySelectorAll('.chip-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index, 10);
        if (type === 'openai') {
          openaiModels.splice(idx, 1);
          renderModelChips(listEl, openaiModels, type);
        } else {
          geminiModels.splice(idx, 1);
          renderModelChips(listEl, geminiModels, type);
        }
      });
    });
  }

  function setupModelInput(inputId, btnId, listElId, type) {
    const input = container.querySelector(`#${inputId}`);
    const btn = container.querySelector(`#${btnId}`);
    const listEl = container.querySelector(`#${listElId}`);

    function addModel() {
      const val = input.value.trim();
      if (!val) return;
      const models = type === 'openai' ? openaiModels : geminiModels;
      if (models.includes(val)) {
        input.value = '';
        return;
      }
      models.push(val);
      input.value = '';
      renderModelChips(listEl, models, type);
    }

    btn.addEventListener('click', addModel);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addModel();
      }
    });

    return listEl;
  }

  const openaiListEl = setupModelInput('openai_model_input', 'add-openai-model-btn', 'openai-models-list', 'openai');
  const geminiListEl = setupModelInput('gemini_model_input', 'add-gemini-model-btn', 'gemini-models-list', 'gemini');

  function setConfigStatus(message, kind = 'info') {
    statusEl.textContent = message;
    statusEl.classList.remove('config-status-info', 'config-status-success', 'config-status-error');
    statusEl.classList.add(kind === 'error' ? 'config-status-error' : kind === 'success' ? 'config-status-success' : 'config-status-info');
  }

  async function loadConfig() {
    setConfigStatus('Đang tải cấu hình...', 'info');
    try {
      const config = await fetchSystemConfig();
      if (!config) {
        setConfigStatus('Chưa có cấu hình hệ thống. Vui lòng điền thông tin và lưu.', 'info');
        formEl.classList.remove('is-hidden');
        openaiModels = [];
        geminiModels = [];
        renderModelChips(openaiListEl, openaiModels, 'openai');
        renderModelChips(geminiListEl, geminiModels, 'gemini');
        return;
      }
      
      openaiEndpointInput.value = config.openai_endpoint || 'https://api.openai.com/v1';
      routerModelInput.value = config.router_model || 'gpt-4o-mini';
      geminiModelInput.value = config.gemini_model || 'gemini-1.5-flash';
      transcribeModelInput.value = config.transcribe_model || 'whisper-1';
      
      vertexProjectIdInput.value = config.vertex_project_id || '';
      vertexLocationInput.value = config.vertex_location || 'us-central1';
      vertexDataStoreIdInput.value = config.vertex_data_store_id || '';

      const provider = config.active_provider || 'openai';
      providerRadios.forEach(r => r.checked = r.value === provider);
      
      const searchMode = config.search_mode || 'google_cse';
      searchModeRadios.forEach(r => r.checked = r.value === searchMode);

      if (config.has_openai_key) openaiKeyInput.value = '••••••••••••';
      if (config.has_gemini_key) geminiKeyInput.value = '••••••••••••';
      if (config.google_search_configured) {
        googleSearchKeyInput.value = '••••••••••••';
        googleSearchCxInput.value = '••••••••••••';
      }

      // Load model lists
      openaiModels = Array.isArray(config.openai_models) ? [...config.openai_models] : [];
      geminiModels = Array.isArray(config.gemini_models) ? [...config.gemini_models] : [];
      renderModelChips(openaiListEl, openaiModels, 'openai');
      renderModelChips(geminiListEl, geminiModels, 'gemini');

      formEl.classList.remove('is-hidden');
      setConfigStatus('✅ Đã tải cấu hình', 'success');
    } catch (error) {
      setConfigStatus('❌ Lỗi tải: ' + error.message, 'error');
    }
  }

  async function saveConfig() {
    const provider = formEl.querySelector('input[name="active_provider"]:checked').value;
    const searchMode = formEl.querySelector('input[name="search_mode"]:checked').value;
    const payload = {
      active_provider: provider,
      search_mode: searchMode,
      openai_endpoint: openaiEndpointInput.value,
      router_model: routerModelInput.value,
      gemini_model: geminiModelInput.value,
      vertex_project_id: vertexProjectIdInput.value,
      vertex_location: vertexLocationInput.value,
      vertex_data_store_id: vertexDataStoreIdInput.value,
      transcribe_model: transcribeModelInput.value,
      openai_api_key: openaiKeyInput.value.includes('•') ? '' : openaiKeyInput.value,
      gemini_api_key: geminiKeyInput.value.includes('•') ? '' : geminiKeyInput.value,
      google_search_key: googleSearchKeyInput.value.includes('•') ? '' : googleSearchKeyInput.value,
      google_search_cx: googleSearchCxInput.value.includes('•') ? '' : googleSearchCxInput.value,
      openai_models: openaiModels,
      gemini_models: geminiModels
    };

    saveBtn.disabled = true;
    saveBtn.textContent = '⏳ Đang lưu...';
    saveStatusEl.className = 'config-save-status';
    saveStatusEl.textContent = '';
    try {
      await updateSystemConfig(payload);
      saveStatusEl.className = 'config-save-status success';
      saveStatusEl.textContent = '✅ Đã lưu thành công!';
      setTimeout(loadConfig, 1500);
    } catch (error) {
      saveStatusEl.className = 'config-save-status error';
      saveStatusEl.textContent = `❌ Lỗi lưu: ${error.message}`;
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = '💾 Lưu cấu hình';
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
