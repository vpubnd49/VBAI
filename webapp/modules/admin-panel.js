import { showToast } from './ui-utils.js';
import { adminFetch } from './ai-proxy.js';
import { fetchSystemConfig, updateSystemConfig, validateGeminiApiKey, triggerVertexIngestion } from './system-config.js';

let allLogs = [];
let allUsers = [];
let allDatasetSamples = [];
let currentPage = 1;
let currentPageCursor = null;
let nextPageCursor = null;
let previousPageCursors = [];
let currentUsersPage = 1;
let currentDatasetPage = 1;
const ITEMS_PER_PAGE = 10;

const DEFAULT_FALLBACK_SOURCES = {
  vbpl: true,
  chinhphu: true,
  quochoi: true,
  thuvienphapluat: true,
  luatvietnam: true,
};

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function readResponsePayload(response) {
  const raw = await response.text();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return { message: raw.slice(0, 320) };
  }
}

function updateDatasetStats(container, total) {
  const stat = container.querySelector('#stat-total-samples');
  if (stat && Number.isFinite(Number(total))) stat.textContent = `${Number(total)} mẫu`;
}

function setActionState(button, label, busy) {
  if (!button) return;
  button.disabled = busy;
  button.setAttribute('aria-busy', String(busy));
  button.innerHTML = label;
}

