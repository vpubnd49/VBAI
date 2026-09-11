/**
 * VBAI Legal Pro V2 — Search History Module
 * Real search logs UI rendering from the backend search-history API
 * Enables searching, filtering, re-opening query in Legal Search UI, and item deletion.
 */

import { firebaseConfig } from '../firebase-config.js';
import { showToast } from './ui-utils.js';

let historyState = {
  logs: [],
  filteredLogs: [],
  currentPage: 1,
  pageSize: 15,
  nextCursor: null,
  previousCursors: [],
  hasMore: false,
  filterQuery: '',
  filterMode: 'all',
  isLoading: false,
  autoRefresh: true,
  pollTimerId: null
};

export async function renderSearchHistory(container, navigateToCallback) {
  if (!container) return;

  // Dọn dẹp timer cũ nếu có
  if (historyState.pollTimerId) {
    clearInterval(historyState.pollTimerId);
    historyState.pollTimerId = null;
  }

  container.innerHTML = `
    <div class="search-history-workspace" style="padding: 20px; max-width: 1200px; margin: 0 auto;">
      <!-- Header Bar -->
      <div class="search-history-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 20px; flex-wrap:wrap; gap:12px;">
        <div>
          <h1 style="font-size:1.5rem; font-weight:700; color:var(--text-primary); margin:0 0 6px 0;">📜 Lịch sử Tra cứu Pháp luật</h1>
          <p style="font-size:0.9rem; color:var(--text-secondary); margin:0;">Nhật ký tra cứu và căn cứ pháp lý được lưu trữ realtime từ hệ thống.</p>
        </div>
        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
          <button id="toggle-history-autorefresh-btn" class="btn btn-secondary" style="display:flex; align-items:center; gap:6px; font-size:0.85rem;" title="Bật/Tắt tự động làm mới mỗi 30s">
            <span class="poll-dot" style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#10b981; transition:background 0.2s;"></span>
            <span class="poll-text">Tự động: BẬT (30s)</span>
          </button>
          <button id="delete-all-history-btn" class="btn btn-secondary" style="display:flex; align-items:center; gap:6px; color:var(--danger,#DC2626); border-color:var(--danger,#DC2626);">
            <span>🗑️</span> <span>Xóa tất cả</span>
          </button>
          <button id="refresh-history-btn" class="btn btn-secondary" style="display:flex; align-items:center; gap:6px;">
            <span>🔄</span> <span>Làm mới</span>
          </button>
        </div>
      </div>

      <!-- Controls & Filter Bar -->
      <div class="history-controls-card" style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:12px; padding:16px; margin-bottom:20px; display:flex; flex-wrap:wrap; gap:12px; align-items:center;">
        <div style="flex:1; min-width:240px; position:relative;">
          <input type="text" id="history-search-input" class="form-input" placeholder="Tìm theo câu hỏi, từ khóa hoặc email..." style="width:100%; padding-left:36px;">
          <span style="position:absolute; left:12px; top:50%; transform:translateY(-50%); opacity:0.6;">🔍</span>
        </div>

        <select id="history-mode-filter" class="form-input" style="width:180px;">
          <option value="all">Tất cả chế độ</option>
          <option value="legal-search">Tra cứu chung</option>
          <option value="document-lookup">Số hiệu văn bản</option>
          <option value="situation-analysis">Tình huống</option>
          <option value="compare-regulations">So sánh</option>
          <option value="effective-date">Hiệu lực</option>
        </select>
      </div>

      <!-- Main History Table Panel -->
      <div class="history-table-panel" style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:12px; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.05);">
        <div class="table-responsive" style="overflow-x:auto;">
          <table class="history-table" style="width:100%; border-collapse:collapse; text-align:left; font-size:0.9rem;">
            <thead>
              <tr style="background:var(--bg-secondary); border-bottom:1px solid var(--border-color); color:var(--text-secondary); font-weight:600;">
                <th style="padding:12px 16px; width:170px;">Thời gian</th>
                <th style="padding:12px 16px; width:180px;">Người tra cứu</th>
                <th style="padding:12px 16px; width:140px;">Chế độ</th>
                <th style="padding:12px 16px;">Từ khóa / Câu hỏi tra cứu</th>
                <th style="padding:12px 16px; width:130px;">Kết quả</th>
                <th style="padding:12px 16px; width:140px; text-align:right;">Hành động</th>
              </tr>
            </thead>
            <tbody id="history-table-body">
              <tr>
                <td colspan="6" style="padding:40px; text-align:center; color:var(--text-muted);">
                  <div class="spinner" style="margin:0 auto 12px auto;"></div>
                   Đang tải nhật ký tra cứu từ máy chủ...
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination Controls -->
        <div id="history-pagination" style="display:flex; justify-content:space-between; align-items:center; padding:12px 16px; background:var(--bg-secondary); border-top:1px solid var(--border-color); font-size:0.85rem;">
          <div id="history-count-info" style="color:var(--text-secondary);">Đang hiển thị 0 bản ghi</div>
          <div style="display:flex; gap:8px; align-items:center;">
            <button id="history-prev-btn" class="btn btn-secondary btn-sm" disabled>⬅️ Trước</button>
            <span id="history-page-num" style="font-weight:600; padding:0 8px;">1 / 1</span>
            <button id="history-next-btn" class="btn btn-secondary btn-sm" disabled>Tiếp ➡️</button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Attach Event Listeners
  const searchInput = container.querySelector('#history-search-input');
  const modeFilter = container.querySelector('#history-mode-filter');
  const refreshBtn = container.querySelector('#refresh-history-btn');
  const prevBtn = container.querySelector('#history-prev-btn');
  const nextBtn = container.querySelector('#history-next-btn');

  searchInput.addEventListener('input', (e) => {
    historyState.filterQuery = e.target.value.toLowerCase().trim();
    historyState.currentPage = 1;
    applyFilterAndRender(container, navigateToCallback);
  });

  modeFilter.addEventListener('change', (e) => {
    historyState.filterMode = e.target.value;
    historyState.currentPage = 1;
    applyFilterAndRender(container, navigateToCallback);
  });

  // Auto-Refresh Toggle Button
  const autoRefreshBtn = container.querySelector('#toggle-history-autorefresh-btn');
  if (autoRefreshBtn) {
    autoRefreshBtn.addEventListener('click', () => {
      historyState.autoRefresh = !historyState.autoRefresh;
      const dot = autoRefreshBtn.querySelector('.poll-dot');
      const text = autoRefreshBtn.querySelector('.poll-text');
      if (historyState.autoRefresh) {
        if (dot) dot.style.background = '#10b981';
        if (text) text.textContent = 'Tự động: BẬT (30s)';
        showToast('Đã BẬT tự động làm mới lịch sử (mỗi 30s)', 'success');
      } else {
        if (dot) dot.style.background = '#94a3b8';
        if (text) text.textContent = 'Tự động: TẮT';
        showToast('Đã TẮT tự động làm mới lịch sử', 'info');
      }
    });
  }

  refreshBtn.addEventListener('click', () => {
    fetchLogs(container, navigateToCallback);
  });

  // Delete All button
  const deleteAllBtn = container.querySelector('#delete-all-history-btn');
  if (deleteAllBtn) {
    deleteAllBtn.addEventListener('click', async () => {
      if (!confirm('Bạn có chắc chắn muốn xóa TOÀN BỘ nhật ký tra cứu? Hành động này không thể hoàn tác.')) return;
      deleteAllBtn.disabled = true;
      deleteAllBtn.querySelector('span:last-child').textContent = 'Đang xóa...';
      try {
        const { backendFetch } = await import('./ai-proxy.js');
        const res = await backendFetch('/search-history', { method: 'DELETE' });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || `HTTP ${res.status}`);
        }
        showToast('Đã xóa toàn bộ nhật ký tra cứu!');
        fetchLogs(container, navigateToCallback);
      } catch (err) {
        showToast('Lỗi xóa nhật ký: ' + err.message, 'error');
      } finally {
        deleteAllBtn.disabled = false;
        deleteAllBtn.querySelector('span:last-child').textContent = 'Xóa tất cả';
      }
    });
  }

  prevBtn.addEventListener('click', () => {
    if (historyState.currentPage > 1) {
      historyState.previousCursors.pop();
      historyState.currentPage -= 1;
      const cursor = historyState.previousCursors[historyState.previousCursors.length - 1] || null;
      fetchLogs(container, navigateToCallback, cursor);
    }
  });

  nextBtn.addEventListener('click', () => {
    if (historyState.hasMore && historyState.nextCursor) {
      historyState.previousCursors.push(historyState.nextCursor);
      historyState.currentPage += 1;
      fetchLogs(container, navigateToCallback, historyState.nextCursor);
    }
  });

  // Initial Fetch
  await fetchLogs(container, navigateToCallback);

  // Khởi chạy vòng lặp Polling 30s
  startHistoryPoller(container, navigateToCallback);
}

function startHistoryPoller(container, navigateToCallback) {
  if (historyState.pollTimerId) {
    clearInterval(historyState.pollTimerId);
    historyState.pollTimerId = null;
  }

  historyState.pollTimerId = setInterval(async () => {
    // 1. Kiểm tra container còn gắn trong DOM không
    const isAttached = container?.isConnected ?? (document?.body?.contains ? document.body.contains(container) : true);
    if (!isAttached) {
      if (historyState.pollTimerId) {
        clearInterval(historyState.pollTimerId);
        historyState.pollTimerId = null;
      }
      return;
    }

    // 2. Kiểm tra cờ autoRefresh
    if (!historyState.autoRefresh) return;

    // 3. Tạm dừng nếu tab trình duyệt đang bị ẩn (Page Visibility API)
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;

    // 4. Chỉ tự động cập nhật khi người dùng đang ở trang 1 và không trong trạng thái tải
    if (historyState.currentPage === 1 && !historyState.isLoading) {
      await fetchLogs(container, navigateToCallback, null, true);
    }
  }, 30 * 1000);
}

async function fetchLogs(container, navigateToCallback, cursor = null, isSilent = false) {
  if (!isSilent) historyState.isLoading = true;
  try {
    const { backendFetch } = await import('./ai-proxy.js');
    const params = new URLSearchParams({ limit: String(historyState.pageSize) });
    if (cursor) params.set('cursor', cursor);
    const response = await backendFetch(`/search-history?${params.toString()}`, { method: 'GET' });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    historyState.logs = (Array.isArray(data.logs) ? data.logs : []).map(raw => {
      const currentEmail = window.currentUser?.email;
      const currentName = window.currentUser?.displayName;
      const currentUid = window.currentUser?.uid;
      const isSelf = Boolean(currentUid && raw.user_id && String(raw.user_id) === String(currentUid));

      const userDisplay = raw.user_name || raw.user_email ||
        (isSelf ? (currentName || currentEmail) : null) ||
        (raw.user_id ? `User ${String(raw.user_id).slice(0, 8)}` : 'anonymous');

      return {
        id: raw.id,
        query: raw.query || '',
        user: userDisplay,
        userEmail: raw.user_email || (isSelf ? currentEmail : null),
        userId: raw.user_id || null,
        mode: raw.mode || 'legal-search',
        feature: raw.feature || 'legal-search',
        model: raw.model || '',
        effectiveDate: raw.effectiveDate || null,
        status: raw.status || 'success',
        createdAt: raw.created_at || raw.timestamp,
        verifiedCount: typeof raw.verified_count === 'number' ? raw.verified_count : (typeof raw.verifiedEvidenceCount === 'number' ? raw.verifiedEvidenceCount : 0),
        totalCount: typeof raw.evidence_count === 'number' ? raw.evidence_count : (typeof raw.totalEvidenceCount === 'number' ? raw.totalEvidenceCount : 0),
        requestId: raw.requestId || raw.request_id || null,
        errorMessage: raw.errorMessage || null
      };
    });

    historyState.isAdmin = data.isAdmin === true;
    historyState.nextCursor = data.pagination?.nextCursor || null;
    historyState.hasMore = data.pagination?.hasMore === true || !!historyState.nextCursor;
    
    if (historyState.filterQuery || historyState.filterMode !== 'all') {
      applyFilterAndRender(container, navigateToCallback);
    } else {
      historyState.filteredLogs = historyState.logs;
      renderTablePage(container, navigateToCallback);
    }
  } catch (err) {
    if (isSilent) {
      console.warn('Lịch sử tra cứu: Tự động cập nhật không thành công (giữ nguyên dữ liệu cũ):', err.message);
      return;
    }
    console.error('Lỗi khi tải search_logs:', err);
    const tbody = container.querySelector('#history-table-body');
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="padding:30px; text-align:center; color:var(--danger);">
            ⚠️ Không thể kết nối nhật ký: ${err.message}
          </td>
        </tr>
      `;
    }
  } finally {
    if (!isSilent) historyState.isLoading = false;
  }
}

