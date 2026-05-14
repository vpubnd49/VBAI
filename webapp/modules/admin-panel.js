import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, query, orderBy, limit, getDocs, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { fetchSystemConfig, updateSystemConfig } from './system-config.js';

import { firebaseConfig } from '../firebase-config.js';

let allLogs = [];
let allUsers = [];
let currentPage = 1;
let currentUsersPage = 1;
const ITEMS_PER_PAGE = 10;

const DEFAULT_FALLBACK_SOURCES = {
  vbpl: true,
  chinhphu: true,
  quochoi: true,
  thuvienphapluat: true,
  luatvietnam: true,
};

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
          <div class="config-two-col-grid">
            <section class="config-section-card config-col-panel">
              <div class="config-section-title"><span class="config-section-icon">●</span> Gemini</div>
              <div class="form-group">
                <label class="form-label">Nhà cung cấp AI mặc định</label>
                <input type="text" class="form-input" value="Gemini" readonly>
              </div>
              <div class="form-group">
                <label class="form-label">Gemini API Key</label>
                <input type="password" id="gemini_api_key" class="form-input" placeholder="AIza...">
                <small class="config-hint">Để trống nếu không muốn thay đổi khóa hiện tại</small>
              </div>
              <div class="form-group">
                <label class="form-label">Model mặc định (Gemini)</label>
                <input type="text" id="gemini_model" class="form-input" placeholder="gemini-2.5-pro">
                <small id="gemini-runtime-warning" class="config-hint" style="display:none; color:#fbbf24;"></small>
              </div>
              <div class="form-group">
                <label class="form-label">Danh sách Model Gemini</label>
                <div class="config-inline-row">
                  <input type="text" id="gemini_model_input" class="form-input config-inline-grow" placeholder="Nhập model (VD: gemini-2.5-pro)">
                  <button type="button" id="add-gemini-model-btn" class="btn btn-primary btn-sm config-inline-add-btn">+ Thêm</button>
                </div>
                <div id="gemini-models-list" class="config-chip-list"></div>
              </div>
              <div class="form-group">
                <label class="form-label">Model transcription</label>
                <input type="text" id="transcribe_model" class="form-input" placeholder="whisper-1">
              </div>
            </section>

            <section class="config-section-card config-col-panel">
              <div class="config-section-title"><span class="config-section-icon">●</span> Vertex AI Search</div>
              <div class="form-group">
                <label class="form-label">Nhà cung cấp tra cứu web</label>
                <div class="config-radio-row">
                  <label class="config-radio-option"><input type="radio" name="web_search_provider" value="vertex_ai_search"> Vertex AI Search</label>
                  <label class="config-radio-option"><input type="radio" name="web_search_provider" value="cse"> Google CSE</label>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Chế độ tra cứu web</label>
                <div class="config-radio-col">
                  <label class="config-radio-option"><input type="radio" name="web_search_mode" value="fast_primary"> Nhanh nhất (Primary + fallback ngắn)</label>
                  <label class="config-radio-option"><input type="radio" name="web_search_mode" value="google_only_fast"> Google/CSE nhanh nhất (không fallback)</label>
                  <label class="config-radio-option"><input type="radio" name="web_search_mode" value="hybrid_fallback"> Google + fallback nguồn trực tiếp</label>
                  <label class="config-radio-option"><input type="radio" name="web_search_mode" value="vertex_answer"> Vertex Answer API</label>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Project ID</label>
                <input type="text" id="vertex_project_id" class="form-input" placeholder="gen-lang-client-xxxx">
              </div>
              <div class="form-group">
                <label class="form-label">Location</label>
                <input type="text" id="vertex_location" class="form-input" placeholder="global">
              </div>
              <div class="form-group">
                <label class="form-label">Data Store ID</label>
                <input type="text" id="vertex_data_store_id" class="form-input" placeholder="vbai-legal-search">
              </div>
              <div class="form-group">
                <label class="form-label">Serving Config</label>
                <input type="text" id="vertex_serving_config" class="form-input" placeholder="projects/.../servingConfigs/default_search">
              </div>
              <div class="form-group">
                <label class="form-label">Web Search Fallback Sources</label>
                <div class="config-fallback-grid">
                  <label class="config-radio-option"><input type="checkbox" id="fallback_vbpl"> vbpl.vn</label>
                  <label class="config-radio-option"><input type="checkbox" id="fallback_chinhphu"> chinhphu.vn</label>
                  <label class="config-radio-option"><input type="checkbox" id="fallback_quochoi"> quochoi.vn</label>
                  <label class="config-radio-option"><input type="checkbox" id="fallback_thuvienphapluat"> thuvienphapluat.vn</label>
                  <label class="config-radio-option"><input type="checkbox" id="fallback_luatvietnam"> luatvietnam.vn</label>
                </div>
              </div>
            </section>
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
    if (currentPage > 1) { currentPage -= 1; renderPage(container); }
  });

  container.querySelector('#next-page-btn').addEventListener('click', () => {
    const totalPages = Math.ceil(allLogs.length / ITEMS_PER_PAGE);
    if (currentPage < totalPages) { currentPage += 1; renderPage(container); }
  });

  container.querySelector('#users-prev-page-btn').addEventListener('click', () => {
    if (currentUsersPage > 1) { currentUsersPage -= 1; renderUsersPage(container); }
  });

  container.querySelector('#users-next-page-btn').addEventListener('click', () => {
    const totalPages = Math.ceil(allUsers.length / ITEMS_PER_PAGE);
    if (currentUsersPage < totalPages) { currentUsersPage += 1; renderUsersPage(container); }
  });

  container.querySelector('#delete-all-logs-btn').addEventListener('click', async () => {
    if (!confirm('Bạn có chắc chắn muốn xóa TOÀN BỘ lịch sử tra cứu không?')) return;
    const btn = container.querySelector('#delete-all-logs-btn');
    btn.textContent = 'Đang xóa...';
    try {
      const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
      const db = getFirestore(app);
      const q = query(collection(db, 'search_logs'), limit(500));
      const snapshot = await getDocs(q);
      const deletePromises = snapshot.docs.map((document) => deleteDoc(doc(db, 'search_logs', document.id)));
      await Promise.all(deletePromises);
      loadLogs(container);
    } catch (e) {
      alert('Lỗi xóa tất cả: ' + e.message);
    } finally {
      btn.textContent = 'Xóa tất cả';
    }
  });

  container.querySelector('#logs-table-body').addEventListener('click', async (e) => {
    if (!e.target.classList.contains('btn-delete')) return;
    const logId = e.target.dataset.id;
    if (!confirm('Bạn có chắc muốn xóa bản ghi này?')) return;

    e.target.disabled = true;
    e.target.textContent = '...';
    try {
      const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
      const db = getFirestore(app);
      await deleteDoc(doc(db, 'search_logs', logId));
      loadLogs(container);
    } catch (err) {
      alert('Lỗi xóa: ' + err.message);
      e.target.disabled = false;
      e.target.textContent = 'Xóa';
    }
  });
}