export function renderAdminPanel(container) {
  const isAdmin = window.isAdmin === true || localStorage.getItem('vbai_is_admin') === 'true';
  if (!isAdmin) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">🔒</div><div class="empty-text">Truy cập bị từ chối.</div></div>';
    return;
  }

  container.innerHTML = `
    <div style="max-width: 1300px; margin: 0 auto; width: 100%; box-sizing: border-box; padding: 10px 0;">
      <!-- 1. Full-Width Status Banner -->
      <div class="admin-user-status-banner" style="padding:14px 20px; margin-bottom:20px; border-radius:10px; background:var(--bg-card, #ffffff); border:1px solid var(--border-color, #cbd5e1); color:var(--text-primary, #0f172a); display:flex; justify-content:space-between; align-items:center; font-size:0.92rem; box-shadow:0 1px 3px rgba(0,0,0,0.05); width:100%; box-sizing:border-box;">
        <div>👤 Tài khoản: <strong style="color:var(--primary, #0284c7)">${escapeHtml(window.currentUser?.email || 'Chưa đăng nhập')}</strong></div>
        <div>🔑 Quyền Quản trị: <strong style="color:${window.isAdmin ? 'var(--success, #059669)' : 'var(--danger, #dc2626)'}">${window.isAdmin ? 'Hợp lệ (Admin)' : 'Không khả dụng (Yêu cầu đăng xuất & đăng nhập lại)'}</strong></div>
      </div>

      <!-- 2. Modern Full-Width Tab Navigation -->
      <div class="admin-tab-nav" style="display:flex; gap:10px; margin-bottom:24px; border-bottom:2px solid var(--border-default, #e2e8f0); padding-bottom:2px; width:100%; box-sizing:border-box; overflow-x:auto;">
        <button type="button" class="admin-tab-btn active" data-tab="tab-config" style="padding:12px 24px; font-weight:700; font-size:0.95rem; border:none; background:none; border-bottom:3px solid var(--brand-primary, #008ca1); color:var(--brand-primary, #008ca1); cursor:pointer; display:flex; align-items:center; gap:8px; margin-bottom:-2px; white-space:nowrap; transition: all 0.2s;">
          ⚙️ Cấu hình AI & Hệ thống
        </button>
        <button type="button" class="admin-tab-btn" data-tab="tab-training" style="padding:12px 24px; font-weight:600; font-size:0.95rem; border:none; background:none; border-bottom:3px solid transparent; color:var(--text-secondary, #64748b); cursor:pointer; display:flex; align-items:center; gap:8px; margin-bottom:-2px; white-space:nowrap; transition: all 0.2s;">
          📊 Dữ liệu Huấn luyện & Tuning (vbaibot)
        </button>
        <button type="button" class="admin-tab-btn" data-tab="tab-logs" style="padding:12px 24px; font-weight:600; font-size:0.95rem; border:none; background:none; border-bottom:3px solid transparent; color:var(--text-secondary, #64748b); cursor:pointer; display:flex; align-items:center; gap:8px; margin-bottom:-2px; white-space:nowrap; transition: all 0.2s;">
          🛡️ Vết Tra Cứu (Audit Logs)
        </button>
        <button type="button" class="admin-tab-btn" data-tab="tab-users" style="padding:12px 24px; font-weight:600; font-size:0.95rem; border:none; background:none; border-bottom:3px solid transparent; color:var(--text-secondary, #64748b); cursor:pointer; display:flex; align-items:center; gap:8px; margin-bottom:-2px; white-space:nowrap; transition: all 0.2s;">
          👥 Tài khoản Hệ thống
        </button>
      </div>

      <!-- TAB 1: AI & SYSTEM CONFIG (FULL-WIDTH HORIZONTAL SECTIONS) -->
      <div id="tab-config" class="admin-tab-content active" style="width:100%;">
        <div class="panel-group admin-config-panel" style="margin-bottom:20px; width:100%;">
          <div class="panel-header" style="display:flex; align-items:center; justify-content:space-between; padding:16px 24px;">
            <div style="display:flex; align-items:center; gap:10px; font-size:1.05rem; font-weight:700;">
              <span class="panel-header-icon">⚙️</span> Cấu hình AI Hệ thống
            </div>
            <button type="button" id="refresh-config-btn" class="btn btn-secondary btn-sm admin-config-toolbar-btn">🔄 Làm mới</button>
          </div>
          <div class="panel-body" style="padding:24px;">
            <div id="config-status" class="config-status-banner config-status-info">Đang tải cấu hình...</div>
            <form id="system-config-form" class="system-config-form is-hidden" style="width:100%;">
              
              <!-- Full-Width Vertical Stack Container -->
              <div style="display: flex; flex-direction: column; gap: 24px; width: 100%; box-sizing: border-box;">
                
                <!-- Section 1: AI Engine (gemini / provider-neutral) - FULL WIDTH -->
                <section class="config-section-card" style="width:100%; box-sizing:border-box; background:var(--bg-card, #ffffff); border:1px solid var(--border-color, #cbd5e1); border-radius:10px; padding:20px 24px; border-left:4px solid var(--brand-primary, #008ca1);">
                  <div class="config-section-title" style="color: var(--brand-primary, #008ca1); font-size:1rem; font-weight:700; margin-bottom:16px; display:flex; align-items:center; gap:8px;">
                    <span>●</span> AI Engine (gemini / provider-neutral)
                  </div>
                  
                  <div class="form-group" style="margin-bottom:16px;">
                    <label class="form-label" style="display:block; font-weight:600; margin-bottom:6px;">gemini API Key</label>
                    <div class="config-inline-row" style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
                      <input type="password" id="gemini_api_key" class="form-input config-inline-grow" placeholder="AIza... (Để trống nếu không đổi)" style="flex:1; min-width:280px; padding:10px 12px; border-radius:6px; border:1px solid var(--border-subtle, #cbd5e1);">
                      <button type="button" id="toggle-gemini-key-btn" class="btn btn-secondary btn-sm" style="padding:8px 14px;">Hiện key</button>
                      <button type="button" id="verify-gemini-key-btn" class="btn btn-primary btn-sm" style="padding:8px 16px; background:var(--brand-primary, #008ca1); color:white; border:none; border-radius:6px;">✓ Xác nhận key</button>
                      <button type="button" id="clear-gemini-key-btn" class="btn btn-danger btn-sm" style="padding:8px 14px; background:#dc2626; color:white; border:none; border-radius:6px;">🗑️ Xóa key</button>
                    </div>
                    <div style="margin-top:10px; display:flex; align-items:center; gap:8px;">
                      <label style="display:inline-flex; align-items:center; gap:6px; font-size:0.85rem; cursor:pointer;">
                        <input type="checkbox" id="verify-gemini-on-save" checked style="width:16px; height:16px; cursor:pointer;">
                        <span>Xác nhận key khi lưu cấu hình</span>
                      </label>
                    </div>
                    <small class="config-hint" style="display:block; margin-top:4px; color:var(--text-muted, #64748b);">Khóa API được lưu an toàn trong Secret Manager/MongoDB</small>
                    <small id="gemini-key-verify-status" class="config-hint" style="display:block; margin-top:4px;"></small>
                  </div>

                  <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(300px, 1fr)); gap:16px; margin-bottom:16px;">
                    <div class="form-group">
                      <label class="form-label" style="display:block; font-weight:600; margin-bottom:6px;">gemini API Endpoint (Base URL)</label>
                      <input type="text" id="gemini_endpoint" class="form-input" placeholder="Provider endpoint" style="width:100%; padding:10px 12px; border-radius:6px; border:1px solid var(--border-subtle, #cbd5e1); box-sizing:border-box;">
                    </div>
                    <div class="form-group">
                      <label class="form-label" style="display:block; font-weight:600; margin-bottom:6px;">Model mặc định (gemini)</label>
                      <input type="text" id="gemini_model" class="form-input" placeholder="Model từ cấu hình provider" style="width:100%; padding:10px 12px; border-radius:6px; border:1px solid var(--border-subtle, #cbd5e1); box-sizing:border-box;">
                      <small id="gemini-runtime-warning" class="config-hint" style="display:none; color:var(--warning);"></small>
                    </div>
                  </div>

                  <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(300px, 1fr)); gap:16px; margin-bottom:16px;">
                    <div class="form-group">
                      <label class="form-label" style="display:block; font-weight:600; margin-bottom:6px;">Model transcription (Ghi âm)</label>
                      <input type="text" id="transcribe_model" class="form-input" placeholder="Model từ cấu hình provider" style="width:100%; padding:10px 12px; border-radius:6px; border:1px solid var(--border-subtle, #cbd5e1); box-sizing:border-box;">
                    </div>
                    <div class="form-group">
                      <label class="form-label" style="display:block; font-weight:600; margin-bottom:6px;">Model meeting (Biên bản cuộc họp)</label>
                      <input type="text" id="meeting_model" class="form-input" placeholder="Model từ cấu hình provider" style="width:100%; padding:10px 12px; border-radius:6px; border:1px solid var(--border-subtle, #cbd5e1); box-sizing:border-box;">
                    </div>
                  </div>

                  <div class="form-group">
                    <label class="form-label" style="display:block; font-weight:600; margin-bottom:6px;">Danh sách Model gemini khả dụng</label>
                    <div class="config-inline-row" style="display:flex; gap:10px; align-items:center;">
                      <input type="text" id="gemini_model_input" class="form-input config-inline-grow" placeholder="Nhập model từ cấu hình provider" style="flex:1; padding:10px 12px; border-radius:6px; border:1px solid var(--border-subtle, #cbd5e1);">
                      <button type="button" id="add-gemini-model-btn" class="btn btn-primary btn-sm" style="padding:10px 18px; background:var(--brand-primary, #008ca1); color:white; border:none; border-radius:6px;">+ Thêm</button>
                    </div>
                    <div id="gemini-models-list" class="config-chip-list" style="margin-top:10px; display:flex; flex-wrap:wrap; gap:8px;"></div>
                  </div>
                </section>

                <!-- Section 2: Robot Crawler - FULL WIDTH -->
                <section class="config-section-card" style="width:100%; box-sizing:border-box; background:var(--bg-card, #ffffff); border:1px solid var(--border-color, #cbd5e1); border-radius:10px; padding:20px 24px; border-left:4px solid #0f766e;">
                  <div class="config-section-title" style="display:flex; justify-content:space-between; align-items:center; font-size:1rem; font-weight:700; margin-bottom:12px;">
                    <span style="color:#0f766e;"><span class="config-section-icon">🤖</span> Robot Tự Động Cào Văn Bản Pháp Luật (24/7)</span>
                    <span id="crawler-status-badge" style="font-size:0.8rem; padding:4px 12px; border-radius:12px; background:#e0f2fe; color:#0369a1; font-weight:700;">Sẵn sàng</span>
                  </div>
                  <div style="font-size:0.88rem; color:var(--text-muted, #475569); margin-bottom:16px; line-height:1.5;">
                    Robot chạy tự động định kỳ mỗi <strong>15 phút</strong> từ Cổng TTĐT Chính phủ (<code>vanban.chinhphu.vn</code>, <code>xaydungchinhsach.chinhphu.vn</code>, <code>chinhphu.vn</code>) và Cơ sở dữ liệu quốc gia về văn bản pháp luật để tự động cập nhật các Luật, Nghị định, Thông tư mới nhất.
                  </div>
                  <div style="display:flex; gap:10px; margin-bottom:14px; flex-wrap:wrap; align-items:center;">
                    <button type="button" id="crawler-trigger-btn" class="btn btn-primary btn-sm" style="background:#0f766e; border:none; padding:8px 16px; border-radius:6px; color:white; font-weight:600; display:flex; align-items:center; gap:6px; cursor:pointer;">
                      🔄 Kích hoạt Robot cào văn bản ngay
                    </button>
                    <button type="button" id="crawler-refresh-status-btn" class="btn btn-secondary btn-sm" style="padding:8px 14px; border-radius:6px; cursor:pointer;">
                      📊 Làm mới trạng thái
                    </button>
                    <div id="crawler-quick-stats" style="font-size:0.85rem; color:var(--text-secondary, #64748b); margin-left:auto;">
                      Đang nạp dữ liệu thống kê...
                    </div>
                  </div>
                  <div style="margin-bottom:12px;">
                    <input type="text" id="crawler-doc-search-input" class="form-input" placeholder="🔍 Tìm kiếm số hiệu / tên văn bản trong CSDL..." style="width:100%; box-sizing:border-box; padding:10px 14px; font-size:0.88rem; border-radius:6px; border:1px solid var(--border-subtle, #cbd5e1);">
                  </div>
                  <div style="max-height:160px; overflow-y:auto; border:1px solid var(--border-color, #cbd5e1); border-radius:6px; background:var(--bg-secondary, #f8fafc); padding:10px;" id="crawler-docs-list-box">
                    <div style="font-size:0.85rem; color:var(--text-muted); text-align:center; padding:10px;">Đang tải danh sách văn bản mới nhất...</div>
                  </div>
                  <div style="margin-top:14px; padding-top:12px; border-top:1px dashed var(--border-subtle, #cbd5e1);">
                    <div style="font-size:0.85rem; font-weight:700; color:var(--text-primary); margin-bottom:8px;">⚡ Nạp nhanh văn bản quy phạm pháp luật vào hệ thống:</div>
                    <div style="display:flex; gap:10px; flex-wrap:wrap;">
                      <input type="text" id="manual-ingest-number" class="form-input" placeholder="Số hiệu (VD: 327/2026/NĐ-CP)" style="flex:1; min-width:140px; font-size:0.85rem; padding:8px 12px; border-radius:6px; border:1px solid var(--border-subtle, #cbd5e1);">
                      <input type="text" id="manual-ingest-title" class="form-input" placeholder="Tên văn bản / Trích yếu" style="flex:2; min-width:220px; font-size:0.85rem; padding:8px 12px; border-radius:6px; border:1px solid var(--border-subtle, #cbd5e1);">
                      <select id="manual-ingest-status" class="form-input" style="width:140px; font-size:0.85rem; padding:8px; border-radius:6px; border:1px solid var(--border-subtle, #cbd5e1);">
                        <option value="Còn hiệu lực">Còn hiệu lực</option>
                        <option value="Hết hiệu lực">Hết hiệu lực</option>
                        <option value="Chưa có hiệu lực">Chưa hiệu lực</option>
                      </select>
                      <button type="button" id="manual-ingest-btn" class="btn btn-secondary btn-sm" style="font-size:0.85rem; padding:8px 16px; border-radius:6px; cursor:pointer;">+ Nạp văn bản</button>
                    </div>
                  </div>
                </section>

                <!-- Section 3: Web Search & Vertex Search - FULL WIDTH -->
                <section class="config-section-card" style="width:100%; box-sizing:border-box; background:var(--bg-card, #ffffff); border:1px solid var(--border-color, #cbd5e1); border-radius:10px; padding:20px 24px; border-left:4px solid #0284c7;">
                  <div class="config-section-title" style="color:#0284c7; font-size:1rem; font-weight:700; margin-bottom:16px;"><span class="config-section-icon">●</span> Web Search & Vertex AI Search</div>
                  <div class="form-group" style="margin-bottom:16px;">
                    <label class="form-label" style="display:block; font-weight:600; margin-bottom:8px;">Chế độ tra cứu web</label>
                    <div style="display:flex; gap:20px; flex-wrap:wrap;">
                      <label style="display:inline-flex; align-items:center; gap:6px; cursor:pointer; font-size:0.9rem;">
                        <input type="radio" name="web_search_mode" value="direct" style="cursor:pointer;">
                        <span>Nhanh nhất (Nguồn trực tiếp)</span>
                      </label>
                      <label style="display:inline-flex; align-items:center; gap:6px; cursor:pointer; font-size:0.9rem;">
                        <input type="radio" name="web_search_mode" value="vertex_first" style="cursor:pointer;">
                        <span>Vertex AI Search + fallback nguồn chính thức</span>
                      </label>
                    </div>
                  </div>
                  <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:16px; margin-bottom:16px;">
                    <div class="form-group">
                      <label class="form-label" style="display:block; font-weight:600; margin-bottom:6px;">Project ID Vertex</label>
                      <input type="text" id="vertex_project_id" class="form-input" placeholder="gen-lang-client-0462350485" style="width:100%; padding:10px 12px; border-radius:6px; border:1px solid var(--border-subtle, #cbd5e1); box-sizing:border-box;">
                    </div>
                    <div class="form-group">
                      <label class="form-label" style="display:block; font-weight:600; margin-bottom:6px;">Data Store ID</label>
                      <input type="text" id="vertex_data_store_id" class="form-input" placeholder="vbai-legal-search" style="width:100%; padding:10px 12px; border-radius:6px; border:1px solid var(--border-subtle, #cbd5e1); box-sizing:border-box;">
                    </div>
                    <div class="form-group">
                      <label class="form-label" style="display:block; font-weight:600; margin-bottom:6px;">Serving Config & Location</label>
                      <div style="display:flex; gap:8px;">
                        <input type="text" id="vertex_location" class="form-input" placeholder="global" style="width:80px; padding:10px 12px; border-radius:6px; border:1px solid var(--border-subtle, #cbd5e1);">
                        <input type="text" id="vertex_serving_config" class="form-input" placeholder="default_search" style="flex:1; padding:10px 12px; border-radius:6px; border:1px solid var(--border-subtle, #cbd5e1);">
                      </div>
                    </div>
                  </div>
                  <div class="form-group" style="margin-bottom:16px;">
                    <label class="form-label" style="display:block; font-weight:600; margin-bottom:8px;">Fallback Sources (Nguồn kiểm chứng chính thống)</label>
                    <div style="display:flex; gap:16px; flex-wrap:wrap;">
                      <label style="display:inline-flex; align-items:center; gap:6px; cursor:pointer; font-size:0.88rem;"><input type="checkbox" id="fallback_vbpl" checked style="cursor:pointer;"> vbpl.vn</label>
                      <label style="display:inline-flex; align-items:center; gap:6px; cursor:pointer; font-size:0.88rem;"><input type="checkbox" id="fallback_chinhphu" checked style="cursor:pointer;"> chinhphu.vn</label>
                      <label style="display:inline-flex; align-items:center; gap:6px; cursor:pointer; font-size:0.88rem;"><input type="checkbox" id="fallback_quochoi" checked style="cursor:pointer;"> quochoi.vn</label>
                      <label style="display:inline-flex; align-items:center; gap:6px; cursor:pointer; font-size:0.88rem;"><input type="checkbox" id="fallback_thuvienphapluat" checked style="cursor:pointer;"> thuvienphapluat.vn</label>
                      <label style="display:inline-flex; align-items:center; gap:6px; cursor:pointer; font-size:0.88rem;"><input type="checkbox" id="fallback_luatvietnam" checked style="cursor:pointer;"> luatvietnam.vn</label>
                    </div>
                  </div>
                  <div class="form-group">
                    <button type="button" id="trigger-vertex-ingest-btn" class="btn btn-sm" style="padding:10px 20px; background:#0284c7; color:#ffffff; border:none; border-radius:6px; font-weight:600; cursor:pointer;">
                      📥 Đồng bộ dữ liệu Vertex Ingest
                    </button>
                    <small id="vertex-ingest-status" class="config-hint" style="display:block; margin-top:6px;"></small>
                  </div>
                </section>

                <!-- Section 4: Engine Pháp Lý & Metadata - FULL WIDTH -->
                <section class="config-section-card" style="width:100%; box-sizing:border-box; background:var(--bg-card, #ffffff); border:1px solid var(--border-color, #cbd5e1); border-radius:10px; padding:20px 24px; border-left:4px solid #7c3aed;">
                  <div class="config-section-title" style="color:#7c3aed; font-size:1rem; font-weight:700; margin-bottom:14px;"><span class="config-section-icon">●</span> Engine Pháp Lý & Metadata</div>
                  <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:12px;">
                    <div style="padding:10px 14px; background:var(--bg-secondary, #f8fafc); border-radius:8px; border-left:3px solid var(--brand-primary, #008ca1);">
                      <strong>Known Documents Index:</strong> 250+ Văn bản quy phạm
                    </div>
                    <div style="padding:10px 14px; background:var(--bg-secondary, #f8fafc); border-radius:8px; border-left:3px solid var(--success, #059669);">
                      <strong>Bổ sung Metadata:</strong> <code>bosung_metadata.jsonl</code> [Active]
                    </div>
                    <div style="padding:10px 14px; background:var(--bg-secondary, #f8fafc); border-radius:8px; border-left:3px solid #0284c7;">
                      <strong>Citation Validator:</strong> Strict Verification Engine
                    </div>
                    <div style="padding:10px 14px; background:var(--bg-secondary, #f8fafc); border-radius:8px; border-left:3px solid #f59e0b;">
                      <strong>Môi trường Runtime:</strong> gemini Only
                    </div>
                  </div>
                </section>

                <!-- Section 5: Hệ Thống & Build Identity - FULL WIDTH -->
                <section class="config-section-card" style="width:100%; box-sizing:border-box; background:var(--bg-card, #ffffff); border:1px solid var(--border-color, #cbd5e1); border-radius:10px; padding:20px 24px; border-left:4px solid #64748b;">
                  <div class="config-section-title" style="color:#334155; font-size:1rem; font-weight:700; margin-bottom:16px;"><span class="config-section-icon">●</span> Hệ Thống & Build Identity</div>
                  <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:16px;">
                    <div class="form-group">
                      <label class="form-label" style="display:block; font-weight:600; margin-bottom:6px;">Tên sản phẩm</label>
                      <input type="text" id="app_product_name" class="form-input" placeholder="VBAI Legal Pro V2" style="width:100%; padding:10px 12px; border-radius:6px; border:1px solid var(--border-subtle, #cbd5e1); box-sizing:border-box;">
                    </div>
                    <div class="form-group">
                      <label class="form-label" style="display:block; font-weight:600; margin-bottom:6px;">Firebase Project ID</label>
                      <input type="text" id="app_firebase_project" class="form-input" placeholder="gen-lang-client-0462350485" style="width:100%; padding:10px 12px; border-radius:6px; border:1px solid var(--border-subtle, #cbd5e1); box-sizing:border-box;">
                    </div>
                    <div class="form-group">
                      <label class="form-label" style="display:block; font-weight:600; margin-bottom:6px;">Runtime Environment</label>
                      <input type="text" id="app_environment" class="form-input" placeholder="production" readonly style="width:100%; padding:10px 12px; border-radius:6px; border:1px solid var(--border-subtle, #cbd5e1); background:var(--surface-muted, #f1f5f9); color:var(--text-muted, #64748b); cursor:not-allowed; box-sizing:border-box;">
                    </div>
                    <div class="form-group">
                      <label class="form-label" style="display:block; font-weight:600; margin-bottom:6px;">App Build Git SHA</label>
                      <input type="text" id="app_build_sha" class="form-input" placeholder="Không xác định" readonly style="width:100%; padding:10px 12px; border-radius:6px; border:1px solid var(--border-subtle, #cbd5e1); background:var(--surface-muted, #f1f5f9); color:var(--text-muted, #64748b); cursor:not-allowed; font-family:monospace; font-size:0.85rem; box-sizing:border-box;">
                    </div>
                  </div>
                </section>

              </div><!-- END Full-Width Stack Container -->

              <div class="btn-row config-save-row" style="margin-top:24px; text-align:center;">
                <button type="submit" id="save-system-config-btn" class="btn btn-primary config-save-btn" style="padding:14px 32px; font-size:1rem; font-weight:700; background:var(--brand-primary, #008ca1); color:white; border:none; border-radius:8px; cursor:pointer; box-shadow:0 4px 12px rgba(0,140,161,0.2);">
                  💾 Lưu cấu hình AI & Hệ thống
                </button>
              </div>
              <div id="config-save-status" class="config-save-status" style="margin-top:10px; text-align:center;"></div>
            </form>
          </div>
        </div>
      </div><!-- END TAB 1: tab-config -->

      <!-- TAB 2: TRAINING & TUNING (VBAIBOT INTEGRATION) -->
      <div id="tab-training" class="admin-tab-content" style="display:none; width:100%;">
        <!-- Hero Control Card -->
        <div style="background:linear-gradient(135deg, #f0fdfa 0%, #e0f2fe 100%); border:1.5px solid #008ca1; border-radius:12px; padding:24px; margin-bottom:24px; box-shadow:0 4px 12px rgba(0,140,161,0.08); width:100%; box-sizing:border-box;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:16px;">
            <div style="max-width:680px;">
              <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
                <span style="font-size:1.5rem;">🤖</span>
                <h3 style="margin:0; font-size:1.2rem; color:#0f766e; font-weight:800;">Trung Tâm Huấn Luyện AI & Tự Động Đồng Bộ vbaibot</h3>
              </div>
              <p style="margin:0; font-size:0.9rem; color:#334155; line-height:1.6;">
                Tự động hóa toàn bộ quy trình: Thu thập dữ liệu chuẩn từ <strong>vpubnd49/vbaibot</strong> (Đơn vị hành chính 02 cấp, bộ test cases công vụ) → Xuất dataset → Kích hoạt huấn luyện tinh chỉnh (Supervised Fine-Tuning) trên <strong>Google Cloud Vertex AI</strong>.
              </p>
            </div>
            <div style="display:flex; gap:10px; flex-wrap:wrap;">
              <button type="button" id="sync-vbaibot-btn" class="btn btn-sm" style="padding:10px 16px; font-size:0.88rem; font-weight:700; background:#0284c7; color:white; border:none; border-radius:6px; cursor:pointer; display:flex; align-items:center; gap:6px;">
                🔄 Tự động đồng bộ vbaibot
              </button>
              <button type="button" id="trigger-tuning-btn" class="btn btn-sm" style="padding:10px 16px; font-size:0.88rem; font-weight:700; background:#059669; color:white; border:none; border-radius:6px; cursor:pointer; display:flex; align-items:center; gap:6px;">
                🚀 Kích hoạt Huấn luyện Vertex AI
              </button>
              <button type="button" id="export-dataset-jsonl-btn" class="btn btn-secondary btn-sm" style="padding:10px 16px; font-size:0.88rem; font-weight:600; cursor:pointer; display:flex; align-items:center; gap:6px;">
                📥 Xuất file JSONL
              </button>
              <button type="button" id="add-dataset-sample-btn" class="btn btn-sm" style="padding:10px 16px; font-size:0.88rem; font-weight:600; background:#008ca1; color:white; border:none; border-radius:6px; cursor:pointer; display:flex; align-items:center; gap:6px;">
                ➕ Thêm mẫu chuẩn
              </button>
            </div>
          </div>

          <!-- Quick Stats Grid -->
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:14px; margin-top:20px;">
            <div style="background:white; padding:14px 18px; border-radius:8px; border:1px solid #cbd5e1;">
              <div style="font-size:0.8rem; color:#64748b; font-weight:600;">Tổng mẫu huấn luyện</div>
              <div id="stat-total-samples" style="font-size:1.4rem; font-weight:800; color:#0f766e; margin-top:2px;">38 mẫu</div>
            </div>
            <div style="background:white; padding:14px 18px; border-radius:8px; border:1px solid #cbd5e1;">
              <div style="font-size:0.8rem; color:#64748b; font-weight:600;">Đơn vị hành chính 02 cấp</div>
              <div style="font-size:1.4rem; font-weight:800; color:#0284c7; margin-top:2px;">34 Tỉnh / 3.321 Xã</div>
            </div>
            <div style="background:white; padding:14px 18px; border-radius:8px; border:1px solid #cbd5e1;">
              <div style="font-size:0.8rem; color:#64748b; font-weight:600;">Mô hình đích Vertex AI</div>
              <div id="stat-target-model" style="font-size:1.4rem; font-weight:800; color:#7c3aed; margin-top:2px;">Chưa cấu hình</div>
            </div>
            <div style="background:white; padding:14px 18px; border-radius:8px; border:1px solid #cbd5e1;">
              <div style="font-size:0.8rem; color:#64748b; font-weight:600;">Trạng thái đồng bộ</div>
              <div style="font-size:1rem; font-weight:700; color:#059669; margin-top:4px; display:flex; align-items:center; gap:4px;">
                <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#059669;"></span> Đã kết nối vbaibot
              </div>
            </div>
          </div>

          <!-- Live Webhook Telemetry Integration Info Box -->
          <div style="margin-top:18px; padding:16px 20px; background:rgba(255,255,255,0.95); border-radius:8px; border:1px dashed #0284c7; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
            <div>
              <div style="font-size:0.88rem; font-weight:700; color:#0369a1; display:flex; align-items:center; gap:6px;">
                <span style="font-size:1.1rem;">📡</span> Webhook Thu Thập & Khử Định Danh Tự Động (Continuous Ingestion):
              </div>
              <div style="font-size:0.82rem; color:#475569; margin-top:3px;">
                Tự động lọc rác và che giấu thông tin cá nhân (SĐT, CCCD, Email) theo <strong>Nghị định 13/2023/NĐ-CP</strong> trước khi lưu vào Dataset.
              </div>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
              <code style="background:#f1f5f9; padding:6px 10px; border-radius:4px; font-size:0.82rem; color:#0f172a; border:1px solid #cbd5e1;">POST /api/telemetry/vbaibot-ingest</code>
              <span style="font-size:0.78rem; background:#dcfce7; color:#15803d; padding:4px 10px; border-radius:12px; font-weight:700;">🟢 Đang nhận dữ liệu</span>
            </div>
          </div>
        </div>

        <!-- Dataset Table Panel -->
        <div class="panel-group" style="margin-bottom:20px; width:100%;">
          <div class="panel-header" style="display:flex; justify-content:space-between; align-items:center; padding:16px 24px;">
            <div style="display:flex; align-items:center; gap:10px; font-size:1.05rem; font-weight:700;">
              <span class="panel-header-icon">📑</span> Danh Sách Mẫu Dữ Liệu Huấn Luyện (Gold Standard Dataset)
            </div>
            <button type="button" id="refresh-dataset-btn" class="btn btn-secondary btn-sm" style="padding:6px 14px; font-size:0.85rem; cursor:pointer">🔄 Làm mới</button>
          </div>
          <div class="panel-body" style="padding:0; overflow-x:auto">
            <table style="width:100%; border-collapse: collapse; font-size:0.88rem">
              <thead>
                <tr style="background:var(--bg-secondary, #f8fafc); border-bottom:1px solid var(--border-color, #cbd5e1); text-align:left">
                  <th style="padding:14px; width:50px; text-align:center">STT</th>
                  <th style="padding:14px; width:160px">Chủ đề</th>
                  <th style="padding:14px; width:300px">Câu hỏi người dùng (Prompt)</th>
                  <th style="padding:14px">Câu trả lời mẫu (Model Response)</th>
                  <th style="padding:14px; width:90px; text-align:right">Thao tác</th>
                </tr>
              </thead>
              <tbody id="dataset-table-body">
                <tr><td colspan="5" style="padding:20px; text-align:center; color:var(--text-muted)">Đang tải dữ liệu huấn luyện...</td></tr>
              </tbody>
            </table>
            <div id="dataset-pagination-controls" style="display:none; justify-content:center; align-items:center; padding:14px; gap:16px; background:var(--bg-secondary, #f8fafc); border-top:1px solid var(--border-color, #cbd5e1)">
              <button type="button" id="dataset-prev-page-btn" class="btn btn-secondary btn-sm" style="padding:6px 12px; font-size:0.85rem">⬅️ Trước</button>
              <span id="dataset-page-indicator" style="font-size:0.88rem; font-weight:600">Trang 1 / 1</span>
              <button type="button" id="dataset-next-page-btn" class="btn btn-secondary btn-sm" style="padding:6px 12px; font-size:0.85rem">Tiếp ➡️</button>
            </div>
          </div>
        </div>
      </div><!-- END TAB 2: tab-training -->

      <!-- TAB 3: AUDIT LOGS -->
      <div id="tab-logs" class="admin-tab-content" style="display:none; width:100%;">
        <div class="panel-group" style="margin-bottom:20px; width:100%;">
          <div class="panel-header" style="display:flex; justify-content:space-between; align-items:center; padding:16px 24px;">
            <div style="display:flex; align-items:center; gap:10px; font-size:1.05rem; font-weight:700;">
              <span class="panel-header-icon">🛡️</span> Quản Trị Hệ Thống - Vết Tra Cứu (Mới nhất)
            </div>
            <div style="display:flex; gap:10px;">
              <button type="button" id="delete-all-logs-btn" class="btn btn-danger btn-sm" style="padding:6px 12px; font-size:0.85rem;">🗑️ Xóa tất cả</button>
              <button type="button" id="refresh-logs-btn" class="btn btn-secondary btn-sm" style="padding:6px 12px; font-size:0.85rem;">🔄 Làm mới</button>
            </div>
          </div>
          <div class="panel-body" style="padding:0; overflow-x:auto">
            <table style="width:100%; border-collapse: collapse; font-size:0.88rem">
              <thead>
                <tr style="background:var(--bg-secondary, #f8fafc); border-bottom:1px solid var(--border-color, #cbd5e1); text-align:left">
                  <th style="padding:14px; width:150px">Thời gian</th>
                  <th style="padding:14px; width:200px">Người dùng</th>
                  <th style="padding:14px">Thao tác / Câu hỏi</th>
                  <th style="padding:14px; width:180px">Model xử lý</th>
                  <th style="padding:14px; width:90px; text-align:right">Hành động</th>
                </tr>
              </thead>
              <tbody id="logs-table-body">
                <tr><td colspan="5" style="padding:20px; text-align:center; color:var(--text-muted)">Đang tải dữ liệu...</td></tr>
              </tbody>
            </table>
            <div id="pagination-controls" style="display:none; justify-content:center; align-items:center; padding:14px; gap:16px; background:var(--bg-secondary, #f8fafc); border-top:1px solid var(--border-color, #cbd5e1)">
              <button type="button" id="prev-page-btn" class="btn btn-secondary btn-sm" style="padding:6px 12px; font-size:0.85rem">⬅️ Trước</button>
              <span id="page-indicator" style="font-size:0.88rem; font-weight:600">Trang 1 / 1</span>
              <button type="button" id="next-page-btn" class="btn btn-secondary btn-sm" style="padding:6px 12px; font-size:0.85rem">Tiếp ➡️</button>
            </div>
          </div>
        </div>
      </div><!-- END TAB 3: tab-logs -->

      <!-- TAB 4: USERS -->
      <div id="tab-users" class="admin-tab-content" style="display:none; width:100%;">
        <div class="panel-group" style="margin-bottom:20px; width:100%;">
          <div class="panel-header" style="display:flex; justify-content:space-between; align-items:center; padding:16px 24px;">
            <div style="display:flex; align-items:center; gap:10px; font-size:1.05rem; font-weight:700;">
              <span class="panel-header-icon">👥</span> Danh sách Tài khoản Hệ thống
            </div>
            <button type="button" id="refresh-users-btn" class="btn btn-secondary btn-sm" style="padding:6px 12px; font-size:0.85rem;">🔄 Làm mới</button>
          </div>
          <div class="panel-body" style="padding:0; overflow-x:auto">
            <table style="width:100%; border-collapse: collapse; font-size:0.88rem">
              <thead>
                <tr style="background:var(--bg-secondary, #f8fafc); border-bottom:1px solid var(--border-color, #cbd5e1); text-align:left">
                  <th style="padding:14px">Email</th>
                  <th style="padding:14px">Tên hiển thị</th>
                  <th style="padding:14px; width:150px">Vai trò / Trạng thái</th>
                  <th style="padding:14px; width:180px">Ngày tham gia</th>
                  <th style="padding:14px; width:180px">Đăng nhập cuối</th>
                  <th style="padding:14px; width:120px; text-align:right">Hành động</th>
                </tr>
              </thead>
              <tbody id="users-table-body">
                <tr><td colspan="5" style="padding:20px; text-align:center; color:var(--text-muted)">Đang tải dữ liệu...</td></tr>
              </tbody>
            </table>
            <div id="users-pagination-controls" style="display:none; justify-content:center; align-items:center; padding:14px; gap:16px; background:var(--bg-secondary, #f8fafc); border-top:1px solid var(--border-color, #cbd5e1)">
              <button type="button" id="users-prev-page-btn" class="btn btn-secondary btn-sm" style="padding:6px 12px; font-size:0.85rem">⬅️ Trước</button>
              <span id="users-page-indicator" style="font-size:0.88rem; font-weight:600">Trang 1 / 1</span>
              <button type="button" id="users-next-page-btn" class="btn btn-secondary btn-sm" style="padding:6px 12px; font-size:0.85rem">Tiếp ➡️</button>
            </div>
          </div>
        </div>
      </div><!-- END TAB 4: tab-users -->

      <!-- Edit User Modal -->
      <div id="edit-user-modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:var(--overlay-backdrop, rgba(0,0,0,0.5)); backdrop-filter:blur(4px); z-index:9999; justify-content:center; align-items:center">
        <div style="background:var(--bg-card, #ffffff); border:1px solid var(--border-default, #cbd5e1); border-radius:12px; width:100%; max-width:480px; padding:24px; box-shadow:var(--shadow-lg, 0 10px 25px rgba(0,0,0,0.15))">
          <h3 style="margin-top:0; margin-bottom:20px; color:var(--text-primary, #0f172a); border-bottom:1px solid var(--border-subtle, #e2e8f0); padding-bottom:10px">✏️ Sửa thông tin thành viên</h3>
          <form id="edit-user-form">
            <input type="hidden" id="edit-user-uid">
            <div style="margin-bottom:16px; text-align:left">
              <label style="display:block; font-size:0.85rem; color:var(--text-secondary, #475569); margin-bottom:6px">Email</label>
              <input type="text" id="edit-user-email" class="form-input" style="width:100%; background:var(--surface-muted, #f1f5f9); color:var(--text-muted, #94a3b8); cursor:not-allowed; border:1px solid var(--border-subtle, #cbd5e1); border-radius:6px; padding:8px; box-sizing:border-box" readonly>
            </div>
            <div style="margin-bottom:16px; text-align:left">
              <label style="display:block; font-size:0.85rem; color:var(--text-secondary, #475569); margin-bottom:6px">Tên hiển thị</label>
              <input type="text" id="edit-user-displayname" class="form-input" style="width:100%; border:1px solid var(--border-subtle, #cbd5e1); border-radius:6px; padding:8px; box-sizing:border-box" required>
            </div>
            <div style="margin-bottom:16px; text-align:left">
              <label style="display:block; font-size:0.85rem; color:var(--text-secondary); margin-bottom:6px">Chức vụ</label>
              <input type="text" id="edit-user-position" class="form-input" style="width:100%; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-default); border-radius:6px; padding:8px; box-sizing:border-box">
            </div>
            <div style="margin-bottom:24px; text-align:left">
              <label style="display:block; font-size:0.85rem; color:var(--text-secondary); margin-bottom:6px">Vai trò hệ thống</label>
              <select id="edit-user-role" style="width:100%; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-default); border-radius:6px; padding:8px; outline:none; box-sizing:border-box">
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

      <!-- Add Dataset Sample Modal -->
      <div id="add-dataset-modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:var(--overlay-backdrop, rgba(0,0,0,0.5)); backdrop-filter:blur(4px); z-index:9999; justify-content:center; align-items:center">
        <div style="background:var(--bg-card, #ffffff); border:1px solid var(--border-default, #cbd5e1); border-radius:12px; width:100%; max-width:650px; padding:24px; box-shadow:var(--shadow-lg, 0 10px 25px rgba(0,0,0,0.15))">
          <h3 style="margin-top:0; margin-bottom:16px; color:var(--text-primary, #0f172a); border-bottom:1px solid var(--border-subtle, #e2e8f0); padding-bottom:10px">➕ Thêm Mẫu Dữ Liệu Huấn Luyện AI (Gold Standard)</h3>
          <form id="add-dataset-form">
            <div style="margin-bottom:12px; text-align:left">
              <label style="display:block; font-size:0.85rem; color:var(--text-secondary, #475569); margin-bottom:4px">Chủ đề (Category)</label>
              <select id="dataset-category" class="form-input" style="width:100%; padding:8px; border-radius:6px; border:1px solid var(--border-subtle, #cbd5e1)">
                <option value="legal-search">Tra cứu pháp luật & Nghị định (legal-search)</option>
                <option value="administrative">Địa giới & Đơn vị hành chính 02 cấp (administrative)</option>
                <option value="nd30-standard">Thể thức văn bản NĐ30/HD05 (nd30-standard)</option>
                <option value="guardrail">Quy tắc giao tiếp & Không suy đoán bừa (guardrail)</option>
              </select>
            </div>
            <div style="margin-bottom:12px; text-align:left">
              <label style="display:block; font-size:0.85rem; color:var(--text-secondary, #475569); margin-bottom:4px">Câu hỏi của người dùng (User Prompt)</label>
              <input type="text" id="dataset-user-prompt" class="form-input" placeholder="Ví dụ: Nghị định 30/2020/NĐ-CP" required style="width:100%; padding:8px; border-radius:6px; border:1px solid var(--border-subtle, #cbd5e1); box-sizing:border-box">
            </div>
            <div style="margin-bottom:16px; text-align:left">
              <label style="display:block; font-size:0.85rem; color:var(--text-secondary, #475569); margin-bottom:4px">Câu trả lời mẫu chuẩn (Model Response - hỗ trợ Markdown & Bảng)</label>
              <textarea id="dataset-model-response" class="form-input" rows="7" placeholder="Nội dung câu trả lời chuẩn 6 phần hoặc bảng kẻ ô..." required style="width:100%; padding:8px; border-radius:6px; border:1px solid var(--border-subtle, #cbd5e1); font-family:monospace; font-size:0.85rem; box-sizing:border-box"></textarea>
            </div>
            <div style="display:flex; justify-content:flex-end; gap:8px">
              <button type="button" id="cancel-dataset-btn" class="btn btn-secondary btn-sm" style="padding:6px 12px">Hủy</button>
              <button type="submit" class="btn btn-primary btn-sm" style="padding:6px 16px; background:var(--brand-primary, #008ca1); color:white; border:none; border-radius:4px; cursor:pointer">Lưu mẫu huấn luyện</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;

  // 1. Tab Switching Event Listeners
  const tabBtns = container.querySelectorAll('.admin-tab-btn');
  const tabContents = container.querySelectorAll('.admin-tab-content');
  
  tabBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const targetTabId = btn.getAttribute('data-tab');
      
      tabBtns.forEach(b => {
        b.classList.remove('active');
        b.style.borderBottom = '3px solid transparent';
        b.style.color = 'var(--text-secondary, #64748b)';
        b.style.fontWeight = '600';
      });
      
      btn.classList.add('active');
      btn.style.borderBottom = '3px solid var(--brand-primary, #008ca1)';
      btn.style.color = 'var(--brand-primary, #008ca1)';
      btn.style.fontWeight = '700';

      tabContents.forEach(tc => {
        if (tc.id === targetTabId) {
          tc.style.display = 'block';
          tc.classList.add('active');
        } else {
          tc.style.display = 'none';
          tc.classList.remove('active');
        }
      });
    });
  });

  // 2. Training & Tuning Handlers
  const syncVbaibotBtn = container.querySelector('#sync-vbaibot-btn');
  if (syncVbaibotBtn) {
    syncVbaibotBtn.addEventListener('click', async () => {
      if (!confirm('Bạn có chắc chắn muốn bắt đầu đồng bộ CSDL hành chính và test cases mới nhất từ vpubnd49/vbaibot?')) return;
      setActionState(syncVbaibotBtn, '🔄 Đang đồng bộ...', true);
      try {
        const res = await adminFetch('/api/admin/training-datasets/sync-vbaibot', { method: 'POST' });
        const data = await readResponsePayload(res);
        if (!res.ok) throw new Error(data.message || data.error || `HTTP ${res.status}`);
        showToast(data.message || 'Đã đồng bộ vbaibot.', data.status === 'PARTIAL' ? 'warning' : 'success');
        await loadDatasetSamples(container);
      } catch (err) {
        showToast(err.message || 'Đồng bộ thất bại', 'error');
      } finally {
        setActionState(syncVbaibotBtn, '🔄 Tự động đồng bộ vbaibot', false);
      }
    });
  }

  const triggerTuningBtn = container.querySelector('#trigger-tuning-btn');
  if (triggerTuningBtn) {
    triggerTuningBtn.addEventListener('click', async () => {
      if (!confirm('XÁC NHẬN: Bạn có chắc chắn muốn kích hoạt phiên huấn luyện tinh chỉnh (Supervised Fine-Tuning) trên Google Cloud Vertex AI?')) return;
      setActionState(triggerTuningBtn, '🚀 Đang khởi tạo...', true);
      try {
        const res = await adminFetch('/api/admin/training-datasets/trigger-tuning', { method: 'POST' });
        const data = await readResponsePayload(res);
        if (!res.ok) throw new Error(data.message || data.error || `HTTP ${res.status}`);
        const status = data.status || data.job?.status || 'REGISTERED';
        showToast(`${data.message || 'Đã đăng ký yêu cầu tuning.'} [${status}]`, status === 'NOT_IMPLEMENTED' ? 'warning' : 'success');
      } catch (err) {
        showToast(err.message || 'Khởi tạo thất bại', 'error');
      } finally {
        setActionState(triggerTuningBtn, '🚀 Kích hoạt Huấn luyện Vertex AI', false);
      }
    });
  }

  const exportDatasetBtn = container.querySelector('#export-dataset-jsonl-btn');
  if (exportDatasetBtn) {
    exportDatasetBtn.addEventListener('click', async () => {
      try {
        const idToken = await window.currentUser.getIdToken();
        const res = await adminFetch('/api/admin/training-datasets/export-jsonl', {
          headers: { 'Authorization': `Bearer ${idToken}` }
        });
        if (!res.ok) throw new Error('Xuất file JSONL thất bại');
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'vbai_gemini_tuning_dataset.jsonl';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showToast('Đã tải về file JSONL huấn luyện thành công!', 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  const addDatasetBtn = container.querySelector('#add-dataset-sample-btn');
  const addDatasetModal = container.querySelector('#add-dataset-modal');
  const cancelDatasetBtn = container.querySelector('#cancel-dataset-btn');
  const addDatasetForm = container.querySelector('#add-dataset-form');

  if (addDatasetBtn && addDatasetModal) {
    addDatasetBtn.addEventListener('click', () => {
      addDatasetModal.style.display = 'flex';
    });
  }
  if (cancelDatasetBtn && addDatasetModal) {
    cancelDatasetBtn.addEventListener('click', () => {
      addDatasetModal.style.display = 'none';
    });
  }

  if (addDatasetForm && addDatasetModal) {
    addDatasetForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const category = container.querySelector('#dataset-category').value;
      const userPrompt = container.querySelector('#dataset-user-prompt').value;
      const modelResponse = container.querySelector('#dataset-model-response').value;

      try {
        const idToken = await window.currentUser.getIdToken();
        const res = await adminFetch('/api/admin/training-datasets', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${idToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ userPrompt, modelResponse, category })
        });
        if (!res.ok) throw new Error('Không thể lưu mẫu huấn luyện');
        showToast('Đã lưu mẫu dữ liệu huấn luyện thành công!', 'success');
        addDatasetForm.reset();
        addDatasetModal.style.display = 'none';
        loadDatasetSamples(container);
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  const refreshDatasetBtn = container.querySelector('#refresh-dataset-btn');
  if (refreshDatasetBtn) {
    refreshDatasetBtn.addEventListener('click', () => loadDatasetSamples(container));
  }

  const datasetTableBody = container.querySelector('#dataset-table-body');
  if (datasetTableBody) {
    datasetTableBody.addEventListener('click', async (e) => {
      const delBtn = e.target.closest('.btn-dataset-delete');
      if (!delBtn) return;
      const id = delBtn.dataset.id;
      if (!confirm('Bạn có chắc chắn muốn xóa mẫu dữ liệu huấn luyện này?')) return;
      try {
        const idToken = await window.currentUser.getIdToken();
        const res = await adminFetch(`/api/admin/training-datasets/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${idToken}` }
        });
        if (!res.ok) throw new Error('Không thể xóa mẫu huấn luyện');
        showToast('Đã xóa mẫu thành công!', 'success');
        loadDatasetSamples(container);
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  const datasetPrevBtn = container.querySelector('#dataset-prev-page-btn');
  const datasetNextBtn = container.querySelector('#dataset-next-page-btn');
  if (datasetPrevBtn) {
    datasetPrevBtn.addEventListener('click', () => {
      if (currentDatasetPage > 1) {
        currentDatasetPage--;
        renderDatasetTable(container);
      }
    });
  }
  if (datasetNextBtn) {
    datasetNextBtn.addEventListener('click', () => {
      const totalPages = Math.ceil(allDatasetSamples.length / ITEMS_PER_PAGE);
      if (currentDatasetPage < totalPages) {
        currentDatasetPage++;
        renderDatasetTable(container);
      }
    });
  }

  // 3. Initialize components & load data
  initSystemConfigPanel(container);
  loadLogs(container);
  loadUsers(container);
  loadDatasetSamples(container);

  container.querySelector('#refresh-logs-btn').addEventListener('click', () => loadLogs(container));
  container.querySelector('#refresh-users-btn').addEventListener('click', () => loadUsers(container));

  container.querySelector('#prev-page-btn').addEventListener('click', () => {
    if (currentPage > 1) {
      previousPageCursors.pop();
      currentPage -= 1;
      currentPageCursor = previousPageCursors[previousPageCursors.length - 1] || null;
      loadLogs(container, currentPageCursor);
    }
  });

  container.querySelector('#next-page-btn').addEventListener('click', () => {
    if (nextPageCursor) {
      previousPageCursors.push(nextPageCursor);
      currentPage += 1;
      currentPageCursor = nextPageCursor;
      loadLogs(container, currentPageCursor);
    }
  });

  container.querySelector('#users-prev-page-btn').addEventListener('click', () => {
      if (currentUsersPage > 1) { currentUsersPage -= 1; loadUsers(container); }
  });

  container.querySelector('#users-next-page-btn').addEventListener('click', () => {
      const totalPages = allUsers.totalPages || Math.ceil(allUsers.length / ITEMS_PER_PAGE);
      if (currentUsersPage < totalPages) { currentUsersPage += 1; loadUsers(container); }
  });

  container.querySelector('#delete-all-logs-btn').addEventListener('click', async () => {
    if (!confirm('XÁC NHẬN: Bạn có chắc chắn muốn xóa TOÀN BỘ lịch sử tra cứu không? Hành động này không thể hoàn tác.')) return;
    const btn = container.querySelector('#delete-all-logs-btn');
    btn.disabled = true;
    btn.textContent = 'Đang xóa...';
    try {
      const response = await adminFetch('/api/search-history', { method: 'DELETE' });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || `HTTP ${response.status}`);
      btn.textContent = `Đã xóa (${result.deleted || 0})`;
      await loadLogs(container);
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
    if (!confirm('Xác nhận xóa bản ghi tra cứu này?')) return;

    e.target.disabled = true;
    e.target.textContent = '...';
    try {
      const response = await adminFetch(`/api/search-history/${encodeURIComponent(logId)}`, { method: 'DELETE' });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || `HTTP ${response.status}`);
      await loadLogs(container);
    } catch (err) {
      alert('Lỗi xóa: ' + err.message);
      e.target.disabled = false;
      e.target.textContent = 'Xóa';
    }
  });

  const usersTableBody = container.querySelector('#users-table-body');
  usersTableBody.addEventListener('click', async (e) => {
    if (e.target.classList.contains('btn-user-delete')) {
      const uid = e.target.dataset.id;
      const email = e.target.dataset.email;
      
      if (window.currentUser && window.currentUser.uid === uid) {
        alert('Bạn không thể tự xóa tài khoản của chính mình!');
        return;
      }
      
      if (!confirm(`XÁC NHẬN: Bạn có chắc chắn muốn xóa vĩnh viễn thành viên [${email}] không?`)) {
        return;
      }
      
      e.target.disabled = true;
      e.target.textContent = '...';
      
      try {
        const idToken = await window.currentUser.getIdToken();
        const res = await adminFetch('/api/admin/delete-user', {
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
    } else if (e.target.classList.contains('btn-user-edit')) {
      const uid = e.target.dataset.id;
      const email = e.target.dataset.email;
      const displayName = e.target.dataset.name || '';
      const position = e.target.dataset.position || '';
      const role = e.target.dataset.role || 'DEPARTMENT';
      
      const modal = container.querySelector('#edit-user-modal');
      container.querySelector('#edit-user-uid').value = uid;
      container.querySelector('#edit-user-email').value = email;
      container.querySelector('#edit-user-displayname').value = displayName;
      container.querySelector('#edit-user-position').value = position;
      container.querySelector('#edit-user-role').value = role;
      
      modal.style.display = 'flex';
    }
  });

  const editUserModal = container.querySelector('#edit-user-modal');
  const editUserForm = container.querySelector('#edit-user-form');
  const cancelBtn = container.querySelector('#edit-user-cancel');
  
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      editUserModal.style.display = 'none';
    });
  }
  
  if (editUserForm) {
    editUserForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const uid = container.querySelector('#edit-user-uid').value;
      const displayName = container.querySelector('#edit-user-displayname').value.trim();
      const position = container.querySelector('#edit-user-position').value.trim();
      const role = container.querySelector('#edit-user-role').value;
      
      const submitBtn = editUserForm.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Đang lưu...';
      
      try {
        const idToken = await window.currentUser.getIdToken();
        const res = await adminFetch('/api/admin/update-user', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${idToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ uid, displayName, position, role })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Cập nhật thất bại.');
        alert('Cập nhật thông tin thành viên thành công!');
        editUserModal.style.display = 'none';
        loadUsers(container);
      } catch (err) {
        alert('Lỗi: ' + err.message);
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Lưu thay đổi';
      }
    });
  }
}

async function initSystemConfigPanel(container) {
  const statusEl = container.querySelector('#config-status');
  const formEl = container.querySelector('#system-config-form');
  const saveBtn = container.querySelector('#save-system-config-btn');
  const refreshBtn = container.querySelector('#refresh-config-btn');
  const saveStatusEl = container.querySelector('#config-save-status');

  const geminiKeyInput = formEl.querySelector('#gemini_api_key');
  const togglegeminiKeyBtn = formEl.querySelector('#toggle-gemini-key-btn');
  const verifygeminiKeyBtn = formEl.querySelector('#verify-gemini-key-btn');
  const verifygeminiOnSaveInput = formEl.querySelector('#verify-gemini-on-save');
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
  const appProductNameInput = formEl.querySelector('#app_product_name');
  const appFirebaseProjectInput = formEl.querySelector('#app_firebase_project');
  const appEnvironmentInput = formEl.querySelector('#app_environment');
  const appBuildShaInput = formEl.querySelector('#app_build_sha');
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

  function updategeminiRuntimeWarning(modelName, hasgeminiKey) {
    if (!geminiRuntimeWarning) return;
    const normalized = String(modelName || '').trim().toLowerCase();
    const useProLikeModel = normalized.includes('pro');
    if (hasgeminiKey && useProLikeModel) {
      geminiRuntimeWarning.style.display = 'block';
       geminiRuntimeWarning.textContent = 'Model không hợp lệ hoặc không được cấu hình; runtime sẽ không tự fallback.';
      return;
    }
    geminiRuntimeWarning.style.display = 'none';
    geminiRuntimeWarning.textContent = '';
  }

  function setgeminiKeyVerifyStatus(message = '', kind = 'info') {
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
    // Keep this UI path explicitly Gemini-only; no generic provider resolver is allowed.
    if (provider !== 'gemini') {
      throw new Error('Chỉ hỗ trợ xác nhận Gemini API key.');
    }
    const keyInput = geminiKeyInput;
    const endpointInput = geminiEndpointInput;
    const modelInput = geminiModelInput;
    const verifyBtn = verifygeminiKeyBtn;
    const verifyStatusEl = geminiKeyVerifyStatus;

    if (verifyBtn) {
      verifyBtn.disabled = true;
      verifyBtn.textContent = 'Đang kiểm tra...';
    }
    
    if (verifyStatusEl) {
      verifyStatusEl.textContent = 'Đang xác nhận gemini API key...';
      verifyStatusEl.style.color = 'var(--text-muted)';
    }

    try {
      const payload = {
        apiKey: keyInput?.value?.trim() || '',
        gemini_endpoint: endpointInput?.value?.trim() || '',
        useStoredKey,
        model: modelInput?.value?.trim() || '',
      };
      const result = await validateGeminiApiKey(payload);
      if (result?.valid !== true) {
        throw new Error(result?.message || 'Xác nhận key thất bại.');
      }
      if (verifyStatusEl) {
        verifyStatusEl.textContent = '✅ gemini API key hợp lệ.';
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

      // Load gemini
setInputValue(geminiModelInput, config.gemini_model || '');
       setInputValue(geminiEndpointInput, config.gemini_endpoint || '');
       setInputValue(geminiKeyInput, '');
      if (geminiKeyInput) geminiKeyInput.type = 'password';
      if (togglegeminiKeyBtn) togglegeminiKeyBtn.textContent = 'Hiện key';
      setgeminiKeyVerifyStatus(config.has_gemini_key ? 'Đã lưu gemini API key. Bạn có thể xác nhận lại bất cứ lúc nào.' : 'Chưa có gemini API key.');
      updategeminiRuntimeWarning(geminiModelInput ? geminiModelInput.value : '', !!config.has_gemini_key);
       geminiModels = Array.isArray(config.gemini_models) ? [...config.gemini_models] : [];
       renderModelChips(geminiListEl, geminiModels, 'gemini', (next) => { geminiModels = next; });
       // Load other configs
      setInputValue(transcribeModelInput, config.transcribe_model || config.gemini_model || '');
      setInputValue(meetingModelInput, config.meeting_model || config.transcribe_model || config.gemini_model || '');
      setInputValue(vertexProjectIdInput, config.vertex_project_id || '');
      setInputValue(vertexLocationInput, config.vertex_location || 'global');
      setInputValue(vertexDataStoreIdInput, config.vertex_data_store_id || '');
       setInputValue(vertexServingConfigInput, config.vertex_serving_config || '');
       setInputValue(appProductNameInput, config.app_product_name || '');
       setInputValue(appFirebaseProjectInput, config.app_firebase_project || '');
       setInputValue(appEnvironmentInput, config.app_environment || config.environment || '');
       setInputValue(appBuildShaInput, config.app_build_sha || config.build_sha || '');

      const provider = config.web_search_provider || 'vertex_search';
       const targetModelEl = container.querySelector('#stat-target-model');
       if (targetModelEl) targetModelEl.textContent = config.gemini_model || 'Chưa cấu hình';
      const mode = (config.web_search_mode === 'cse_fast' || config.web_search_mode === 'direct') ? 'direct' : 'vertex_first';
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
    const activeAiModel = getInputValue(geminiModelInput);
    const activeTranscribeModel = getInputValue(transcribeModelInput);
    const activeMeetingModel = getInputValue(meetingModelInput);

    const payload = {
      // gemini
      gemini_model: activeAiModel,
      gemini_endpoint: getInputValue(geminiEndpointInput),
      // Only submit a key when an administrator manually entered a new one.
      ...(getInputValue(geminiKeyInput) ? { gemini_api_key: getInputValue(geminiKeyInput) } : {}),

      // Other Settings
      transcribe_model: activeTranscribeModel,
      meeting_model: activeMeetingModel,
      web_search_provider: 'vertex_search',
      web_search_mode: getSelectedRadio('web_search_mode', 'vertex_first'),
      web_search_fallback_sources: getFallbackSources(),
      vertex_project_id: getInputValue(vertexProjectIdInput),
      vertex_location: getInputValue(vertexLocationInput, 'global'),
      vertex_data_store_id: getInputValue(vertexDataStoreIdInput),
       vertex_serving_config: getInputValue(vertexServingConfigInput),
       app_product_name: getInputValue(appProductNameInput),
       app_firebase_project: getInputValue(appFirebaseProjectInput),
    };

    saveBtn.disabled = true;
    saveBtn.textContent = '⏳ Đang lưu...';
    saveStatusEl.className = 'config-save-status';
    saveStatusEl.textContent = '';
    try {
      if (verifygeminiOnSaveInput?.checked) {
        const keyOk = await runKeyValidation('gemini', { useStoredKey: false });
        if (!keyOk) {
          saveStatusEl.className = 'config-save-status error';
          saveStatusEl.textContent = '❌ Key gemini chưa hợp lệ nên chưa lưu cấu hình.';
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
    if (!confirm('XÁC NHẬN: Bạn có chắc chắn muốn lưu và áp dụng toàn bộ cấu hình AI & Hệ thống mới này?')) return;
    saveConfig();
  });
  togglegeminiKeyBtn?.addEventListener('click', () => {
    const showing = geminiKeyInput.type === 'text';
    geminiKeyInput.type = showing ? 'password' : 'text';
    togglegeminiKeyBtn.textContent = showing ? 'Hiện key' : 'Ẩn key';
  });
  verifygeminiKeyBtn?.addEventListener('click', () => {
    void runKeyValidation('gemini', { useStoredKey: false });
  });
  const cleargeminiKeyBtn = formEl.querySelector('#clear-gemini-key-btn');
  cleargeminiKeyBtn?.addEventListener('click', async () => {
    if (!confirm('Bạn có chắc chắn muốn xóa gemini API key khỏi hệ thống không?')) return;
    try {
      if (geminiKeyInput) geminiKeyInput.value = '';
      await updateSystemConfig({ clear_gemini_api_key: true });
      if (saveStatusEl) {
        saveStatusEl.className = 'config-save-status success';
        saveStatusEl.textContent = '✅ Đã xóa gemini API key thành công.';
      }
      await loadConfig();
    } catch (err) {
      if (saveStatusEl) {
        saveStatusEl.className = 'config-save-status error';
        saveStatusEl.textContent = `❌ Lỗi xóa key: ${err.message}`;
      }
    }
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
      vertexIngestStatus.style.color = 'var(--status-success-text, #059669)';
      alert(result.message || 'Kích hoạt đồng bộ thành công!');
    } catch (err) {
      vertexIngestStatus.textContent = `❌ Thất bại: ${err.message}`;
      vertexIngestStatus.style.color = 'var(--status-error-text, #dc2626)';
      alert('Lỗi kích hoạt đồng bộ: ' + err.message);
    } finally {
      triggerVertexIngestBtn.disabled = false;
      triggerVertexIngestBtn.textContent = '🔄 Đồng bộ dữ liệu (Ingest)';
    }
  });
  geminiModelInput.addEventListener('input', () => {
    updategeminiRuntimeWarning(geminiModelInput.value, geminiKeyInput.value.includes('•') || !!geminiKeyInput.value.trim());
  });
  loadConfig();

  // Crawler UI Binding
  const crawlerBtn = formEl.querySelector('#crawler-trigger-btn') || formEl.querySelector('#trigger-crawler-btn');
  const crawlerRefreshBtn = formEl.querySelector('#crawler-refresh-status-btn') || formEl.querySelector('#refresh-crawler-status-btn');
  const crawlerBadge = formEl.querySelector('#crawler-status-badge');
  const crawlerStats = formEl.querySelector('#crawler-quick-stats');
  const crawlerMsg = formEl.querySelector('#crawler-result-message') || null;
  const crawlerDocsList = formEl.querySelector('#crawler-docs-list-box') || formEl.querySelector('#crawler-recent-docs');
  const searchInput = formEl.querySelector('#crawler-doc-search-input') || formEl.querySelector('#crawler-search-input');
  const typeFilterSelect = formEl.querySelector('#crawler-type-filter');
  const cleanGarbageBtn = formEl.querySelector('#clean-garbage-docs-btn');

  let cachedRecentDocs = [];

  function renderDocsList() {
    if (!crawlerDocsList) return;
    const query = (searchInput ? searchInput.value : '').trim().toLowerCase();
    const typeFilter = typeFilterSelect ? typeFilterSelect.value : 'all';

    let filtered = cachedRecentDocs;

    if (typeFilter !== 'all') {
      filtered = filtered.filter(d => {
        const type = (d.document_type || '').toLowerCase();
        const docNum = (d.document_number || '').toLowerCase();
        if (typeFilter === 'luat') return type === 'luat' || docNum.includes('/qh');
        if (typeFilter === 'nghi_dinh') return type === 'nghi_dinh' || docNum.includes('/nđ-cp') || docNum.includes('/nd-cp');
        if (typeFilter === 'thong_tu') return type === 'thong_tu' || docNum.includes('/tt');
        if (typeFilter === 'quyet_dinh') return type === 'quyet_dinh' || docNum.includes('/qđ') || docNum.includes('/qd');
        return true;
      });
    }

    if (query) {
      filtered = filtered.filter(d => {
        const num = (d.document_number || '').toLowerCase();
        const title = (d.title || '').toLowerCase();
        const issuer = (d.issuer || '').toLowerCase();
        return num.includes(query) || title.includes(query) || issuer.includes(query);
      });
    }

    if (filtered.length === 0) {
      crawlerDocsList.innerHTML = '<div style="color:var(--text-muted); text-align:center; padding:12px;">Không tìm thấy văn bản phù hợp.</div>';
      return;
    }

    crawlerDocsList.innerHTML = filtered.map(d => `
      <div style="padding:8px 0; border-bottom:1px solid var(--border-subtle); display:flex; justify-content:space-between; align-items:center; gap:8px;">
        <div style="flex:1;">
          <div style="font-weight:600; color:var(--text-primary);">
            ${escapeHtml(d.document_number || 'Văn bản')}: <span style="font-weight:400;">${escapeHtml(d.title || '')}</span>
          </div>
          <div style="font-size:0.72rem; color:var(--text-muted); margin-top:2px;">
            ${escapeHtml(d.issuer || 'Chính phủ')} • Ban hành: ${d.issue_date || 'N/A'} • <span style="color:#166534; font-weight:600;">Đã kiểm chứng</span>
          </div>
        </div>
        <button type="button" class="btn btn-secondary delete-doc-btn" data-doc-num="${escapeHtml(d.document_number)}" style="font-size:0.72rem; padding:3px 8px; color:#b91c1c; border-color:#fca5a5; background:#fff;" title="Xóa văn bản này khỏi CSDL">
          🗑️ Xóa
        </button>
      </div>
    `).join('');

    // Bind delete buttons
    crawlerDocsList.querySelectorAll('.delete-doc-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const docNum = e.currentTarget.dataset.docNum;
        if (!docNum) return;
        if (!confirm(`Bạn có chắc chắn muốn xóa văn bản [${docNum}] khỏi CSDL không?`)) return;

        btn.disabled = true;
        btn.textContent = '⏳';

        try {
          const token = localStorage.getItem('vbai_token') || (window.currentUser ? await window.currentUser.getIdToken() : '');
          const res = await adminFetch(`/api/admin/document?number=${encodeURIComponent(docNum)}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const result = await res.json();
          if (result.success) {
            showToast(`Đã xóa văn bản ${docNum} khỏi CSDL!`, 'success');
            await loadCrawlerStatus();
          } else {
            showToast(result.error || 'Không thể xóa văn bản', 'error');
            btn.disabled = false;
            btn.textContent = '🗑️ Xóa';
          }
        } catch (err) {
          showToast(err.message, 'error');
          btn.disabled = false;
          btn.textContent = '🗑️ Xóa';
        }
      });
    });
  }

  if (searchInput) searchInput.addEventListener('input', renderDocsList);
  if (typeFilterSelect) typeFilterSelect.addEventListener('change', renderDocsList);

  async function loadCrawlerStatus() {
    try {
      const token = localStorage.getItem('vbai_token') || (window.currentUser ? await window.currentUser.getIdToken() : '');
      const res = await adminFetch('/api/admin/crawler/status', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        if (crawlerDocsList) crawlerDocsList.innerHTML = `<div style="color:var(--text-muted); text-align:center;">Chưa có văn bản nào trong danh sách quét gần đây.</div>`;
        return;
      }
      const data = await res.json();
      if (crawlerBadge) {
        crawlerBadge.textContent = data.status === 'running' ? '⏳ Đang quét...' : `🟢 Sẵn sàng (${data.totalKnownDocs || 0} văn bản)`;
        crawlerBadge.style.background = data.status === 'running' ? '#fef3c7' : '#e0f2fe';
        crawlerBadge.style.color = data.status === 'running' ? '#92400e' : '#0369a1';
      }
      if (typeof crawlerMsg !== 'undefined' && crawlerMsg && data.message) {
        crawlerMsg.textContent = data.message;
      }
      if (crawlerStats) {
        const lastRunStr = data.lastRun ? new Date(data.lastRun).toLocaleTimeString('vi-VN') : 'Mới cập nhật';
        crawlerStats.textContent = `Lần quét: ${lastRunStr} | CSDL: ${data.totalKnownDocs || 0} văn bản`;
      }
      cachedRecentDocs = Array.isArray(data.recentDocuments) ? data.recentDocuments : [];
      renderDocsList();
    } catch (err) {
      if (crawlerDocsList) crawlerDocsList.innerHTML = `<div style="color:var(--text-muted); text-align:center;">Không thể tải danh sách (${escapeHtml(err.message)})</div>`;
    }
  }

  if (cleanGarbageBtn) {
    cleanGarbageBtn.addEventListener('click', async () => {
      if (!confirm('Bạn có chắc chắn muốn lọc dọn sạch các văn bản rác/giấy mời/công văn không phải VBQPPL khỏi CSDL?')) return;
      cleanGarbageBtn.disabled = true;
      cleanGarbageBtn.textContent = '⏳ Đang dọn rác...';
      try {
        const token = localStorage.getItem('vbai_token') || (window.currentUser ? await window.currentUser.getIdToken() : '');
        const res = await adminFetch('/api/admin/crawler/clean', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await res.json();
        showToast(`Đã dọn sạch ${result.deletedCount || 0} bản ghi rác!`, 'success');
        await loadCrawlerStatus();
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        cleanGarbageBtn.disabled = false;
        cleanGarbageBtn.textContent = '🧹 Lọc dọn rác CSDL';
      }
    });
  }

  if (crawlerBtn) {
    crawlerBtn.addEventListener('click', async () => {
      crawlerBtn.disabled = true;
      crawlerBtn.textContent = '⏳ Robot đang quét cào dữ liệu...';
      if (typeof crawlerMsg !== 'undefined' && crawlerMsg) crawlerMsg.textContent = 'Đang kết nối Cổng TTĐT Chính phủ và Cổng VBPL...';
      try {
        const token = localStorage.getItem('vbai_token') || (window.currentUser ? await window.currentUser.getIdToken() : '');
        const res = await adminFetch('/api/admin/crawler/run', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });
        const result = await res.json();
        if (typeof crawlerMsg !== 'undefined' && crawlerMsg) crawlerMsg.textContent = result.message || 'Đã hoàn tất cào văn bản!';
        showToast(result.message || 'Cào văn bản thành công!', 'success');
        await loadCrawlerStatus();
      } catch (err) {
        if (typeof crawlerMsg !== 'undefined' && crawlerMsg) crawlerMsg.textContent = '❌ Lỗi cào dữ liệu: ' + err.message;
        showToast(err.message, 'error');
      } finally {
        crawlerBtn.disabled = false;
        crawlerBtn.textContent = '🤖 Kích hoạt Robot cào văn bản ngay';
      }
    });
  }

  if (crawlerRefreshBtn) {
    crawlerRefreshBtn.addEventListener('click', () => {
      loadCrawlerStatus();
      showToast('Đã làm mới trạng thái Robot!', 'info');
    });
  }

  // Bind Quick Document Ingestion Form
  const manualNumInput = formEl.querySelector('#manual-doc-num');
  const manualTitleInput = formEl.querySelector('#manual-doc-title');
  const manualDateInput = formEl.querySelector('#manual-doc-date');
  const manualSubmitBtn = formEl.querySelector('#manual-doc-submit-btn');
  const manualMsg = formEl.querySelector('#manual-doc-msg');

  if (manualDateInput && !manualDateInput.value) {
    manualDateInput.value = new Date().toISOString().split('T')[0];
  }

  if (manualSubmitBtn) {
    manualSubmitBtn.addEventListener('click', async () => {
      const docNum = manualNumInput ? manualNumInput.value.trim() : '';
      const title = manualTitleInput ? manualTitleInput.value.trim() : '';
      const issueDate = manualDateInput ? manualDateInput.value : '';

      if (!docNum) {
        showToast('Vui lòng nhập số hiệu văn bản', 'warning');
        return;
      }

      manualSubmitBtn.disabled = true;
      manualSubmitBtn.textContent = '⏳ Đang lưu...';
      if (manualMsg) manualMsg.textContent = 'Đang đồng bộ vào MongoDB...';

      try {
        const token = window.currentUser ? await window.currentUser.getIdToken() : '';
        const res = await adminFetch('/api/admin/ingest-document', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            document_number: docNum,
            title: title || `Văn bản ${docNum}`,
            issue_date: issueDate || new Date().toISOString().split('T')[0],
            effective_date: issueDate || new Date().toISOString().split('T')[0],
            effective_status: 'in_force'
          })
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.message || data.error || 'Không thể lưu văn bản');
        }

        if (manualMsg) manualMsg.textContent = `✅ Đã lưu thành công: ${docNum}`;
        showToast(`Đã lưu thành công văn bản ${docNum} vào CSDL!`, 'success');
        if (manualNumInput) manualNumInput.value = '';
        if (manualTitleInput) manualTitleInput.value = '';
        await loadCrawlerStatus();
      } catch (err) {
        if (manualMsg) manualMsg.textContent = `❌ Lỗi: ${err.message}`;
        showToast(err.message, 'error');
      } finally {
        manualSubmitBtn.disabled = false;
        manualSubmitBtn.textContent = '➕ Lưu vào CSDL';
      }
    });
  }

  loadCrawlerStatus();
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