function applyFilterAndRender(container, navigateToCallback) {
  const { logs, filterQuery, filterMode } = historyState;

  historyState.filteredLogs = logs.filter(item => {
    // Search a normalized copy only; keep item.query untouched for display/reopen.
    const searchable = [item.query, item.user, item.requestId, item.feature, item.effectiveDate]
      .map(value => String(value || '').toLocaleLowerCase('vi-VN'))
      .join(' ');
    const matchesQuery = !filterQuery || searchable.includes(filterQuery);

    const matchesMode = filterMode === 'all' || item.mode === filterMode;

    return matchesQuery && matchesMode;
  });

  renderTablePage(container, navigateToCallback);
}

function renderTablePage(container, navigateToCallback) {
  const tbody = container.querySelector('#history-table-body');
  const countInfo = container.querySelector('#history-count-info');
  const pageNum = container.querySelector('#history-page-num');
  const prevBtn = container.querySelector('#history-prev-btn');
  const nextBtn = container.querySelector('#history-next-btn');

  if (!tbody) return;

  const { filteredLogs, currentPage } = historyState;
  const totalLogs = filteredLogs.length;
  const totalPages = currentPage + (historyState.hasMore ? 1 : 0);

  if (totalLogs === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="padding:40px; text-align:center; color:var(--text-muted);">
          📭 Chưa tìm thấy lịch sử tra cứu nào phù hợp.
        </td>
      </tr>
    `;
    if (countInfo) countInfo.textContent = 'Đang hiển thị 0 bản ghi';
    if (pageNum) pageNum.textContent = '1 / 1';
    if (prevBtn) prevBtn.disabled = true;
    if (nextBtn) nextBtn.disabled = true;
    return;
  }

  const startIdx = 0;
  const endIdx = totalLogs;
  const pageItems = filteredLogs;

  tbody.innerHTML = pageItems.map(item => {
    const formattedTime = formatTimestamp(item.createdAt);
    const modeBadge = getModeBadgeHtml(item.mode);
    const featureTag = item.feature ? `<span style="font-size:0.72rem; color:var(--text-muted);">${escapeHtml(item.feature)}</span>` : '';
    const effectiveTag = item.effectiveDate ? `<div style="font-size:0.72rem; color:var(--text-muted); margin-top:2px;">Rà soát ngày: ${escapeHtml(item.effectiveDate)}</div>` : '';
    
    let resultBadge = `<span class="verify-chip verified-true" style="font-size:0.75rem;">✓ Đã kiểm chứng (${item.verifiedCount}/${item.totalCount || 1})</span>`;
    if (item.status === 'unverified_evidence' || item.verifiedCount === 0) {
      resultBadge = `<span class="verify-chip" style="background:rgba(234,179,8,0.15); color:#d97706; font-size:0.75rem; padding:2px 8px; border-radius:12px; font-weight:600;">⚠️ Chưa có căn cứ</span>`;
    } else if (item.status === 'error') {
      resultBadge = `<span class="verify-chip" style="background:rgba(239,68,68,0.15); color:#dc2626; font-size:0.75rem; padding:2px 8px; border-radius:12px; font-weight:600;">❌ Lỗi thực thi</span>`;
    }

    const modelTag = `<span style="font-size:0.72rem; background:var(--bg-secondary); padding:2px 6px; border-radius:4px; margin-left:4px; font-family:monospace;">${escapeHtml(item.model)}</span>`;
    const traceIdTag = item.requestId ? `<div style="font-size:0.7rem; color:var(--text-muted); font-family:monospace;">requestId: ${escapeHtml(item.requestId)}</div>` : '<div style="font-size:0.7rem; color:var(--text-muted);">requestId: n/a</div>';

    const canDelete = historyState.isAdmin || (window.currentUser && item.userId === window.currentUser.uid);
    const deleteBtnHtml = canDelete
      ? `<button class="btn btn-secondary btn-sm btn-delete-log" data-id="${item.id}" style="padding:4px 8px; font-size:0.8rem; color:var(--danger);" title="Xóa bản ghi">
           <span>🗑️</span>
         </button>`
      : '';

    return `
      <tr style="border-bottom:1px solid var(--border-color); transition:background 0.2s;" onmouseenter="this.style.background='var(--bg-hover)'" onmouseleave="this.style.background='transparent'">
        <td style="padding:12px 16px; color:var(--text-secondary); white-space:nowrap;">
          <div>${formattedTime}</div>
          ${effectiveTag}
        </td>
        <td style="padding:12px 16px; font-weight:500; color:var(--text-primary); text-overflow:ellipsis; overflow:hidden; max-width:200px; white-space:nowrap;" title="${escapeHtml(item.user)}">
          <div style="font-weight:600; color:var(--brand-primary, #0284c7);">${escapeHtml(item.user)}</div>
          ${item.userEmail && item.userEmail !== item.user ? `<div style="font-size:0.75rem; color:var(--text-muted);">${escapeHtml(item.userEmail)}</div>` : ''}
          ${traceIdTag}
        </td>
        <td style="padding:12px 16px;">
           <div>feature: ${featureTag || 'n/a'} · mode: ${modeBadge}</div>
           <div style="margin-top:2px;">${modelTag}</div>
        </td>
        <td style="padding:12px 16px; font-weight:500; color:var(--text-primary);" title="${escapeAttribute(item.query)}">
          <div style="max-height:48px; overflow:hidden; text-overflow:ellipsis; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;">
            ${escapeHtml(item.query)}
          </div>
        </td>
        <td style="padding:12px 16px;">${resultBadge}</td>
        <td style="padding:12px 16px; text-align:right; white-space:nowrap;">
          <button class="btn btn-primary btn-sm btn-reopen" data-query="${escapeAttribute(item.query)}" data-mode="${escapeAttribute(item.mode)}" style="padding:4px 10px; font-size:0.8rem; margin-right:4px;">
            <span>🚀</span> <span>Mở lại</span>
          </button>
          ${deleteBtnHtml}
        </td>
      </tr>
    `;
  }).join('');

  if (countInfo) countInfo.textContent = `Hiển thị ${startIdx + 1} - ${endIdx} trên tổng số ${totalLogs} bản ghi`;
  if (pageNum) pageNum.textContent = `${currentPage} / ${totalPages}`;
  if (prevBtn) prevBtn.disabled = currentPage === 1 || historyState.isLoading;
  if (nextBtn) nextBtn.disabled = !historyState.hasMore || historyState.isLoading;

  // Delegate Reopen and Delete actions
  tbody.addEventListener('click', async (e) => {
    const reopenBtn = e.target.closest('.btn-reopen');
    if (reopenBtn) {
      const q = reopenBtn.dataset.query;
      const m = reopenBtn.dataset.mode || 'legal-search';
      if (typeof navigateToCallback === 'function') {
        navigateToCallback('legal-search', q, m);
      }
      return;
    }

    const deleteBtn = e.target.closest('.btn-delete-log');
    if (deleteBtn) {
      const logId = deleteBtn.dataset.id;
      if (!confirm('Bạn có chắc chắn muốn xóa bản ghi nhật ký tra cứu này không?')) return;
      deleteBtn.disabled = true;
      try {
        const { backendFetch } = await import('./ai-proxy.js');
        const res = await backendFetch(`/search-history/${logId}`, { method: 'DELETE' });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || `HTTP ${res.status}`);
        }
        showToast('Đã xóa bản ghi tra cứu thành công!');
        fetchLogs(container, navigateToCallback);
      } catch (err) {
        showToast('Lỗi xóa bản ghi: ' + err.message, 'error');
        deleteBtn.disabled = false;
      }
    }
  });
}

function formatTimestamp(ts) {
  if (!ts) return 'N/A';
  let d;
  if (ts.seconds) {
    d = new Date(ts.seconds * 1000);
  } else if (typeof ts === 'string' || typeof ts === 'number') {
    d = new Date(ts);
  } else {
    return 'N/A';
  }
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getModeBadgeHtml(mode) {
  const modeMap = {
    'legal-search': { label: 'Tra cứu chung', class: 'badge-primary' },
    'document-lookup': { label: 'Số hiệu VB', class: 'badge-info' },
    'situation-analysis': { label: 'Tình huống', class: 'badge-warning' },
    'compare-regulations': { label: 'So sánh', class: 'badge-success' },
    'effective-date': { label: 'Hiệu lực', class: 'badge-secondary' },
  };

  const info = modeMap[mode] || { label: mode || 'Tra cứu', class: 'badge-secondary' };
  return `<span class="badge ${info.class}" style="font-size:0.75rem; padding:2px 8px; border-radius:4px;">${escapeHtml(info.label)}</span>`;
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttribute(str) {
  return String(str || '').replace(/"/g, '&quot;');
}
