import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, query, limit, getDocs, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { fetchSystemConfig, updateSystemConfig, validateGeminiApiKey, triggerVertexIngestion } from './system-config.js';

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
    <div class="admin-user-status-banner" style="padding:12px 16px; margin-bottom:20px; border-radius:8px; background:var(--bg-card, #ffffff); border:1px solid var(--border-color, #cbd5e1); color:var(--text-primary, #0f172a); display:flex; justify-content:space-between; align-items:center; font-size:0.9rem">
      <div>👤 Tài khoản: <strong style="color:var(--primary, #0284c7)">${escapeHtml(window.currentUser?.email || 'Chưa đăng nhập')}</strong></div>
      <div>🔑 Quyền Quản trị: <strong style="color:${window.isAdmin ? 'var(--success, #059669)' : 'var(--danger, #dc2626)'}">${window.isAdmin ? 'Hợp lệ (Admin)' : 'Không khả dụng (Yêu cầu đăng xuất & đăng nhập lại)'}</strong></div>
    </div>

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
            <!-- Group 1: AI (Google Gemini) -->
            <section class="config-section-card config-col-panel">
              <div class="config-section-title" style="color: var(--brand-primary);"><span class="config-section-icon">●</span> AI Engine (Google Gemini)</div>
              
              <div class="form-group">
                <label class="form-label">Gemini API Key</label>
                <div class="config-inline-row">
                  <input type="password" id="gemini_api_key" class="form-input config-inline-grow" placeholder="AIza... (Để trống nếu không đổi)">
                  <button type="button" id="toggle-gemini-key-btn" class="btn btn-secondary btn-sm config-inline-add-btn">Hiện key</button>
                  <button type="button" id="verify-gemini-key-btn" class="btn btn-primary btn-sm config-inline-add-btn">Xác nhận key</button>
                </div>
                <label class="config-radio-option" style="margin-top:8px">
                  <input type="checkbox" id="verify-gemini-on-save" checked> Xác nhận key khi lưu cấu hình
                </label>
                <small class="config-hint">Khóa API được lưu an toàn trong Secret Manager/Firestore (PATCH semantics)</small>
                <small id="gemini-key-verify-status" class="config-hint"></small>
              </div>
              <div class="form-group">
                <label class="form-label">Gemini API Endpoint (Base URL)</label>
                <input type="text" id="gemini_endpoint" class="form-input" placeholder="https://generativelanguage.googleapis.com/v1beta/openai">
              </div>
              <div class="form-group">
                <label class="form-label">Model mặc định (Gemini)</label>
                <input type="text" id="gemini_model" class="form-input" placeholder="gemini-3.5-flash-lite">
                <small id="gemini-runtime-warning" class="config-hint" style="display:none; color:var(--warning);"></small>
              </div>
              <div class="form-group">
                <label class="form-label">Model transcription (Ghi âm)</label>
                <input type="text" id="transcribe_model" class="form-input" placeholder="gemini-3.5-flash-lite">
              </div>
              <div class="form-group">
                <label class="form-label">Model meeting (Biên bản cuộc họp)</label>
                <input type="text" id="meeting_model" class="form-input" placeholder="gemini-3.5-flash-lite">
              </div>
              <div class="form-group">
                <label class="form-label">Danh sách Model Gemini khả dụng</label>
                <div class="config-inline-row">
                  <input type="text" id="gemini_model_input" class="form-input config-inline-grow" placeholder="Nhập model (VD: gemini-3.5-flash-lite)">
                  <button type="button" id="add-gemini-model-btn" class="btn btn-primary btn-sm config-inline-add-btn">+ Thêm</button>
                </div>
                <div id="gemini-models-list" class="config-chip-list"></div>
              </div>
            </section>

            <!-- Group 2: Search (Google & Vertex AI Search) -->
            <section class="config-section-card config-col-panel config-section-vertex">
              <div class="config-section-title"><span class="config-section-icon">●</span> Web Search & Vertex AI Search</div>
              <div class="form-group">
                <label class="form-label">Chế độ tra cứu web</label>
                <div class="config-radio-col">
                  <label class="config-radio-option"><input type="radio" name="web_search_mode" value="cse_fast"> Nhanh nhất (Nguồn trực tiếp)</label>
                  <label class="config-radio-option"><input type="radio" name="web_search_mode" value="cse_with_fallback"> Vertex AI Search + fallback nguồn chính thức</label>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Project ID Vertex</label>
                <input type="text" id="vertex_project_id" class="form-input" placeholder="gen-lang-client-0462350485">
              </div>
              <div class="form-group">
                <label class="form-label">Location, Data Store ID & Serving Config</label>
                <div class="config-inline-row">
                  <input type="text" id="vertex_location" class="form-input" placeholder="global" style="width: 25%;">
                  <input type="text" id="vertex_data_store_id" class="form-input" placeholder="vbai-legal-search" style="flex:1;">
                  <input type="text" id="vertex_serving_config" class="form-input" placeholder="default_config" style="width: 30%;">
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Fallback Sources (Nguồn kiểm chứng)</label>
                <div class="config-fallback-grid">
                  <label class="config-radio-option"><input type="checkbox" id="fallback_vbpl"> vbpl.vn</label>
                  <label class="config-radio-option"><input type="checkbox" id="fallback_chinhphu"> chinhphu.vn</label>
                  <label class="config-radio-option"><input type="checkbox" id="fallback_quochoi"> quochoi.vn</label>
                  <label class="config-radio-option"><input type="checkbox" id="fallback_thuvienphapluat"> thuvienphapluat.vn</label>
                  <label class="config-radio-option"><input type="checkbox" id="fallback_luatvietnam"> luatvietnam.vn</label>
                </div>
              </div>
              <div class="form-group config-ingest-group">
                <button type="button" id="trigger-vertex-ingest-btn" class="btn btn-secondary btn-sm config-ingest-btn">
                  🔄 Đồng bộ dữ liệu Vertex (Ingest)
                </button>
                <small id="vertex-ingest-status" class="config-hint config-block-hint"></small>
              </div>
            </section>

            <!-- Group 3: Legal Engine Metadata -->
            <section class="config-section-card config-col-panel config-section-search">
              <div class="config-section-title config-title-gold"><span class="config-section-icon">●</span> Engine Pháp Lý & Metadata</div>
              <div class="form-group">
                <div class="admin-ai-badge">Known Documents Index: <strong>750+ Văn bản quy phạm</strong></div>
              </div>
              <div class="form-group">
                <div class="admin-ai-badge">Bổ sung Metadata: <strong>bosung_metadata.json (Active)</strong></div>
              </div>
              <div class="form-group">
                <div class="admin-ai-badge">Citation Validator: <strong>Strict Verification Engine Wired</strong></div>
              </div>
              <div class="form-group">
                <div class="admin-ai-badge">Môi trường AI Runtime: <strong>Google Gemini Only (Strict Mode)</strong></div>
              </div>
            </section>

            <!-- Group 4: System & Build Info -->
            <section class="config-section-card config-col-panel">
              <div class="config-section-title" style="color: var(--info);"><span class="config-section-icon">●</span> Hệ Thống & Build Identity</div>
              <div class="form-group">
                <label class="form-label">Tên sản phẩm:</label>
                <input type="text" class="form-input" value="VBAI Legal Pro V2" readonly>
              </div>
              <div class="form-group">
                <label class="form-label">Firebase Project ID:</label>
                <input type="text" class="form-input" value="${window.__VBAI_CONFIG__?.FIREBASE_PROJECT_ID || 'gen-lang-client-0462350485'}" readonly>
              </div>
              <div class="form-group">
                <label class="form-label">Runtime Environment:</label>
                <input type="text" class="form-input" value="${window.__VBAI_CONFIG__?.APP_ENV || 'production'}" readonly>
              </div>
              <div class="form-group">
                <label class="form-label">App Build Git SHA:</label>
                <input type="text" class="form-input" value="${typeof __VBAI_FULL_GIT_SHA__ !== 'undefined' ? __VBAI_FULL_GIT_SHA__ : 'dev-build'}" readonly>
              </div>
            </section>
          </div>

          <div class="btn-row config-save-row">
            <button id="save-system-config-btn" class="btn btn-primary config-save-btn">💾 Lưu cấu hình AI & Hệ thống</button>
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
              <th style="padding:12px; width:120px; text-align:right">Hành động</th>
            </tr>
          </thead>
          <tbody id="users-table-body">
            <tr><td colspan="5" style="padding:20px; text-align:center; color:var(--text-muted)">Đang tải dữ liệu...</td></tr>
          </tbody>
        </table>
        <div id="users-pagination-controls" style="display:none; justify-content:center; align-items:center; padding:12px; gap:16px; background:var(--bg-secondary); border-top:1px solid var(--border-color)">
          <button id="users-prev-page-btn" class="btn btn-secondary btn-sm" style="padding:4px 8px; font-size:0.8rem">⬅️ Trước</button>
          <span id="users-page-indicator" style="font-size:0.85rem; font-weight:500">Trang 1 / 1</span>
          <button id="users-next-page-btn" class="btn btn-secondary btn-sm" style="padding:4px 8px; font-size:0.8rem">Tiếp ➡️</button>
        </div>
      </div>
    </div>

    <!-- Edit User Modal -->
    <div id="edit-user-modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:9999; justify-content:center; align-items:center">
      <div style="background:#0f1f38; border:1px solid rgba(96,165,250,0.3); border-radius:12px; width:100%; max-width:450px; padding:24px; box-shadow:0 20px 25px -5px rgba(0,0,0,0.5)">
        <h3 style="margin-top:0; margin-bottom:20px; color:#e6f1ff; border-bottom:1px solid rgba(96,165,250,0.2); padding-bottom:10px">✏️ Sửa thông tin thành viên</h3>
        <form id="edit-user-form">
          <input type="hidden" id="edit-user-uid">
          <div style="margin-bottom:16px; text-align:left">
            <label style="display:block; font-size:0.8rem; color:#cfe4ff; margin-bottom:6px">Email</label>
            <input type="text" id="edit-user-email" class="form-input" style="width:100%; background:rgba(8,17,32,0.5); color:#8899af; cursor:not-allowed; border:1px solid rgba(96,165,250,0.1); border-radius:6px; padding:8px; box-sizing:border-box" readonly>
          </div>
          <div style="margin-bottom:16px; text-align:left">
            <label style="display:block; font-size:0.8rem; color:#cfe4ff; margin-bottom:6px">Tên hiển thị</label>
            <input type="text" id="edit-user-name" class="form-input" style="width:100%; background:rgba(8,17,32,0.5); color:#e6f1ff; border:1px solid rgba(96,165,250,0.2); border-radius:6px; padding:8px; box-sizing:border-box" required>
          </div>
          <div style="margin-bottom:16px; text-align:left">
            <label style="display:block; font-size:0.8rem; color:#cfe4ff; margin-bottom:6px">Chức vụ</label>
            <input type="text" id="edit-user-position" class="form-input" style="width:100%; background:rgba(8,17,32,0.5); color:#e6f1ff; border:1px solid rgba(96,165,250,0.2); border-radius:6px; padding:8px; box-sizing:border-box">
          </div>
          <div style="margin-bottom:24px; text-align:left">
            <label style="display:block; font-size:0.8rem; color:#cfe4ff; margin-bottom:6px">Vai trò hệ thống</label>
            <select id="edit-user-role" style="width:100%; background:#081120; color:#e6f1ff; border:1px solid rgba(96,165,250,0.2); border-radius:6px; padding:8px; outline:none; box-sizing:border-box">
              <option value="DEPARTMENT">DEPARTMENT (Chuyên viên)</option>
              <option value="OFFICE">OFFICE (Trưởng/Phó phòng)</option>
              <option value="LEADER">LEADER (Lãnh đạo)</option>
              <option value="ADMIN">ADMIN (Quản trị viên)</option>
            </select>
          </div>
          <div style="display:flex; justify-content:flex-end; gap:12px">
            <button type="button" id="edit-user-cancel" class="btn btn-secondary" style="padding:8px 16px; border-radius:6px">Hủy</button>
            <button type="submit" class="btn btn-primary" style="padding:8px 16px; border-radius:6px">Lưu thay đổi</button>
          </div>
        </form>
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
    btn.disabled = true;
    btn.textContent = 'Đang xóa...';
    try {
      const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
      const db = getFirestore(app);
      let totalDeleted = 0;
      let hasMore = true;
      while (hasMore) {
        const q = query(collection(db, 'search_logs'), limit(500));
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
          hasMore = false;
          break;
        }
        const deletePromises = snapshot.docs.map((document) => deleteDoc(doc(db, 'search_logs', document.id)));
        await Promise.all(deletePromises);
        totalDeleted += snapshot.docs.length;
        btn.textContent = `Đang xóa... (${totalDeleted})`;
        if (snapshot.docs.length < 500) {
          hasMore = false;
        }
      }
      loadLogs(container);
    } catch (e) {
      alert('Lỗi xóa tất cả: ' + e.message);
    } finally {
      btn.disabled = false;
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

  // Handle user table clicks (Delete / Edit)
  const usersTableBody = container.querySelector('#users-table-body');
  
  // Delete action
  usersTableBody.addEventListener('click', async (e) => {
    if (e.target.classList.contains('btn-user-delete')) {
      const uid = e.target.dataset.id;
      const email = e.target.dataset.email;
      
      if (window.currentUser && window.currentUser.uid === uid) {
        alert('Bạn không thể tự xóa tài khoản của chính mình!');
        return;
      }
      
      if (!confirm(`Bạn có chắc chắn muốn xóa vĩnh viễn thành viên [${email}] không?\nHành động này sẽ xóa ở cả Firestore và Auth login.`)) {
        return;
      }
      
      e.target.disabled = true;
      e.target.textContent = '...';
      
      try {
        const idToken = await window.currentUser.getIdToken();
        const res = await fetch('/api/admin/delete-user', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${idToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ uid })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Xóa thành viên thất bại.');
        alert('Đã xóa thành viên thành công!');
        loadUsers(container);
      } catch (err) {
        alert('Lỗi: ' + err.message);
        e.target.disabled = false;
        e.target.textContent = 'Xóa';
      }
    }
  });

  // Edit modal elements
  const editModal = container.querySelector('#edit-user-modal');
  const editForm = container.querySelector('#edit-user-form');
  const cancelBtn = container.querySelector('#edit-user-cancel');
  
  // Open Edit Modal
  usersTableBody.addEventListener('click', (e) => {
    if (e.target.classList.contains('btn-user-edit')) {
      const uid = e.target.dataset.id;
      const email = e.target.dataset.email;
      const name = e.target.dataset.name;
      const position = e.target.dataset.position;
      const role = e.target.dataset.role || 'DEPARTMENT';
      
      container.querySelector('#edit-user-uid').value = uid;
      container.querySelector('#edit-user-email').value = email;
      container.querySelector('#edit-user-name').value = name;
      container.querySelector('#edit-user-position').value = position;
      container.querySelector('#edit-user-role').value = role.toUpperCase();
      
      editModal.style.display = 'flex';
    }
  });

  // Close Edit Modal
  cancelBtn.addEventListener('click', () => {
    editModal.style.display = 'none';
  });

  // Submit Edit Form
  editForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const uid = container.querySelector('#edit-user-uid').value;
    const displayName = container.querySelector('#edit-user-name').value.trim();
    const position = container.querySelector('#edit-user-position').value.trim();
    const role = container.querySelector('#edit-user-role').value;
    
    const submitBtn = editForm.querySelector('button[type="submit"]');
    const oldText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Đang lưu...';
    
    try {
      const idToken = await window.currentUser.getIdToken();
      const res = await fetch('/api/admin/update-user', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ uid, displayName, position, role })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Cập nhật thất bại.');
      alert('Đã cập nhật thông tin thành viên thành công!');
      editModal.style.display = 'none';
      loadUsers(container);
    } catch (err) {
      alert('Lỗi: ' + err.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = oldText;
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
  const toggleGeminiKeyBtn = formEl.querySelector('#toggle-gemini-key-btn');
  const verifyGeminiKeyBtn = formEl.querySelector('#verify-gemini-key-btn');
  const verifyGeminiOnSaveInput = formEl.querySelector('#verify-gemini-on-save');
  const geminiKeyVerifyStatus = formEl.querySelector('#gemini-key-verify-status');
  const geminiEndpointInput = formEl.querySelector('#gemini_endpoint');
  const geminiModelInput = formEl.querySelector('#gemini_model');
  const geminiRuntimeWarning = formEl.querySelector('#gemini-runtime-warning');
  
  const transcribeModelInput = formEl.querySelector('#transcribe_model');
  const meetingModelInput = formEl.querySelector('#meeting_model');
  const vertexProjectIdInput = formEl.querySelector('#vertex_project_id');
  const vertexLocationInput = formEl.querySelector('#vertex_location');
  const vertexDataStoreIdInput = formEl.querySelector('#vertex_data_store_id');
  const vertexServingConfigInput = formEl.querySelector('#vertex_serving_config');
  const triggerVertexIngestBtn = formEl.querySelector('#trigger-vertex-ingest-btn');
  const vertexIngestStatus = formEl.querySelector('#vertex-ingest-status');

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
      geminiRuntimeWarning.textContent = 'Lưu ý: model Pro có thể bị 404 theo quyền dự án. Runtime sẽ tự fallback 1 lần sang gemini-3.5-flash-lite để tránh gián đoạn.';
      return;
    }
    geminiRuntimeWarning.style.display = 'none';
    geminiRuntimeWarning.textContent = '';
  }

  function setGeminiKeyVerifyStatus(message = '', kind = 'info') {
    if (!geminiKeyVerifyStatus) return;
    geminiKeyVerifyStatus.textContent = message;
    if (kind === 'error') {
      geminiKeyVerifyStatus.style.color = '#b91c1c';
      return;
    }
    if (kind === 'success') {
      geminiKeyVerifyStatus.style.color = '#15803d';
      return;
    }
    geminiKeyVerifyStatus.style.color = 'var(--text-muted)';
  }

  async function runKeyValidation(provider = 'gemini', { useStoredKey = true } = {}) {
    const keyInput = geminiKeyInput;
    const endpointInput = geminiEndpointInput;
    const modelInput = geminiModelInput;
    const verifyBtn = verifyGeminiKeyBtn;
    const verifyStatusEl = geminiKeyVerifyStatus;

    if (verifyBtn) {
      verifyBtn.disabled = true;
      verifyBtn.textContent = 'Đang kiểm tra...';
    }
    
    if (verifyStatusEl) {
      verifyStatusEl.textContent = 'Đang xác nhận Gemini API key...';
      verifyStatusEl.style.color = 'var(--text-muted)';
    }

    try {
      const payload = {
        apiKey: keyInput?.value?.trim() || '',
        gemini_endpoint: endpointInput?.value?.trim() || '',
        useStoredKey,
        model: modelInput?.value?.trim() || 'gemini-3.5-flash-lite',
      };
      const result = await validateGeminiApiKey(payload);
      if (result?.valid !== true) {
        throw new Error(result?.message || 'Xác nhận key thất bại.');
      }
      if (verifyStatusEl) {
        verifyStatusEl.textContent = '✅ Gemini API key hợp lệ.';
        verifyStatusEl.style.color = '#15803d';
      }
      return true;
    } catch (error) {
      if (verifyStatusEl) {
        verifyStatusEl.textContent = `❌ ${error.message}`;
        verifyStatusEl.style.color = '#b91c1c';
      }
      return false;
    } finally {
      if (verifyBtn) {
        verifyBtn.disabled = false;
        verifyBtn.textContent = 'Xác nhận key';
      }
    }
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

      // Helper for safe input access
      const setInputValue = (el, val) => { if (el) el.value = val; };
      const getInputValue = (el, fallback = '') => el ? el.value.trim() : fallback;

      // Load Gemini
      setInputValue(geminiModelInput, config.gemini_model || 'gemini-3.5-flash-lite');
      setInputValue(geminiEndpointInput, config.gemini_endpoint || '');
      setInputValue(geminiKeyInput, config.gemini_api_key || '');
      if (geminiKeyInput) geminiKeyInput.type = 'password';
      if (toggleGeminiKeyBtn) toggleGeminiKeyBtn.textContent = 'Hiện key';
      setGeminiKeyVerifyStatus(config.has_gemini_key ? 'Đã lưu Gemini API key. Bạn có thể xác nhận lại bất cứ lúc nào.' : 'Chưa có Gemini API key.');
      updateGeminiRuntimeWarning(geminiModelInput ? geminiModelInput.value : '', !!config.has_gemini_key);
      geminiModels = Array.isArray(config.gemini_models) ? [...config.gemini_models] : [];
      renderModelChips(geminiListEl, geminiModels, 'gemini', (next) => { geminiModels = next; });

      // Load other configs
      setInputValue(transcribeModelInput, config.transcribe_model || 'gemini-3.5-flash-lite');
      setInputValue(meetingModelInput, config.meeting_model || 'gemini-3.5-flash-lite');
      setInputValue(vertexProjectIdInput, config.vertex_project_id || '');
      setInputValue(vertexLocationInput, config.vertex_location || 'global');
      setInputValue(vertexDataStoreIdInput, config.vertex_data_store_id || '');
      setInputValue(vertexServingConfigInput, config.vertex_serving_config || '');

      const provider = config.web_search_provider || 'vertex_search';
      const mode = config.web_search_mode || 'cse_with_fallback';
      setSelectedRadio('web_search_provider', provider);
      setSelectedRadio('web_search_mode', mode);
      setFallbackSources(config.web_search_fallback_sources || DEFAULT_FALLBACK_SOURCES);

      formEl.classList.remove('is-hidden');
      setConfigStatus('✅ Đã tải cấu hình', 'success');
    } catch (error) {
      setConfigStatus('❌ Lỗi tải: ' + error.message, 'error');
    }
  }

  async function saveConfig() {
    const getInputValue = (el, fallback = '') => el ? el.value.trim() : fallback;
    const payload = {
      // Gemini
      gemini_model: getInputValue(geminiModelInput, 'gemini-3.5-flash-lite'),
      gemini_endpoint: getInputValue(geminiEndpointInput),
      gemini_models: geminiModels,
      gemini_api_key: getInputValue(geminiKeyInput),

      // Other Settings
      transcribe_model: getInputValue(transcribeModelInput, 'gemini-3.5-flash-lite'),
      meeting_model: getInputValue(meetingModelInput, 'gemini-3.5-flash-lite'),
      web_search_provider: getSelectedRadio('web_search_provider', 'vertex_search'),
      web_search_mode: getSelectedRadio('web_search_mode', 'cse_with_fallback'),
      web_search_fallback_sources: getFallbackSources(),
      vertex_project_id: getInputValue(vertexProjectIdInput),
      vertex_location: getInputValue(vertexLocationInput, 'global'),
      vertex_data_store_id: getInputValue(vertexDataStoreIdInput),
      vertex_serving_config: getInputValue(vertexServingConfigInput),
    };

    saveBtn.disabled = true;
    saveBtn.textContent = '⏳ Đang lưu...';
    saveStatusEl.className = 'config-save-status';
    saveStatusEl.textContent = '';
    try {
      if (verifyGeminiOnSaveInput?.checked) {
        const useStoredKey = !payload.gemini_api_key;
        const keyOk = await runKeyValidation('gemini', { useStoredKey });
        if (!keyOk) {
          saveStatusEl.className = 'config-save-status error';
          saveStatusEl.textContent = '❌ Key Gemini chưa hợp lệ nên chưa lưu cấu hình.';
          return;
        }
      }
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
  toggleGeminiKeyBtn?.addEventListener('click', () => {
    const showing = geminiKeyInput.type === 'text';
    geminiKeyInput.type = showing ? 'password' : 'text';
    toggleGeminiKeyBtn.textContent = showing ? 'Hiện key' : 'Ẩn key';
  });
  verifyGeminiKeyBtn?.addEventListener('click', () => {
    const useStoredKey = !geminiKeyInput.value.trim();
    void runKeyValidation('gemini', { useStoredKey });
  });

  refreshBtn.addEventListener('click', loadConfig);
  triggerVertexIngestBtn?.addEventListener('click', async () => {
    if (!confirm('Bạn có chắc chắn muốn kích hoạt tiến trình đồng bộ (Ingest) dữ liệu từ GCS Storage vào Vertex AI Search ngay bây giờ không?')) return;
    
    triggerVertexIngestBtn.disabled = true;
    triggerVertexIngestBtn.textContent = '⏳ Đang đồng bộ...';
    vertexIngestStatus.textContent = 'Đang gửi yêu cầu đồng bộ lên Vertex AI Search...';
    vertexIngestStatus.style.color = 'var(--text-muted)';
    
    try {
      const result = await triggerVertexIngestion({
        projectId: vertexProjectIdInput?.value?.trim() || undefined,
        location: vertexLocationInput?.value?.trim() || undefined,
        dataStoreId: vertexDataStoreIdInput?.value?.trim() || undefined,
      });
      
      vertexIngestStatus.textContent = '✅ Đã kích hoạt tiến trình đồng bộ thành công!';
      vertexIngestStatus.style.color = '#34d399';
      alert(result.message || 'Kích hoạt đồng bộ thành công!');
    } catch (err) {
      vertexIngestStatus.textContent = `❌ Thất bại: ${err.message}`;
      vertexIngestStatus.style.color = '#f87171';
      alert('Lỗi kích hoạt đồng bộ: ' + err.message);
    } finally {
      triggerVertexIngestBtn.disabled = false;
      triggerVertexIngestBtn.textContent = '🔄 Đồng bộ dữ liệu (Ingest)';
    }
  });
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
  const tbody = container.querySelector('#logs-table-body');
  try {
    const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    const db = getFirestore(app);
    const q = query(collection(db, 'search_logs'), limit(500));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      tbody.innerHTML = `<tr><td colspan="5" style="padding:20px; text-align:center; color:var(--text-muted)">Không có dữ liệu (Snapshot trả về 0 bản ghi)</td></tr>`;
      return;
    }
    allLogs = snapshot.docs.map((entry) => ({ id: entry.id, data: entry.data() }));
    allLogs.sort((a, b) => {
      const tA = a.data.timestamp?.toMillis ? a.data.timestamp.toMillis() : 0;
      const tB = b.data.timestamp?.toMillis ? b.data.timestamp.toMillis() : 0;
      return tB - tA;
    });
    currentPage = 1;
    renderPage(container);
  } catch (error) {
    console.error('Error loading logs:', error);
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="5" style="padding:20px; text-align:center; color:#f87171">Lỗi tải dữ liệu: ${escapeHtml(error.message)}</td></tr>`;
    }
  }
}

function renderPage(container) {
  const tbody = container.querySelector('#logs-table-body');
  if (!tbody) return;
  const start = (currentPage - 1) * ITEMS_PER_PAGE;
  const pageLogs = allLogs.slice(start, start + ITEMS_PER_PAGE);
  tbody.innerHTML = pageLogs.length > 0 ? pageLogs.map((item) => {
    const userDisplay = item.data.userEmail || item.data.user || 'Unknown';
    const queryDisplay = item.data.query || item.data.action || '';
    const modeBadge = item.data.mode ? `<span class="recent-mode-tag" style="font-size:0.68rem; margin-left:6px;">${escapeHtml(item.data.mode)}</span>` : '';
    const evidenceMeta = (typeof item.data.verifiedEvidenceCount === 'number')
      ? `<div style="font-size:0.72rem; color:var(--text-muted); margin-top:2px;">Xác minh: ${item.data.verifiedEvidenceCount}/${item.data.totalEvidenceCount || 0} căn cứ</div>`
      : '';
    return `
      <tr style="border-bottom:1px solid var(--border-color)">
        <td style="padding:12px;">${formatDate(item.data.timestamp)}</td>
        <td style="padding:12px;">${escapeHtml(userDisplay)}</td>
        <td style="padding:12px;">
          <div>${escapeHtml(queryDisplay)} ${modeBadge}</div>
          ${evidenceMeta}
        </td>
        <td style="padding:12px;">${escapeHtml(item.data.model || '')}</td>
        <td style="padding:12px;"><button class="btn-delete" data-id="${item.id}">Xóa</button></td>
      </tr>
    `;
  }).join('') : '<tr><td colspan="5" style="padding:20px; text-align:center; color:var(--text-muted)">Không có dữ liệu</td></tr>';


  const totalPages = Math.ceil(allLogs.length / ITEMS_PER_PAGE) || 1;
  const paginationControls = container.querySelector('#pagination-controls');
  const pageIndicator = container.querySelector('#page-indicator');
  if (paginationControls && pageIndicator) {
    if (allLogs.length > ITEMS_PER_PAGE) {
      paginationControls.style.display = 'flex';
      pageIndicator.textContent = `Trang ${currentPage} / ${totalPages}`;
      container.querySelector('#prev-page-btn').disabled = currentPage === 1;
      container.querySelector('#next-page-btn').disabled = currentPage === totalPages;
    } else {
      paginationControls.style.display = 'none';
    }
  }
}

async function loadUsers(container) {
  const tbody = container.querySelector('#users-table-body');
  try {
    const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    const db = getFirestore(app);
    const q = query(collection(db, 'users'), limit(500));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      tbody.innerHTML = `<tr><td colspan="5" style="padding:20px; text-align:center; color:var(--text-muted)">Không có dữ liệu (Snapshot trả về 0 bản ghi)</td></tr>`;
      return;
    }
    allUsers = snapshot.docs.map((entry) => ({ id: entry.id, data: entry.data() }));
    allUsers.sort((a, b) => {
      const tA = a.data.createdAt?.toMillis ? a.data.createdAt.toMillis() : 0;
      const tB = b.data.createdAt?.toMillis ? b.data.createdAt.toMillis() : 0;
      return tB - tA;
    });
    currentUsersPage = 1;
    renderUsersPage(container);
  } catch (error) {
    console.error('Error loading users:', error);
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="5" style="padding:20px; text-align:center; color:#f87171">Lỗi tải dữ liệu: ${escapeHtml(error.message)}</td></tr>`;
    }
  }
}