async function loadLogs(container, cursor = null) {
  const tbody = container.querySelector('#logs-table-body');
  try {
    const { backendFetch } = await import('./ai-proxy.js');
    const params = new URLSearchParams({ limit: String(ITEMS_PER_PAGE) });
    if (cursor) params.set('cursor', cursor);
    const response = await backendFetch(`/search-history?${params.toString()}`, { method: 'GET' });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const resData = await response.json();
    const logsList = Array.isArray(resData.logs) ? resData.logs : [];
    
    if (logsList.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="padding:20px; text-align:center; color:var(--text-muted)">Chưa có vết tra cứu nào được ghi nhận.</td></tr>`;
      return;
    }

    allLogs = logsList.map((item) => ({
      id: item.id,
      data: {
        timestamp: item.created_at || item.timestamp,
          userEmail: item.user_email || (item.user_id ? `User ${String(item.user_id).slice(0, 8)}` : 'anonymous'),
        query: item.query || '',
        action: item.query || '',
        model: item.model || null,
        feature: item.feature || 'legal-search',
        mode: item.mode || 'legal-search',
        effectiveDate: item.effectiveDate || null,
        status: item.status || 'success',
        verifiedEvidenceCount: typeof item.verified_count === 'number' ? item.verified_count : item.verifiedEvidenceCount,
        totalEvidenceCount: typeof item.evidence_count === 'number' ? item.evidence_count : item.totalEvidenceCount,
        requestId: item.requestId || item.request_id || null,
      }
    }));

    nextPageCursor = resData.pagination?.nextCursor || null;
    renderPage(container);
  } catch (error) {
    console.error('Error loading logs:', error);
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="5" style="padding:20px; text-align:center; color:var(--status-error-text, #dc2626)">Lỗi tải dữ liệu: ${escapeHtml(error.message)}</td></tr>`;
    }
  }
}