async function initSystemConfigPanel(container) {
  const statusEl = container.querySelector('#config-status');
  const formEl = container.querySelector('#system-config-form');
  const saveBtn = container.querySelector('#save-system-config-btn');
  const refreshBtn = container.querySelector('#refresh-config-btn');
  const saveStatusEl = container.querySelector('#config-save-status');

  const geminiKeyInput = formEl.querySelector('#gemini_api_key');
  const geminiModelInput = formEl.querySelector('#gemini_model');
  const geminiRuntimeWarning = formEl.querySelector('#gemini-runtime-warning');
  const transcribeModelInput = formEl.querySelector('#transcribe_model');
  const vertexProjectIdInput = formEl.querySelector('#vertex_project_id');
  const vertexLocationInput = formEl.querySelector('#vertex_location');
  const vertexDataStoreIdInput = formEl.querySelector('#vertex_data_store_id');
  const vertexServingConfigInput = formEl.querySelector('#vertex_serving_config');

  const fallbackCheckboxes = {
    vbpl: formEl.querySelector('#fallback_vbpl'),
    chinhphu: formEl.querySelector('#fallback_chinhphu'),
    quochoi: formEl.querySelector('#fallback_quochoi'),
    thuvienphapluat: formEl.querySelector('#fallback_thuvienphapluat'),
    luatvietnam: formEl.querySelector('#fallback_luatvietnam'),
  };

  let geminiModels = [];

  const geminiListEl = setupModelInput(container, 'gemini_model_input', 'add-gemini-model-btn', 'gemini-models-list', () => geminiModels, (next) => {
    geminiModels = next;
  });

  function setConfigStatus(message, kind = 'info') {
    statusEl.textContent = message;
    statusEl.classList.remove('config-status-info', 'config-status-success', 'config-status-error');
    statusEl.classList.add(kind === 'error' ? 'config-status-error' : kind === 'success' ? 'config-status-success' : 'config-status-info');
  }

  function setSelectedRadio(name, value) {
    formEl.querySelectorAll(`input[name="${name}"]`).forEach((radio) => {
      radio.checked = radio.value === value;
    });
  }

  function getSelectedRadio(name, fallback) {
    return formEl.querySelector(`input[name="${name}"]:checked`)?.value || fallback;
  }

  function setFallbackSources(sourceMap = DEFAULT_FALLBACK_SOURCES) {
    Object.entries(fallbackCheckboxes).forEach(([key, el]) => {
      if (!el) return;
      el.checked = sourceMap[key] !== false;
    });
  }

  function getFallbackSources() {
    const out = { ...DEFAULT_FALLBACK_SOURCES };
    Object.entries(fallbackCheckboxes).forEach(([key, el]) => {
      if (!el) return;
      out[key] = el.checked;
    });
    return out;
  }

  function updateGeminiRuntimeWarning(modelName, hasGeminiKey) {
    if (!geminiRuntimeWarning) return;
    const normalized = String(modelName || '').trim().toLowerCase();
    const useProLikeModel = normalized.includes('pro');
    if (hasGeminiKey && useProLikeModel) {
      geminiRuntimeWarning.style.display = 'block';
      geminiRuntimeWarning.textContent = 'Lưu ý: model Pro có thể bị 404 theo quyền dự án. Runtime sẽ tự fallback 1 lần sang gemini-2.5-flash để tránh gián đoạn.';
      return;
    }
    geminiRuntimeWarning.style.display = 'none';
    geminiRuntimeWarning.textContent = '';
  }

  async function loadConfig() {
    setConfigStatus('Đang tải cấu hình...', 'info');
    try {
      const config = await fetchSystemConfig({ forceRefresh: true });
      if (!config) {
        setConfigStatus('Chưa có cấu hình hệ thống. Vui lòng nhập thông tin và lưu.', 'info');
        formEl.classList.remove('is-hidden');
        renderModelChips(geminiListEl, geminiModels, 'gemini', (next) => { geminiModels = next; });
        return;
      }

      geminiModelInput.value = config.gemini_model || 'gemini-2.5-pro';
      transcribeModelInput.value = config.transcribe_model || 'whisper-1';

      vertexProjectIdInput.value = config.vertex_project_id || '';
      vertexLocationInput.value = config.vertex_location || 'global';
      vertexDataStoreIdInput.value = config.vertex_data_store_id || '';
      vertexServingConfigInput.value = config.vertex_serving_config || '';

      const provider = config.web_search_provider || 'vertex_ai_search';
      const mode = config.web_search_mode || 'fast_primary';
      setSelectedRadio('web_search_provider', provider);
      setSelectedRadio('web_search_mode', mode);
      setFallbackSources(config.web_search_fallback_sources || DEFAULT_FALLBACK_SOURCES);

      geminiKeyInput.value = config.has_gemini_key ? '••••••••••••' : '';
      updateGeminiRuntimeWarning(geminiModelInput.value, !!config.has_gemini_key);

      geminiModels = Array.isArray(config.gemini_models) ? [...config.gemini_models] : [];
      renderModelChips(geminiListEl, geminiModels, 'gemini', (next) => { geminiModels = next; });

      formEl.classList.remove('is-hidden');
      setConfigStatus('✅ Đã tải cấu hình', 'success');
    } catch (error) {
      setConfigStatus('❌ Lỗi tải: ' + error.message, 'error');
    }
  }

  async function saveConfig() {
    const payload = {
      active_provider: 'gemini',
      gemini_model: geminiModelInput.value.trim(),
      transcribe_model: transcribeModelInput.value.trim() || 'whisper-1',
      web_search_provider: getSelectedRadio('web_search_provider', 'vertex_ai_search'),
      web_search_mode: getSelectedRadio('web_search_mode', 'fast_primary'),
      web_search_fallback_sources: getFallbackSources(),
      vertex_project_id: vertexProjectIdInput.value.trim(),
      vertex_location: vertexLocationInput.value.trim() || 'global',
      vertex_data_store_id: vertexDataStoreIdInput.value.trim(),
      vertex_serving_config: vertexServingConfigInput.value.trim(),
      gemini_models: geminiModels,
      gemini_api_key: geminiKeyInput.value.includes('•') ? '' : geminiKeyInput.value.trim(),
    };

    saveBtn.disabled = true;
    saveBtn.textContent = '⏳ Đang lưu...';
    saveStatusEl.className = 'config-save-status';
    saveStatusEl.textContent = '';
    try {
      await updateSystemConfig(payload);
      saveStatusEl.className = 'config-save-status success';
      saveStatusEl.textContent = '✅ Đã lưu và áp dụng ngay!';
      await loadConfig();
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
  geminiModelInput.addEventListener('input', () => {
    updateGeminiRuntimeWarning(geminiModelInput.value, geminiKeyInput.value.includes('•') || !!geminiKeyInput.value.trim());
  });
  loadConfig();
}

function setupModelInput(container, inputId, btnId, listElId, getModels, setModels) {
  const input = container.querySelector(`#${inputId}`);
  const btn = container.querySelector(`#${btnId}`);
  const listEl = container.querySelector(`#${listElId}`);

  function addModel() {
    const val = input.value.trim();
    if (!val) return;
    const models = getModels();
    if (models.includes(val)) {
      input.value = '';
      return;
    }
    const next = [...models, val];
    setModels(next);
    input.value = '';
    renderModelChips(listEl, next, 'gemini', setModels);
  }

  btn.addEventListener('click', addModel);
  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    addModel();
  });

  return listEl;
}