function renderUsersPage(container) {
  const tbody = container.querySelector('#users-table-body');
  if (!tbody) return;
  const start = (currentUsersPage - 1) * ITEMS_PER_PAGE;
  const pageUsers = allUsers.slice(start, start + ITEMS_PER_PAGE);
  tbody.innerHTML = pageUsers.length > 0 ? pageUsers.map((item) => {
    const email = item.data.email || item.data.username || '';
    const name = item.data.displayName || item.data.fullName || item.data.name || '';
    const position = item.data.position || '';
    const role = item.data.role || '';
    return `
      <tr style="border-bottom:1px solid var(--border-color)">
        <td style="padding:12px;">${escapeHtml(email)}</td>
        <td style="padding:12px;">${escapeHtml(name)}</td>
        <td style="padding:12px;">${formatDate(item.data.createdAt)}</td>
        <td style="padding:12px;">${formatDate(item.data.lastLogin)}</td>
        <td style="padding:12px; text-align:right">
          <button class="btn-user-edit" data-id="${item.id}" data-email="${escapeHtml(email)}" data-name="${escapeHtml(name)}" data-position="${escapeHtml(position)}" data-role="${escapeHtml(role)}" style="padding:4px 8px; font-size:0.8rem; background:#3b82f6; color:white; border:none; border-radius:4px; margin-right:4px; cursor:pointer">Sửa</button>
          <button class="btn-user-delete" data-id="${item.id}" data-email="${escapeHtml(email)}" style="padding:4px 8px; font-size:0.8rem; background:#ef4444; color:white; border:none; border-radius:4px; cursor:pointer">Xóa</button>
        </td>
      </tr>
    `;
  }).join('') : '<tr><td colspan="5" style="padding:20px; text-align:center; color:var(--text-muted)">Không có dữ liệu</td></tr>';

  const totalPages = Math.ceil(allUsers.length / ITEMS_PER_PAGE) || 1;
  const paginationControls = container.querySelector('#users-pagination-controls');
  const pageIndicator = container.querySelector('#users-page-indicator');
  if (paginationControls && pageIndicator) {
    if (allUsers.length > ITEMS_PER_PAGE) {
      paginationControls.style.display = 'flex';
      pageIndicator.textContent = `Trang ${currentUsersPage} / ${totalPages}`;
      container.querySelector('#users-prev-page-btn').disabled = currentUsersPage === 1;
      container.querySelector('#users-next-page-btn').disabled = currentUsersPage === totalPages;
    } else {
      paginationControls.style.display = 'none';
    }
  }
}

function formatDate(val) {
  if (!val) return '';
  if (typeof val.toDate === 'function') {
    try {
      return val.toDate().toLocaleString('vi-VN');
    } catch (e) {
      console.warn('Error calling toDate():', e);
    }
  }
  if (val.seconds !== undefined) {
    return new Date(val.seconds * 1000).toLocaleString('vi-VN');
  }
  try {
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      return d.toLocaleString('vi-VN');
    }
  } catch (e) {}
  return String(val);
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