function renderPage(container) {
  const tbody = container.querySelector('#logs-table-body');
  if (!tbody) return;
  const start = (currentPage - 1) * ITEMS_PER_PAGE;
  const pageLogs = allLogs.slice(start, start + ITEMS_PER_PAGE);
  tbody.innerHTML = pageLogs.length > 0 ? pageLogs.map((item) => {
    const userDisplay = item.data.userEmail || item.data.user || 'anonymous';
    const queryDisplay = item.data.query || item.data.action || '';
    const modeBadge = item.data.mode ? `<span class="recent-mode-tag" style="font-size:0.68rem; margin-left:6px;">${escapeHtml(item.data.mode)}</span>` : '';
    const featureTag = item.data.feature ? `<span style="font-size:0.68rem; color:var(--text-muted);">${escapeHtml(item.data.feature)}</span>` : '';
    const effectiveDateTag = item.data.effectiveDate ? `<div style="font-size:0.68rem; color:var(--text-muted);">Hiệu lực: ${escapeHtml(item.data.effectiveDate)}</div>` : '';
    const verifiedCount = typeof item.data.verifiedEvidenceCount === 'number' ? item.data.verifiedEvidenceCount : 0;
    const totalCount = typeof item.data.totalEvidenceCount === 'number' ? item.data.totalEvidenceCount : 0;
    const traceId = item.data.requestId ? `<div style="font-size:0.68rem; color:var(--text-muted); font-family:monospace;">TraceID: ${escapeHtml(item.data.requestId)}</div>` : '';
    const statusTag = item.data.status === 'unverified_evidence' || verifiedCount === 0
      ? `<span style="font-size:0.7rem; color:#d97706; font-weight:600;">⚠️ Chưa có căn cứ</span>`
      : `<span style="font-size:0.7rem; color:var(--success, #059669); font-weight:600;">✓ Đã kiểm chứng (${verifiedCount}/${totalCount || 1})</span>`;

    return `
      <tr style="border-bottom:1px solid var(--border-color)">
        <td style="padding:12px;">${formatDate(item.data.timestamp)}</td>
        <td style="padding:12px;">
          <div>${escapeHtml(userDisplay)}</div>
          ${traceId}
        </td>
        <td style="padding:12px;">
          <div>${featureTag} ${modeBadge}</div>
          ${effectiveDateTag}
          <div style="margin-top:2px;">${statusTag}</div>
        </td>
        <td style="padding:12px;"><span style="font-family:monospace; font-size:0.78rem;">${escapeHtml(item.data.model || '')}</span></td>
        <td style="padding:12px; text-align:right;"><button class="btn-delete" data-id="${item.id}" style="padding:4px 8px; font-size:0.8rem; background:var(--btn-danger-bg, #b91c1c); color:white; border:none; border-radius:4px; cursor:pointer;">Xóa</button></td>
      </tr>
    `;
  }).join('') : '<tr><td colspan="5" style="padding:20px; text-align:center; color:var(--text-muted)">Không có dữ liệu</td></tr>';


  const totalPages = currentPage + (nextPageCursor ? 1 : 0);
  const paginationControls = container.querySelector('#pagination-controls');
  const pageIndicator = container.querySelector('#page-indicator');
  if (paginationControls && pageIndicator) {
    if (currentPage > 1 || nextPageCursor) {
      paginationControls.style.display = 'flex';
      pageIndicator.textContent = `Trang ${currentPage} / ${totalPages}`;
      container.querySelector('#prev-page-btn').disabled = currentPage === 1;
      container.querySelector('#next-page-btn').disabled = !nextPageCursor;
    } else {
      paginationControls.style.display = 'none';
    }
  }
}