function renderModelChips(listEl, models, type, onChange = null) {
  listEl.innerHTML = models.length === 0
    ? '<span class="config-chip-empty">Chưa có model nào. Hãy thêm model bên trên.</span>'
    : models.map((m, i) => `
      <span class="model-chip ${type}-chip" data-index="${i}">
        <span>${escapeHtml(m)}</span>
        <span class="chip-remove" data-index="${i}" title="Xóa model này">×</span>
      </span>
    `).join('');

  listEl.querySelectorAll('.chip-remove').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.index);
      const next = models.filter((_, i) => i !== idx);
      if (typeof onChange === 'function') onChange(next);
      renderModelChips(listEl, next, type, onChange);
    });
  });
}

async function loadLogs(container) {
  try {
    const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    const db = getFirestore(app);
    const q = query(collection(db, 'search_logs'), orderBy('timestamp', 'desc'), limit(500));
    const snapshot = await getDocs(q);
    allLogs = snapshot.docs.map((entry) => ({ id: entry.id, data: entry.data() }));
    currentPage = 1;
    renderPage(container);
  } catch (error) {
    console.error('Error loading logs:', error);
  }
}

function renderPage(container) {
  const tbody = container.querySelector('#logs-table-body');
  if (!tbody) return;
  const start = (currentPage - 1) * ITEMS_PER_PAGE;
  const pageLogs = allLogs.slice(start, start + ITEMS_PER_PAGE);
  tbody.innerHTML = pageLogs.map((item) => `
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
  try {
    const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    const db = getFirestore(app);
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(500));
    const snapshot = await getDocs(q);
    allUsers = snapshot.docs.map((entry) => ({ id: entry.id, data: entry.data() }));
    currentUsersPage = 1;
    renderUsersPage(container);
  } catch (error) {
    console.error('Error loading users:', error);
  }
}

function renderUsersPage(container) {
  const tbody = container.querySelector('#users-table-body');
  if (!tbody) return;
  const start = (currentUsersPage - 1) * ITEMS_PER_PAGE;
  const pageUsers = allUsers.slice(start, start + ITEMS_PER_PAGE);
  tbody.innerHTML = pageUsers.map((item) => `
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
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
