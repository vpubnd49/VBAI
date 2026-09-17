/**
 * VBAI Legal Pro V2 — Search History Module (Redesigned)
 * Simplified UI: 4 core columns, clean layout, no technical clutter
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
  pollTimerId: null,
  isAdmin: false
};

export async function renderSearchHistory(container, navigateToCallback) {
  if (!container) return;

  // Dọn dẹp timer cũ nếu có
  if (historyState.pollTimerId) {
    clearInterval(historyState.pollTimerId);
    historyState.pollTimerId = null;
  }

  container.innerHTML = `
    <div class="search-history-workspace">
      <!-- Header Bar -->
      <div class="sh-header">
        <div class="sh-header-left">
          <h1 class="sh-title">📜 Lịch sử Tra cứu</h1>
          <p class="sh-subtitle">Nhật ký tra cứu pháp luật của bạn</p>
        </div>
        <div class="sh-header-actions">
          <button id="toggle-history-autorefresh-btn" class="btn btn-secondary sh-action-btn" title="Bật/Tắt tự động làm mới mỗi 30s">
            <span class="poll-dot sh-poll-dot"></span>
            <span class="poll-text">Tự động: BẬT (30s)</span>
          </button>
          <button id="delete-all-history-btn" class="btn btn-secondary sh-action-btn sh-danger-btn">
            <span>🗑️</span> <span>Xóa tất cả</span>
          </button>
          <button id="refresh-history-btn" class="btn btn-secondary sh-action-btn">
            <span>🔄</span> <span>Làm mới</span>
          </button>
        </div>
      </div>

      <!-- Controls & Filter Bar -->
      <div class="sh-filter-bar">
        <div class="sh-search-wrapper">
          <span class="sh-search-icon">🔍</span>
          <input type="text" id="history-search-input" class="form-input sh-search-input" placeholder="Tìm theo câu hỏi, từ khóa...">
        </div>
        <select id="history-mode-filter" class="form-input sh-mode-select">
          <option value="all">Tất cả chế độ</option>
          <option value="legal-search">Tra cứu chung</option>
          <option value="document-lookup">Số hiệu văn bản</option>
          <option value="situation-analysis">Tình huống</option>
          <option value="compare-regulations">So sánh</option>
          <option value="effective-date">Hiệu lực</option>
        </select>
      </div>

      <!-- Main History Table Panel -->
      <div class="sh-table-panel">
        <div class="sh-table-scroll">
          <table class="sh-table">
            <thead>
              <tr>
                <th class="sh-col-time">Thời gian</th>
                <th class="sh-col-query">Câu hỏi tra cứu</th>
                <th class="sh-col-result">Kết quả</th>
                <th class="sh-col-action">Hành động</th>
              </tr>
            </thead>
            <tbody id="history-table-body">
              <tr>
                <td colspan="4" class="sh-loading-cell">
                  <div class="spinner" style="margin:0 auto 12px auto;"></div>
                  Đang tải nhật ký tra cứu...
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination Controls -->
        <div id="history-pagination" class="sh-pagination">
          <div id="history-count-info" class="sh-count-info">Đang hiển thị 0 bản ghi</div>
          <div class="sh-page-controls">
            <button id="history-prev-btn" class="btn btn-secondary btn-sm" disabled>⬅️ Trước</button>
            <span id="history-page-num" class="sh-page-num">1 / 1</span>
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
    const isAttached = container?.isConnected ?? (document?.body?.contains ? document.body.contains(container) : true);
    if (!isAttached) {
      if (historyState.pollTimerId) {
        clearInterval(historyState.pollTimerId);
        historyState.pollTimerId = null;
      }
      return;
    }

    if (!historyState.autoRefresh) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;

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
          <td colspan="4" class="sh-loading-cell" style="color:var(--danger);">
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
        <td colspan="4" class="sh-empty-cell">
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
    
    // Result badge
    let resultBadge;
    if (item.status === 'error') {
      resultBadge = '<span class="sh-result-badge sh-result-error">❌ Lỗi</span>';
    } else if (item.status === 'unverified_evidence' || item.verifiedCount === 0) {
      resultBadge = '<span class="sh-result-badge sh-result-warn">⚠️ Chưa có căn cứ</span>';
    } else {
      resultBadge = `<span class="sh-result-badge sh-result-ok">✓ Kiểm chứng (${item.verifiedCount}/${item.totalCount || 1})</span>`;
    }

    const canDelete = historyState.isAdmin || (window.currentUser && item.userId === window.currentUser.uid);
    const deleteBtnHtml = canDelete
      ? `<button class="btn btn-secondary btn-sm btn-delete-log sh-delete-btn" data-id="${item.id}" title="Xóa bản ghi">🗑️</button>`
      : '';

    return `
      <tr class="sh-row">
        <td class="sh-cell-time">
          <div class="sh-time-main">${formattedTime}</div>
          ${item.effectiveDate ? `<div class="sh-time-sub">Rà soát: ${escapeHtml(item.effectiveDate)}</div>` : ''}
        </td>
        <td class="sh-cell-query">
          <div class="sh-query-text" title="${escapeAttribute(item.query)}">${escapeHtml(item.query)}</div>
          <div class="sh-query-meta">
            ${modeBadge}
          </div>
        </td>
        <td class="sh-cell-result">${resultBadge}</td>
        <td class="sh-cell-action">
          <button class="btn btn-primary btn-sm btn-reopen sh-reopen-btn" data-query="${escapeAttribute(item.query)}" data-mode="${escapeAttribute(item.mode)}">
            🚀 Mở lại
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
    'legal-search': { label: 'Pháp luật', color: '#008CA1' },
    'document-lookup': { label: 'Văn bản', color: '#0369a1' },
    'situation-analysis': { label: 'Tình huống', color: '#b45309' },
    'compare-regulations': { label: 'So sánh', color: '#15803d' },
    'effective-date': { label: 'Hiệu lực', color: '#7c3aed' },
  };
  const info = modeMap[mode] || { label: mode || 'Tra cứu', color: '#64748b' };
  return `<span class="sh-mode-badge" style="--badge-color:${info.color}">${escapeHtml(info.label)}</span>`;
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