async function loadUsers(container) {
  const tbody = container.querySelector('#users-table-body');
  try {
    const requestedPage = currentUsersPage;
    const resp = await adminFetch(`/api/admin/users?page=${requestedPage}&limit=${ITEMS_PER_PAGE}`, {});
    const result = await resp.json();
    if (!resp.ok || !result.success || !Array.isArray(result.users) || result.users.length === 0) {
       tbody.innerHTML = `<tr><td colspan="6" style="padding:20px; text-align:center; color:var(--text-muted)">${resp.ok ? 'Không có dữ liệu (Hệ thống trả về 0 bản ghi)' : 'Không thể tải danh sách người dùng'}</td></tr>`;
      return;
    }
    allUsers = result.users.map((u) => ({ id: u.uid || u._id, data: { ...u, createdAt: u.created_at || u.createdAt, lastLogin: u.last_login_at || u.lastLogin } }));
    if (result.pagination) {
      allUsers.totalPages = result.pagination.totalPages || 1;
      allUsers.total = result.pagination.total || allUsers.length;
    }
    renderUsersPage(container);
  } catch (error) {
    console.error('Error loading users:', error);
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="5" style="padding:20px; text-align:center; color:var(--status-error-text, #dc2626)">Lỗi tải dữ liệu: ${escapeHtml(error.message)}</td></tr>`;
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
    const role = item.data.role || item.data.system_role || '';
    const status = item.data.status || (item.data.disabled ? 'disabled' : 'active');
    return `
      <tr style="border-bottom:1px solid var(--border-color)">
        <td style="padding:12px;">${escapeHtml(email)}</td>
        <td style="padding:12px;">${escapeHtml(name)}</td>
        <td style="padding:12px;"><span class="badge">${escapeHtml(role)}</span><br><small>${escapeHtml(status)}</small></td>
        <td style="padding:12px;">${formatDate(item.data.createdAt)}</td>
        <td style="padding:12px;">${formatDate(item.data.lastLogin)}</td>
        <td style="padding:12px; text-align:right">
          <button class="btn-user-edit" data-id="${item.id}" data-email="${escapeHtml(email)}" data-name="${escapeHtml(name)}" data-position="${escapeHtml(position)}" data-role="${escapeHtml(role)}" style="padding:4px 8px; font-size:0.8rem; background:var(--btn-primary-bg, #1d4ed8); color:white; border:none; border-radius:4px; margin-right:4px; cursor:pointer">Sửa</button>
          <button class="btn-user-delete" data-id="${item.id}" data-email="${escapeHtml(email)}" style="padding:4px 8px; font-size:0.8rem; background:var(--btn-danger-bg, #b91c1c); color:white; border:none; border-radius:4px; cursor:pointer">Xóa</button>
        </td>
      </tr>
    `;
  }).join('') : '<tr><td colspan="5" style="padding:20px; text-align:center; color:var(--text-muted)">Không có dữ liệu</td></tr>';

    const totalPages = allUsers.totalPages || Math.ceil(allUsers.length / ITEMS_PER_PAGE) || 1;
  const paginationControls = container.querySelector('#users-pagination-controls');
  const pageIndicator = container.querySelector('#users-page-indicator');
  if (paginationControls && pageIndicator) {
    if (totalPages > 1) {
      paginationControls.style.display = 'flex';
      pageIndicator.textContent = `Trang ${currentUsersPage} / ${totalPages} (${allUsers.total || allUsers.length} tài khoản)`;
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

async function loadDatasetSamples(container) {
  const tbody = container.querySelector('#dataset-table-body');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="5" style="padding:20px; text-align:center; color:var(--text-muted)">Đang tải danh sách mẫu huấn luyện...</td></tr>';
  
  try {
    const resp = await adminFetch('/api/admin/training-datasets', {});
    if (!resp.ok) throw new Error('Không thể nạp dữ liệu huấn luyện');
    const resData = await resp.json();
    allDatasetSamples = resData.data || [];
    updateDatasetStats(container, resData.total ?? allDatasetSamples.length);
    currentDatasetPage = 1;
    renderDatasetTable(container);
  } catch (err) {
    console.error('loadDatasetSamples error:', err);
    tbody.innerHTML = `<tr><td colspan="5" style="padding:20px; text-align:center; color:var(--danger, #dc2626)">Lỗi: ${escapeHtml(err.message)}</td></tr>`;
  }
}

function renderDatasetTable(container) {
  const tbody = container.querySelector('#dataset-table-body');
  if (!tbody) return;
  
  const start = (currentDatasetPage - 1) * ITEMS_PER_PAGE;
  const pageItems = allDatasetSamples.slice(start, start + ITEMS_PER_PAGE);
  
  tbody.innerHTML = pageItems.length > 0 ? pageItems.map((item, idx) => {
    const userMsg = item.messages?.find(m => m.role === 'user')?.content || item.userPrompt || '';
    const modelMsg = item.messages?.find(m => m.role === 'model')?.content || item.modelResponse || '';
    const cat = item.category || 'legal-search';
    const itemId = item._id || idx;
    
    return `
      <tr style="border-bottom:1px solid var(--border-color)">
        <td style="padding:12px; text-align:center; font-weight:700; color:var(--text-muted)">${start + idx + 1}</td>
        <td style="padding:12px;"><span style="display:inline-block; padding:2px 8px; font-size:0.72rem; border-radius:10px; background:#e0f2fe; color:#0369a1; font-weight:600">${escapeHtml(cat)}</span></td>
        <td style="padding:12px; font-weight:600; color:var(--text-primary)">${escapeHtml(userMsg)}</td>
        <td style="padding:12px; color:var(--text-secondary); max-width:380px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap" title="${escapeHtml(modelMsg)}">${escapeHtml(modelMsg.slice(0, 120))}...</td>
        <td style="padding:12px; text-align:right">
          <button class="btn-dataset-delete" data-id="${itemId}" style="padding:4px 8px; font-size:0.75rem; background:var(--btn-danger-bg, #b91c1c); color:white; border:none; border-radius:4px; cursor:pointer">Xóa</button>
        </td>
      </tr>
    `;
  }).join('') : '<tr><td colspan="5" style="padding:20px; text-align:center; color:var(--text-muted)">Chưa có mẫu huấn luyện nào. Hãy bấm "Thêm mẫu chuẩn" để bắt đầu!</td></tr>';

  const totalPages = Math.ceil(allDatasetSamples.length / ITEMS_PER_PAGE) || 1;
  const paginationControls = container.querySelector('#dataset-pagination-controls');
  const pageIndicator = container.querySelector('#dataset-page-indicator');
  if (paginationControls && pageIndicator) {
    if (allDatasetSamples.length > ITEMS_PER_PAGE) {
      paginationControls.style.display = 'flex';
      pageIndicator.textContent = `Trang ${currentDatasetPage} / ${totalPages} (${allDatasetSamples.length} mẫu)`;
      container.querySelector('#dataset-prev-page-btn').disabled = currentDatasetPage === 1;
      container.querySelector('#dataset-next-page-btn').disabled = currentDatasetPage === totalPages;
    } else {
      paginationControls.style.display = 'none';
    }
  }
}
