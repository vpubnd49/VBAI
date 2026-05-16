import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, query, orderBy, limit, getDocs, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { fetchSystemConfig, updateSystemConfig, validateGeminiApiKey } from './system-config.js';

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
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">ðŸ”’</div><div class="empty-text">Truy cáº­p bá»‹ tá»« chá»‘i.</div></div>';
    return;
  }

  container.innerHTML = `
    <div class="panel-group admin-config-panel">
      <div class="panel-header">
        <div class="panel-header-icon">âš™ï¸</div>
        Cáº¥u hÃ¬nh AI Há»‡ thá»‘ng
        <div class="admin-config-spacer"></div>
        <button id="refresh-config-btn" class="btn btn-secondary btn-sm admin-config-toolbar-btn">LÃ m má»›i</button>
      </div>
      <div class="panel-body">
        <div id="config-status" class="config-status-banner config-status-info">Äang táº£i cáº¥u hÃ¬nh...</div>
        <form id="system-config-form" class="system-config-form is-hidden">
          <div class="config-two-col-grid">
            <section class="config-section-card config-col-panel">
              <div class="config-section-title"><span class="config-section-icon">â—</span> Gemini</div>
              <div class="form-group">
                <label class="form-label">NhÃ  cung cáº¥p AI máº·c Ä‘á»‹nh</label>
                <input type="text" class="form-input" value="Gemini" readonly>
              </div>
              <div class="form-group">
                <label class="form-label">Gemini API Key</label>
                <div class="config-inline-row">
                  <input type="password" id="gemini_api_key" class="form-input config-inline-grow" placeholder="AIza...">
                  <button type="button" id="toggle-gemini-key-btn" class="btn btn-secondary btn-sm config-inline-add-btn">Hiá»‡n key</button>
                  <button type="button" id="verify-gemini-key-btn" class="btn btn-primary btn-sm config-inline-add-btn">XÃ¡c nháº­n key</button>
                </div>
                <label class="config-radio-option" style="margin-top:8px">
                  <input type="checkbox" id="verify-gemini-on-save" checked> XÃ¡c nháº­n key khi lÆ°u cáº¥u hÃ¬nh
                </label>
                <small class="config-hint">Äá»ƒ trá»‘ng náº¿u khÃ´ng muá»‘n thay Ä‘á»•i khÃ³a hiá»‡n táº¡i</small>
                <small id="gemini-key-verify-status" class="config-hint"></small>
              </div>
              <div class="form-group">
                <label class="form-label">Model máº·c Ä‘á»‹nh (Gemini)</label>
                <input type="text" id="gemini_model" class="form-input" placeholder="gemini-2.5-pro">
                <small id="gemini-runtime-warning" class="config-hint" style="display:none; color:#fbbf24;"></small>
              </div>
              <div class="form-group">
                <label class="form-label">Danh sÃ¡ch Model Gemini</label>
                <div class="config-inline-row">
                  <input type="text" id="gemini_model_input" class="form-input config-inline-grow" placeholder="Nháº­p model (VD: gemini-2.5-pro)">
                  <button type="button" id="add-gemini-model-btn" class="btn btn-primary btn-sm config-inline-add-btn">+ ThÃªm</button>
                </div>
                <div id="gemini-models-list" class="config-chip-list"></div>
              </div>
              <div class="form-group">
                <label class="form-label">Model transcription</label>
                <input type="text" id="transcribe_model" class="form-input" placeholder="gemini-2.5-flash">
              </div>
            </section>

            <section class="config-section-card config-col-panel">
              <div class="config-section-title"><span class="config-section-icon">â—</span> Web Search</div>
              <div class="form-group">
                <label class="form-label">Nhà cung cấp tra cứu web</label>
                <div class="config-radio-col">
                  <label class="config-radio-option"><input type="radio" name="web_search_provider" value="vertex_search"> Vertex AI Search (khuyến nghị)</label>
                  <label class="config-radio-option"><input type="radio" name="web_search_provider" value="cse"> Google CSE (legacy)</label>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Vertex project id</label>
                <input type="text" id="vertex_project_id" class="form-input" placeholder="gen-lang-client-0462350485">
              </div>
              <div class="form-group">
                <label class="form-label">Vertex location</label>
                <input type="text" id="vertex_location" class="form-input" placeholder="global">
              </div>
              <div class="form-group">
                <label class="form-label">Vertex data store id</label>
                <input type="text" id="vertex_data_store_id" class="form-input" placeholder="legal-web-datastore">
              </div>
              <div class="form-group">
                <label class="form-label">Vertex serving config (tuy chon, full path)</label>
                <input type="text" id="vertex_serving_config" class="form-input" placeholder="projects/.../servingConfigs/default_search">
              </div>
              <div class="form-group">
                <label class="form-label">Google Custom Search API Key</label>
                <input type="password" id="google_search_key" class="form-input" placeholder="AIza...">
              </div>
              <div class="form-group">
                <label class="form-label">Google CSE CX (Search Engine ID)</label>
                <input type="text" id="google_search_cx" class="form-input" placeholder="xxxxxxxxxxxxxxxxx:yyyyyyyyyyy">
              </div>
              <div class="form-group">
                <label class="form-label">Cháº¿ Ä‘á»™ tra cá»©u web</label>
                <div class="config-radio-col">
                  <label class="config-radio-option"><input type="radio" name="web_search_mode" value="cse_fast"> CSE nhanh nháº¥t (khÃ´ng fallback)</label>
                  <label class="config-radio-option"><input type="radio" name="web_search_mode" value="cse_with_fallback"> CSE + fallback nguá»“n trá»±c tiáº¿p</label>
                </div>
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
            <button id="save-system-config-btn" class="btn btn-primary config-save-btn">ðŸ’¾ LÆ°u cáº¥u hÃ¬nh</button>
          </div>
          <div id="config-save-status" class="config-save-status"></div>
        </form>
      </div>
    </div>

    <div class="panel-group" style="margin-bottom:20px;">
      <div class="panel-header">
        <div class="panel-header-icon">ðŸ›¡ï¸</div>
        Quáº£n Trá»‹ Há»‡ Thá»‘ng - Váº¿t Tra Cá»©u (Má»›i nháº¥t)
        <div style="flex:1"></div>
        <button id="delete-all-logs-btn" class="btn btn-sm" style="padding:4px 8px; font-size:0.8rem; background:#ef4444; color:white; border:none; margin-right:8px">XÃ³a táº¥t cáº£</button>
        <button id="refresh-logs-btn" class="btn btn-secondary btn-sm" style="padding:4px 8px; font-size:0.8rem">LÃ m má»›i</button>
      </div>
      <div class="panel-body" style="padding:0; overflow-x:auto">
        <table style="width:100%; border-collapse: collapse; font-size:0.85rem">
          <thead>
            <tr style="background:var(--bg-secondary); border-bottom:1px solid var(--border-color); text-align:left">
              <th style="padding:12px; width:140px">Thá»i gian</th>
              <th style="padding:12px">NgÆ°á»i dÃ¹ng</th>
              <th style="padding:12px">Thao tÃ¡c / CÃ¢u há»i</th>
              <th style="padding:12px; width:150px">Model xá»­ lÃ½</th>
              <th style="padding:12px; width:80px; text-align:right">HÃ nh Ä‘á»™ng</th>
            </tr>
          </thead>
          <tbody id="logs-table-body">
            <tr><td colspan="5" style="padding:20px; text-align:center; color:var(--text-muted)">Äang táº£i dá»¯ liá»‡u...</td></tr>
          </tbody>
        </table>
        <div id="pagination-controls" style="display:none; justify-content:center; align-items:center; padding:12px; gap:16px; background:var(--bg-secondary); border-top:1px solid var(--border-color)">
          <button id="prev-page-btn" class="btn btn-secondary btn-sm" style="padding:4px 8px; font-size:0.8rem">â¬…ï¸ TrÆ°á»›c</button>
          <span id="page-indicator" style="font-size:0.85rem; font-weight:500">Trang 1 / 1</span>
          <button id="next-page-btn" class="btn btn-secondary btn-sm" style="padding:4px 8px; font-size:0.8rem">Tiáº¿p âž¡ï¸</button>
        </div>
      </div>
    </div>

    <div class="panel-group" style="margin-bottom:20px;">
      <div class="panel-header">
        <div class="panel-header-icon">ðŸ‘¥</div>
        Danh sÃ¡ch TÃ i khoáº£n Há»‡ thá»‘ng
        <div style="flex:1"></div>
        <button id="refresh-users-btn" class="btn btn-secondary btn-sm" style="padding:4px 8px; font-size:0.8rem">LÃ m má»›i</button>
      </div>
      <div class="panel-body" style="padding:0; overflow-x:auto">
        <table style="width:100%; border-collapse: collapse; font-size:0.85rem">
          <thead>
            <tr style="background:var(--bg-secondary); border-bottom:1px solid var(--border-color); text-align:left">
              <th style="padding:12px">Email</th>
              <th style="padding:12px">TÃªn hiá»ƒn thá»‹</th>
              <th style="padding:12px; width:180px">NgÃ y tham gia</th>
              <th style="padding:12px; width:180px">ÄÄƒng nháº­p cuá»‘i</th>
            </tr>
          </thead>
          <tbody id="users-table-body">
            <tr><td colspan="4" style="padding:20px; text-align:center; color:var(--text-muted)">Äang táº£i dá»¯ liá»‡u...</td></tr>
          </tbody>
        </table>
        <div id="users-pagination-controls" style="display:none; justify-content:center; align-items:center; padding:12px; gap:16px; background:var(--bg-secondary); border-top:1px solid var(--border-color)">
          <button id="users-prev-page-btn" class="btn btn-secondary btn-sm" style="padding:4px 8px; font-size:0.8rem">â¬…ï¸ TrÆ°á»›c</button>
          <span id="users-page-indicator" style="font-size:0.85rem; font-weight:500">Trang 1 / 1</span>
          <button id="users-next-page-btn" class="btn btn-secondary btn-sm" style="padding:4px 8px; font-size:0.8rem">Tiáº¿p âž¡ï¸</button>
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
    if (!confirm('Báº¡n cÃ³ cháº¯c cháº¯n muá»‘n xÃ³a TOÃ€N Bá»˜ lá»‹ch sá»­ tra cá»©u khÃ´ng?')) return;
    const btn = container.querySelector('#delete-all-logs-btn');
    btn.textContent = 'Äang xÃ³a...';
    try {
      const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
      const db = getFirestore(app);
      const q = query(collection(db, 'search_logs'), limit(500));
      const snapshot = await getDocs(q);
      const deletePromises = snapshot.docs.map((document) => deleteDoc(doc(db, 'search_logs', document.id)));
      await Promise.all(deletePromises);
      loadLogs(container);
    } catch (e) {
      alert('Lá»—i xÃ³a táº¥t cáº£: ' + e.message);
    } finally {
      btn.textContent = 'XÃ³a táº¥t cáº£';
    }
  });

  container.querySelector('#logs-table-body').addEventListener('click', async (e) => {
    if (!e.target.classList.contains('btn-delete')) return;
    const logId = e.target.dataset.id;
    if (!confirm('Báº¡n cÃ³ cháº¯c muá»‘n xÃ³a báº£n ghi nÃ y?')) return;

    e.target.disabled = true;
    e.target.textContent = '...';
    try {
      const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
      const db = getFirestore(app);
      await deleteDoc(doc(db, 'search_logs', logId));
      loadLogs(container);
    } catch (err) {
      alert('Lá»—i xÃ³a: ' + err.message);
      e.target.disabled = false;
      e.target.textContent = 'XÃ³a';
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
  const geminiModelInput = formEl.querySelector('#gemini_model');
  const geminiRuntimeWarning = formEl.querySelector('#gemini-runtime-warning');
  const transcribeModelInput = formEl.querySelector('#transcribe_model');
  const googleSearchKeyInput = formEl.querySelector('#google_search_key');
  const googleSearchCxInput = formEl.querySelector('#google_search_cx');
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
      geminiRuntimeWarning.textContent = 'LÆ°u Ã½: model Pro cÃ³ thá»ƒ bá»‹ 404 theo quyá»n dá»± Ã¡n. Runtime sáº½ tá»± fallback 1 láº§n sang gemini-2.5-flash Ä‘á»ƒ trÃ¡nh giÃ¡n Ä‘oáº¡n.';
      return;
    }
    geminiRuntimeWarning.style.display = 'none';
    geminiRuntimeWarning.textContent = '';
  }

  function setGeminiKeyVerifyStatus(message = '', kind = 'info') {
    if (!geminiKeyVerifyStatus) return;
    geminiKeyVerifyStatus.textContent = message;
    if (kind === 'error') {
      geminiKeyVerifyStatus.style.color = '#f87171';
      return;
    }
    if (kind === 'success') {
      geminiKeyVerifyStatus.style.color = '#34d399';
      return;
    }
    geminiKeyVerifyStatus.style.color = 'var(--text-muted)';
  }

  async function runGeminiKeyValidation({ useStoredKey = true } = {}) {
    if (verifyGeminiKeyBtn) {
      verifyGeminiKeyBtn.disabled = true;
      verifyGeminiKeyBtn.textContent = 'Äang kiá»ƒm tra...';
    }
    setGeminiKeyVerifyStatus('Äang xÃ¡c nháº­n Gemini API key...');
    try {
      const payload = {
        apiKey: geminiKeyInput?.value?.trim() || '',
        useStoredKey,
        model: geminiModelInput?.value?.trim() || 'gemini-2.5-flash',
      };
      const result = await validateGeminiApiKey(payload);
      if (result?.valid !== true) {
        throw new Error(result?.message || 'XÃ¡c nháº­n key tháº¥t báº¡i.');
      }
      setGeminiKeyVerifyStatus('âœ… Gemini API key há»£p lá»‡.', 'success');
      return true;
    } catch (error) {
      setGeminiKeyVerifyStatus(`âŒ ${error.message}`, 'error');
      return false;
    } finally {
      if (verifyGeminiKeyBtn) {
        verifyGeminiKeyBtn.disabled = false;
        verifyGeminiKeyBtn.textContent = 'XÃ¡c nháº­n key';
      }
    }
  }

  async function loadConfig() {
    setConfigStatus('Äang táº£i cáº¥u hÃ¬nh...', 'info');
    try {
      const config = await fetchSystemConfig({ forceRefresh: true });
      if (!config) {
        setConfigStatus('ChÆ°a cÃ³ cáº¥u hÃ¬nh há»‡ thá»‘ng. Vui lÃ²ng nháº­p thÃ´ng tin vÃ  lÆ°u.', 'info');
        formEl.classList.remove('is-hidden');
        renderModelChips(geminiListEl, geminiModels, 'gemini', (next) => { geminiModels = next; });
        return;
      }

      geminiModelInput.value = config.gemini_model || 'gemini-2.5-pro';
      transcribeModelInput.value = config.transcribe_model || 'gemini-2.5-flash';

      const mode = config.web_search_mode || 'cse_fast';
      const provider = config.web_search_provider || 'vertex_search';
      setSelectedRadio('web_search_provider', provider);
      setSelectedRadio('web_search_mode', mode);
      setFallbackSources(config.web_search_fallback_sources || DEFAULT_FALLBACK_SOURCES);
      googleSearchKeyInput.value = config.google_search_key || '';
      googleSearchCxInput.value = config.google_search_cx || '';
      if (vertexProjectIdInput) vertexProjectIdInput.value = config.vertex_project_id || '';
      if (vertexLocationInput) vertexLocationInput.value = config.vertex_location || 'global';
      if (vertexDataStoreIdInput) vertexDataStoreIdInput.value = config.vertex_data_store_id || '';
      if (vertexServingConfigInput) vertexServingConfigInput.value = config.vertex_serving_config || '';

      geminiKeyInput.value = config.gemini_api_key || '';
      geminiKeyInput.type = 'password';
      if (toggleGeminiKeyBtn) toggleGeminiKeyBtn.textContent = 'Hiá»‡n key';
      setGeminiKeyVerifyStatus(config.has_gemini_key ? 'ÄÃ£ lÆ°u Gemini API key. Báº¡n cÃ³ thá»ƒ xÃ¡c nháº­n láº¡i báº¥t cá»© lÃºc nÃ o.' : 'ChÆ°a cÃ³ Gemini API key.');
      updateGeminiRuntimeWarning(geminiModelInput.value, !!config.has_gemini_key);

      geminiModels = Array.isArray(config.gemini_models) ? [...config.gemini_models] : [];
      renderModelChips(geminiListEl, geminiModels, 'gemini', (next) => { geminiModels = next; });

      formEl.classList.remove('is-hidden');
      if (config.web_search_configured || config.google_search_configured || config.vertex_search_configured) {
        setConfigStatus('âœ… ÄÃ£ táº£i cáº¥u hÃ¬nh', 'success');
      } else {
        setConfigStatus('âš ï¸ ChÆ°a cáº¥u hÃ¬nh Web Search (Vertex/CSE). Chatbot sáº½ khÃ´ng tra cá»©u web Ä‘Æ°á»£c.', 'error');
      }
    } catch (error) {
      setConfigStatus('âŒ Lá»—i táº£i: ' + error.message, 'error');
    }
  }

  async function saveConfig() {
    const payload = {
      active_provider: 'gemini',
      gemini_model: geminiModelInput.value.trim(),
      transcribe_model: transcribeModelInput.value.trim() || 'gemini-2.5-flash',
      google_search_key: googleSearchKeyInput.value.trim(),
      google_search_cx: googleSearchCxInput.value.trim(),
      vertex_project_id: vertexProjectIdInput?.value?.trim() || '',
      vertex_location: vertexLocationInput?.value?.trim() || 'global',
      vertex_data_store_id: vertexDataStoreIdInput?.value?.trim() || '',
      vertex_serving_config: vertexServingConfigInput?.value?.trim() || '',
      web_search_provider: getSelectedRadio('web_search_provider', 'vertex_search'),
      web_search_mode: getSelectedRadio('web_search_mode', 'cse_fast'),
      web_search_fallback_sources: getFallbackSources(),
      gemini_models: geminiModels,
      gemini_api_key: geminiKeyInput.value.trim(),
    };

    saveBtn.disabled = true;
    saveBtn.textContent = 'â³ Äang lÆ°u...';
    saveStatusEl.className = 'config-save-status';
    saveStatusEl.textContent = '';
    try {
      if (verifyGeminiOnSaveInput?.checked) {
        const useStoredKey = !payload.gemini_api_key;
        const keyOk = await runGeminiKeyValidation({ useStoredKey });
        if (!keyOk) {
          saveStatusEl.className = 'config-save-status error';
          saveStatusEl.textContent = 'âŒ Key chÆ°a há»£p lá»‡ nÃªn chÆ°a lÆ°u cáº¥u hÃ¬nh.';
          return;
        }
      }
      await updateSystemConfig(payload);
      saveStatusEl.className = 'config-save-status success';
      saveStatusEl.textContent = 'âœ… ÄÃ£ lÆ°u vÃ  Ã¡p dá»¥ng ngay!';
      await loadConfig();
    } catch (error) {
      saveStatusEl.className = 'config-save-status error';
      saveStatusEl.textContent = `âŒ Lá»—i lÆ°u: ${error.message}`;
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'ðŸ’¾ LÆ°u cáº¥u hÃ¬nh';
    }
  }

  saveBtn.addEventListener('click', (e) => {
    e.preventDefault();
    saveConfig();
  });
  toggleGeminiKeyBtn?.addEventListener('click', () => {
    const showing = geminiKeyInput.type === 'text';
    geminiKeyInput.type = showing ? 'password' : 'text';
    toggleGeminiKeyBtn.textContent = showing ? 'Hiá»‡n key' : 'áº¨n key';
  });
  verifyGeminiKeyBtn?.addEventListener('click', () => {
    const useStoredKey = !geminiKeyInput.value.trim();
    void runGeminiKeyValidation({ useStoredKey });
  });
  refreshBtn.addEventListener('click', loadConfig);
  geminiModelInput.addEventListener('input', () => {
    updateGeminiRuntimeWarning(geminiModelInput.value, geminiKeyInput.value.includes('â€¢') || !!geminiKeyInput.value.trim());
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
    ? '<span class="config-chip-empty">ChÆ°a cÃ³ model nÃ o. HÃ£y thÃªm model bÃªn trÃªn.</span>'
    : models.map((m, i) => `
      <span class="model-chip ${type}-chip" data-index="${i}">
        <span>${escapeHtml(m)}</span>
        <span class="chip-remove" data-index="${i}" title="XÃ³a model nÃ y">Ã—</span>
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
      <td style="padding:12px;"><button class="btn-delete" data-id="${item.id}">XÃ³a</button></td>
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



