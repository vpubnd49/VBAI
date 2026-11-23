/**
 * NQ57 Task Tracker Module — Theo dõi & Đôn đốc Nhiệm vụ Nghị quyết 57-NQ/TW & Kết luận Cuộc họp
 */
import { backendFetch } from './ai-proxy.js';
import { showToast } from './ui-utils.js';

const PILLARS = [
  'Thể chế & Cải cách TTHC',
  'Hạ tầng số & Liên thông',
  'Dữ liệu dùng chung & Đề án 06',
  'Nhân lực số & Học tập số',
  'An toàn thông tin & An ninh mạng',
  'Kinh tế số, Xã hội số & Chỉ số 766',
];

const STATUS_META = {
  hoan_thanh: { label: 'Hoàn thành', color: '#059669', bg: '#ecfdf5' },
  dang_thuc_hien: { label: 'Trong hạn', color: '#2563eb', bg: '#eff6ff' },
  sap_qua_han: { label: 'Sắp quá hạn', color: '#d97706', bg: '#fffbeb' },
  qua_han: { label: 'Quá hạn', color: '#dc2626', bg: '#fef2f2' },
};

function formatIsoToVN(iso = '') {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : (iso || '—');
}

function escapeHtml(str = '') {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Tách đơn vị chủ trì & hạn hoàn thành từ 1 câu kết luận cuộc họp (ví dụ: "Giao Sở Khoa học và Công nghệ chủ trì... trước ngày 10/05/2026")
 */
export function parseConclusionToTask(text = '', sourceDoc = '', sourceDate = '') {
  const clean = String(text || '').trim();
  const unitMatch = clean.match(/(?:Giao|Yêu cầu|Đề nghị)\s+([^,.;:]+?)(?:\s+chủ trì|\s+phối hợp|\s+khẩn trương|\s+nghiên cứu|\s+triển khai|\s+báo cáo|\s+rà soát|,|\.)/i);
  const leadUnit = unitMatch ? unitMatch[1].trim() : 'Đơn vị liên quan';

  let dueDate = '';
  const dateMatch = clean.match(/(?:trước|đến|chậm nhất|hạn)\s+ngày\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/i)
    || clean.match(/ngày\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
  if (dateMatch) {
    const dd = dateMatch[1].padStart(2, '0');
    const mm = dateMatch[2].padStart(2, '0');
    const yyyy = dateMatch[3];
    dueDate = `${yyyy}-${mm}-${dd}`;
  }

  let pillar = PILLARS[0];
  if (/dữ liệu|đề án 06|vneid|số hóa/i.test(clean)) pillar = PILLARS[2];
  else if (/hạ tầng|5g|mạng|phần mềm|hệ thống/i.test(clean)) pillar = PILLARS[1];
  else if (/học tập số|nhân lực|đào tạo|tập huấn|chuyên trách/i.test(clean)) pillar = PILLARS[3];
  else if (/an toàn thông tin|an ninh mạng|bảo mật|cấp độ/i.test(clean)) pillar = PILLARS[4];
  else if (/kinh tế số|xã hội số|766|dti|dịch vụ công/i.test(clean)) pillar = PILLARS[5];

  return {
    title: clean,
    source_doc: sourceDoc || 'Thông báo kết luận cuộc họp',
    source_date: sourceDate || '',
    lead_unit: leadUnit,
    coord_units: [],
    due_date: dueDate,
    pillar,
    status: 'dang_thuc_hien',
  };
}

export async function pushMeetingTasksToTracker(formState) {
  const pad2 = (v) => {
    const s = String(v ?? '').trim();
    return /^\d$/.test(s) ? `0${s}` : s;
  };
  const sourceDate = formState?.ngay && formState?.thang && formState?.nam
    ? `${pad2(formState.ngay)}/${pad2(formState.thang)}/${formState.nam}`
    : '';
  const sourceDoc = formState?.so_ky_hieu || `TBKL của ${formState?.chu_tri || 'Lãnh đạo'}`;
  const rawConclusions = (formState?.noi_dung_cuoc_hop || []).flatMap((nd) => nd?.ket_luan || []);
  const tasks = rawConclusions
    .map((line) => parseConclusionToTask(line, sourceDoc, sourceDate))
    .filter((t) => t.title.length > 5);

  if (!tasks.length) {
    showToast('Không tìm thấy đầu việc kết luận nào để đẩy sang bảng theo dõi.', 'error');
    return null;
  }

  const res = await backendFetch('/nq57/tasks/bulk-from-meeting', {
    method: 'POST',
    body: { tasks },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Lỗi lưu nhiệm vụ');
  return data;
}

function exportTasksToCsv(tasks = []) {
  const headers = ['STT', 'Nội dung nhiệm vụ', 'Văn bản nguồn', 'Ngày VB', 'Đơn vị chủ trì', 'Đơn vị phối hợp', 'Trụ cột NQ 57', 'Hạn hoàn thành', 'Trạng thái', 'Ghi chú'];
  const csvEscape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = tasks.map((t, idx) => [
    idx + 1,
    t.title,
    t.source_doc,
    t.source_date,
    t.lead_unit,
    Array.isArray(t.coord_units) ? t.coord_units.join('; ') : '',
    t.pillar,
    formatIsoToVN(t.due_date),
    STATUS_META[t.effective_status]?.label || t.effective_status,
    t.notes || '',
  ].map(csvEscape).join(','));

  const bom = '\uFEFF';
  const blob = new Blob([bom + headers.map(csvEscape).join(',') + '\n' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const today = new Date();
  const dStr = `${String(today.getDate()).padStart(2, '0')}-${String(today.getMonth() + 1).padStart(2, '0')}-${today.getFullYear()}`;
  a.href = url;
  a.download = `Bang_Don_Doc_NQ57_${dStr}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function renderNq57Tracker(container) {
  let state = {
    tasks: [],
    summary: { total: 0, hoan_thanh: 0, dang_thuc_hien: 0, sap_qua_han: 0, qua_han: 0 },
    filterStatus: 'all',
    filterPillar: '',
    filterSearch: '',
    loading: true,
    showAddForm: false,
  };

  async function loadData() {
    state.loading = true;
    render();
    try {
      const qs = new URLSearchParams();
      if (state.filterStatus && state.filterStatus !== 'all') qs.set('status', state.filterStatus);
      if (state.filterPillar) qs.set('pillar', state.filterPillar);
      if (state.filterSearch) qs.set('search', state.filterSearch);

      const [tasksRes, sumRes] = await Promise.all([
        backendFetch(`/nq57/tasks?${qs.toString()}`),
        backendFetch('/nq57/tasks/summary'),
      ]);
      const tasksData = await tasksRes.json();
      const sumData = await sumRes.json();
      state.tasks = Array.isArray(tasksData.tasks) ? tasksData.tasks : [];
      if (sumData.summary) state.summary = sumData.summary;
    } catch (err) {
      showToast('Lỗi tải dữ liệu đôn đốc NQ 57: ' + err.message, 'error');
    } finally {
      state.loading = false;
      render();
    }
  }

  function render() {
    const s = state.summary;
    container.innerHTML = `
      <div class="page-wrapper" style="max-width:1280px;margin:0 auto;padding:16px 20px;">
        <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:12px;margin-bottom:18px;">
          <div>
            <h2 style="margin:0;font-size:1.4rem;color:var(--text-main);">🚀 Theo dõi & Đôn đốc Nhiệm vụ Nghị quyết 57-NQ/TW</h2>
            <p style="margin:4px 0 0;color:var(--text-muted);font-size:0.92rem;">Đồng bộ nhiệm vụ từ Thông báo kết luận cuộc họp & Kế hoạch CĐS phục vụ báo cáo <a href="https://nq57.tracuu.lamdong.vn/" target="_blank" rel="noopener noreferrer" style="color:#0f766e;font-weight:700;">nq57.tracuu.lamdong.vn</a></p>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <a class="btn btn-secondary" href="https://nq57.tracuu.lamdong.vn/" target="_blank" rel="noopener noreferrer" style="text-decoration:none;">🔗 Mở cổng NQ 57 Lâm Đồng</a>
            <button class="btn btn-primary" id="nq57-toggle-add">+ Thêm nhiệm vụ</button>
            <button class="btn btn-secondary" id="nq57-export-csv">⬇ Xuất Excel/CSV (NQ 57)</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:18px;">
          <div class="panel-group" style="margin:0;padding:14px;border-left:4px solid #0f766e;">
            <div style="font-size:0.85rem;color:var(--text-muted);">Tổng nhiệm vụ</div>
            <div style="font-size:1.7rem;font-weight:800;color:#0f766e;">${s.total || 0}</div>
          </div>
          <div class="panel-group" style="margin:0;padding:14px;border-left:4px solid #059669;">
            <div style="font-size:0.85rem;color:var(--text-muted);">Hoàn thành</div>
            <div style="font-size:1.7rem;font-weight:800;color:#059669;">${s.hoan_thanh || 0}</div>
          </div>
          <div class="panel-group" style="margin:0;padding:14px;border-left:4px solid #d97706;">
            <div style="font-size:0.85rem;color:var(--text-muted);">Sắp quá hạn (≤3 ngày)</div>
            <div style="font-size:1.7rem;font-weight:800;color:#d97706;">${s.sap_qua_han || 0}</div>
          </div>
          <div class="panel-group" style="margin:0;padding:14px;border-left:4px solid #dc2626;">
            <div style="font-size:0.85rem;color:var(--text-muted);">Quá hạn</div>
            <div style="font-size:1.7rem;font-weight:800;color:#dc2626;">${s.qua_han || 0}</div>
          </div>
        </div>

        ${state.showAddForm ? `
          <div class="panel-group" style="margin-bottom:18px;border:1px solid var(--daquy-400);">
            <h3 style="margin:0 0 12px;font-size:1.05rem;">Thêm nhiệm vụ NQ 57 / Chỉ đạo điều hành</h3>
            <div class="form-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;">
              <div class="form-group" style="grid-column:1/-1;">
                <label class="form-label">Nội dung nhiệm vụ *</label>
                <textarea class="form-textarea" id="nq57-f-title" rows="2" placeholder="VD: Giao Sở Khoa học và Công nghệ chủ trì hoàn thiện nền tảng dữ liệu dùng chung..."></textarea>
              </div>
              <div class="form-group">
                <label class="form-label">Đơn vị chủ trì *</label>
                <input class="form-input" id="nq57-f-lead" placeholder="VD: Sở Khoa học và Công nghệ">
              </div>
              <div class="form-group">
                <label class="form-label">Đơn vị phối hợp</label>
                <input class="form-input" id="nq57-f-coord" placeholder="VD: Sở Tài chính; UBND các xã, phường">
              </div>
              <div class="form-group">
                <label class="form-label">Hạn hoàn thành</label>
                <input type="date" class="form-input" id="nq57-f-due">
              </div>
              <div class="form-group">
                <label class="form-label">Trụ cột NQ 57</label>
                <select class="form-input" id="nq57-f-pillar">
                  ${PILLARS.map((p) => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Văn bản nguồn (Số hiệu)</label>
                <input class="form-input" id="nq57-f-src" placeholder="VD: TB số 120/TB-UBND">
              </div>
              <div class="form-group">
                <label class="form-label">Ngày văn bản (DD/MM/YYYY)</label>
                <input class="form-input" id="nq57-f-srcdate" placeholder="23/10/2026">
              </div>
            </div>
            <div style="margin-top:12px;display:flex;gap:8px;justify-content:flex-end;">
              <button class="btn btn-secondary" id="nq57-cancel-add">Hủy</button>
              <button class="btn btn-success" id="nq57-save-add">Lưu nhiệm vụ</button>
            </div>
          </div>
        ` : ''}

        <div class="panel-group" style="margin-bottom:14px;display:flex;flex-wrap:wrap;gap:10px;align-items:center;">
          <input class="form-input" id="nq57-search" value="${escapeHtml(state.filterSearch)}" placeholder="Tìm theo nội dung, đơn vị, số hiệu văn bản..." style="flex:2;min-width:220px;">
          <select class="form-input" id="nq57-filter-status" style="flex:1;min-width:150px;">
            <option value="all" ${state.filterStatus === 'all' ? 'selected' : ''}>Tất cả trạng thái</option>
            <option value="qua_han" ${state.filterStatus === 'qua_han' ? 'selected' : ''}>Quá hạn</option>
            <option value="sap_qua_han" ${state.filterStatus === 'sap_qua_han' ? 'selected' : ''}>Sắp quá hạn</option>
            <option value="dang_thuc_hien" ${state.filterStatus === 'dang_thuc_hien' ? 'selected' : ''}>Trong hạn</option>
            <option value="hoan_thanh" ${state.filterStatus === 'hoan_thanh' ? 'selected' : ''}>Hoàn thành</option>
          </select>
          <select class="form-input" id="nq57-filter-pillar" style="flex:1;min-width:180px;">
            <option value="">Tất cả trụ cột NQ 57</option>
            ${PILLARS.map((p) => `<option value="${escapeHtml(p)}" ${state.filterPillar === p ? 'selected' : ''}>${escapeHtml(p)}</option>`).join('')}
          </select>
          <button class="btn btn-secondary" id="nq57-apply-filter">Lọc</button>
        </div>

        <div class="panel-group" style="overflow-x:auto;">
          ${state.loading ? '<p style="text-align:center;padding:24px;">Đang tải danh sách nhiệm vụ...</p>' : (
            !state.tasks.length
              ? '<p style="text-align:center;padding:28px;color:var(--text-muted);">Chưa có nhiệm vụ nào. Hãy bấm <strong>+ Thêm nhiệm vụ</strong> hoặc đẩy trực tiếp từ chức năng <strong>Xử lý ghi âm & Biên bản cuộc họp</strong>.</p>'
              : `<table style="width:100%;border-collapse:collapse;font-size:0.9rem;">
                  <thead>
                    <tr style="border-bottom:2px solid var(--border-color);text-align:left;">
                      <th style="padding:10px 8px;">Nội dung nhiệm vụ</th>
                      <th style="padding:10px 8px;">Đơn vị chủ trì</th>
                      <th style="padding:10px 8px;">Trụ cột</th>
                      <th style="padding:10px 8px;">Hạn</th>
                      <th style="padding:10px 8px;">Trạng thái</th>
                      <th style="padding:10px 8px;text-align:right;">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${state.tasks.map((t) => {
                      const st = STATUS_META[t.effective_status] || STATUS_META.dang_thuc_hien;
                      const isDone = t.status === 'hoan_thanh';
                      return `<tr style="border-bottom:1px solid var(--border-color);">
                        <td style="padding:10px 8px;max-width:420px;">
                          <div style="font-weight:600;${isDone ? 'text-decoration:line-through;opacity:0.7;' : ''}">${escapeHtml(t.title)}</div>
                          ${t.source_doc ? `<div style="font-size:0.8rem;color:var(--text-muted);margin-top:2px;">Nguồn: ${escapeHtml(t.source_doc)}${t.source_date ? ` (ngày ${escapeHtml(t.source_date)})` : ''}</div>` : ''}
                        </td>
                        <td style="padding:10px 8px;">${escapeHtml(t.lead_unit)}</td>
                        <td style="padding:10px 8px;font-size:0.82rem;">${escapeHtml(t.pillar || '')}</td>
                        <td style="padding:10px 8px;white-space:nowrap;">${formatIsoToVN(t.due_date)}</td>
                        <td style="padding:10px 8px;white-space:nowrap;">
                          <span style="display:inline-block;padding:3px 10px;border-radius:999px;font-size:0.8rem;font-weight:700;color:${st.color};background:${st.bg};">${st.label}</span>
                        </td>
                        <td style="padding:10px 8px;text-align:right;white-space:nowrap;">
                          <button class="btn btn-sm btn-secondary nq57-btn-toggle" data-id="${escapeHtml(t.id)}" data-done="${isDone ? '1' : '0'}">${isDone ? 'Mở lại' : '✓ Hoàn thành'}</button>
                          <button class="btn btn-sm btn-secondary nq57-btn-del" data-id="${escapeHtml(t.id)}" style="color:#dc2626;margin-left:4px;">Xóa</button>
                        </td>
                      </tr>`;
                    }).join('')}
                  </tbody>
                </table>`
          )}
        </div>
      </div>
    `;

    container.querySelector('#nq57-toggle-add')?.addEventListener('click', () => {
      state.showAddForm = !state.showAddForm;
      render();
    });
    container.querySelector('#nq57-cancel-add')?.addEventListener('click', () => {
      state.showAddForm = false;
      render();
    });
    container.querySelector('#nq57-export-csv')?.addEventListener('click', () => {
      if (!state.tasks.length) { showToast('Không có dữ liệu để xuất.', 'error'); return; }
      exportTasksToCsv(state.tasks);
      showToast('Đã xuất file CSV phục vụ báo cáo nq57.vn!', 'success');
    });
    container.querySelector('#nq57-apply-filter')?.addEventListener('click', () => {
      state.filterSearch = container.querySelector('#nq57-search')?.value || '';
      state.filterStatus = container.querySelector('#nq57-filter-status')?.value || 'all';
      state.filterPillar = container.querySelector('#nq57-filter-pillar')?.value || '';
      loadData();
    });
    container.querySelector('#nq57-save-add')?.addEventListener('click', async () => {
      const title = container.querySelector('#nq57-f-title')?.value?.trim();
      const lead_unit = container.querySelector('#nq57-f-lead')?.value?.trim();
      if (!title || !lead_unit) {
        showToast('Vui lòng nhập Nội dung nhiệm vụ và Đơn vị chủ trì.', 'error');
        return;
      }
      try {
        const res = await backendFetch('/nq57/tasks', {
          method: 'POST',
          body: {
            title,
            lead_unit,
            coord_units: container.querySelector('#nq57-f-coord')?.value || '',
            due_date: container.querySelector('#nq57-f-due')?.value || '',
            pillar: container.querySelector('#nq57-f-pillar')?.value || PILLARS[0],
            source_doc: container.querySelector('#nq57-f-src')?.value || '',
            source_date: container.querySelector('#nq57-f-srcdate')?.value || '',
          },
        });
        if (!res.ok) throw new Error((await res.json())?.error || 'Lỗi lưu nhiệm vụ');
        state.showAddForm = false;
        showToast('Đã thêm nhiệm vụ NQ 57!', 'success');
        loadData();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    container.querySelectorAll('.nq57-btn-toggle').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const nextStatus = btn.dataset.done === '1' ? 'dang_thuc_hien' : 'hoan_thanh';
        try {
          const res = await backendFetch(`/nq57/tasks/${id}`, { method: 'PATCH', body: { status: nextStatus } });
          if (!res.ok) throw new Error('Không thể cập nhật trạng thái');
          loadData();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });

    container.querySelectorAll('.nq57-btn-del').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        try {
          const res = await backendFetch(`/nq57/tasks/${id}`, { method: 'DELETE' });
          if (!res.ok) throw new Error('Không thể xóa nhiệm vụ');
          showToast('Đã xóa nhiệm vụ.', 'success');
          loadData();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });
  }

  loadData();
}
