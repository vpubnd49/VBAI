/**
 * PAKN Assistant Module — Trợ lý Phân loại & Dự thảo Xử lý Phản ánh, Kiến nghị (pakn.nq57.vn)
 * Đúng cơ cấu 6 Sở mới tỉnh Lâm Đồng & mô hình chính quyền địa phương 2 cấp (Tỉnh - Xã)
 */
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, WidthType, BorderStyle, VerticalAlign, LineRuleType,
} from 'docx';
import { saveAs } from 'file-saver';
import { backendFetch, sendChatRequest } from './ai-proxy.js';
import { showToast } from './ui-utils.js';

const L = {
  PAGE: { width: 11906, height: 16838 },
  MARGIN: { top: 1134, bottom: 1134, left: 1701, right: 1134 },
  FONT: 'Times New Roman',
  CW: 9071,
};
const BN = {
  top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
  left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
  right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
  insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'auto' },
  insideVertical: { style: BorderStyle.NONE, size: 0, color: 'auto' },
};
const BS = { before: 120, after: 0, line: 340, lineRule: LineRuleType.AT_LEAST };

function escapeHtml(str = '') {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getTodayVN() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function parseJsonSafe(raw = '') {
  const cleaned = String(raw || '')
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();
  const s = cleaned.indexOf('{');
  const e = cleaned.lastIndexOf('}');
  if (s === -1 || e === -1 || e <= s) throw new Error('AI không trả về JSON hợp lệ.');
  return JSON.parse(cleaned.slice(s, e + 1));
}

function buildPaknPrompt({ code, content, citizenInfo, draftType, dueDateVN }) {
  const modeLabel = draftType === 'tra_loi'
    ? 'Công văn trả lời trực tiếp công dân/doanh nghiệp'
    : 'Công văn của UBND tỉnh chuyển đơn vị chủ trì kiểm tra, giải quyết và trả lời công dân trên pakn.nq57.vn';

  return `Bạn là chuyên viên Văn phòng UBND tỉnh Lâm Đồng phụ trách xử lý Phản ánh, kiến nghị trên hệ thống pakn.nq57.vn theo Nghị quyết 57-NQ/TW.

THÔNG TIN PHẢN ÁNH, KIẾN NGHỊ:
- Mã hồ sơ: ${code || 'Chưa có mã'}
- Người phản ánh (nếu có): ${citizenInfo || 'Công dân/Doanh nghiệp (định danh VNeID)'}
- Loại văn bản cần dự thảo: ${modeLabel}
- Hạn giải quyết dự kiến: ${dueDateVN ? `trước ngày ${dueDateVN}` : 'trong vòng 05 ngày làm việc'}
- Nội dung phản ánh:
${content}

QUY TẮC BẮT BUỘC:
1. Phân loại đúng thẩm quyền theo MÔ HÌNH CHÍNH QUYỀN 2 CẤP (Tỉnh - Xã, KHÔNG dùng cấp huyện) và CƠ CẤU 6 SỞ MỚI TỈNH LÂM ĐỒNG (sau Nghị quyết 390-395/NQ-HĐND ngày 18/02/2025):
   - Đất đai, tài nguyên, môi trường, nông nghiệp -> Sở Nông nghiệp và Môi trường
   - Hạ tầng số, CNTT, chuyển đổi số, phần mềm, khoa học công nghệ -> Sở Khoa học và Công nghệ
   - Tài chính, ngân sách, đầu tư, doanh nghiệp, quy hoạch -> Sở Tài chính
   - Xây dựng, giao thông, hạ tầng đô thị -> Sở Xây dựng
   - Tổ chức bộ máy, cán bộ công chức, lao động, người có công, CCHC -> Sở Nội vụ
   - Dân tộc, tôn giáo -> Sở Dân tộc và Tôn giáo
   - Thủ tục đất đai/hộ tịch/chứng thực tại cơ sở -> UBND xã/phường/đặc khu liên quan.
2. Mọi ngày tháng văn bản BẮT BUỘC định dạng "ngày DD/MM/YYYY" (ví dụ: "ngày 23/10/2026"), TUYỆT ĐỐI KHÔNG viết dài "ngày 23 tháng 10 năm 2026".
3. Dự thảo phần NỘI DUNG CHÍNH của Công văn (không viết Quốc hiệu/Tiêu ngữ/Chữ ký), văn phong hành chính chuẩn NĐ30, câu cuối gắn dấu ./.

CHỈ TRẢ VỀ JSON THUẦN:
{
  "title": "Trích yếu ngắn gọn (bắt đầu bằng V/v ...)",
  "field": "Tên lĩnh vực (VD: Dịch vụ công trực tuyến / Đất đai / Dữ liệu VNeID / ...)",
  "assigned_unit": "Đơn vị chủ trì chính xác",
  "coord_units": ["Đơn vị phối hợp 1", "Đơn vị phối hợp 2"],
  "kinh_gui": "Tên cơ quan nhận (hoặc công dân/doanh nghiệp)",
  "legal_basis": ["Căn cứ pháp lý liên quan 1 (kèm số hiệu, ngày DD/MM/YYYY)", "Căn cứ 2"],
  "draft_content": "Nội dung chính Công văn chuẩn NĐ30, chia đoạn rõ ràng, kết thúc bằng dấu ./."
}`;
}

async function exportPaknDocx(analysis, meta) {
  const reportDate = getTodayVN();
  const ch = [];
  const ty = String(analysis.title || 'V/v xử lý phản ánh, kiến nghị trên hệ thống pakn.nq57.vn').trim();
  const trichYeuText = ty.toLowerCase().startsWith('v/v') ? ty : `V/v ${ty}`;

  const lc = [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [new TextRun({ text: 'ỦY BAN NHÂN DÂN', font: L.FONT, size: 26 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [new TextRun({ text: 'TỈNH LÂM ĐỒNG', font: L.FONT, size: 26, bold: true })] }),
    new Paragraph({ spacing: { before: 20, after: 80 }, border: { top: { style: BorderStyle.SINGLE, size: 2, color: '000000', space: 1 } }, indent: { left: 1500, right: 1500 } }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [new TextRun({ text: 'Số:        /UBND-NC', font: L.FONT, size: 26 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80, after: 0 }, children: [new TextRun({ text: trichYeuText, font: L.FONT, size: 24 })] }),
  ];
  const rc = [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [new TextRun({ text: 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', font: L.FONT, size: 26, bold: true })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [new TextRun({ text: 'Độc lập - Tự do - Hạnh phúc', font: L.FONT, size: 28, bold: true })] }),
    new Paragraph({ spacing: { before: 20, after: 0 }, border: { top: { style: BorderStyle.SINGLE, size: 2, color: '000000', space: 1 } }, indent: { left: 1100, right: 1100 } }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [new TextRun({ text: `Lâm Đồng, ngày ${reportDate}`, font: L.FONT, size: 28, italics: true })] }),
  ];

  ch.push(new Table({
    width: { size: L.CW, type: WidthType.DXA },
    borders: BN,
    columnWidths: [3500, 5571],
    rows: [new TableRow({
      children: [
        new TableCell({ borders: BN, width: { size: 3500, type: WidthType.DXA }, verticalAlign: VerticalAlign.TOP, children: lc }),
        new TableCell({ borders: BN, width: { size: 5571, type: WidthType.DXA }, verticalAlign: VerticalAlign.TOP, children: rc }),
      ],
    })],
  }));

  ch.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 240, after: 200 },
    children: [new TextRun({ text: `Kính gửi: ${analysis.kinh_gui || analysis.assigned_unit || 'Đơn vị liên quan'}.`, font: L.FONT, size: 28 })],
  }));

  const lines = String(analysis.draft_content || '').split('\n').map((l) => l.trim()).filter(Boolean);
  lines.forEach((line, idx) => {
    let txt = line;
    if (idx === lines.length - 1 && !txt.endsWith('./.')) {
      txt = txt.replace(/\.$/, '') + './.';
    }
    ch.push(new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: BS,
      indent: { firstLine: 567 },
      children: [new TextRun({ text: txt, font: L.FONT, size: 28 })],
    }));
  });

  const nn = [
    new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: 'Nơi nhận:', font: L.FONT, size: 24, bold: true, italics: true })] }),
    new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: '- Như trên;', font: L.FONT, size: 22 })] }),
    new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: '- Chủ tịch, các PCT UBND tỉnh;', font: L.FONT, size: 22 })] }),
    new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: '- CVP, PCVP UBND tỉnh;', font: L.FONT, size: 22 })] }),
    new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: '- Lưu: VT, NC.', font: L.FONT, size: 22 })] }),
  ];
  const sg = [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [new TextRun({ text: 'TL. CHỦ TỊCH', font: L.FONT, size: 28, bold: true })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [new TextRun({ text: 'CHÁNH VĂN PHÒNG', font: L.FONT, size: 28, bold: true })] }),
    new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: '', font: L.FONT, size: 28 })] }),
    new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: '', font: L.FONT, size: 28 })] }),
    new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: '', font: L.FONT, size: 28 })] }),
    new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: '', font: L.FONT, size: 28 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [new TextRun({ text: meta.signer || '', font: L.FONT, size: 28, bold: true })] }),
  ];
  ch.push(new Paragraph({ spacing: { before: 180, after: 0 }, children: [] }));
  ch.push(new Table({
    width: { size: L.CW, type: WidthType.DXA },
    borders: BN,
    columnWidths: [4400, 4671],
    rows: [new TableRow({
      children: [
        new TableCell({ borders: BN, width: { size: 4400, type: WidthType.DXA }, verticalAlign: VerticalAlign.TOP, children: nn }),
        new TableCell({ borders: BN, width: { size: 4671, type: WidthType.DXA }, verticalAlign: VerticalAlign.TOP, children: sg }),
      ],
    })],
  }));

  const doc = new Document({
    sections: [{ properties: { page: { size: L.PAGE, margin: L.MARGIN } }, children: ch }],
  });
  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Cong_Van_PAKN_${(meta.code || 'NQ57').replace(/[^\w\d-]+/g, '_')}.docx`);
}

export function renderPaknAssistant(container) {
  const state = {
    code: '',
    citizenInfo: '',
    draftType: 'chuyen_xu_ly',
    dueDate: '',
    content: '',
    signer: '',
    processing: false,
    analysis: null,
    savedCases: [],
    loadingList: true,
  };

  async function loadCases() {
    state.loadingList = true;
    render();
    try {
      const res = await backendFetch('/pakn?limit=50');
      const data = await res.json();
      state.savedCases = Array.isArray(data.cases) ? data.cases : [];
    } catch (_) {
      state.savedCases = [];
    } finally {
      state.loadingList = false;
      render();
    }
  }

  function render() {
    const a = state.analysis;
    container.innerHTML = `
      <div class="page-wrapper" style="max-width:1280px;margin:0 auto;padding:16px 20px;">
        <div style="margin-bottom:18px;">
          <h2 style="margin:0;font-size:1.4rem;color:var(--text-main);">📨 Trợ lý Xử lý Phản ánh, Kiến nghị (pakn.nq57.vn)</h2>
          <p style="margin:4px 0 0;color:var(--text-muted);font-size:0.92rem;">Tự động phân loại lĩnh vực, xác định đúng đơn vị chủ trì (6 Sở mới & chính quyền 2 cấp Tỉnh–Xã) và dự thảo Công văn chuẩn NĐ30.</p>
        </div>

        <div class="panel-group" style="margin-bottom:16px;">
          <h3 style="margin:0 0 12px;font-size:1.05rem;">1. Nhập nội dung Phản ánh, kiến nghị</h3>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px;">
            <div class="form-group">
              <label class="form-label">Mã hồ sơ PAKN</label>
              <input class="form-input" id="pakn-code" value="${escapeHtml(state.code)}" placeholder="VD: PAKN.2026.00123">
            </div>
            <div class="form-group">
              <label class="form-label">Loại văn bản dự thảo</label>
              <select class="form-input" id="pakn-type">
                <option value="chuyen_xu_ly" ${state.draftType === 'chuyen_xu_ly' ? 'selected' : ''}>Công văn chuyển đơn vị chủ trì xử lý</option>
                <option value="tra_loi" ${state.draftType === 'tra_loi' ? 'selected' : ''}>Công văn trả lời trực tiếp công dân</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Hạn xử lý</label>
              <input type="date" class="form-input" id="pakn-due" value="${escapeHtml(state.dueDate)}">
            </div>
            <div class="form-group">
              <label class="form-label">Người phản ánh (tùy chọn)</label>
              <input class="form-input" id="pakn-citizen" value="${escapeHtml(state.citizenInfo)}" placeholder="Họ tên / Doanh nghiệp (không cần nhập CCCD)">
            </div>
            <div class="form-group" style="grid-column:1/-1;">
              <label class="form-label">Nội dung phản ánh, kiến nghị *</label>
              <textarea class="form-textarea" id="pakn-content" rows="4" placeholder="Dán nguyên văn nội dung phản ánh từ cổng pakn.nq57.vn (hệ thống tự động ẩn danh SĐT/CCCD trước khi phân tích AI)...">${escapeHtml(state.content)}</textarea>
            </div>
          </div>
          <div style="margin-top:12px;display:flex;gap:10px;align-items:center;">
            <button class="btn btn-primary" id="pakn-analyze-btn" ${state.processing ? 'disabled' : ''}>
              ${state.processing ? '⏳ Đang phân loại & dự thảo...' : '✨ Phân loại thẩm quyền & Dự thảo Công văn NĐ30'}
            </button>
          </div>
        </div>

        ${a ? `
          <div class="panel-group" style="margin-bottom:16px;border-left:4px solid #0f766e;">
            <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px;margin-bottom:12px;">
              <h3 style="margin:0;font-size:1.1rem;">2. Kết quả phân loại & Dự thảo Công văn</h3>
              <div style="display:flex;gap:8px;flex-wrap:wrap;">
                <button class="btn btn-secondary" id="pakn-save-btn">💾 Lưu vào danh sách theo dõi</button>
                <button class="btn btn-success" id="pakn-docx-btn">⬇ Tải Công văn NĐ30 (.DOCX)</button>
              </div>
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin-bottom:12px;font-size:0.9rem;">
              <div><strong>Lĩnh vực:</strong> ${escapeHtml(a.field)}</div>
              <div><strong>Đơn vị chủ trì:</strong> <span style="color:#0f766e;font-weight:700;">${escapeHtml(a.assigned_unit)}</span></div>
              <div><strong>Đơn vị phối hợp:</strong> ${escapeHtml((a.coord_units || []).join('; ') || 'Không')}</div>
              <div><strong>Kính gửi:</strong> ${escapeHtml(a.kinh_gui || a.assigned_unit)}</div>
            </div>
            ${(a.legal_basis?.length) ? `<div style="margin-bottom:12px;font-size:0.88rem;"><strong>Căn cứ pháp lý đối chiếu:</strong><ul style="margin:4px 0 0 18px;">${a.legal_basis.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}</ul></div>` : ''}
            <div class="form-group">
              <label class="form-label">Trích yếu</label>
              <input class="form-input" id="pakn-edit-title" value="${escapeHtml(a.title || '')}">
            </div>
            <div class="form-group" style="margin-top:8px;">
              <label class="form-label">Nội dung dự thảo Công văn (có thể chỉnh sửa trước khi tải DOCX)</label>
              <textarea class="form-textarea" id="pakn-edit-draft" rows="8">${escapeHtml(a.draft_content || '')}</textarea>
            </div>
          </div>
        ` : ''}

        <div class="panel-group" style="overflow-x:auto;">
          <h3 style="margin:0 0 12px;font-size:1.05rem;">3. Hồ sơ PAKN đã lưu theo dõi (${state.savedCases.length})</h3>
          ${state.loadingList ? '<p style="color:var(--text-muted);">Đang tải danh sách...</p>' : (
            !state.savedCases.length
              ? '<p style="color:var(--text-muted);">Chưa có hồ sơ PAKN nào được lưu.</p>'
              : `<table style="width:100%;border-collapse:collapse;font-size:0.88rem;">
                  <thead>
                    <tr style="border-bottom:2px solid var(--border-color);text-align:left;">
                      <th style="padding:8px;">Mã hồ sơ</th>
                      <th style="padding:8px;">Trích yếu / Lĩnh vực</th>
                      <th style="padding:8px;">Đơn vị chủ trì</th>
                      <th style="padding:8px;">Trạng thái</th>
                      <th style="padding:8px;text-align:right;">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${state.savedCases.map((c) => {
                      const done = c.status === 'da_tra_loi';
                      return `<tr style="border-bottom:1px solid var(--border-color);">
                        <td style="padding:8px;font-weight:700;white-space:nowrap;">${escapeHtml(c.code)}</td>
                        <td style="padding:8px;">
                          <div style="font-weight:600;">${escapeHtml(c.title || c.content.slice(0, 80))}</div>
                          <div style="font-size:0.8rem;color:var(--text-muted);">${escapeHtml(c.field)}</div>
                        </td>
                        <td style="padding:8px;">${escapeHtml(c.assigned_unit)}</td>
                        <td style="padding:8px;white-space:nowrap;">
                          <span style="padding:3px 10px;border-radius:999px;font-size:0.8rem;font-weight:700;color:${done ? '#059669' : '#d97706'};background:${done ? '#ecfdf5' : '#fffbeb'};">${done ? 'Đã trả lời' : 'Đang xử lý'}</span>
                        </td>
                        <td style="padding:8px;text-align:right;white-space:nowrap;">
                          <button class="btn btn-sm btn-secondary pakn-toggle-st" data-id="${escapeHtml(c.id)}" data-done="${done ? '1' : '0'}">${done ? 'Mở lại' : '✓ Đã trả lời'}</button>
                          <button class="btn btn-sm btn-secondary pakn-del-st" data-id="${escapeHtml(c.id)}" style="color:#dc2626;margin-left:4px;">Xóa</button>
                        </td>
                      </tr>`;
                    }).join('')}
                  </tbody>
                </table>`
          )}
        </div>
      </div>
    `;

    const syncForm = () => {
      state.code = container.querySelector('#pakn-code')?.value?.trim() || '';
      state.draftType = container.querySelector('#pakn-type')?.value || 'chuyen_xu_ly';
      state.dueDate = container.querySelector('#pakn-due')?.value || '';
      state.citizenInfo = container.querySelector('#pakn-citizen')?.value?.trim() || '';
      state.content = container.querySelector('#pakn-content')?.value || '';
      if (state.analysis) {
        const t = container.querySelector('#pakn-edit-title')?.value;
        const d = container.querySelector('#pakn-edit-draft')?.value;
        if (t !== undefined) state.analysis.title = t;
        if (d !== undefined) state.analysis.draft_content = d;
      }
    };

    container.querySelector('#pakn-analyze-btn')?.addEventListener('click', async () => {
      syncForm();
      if (!state.content.trim()) { showToast('Vui lòng nhập nội dung phản ánh, kiến nghị.', 'error'); return; }
      state.processing = true;
      render();
      try {
        const m = state.dueDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        const dueDateVN = m ? `${m[3]}/${m[2]}/${m[1]}` : '';
        const prompt = buildPaknPrompt({
          code: state.code,
          content: state.content,
          citizenInfo: state.citizenInfo,
          draftType: state.draftType,
          dueDateVN,
        });
        const raw = await sendChatRequest([{ role: 'user', content: prompt }], null, { temperature: 0.1, timeoutMs: 90000, provider: 'gemini' });
        state.analysis = parseJsonSafe(raw);
        showToast('Đã phân loại thẩm quyền và dự thảo Công văn NĐ30!', 'success');
      } catch (err) {
        showToast('Lỗi phân tích PAKN: ' + err.message, 'error');
      } finally {
        state.processing = false;
        render();
      }
    });

    container.querySelector('#pakn-save-btn')?.addEventListener('click', async () => {
      syncForm();
      if (!state.analysis) return;
      try {
        const res = await backendFetch('/pakn', {
          method: 'POST',
          body: {
            code: state.code,
            title: state.analysis.title,
            content: state.content,
            citizen_info: state.citizenInfo,
            field: state.analysis.field,
            assigned_unit: state.analysis.assigned_unit,
            coord_units: state.analysis.coord_units || [],
            due_date: state.dueDate,
            legal_basis: state.analysis.legal_basis || [],
            draft_type: state.draftType,
            draft_content: state.analysis.draft_content,
          },
        });
        if (!res.ok) throw new Error((await res.json())?.error || 'Lỗi lưu hồ sơ');
        showToast('Đã lưu hồ sơ PAKN vào danh sách theo dõi!', 'success');
        loadCases();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    container.querySelector('#pakn-docx-btn')?.addEventListener('click', async () => {
      syncForm();
      if (!state.analysis) return;
      try {
        await exportPaknDocx(state.analysis, state);
        showToast('Đã xuất Công văn xử lý PAKN chuẩn NĐ30 (.DOCX)!', 'success');
      } catch (err) {
        showToast('Lỗi xuất DOCX: ' + err.message, 'error');
      }
    });

    container.querySelectorAll('.pakn-toggle-st').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const nextStatus = btn.dataset.done === '1' ? 'dang_xu_ly' : 'da_tra_loi';
        const res = await backendFetch(`/pakn/${btn.dataset.id}`, { method: 'PATCH', body: { status: nextStatus } });
        if (res.ok) loadCases();
      });
    });

    container.querySelectorAll('.pakn-del-st').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const res = await backendFetch(`/pakn/${btn.dataset.id}`, { method: 'DELETE' });
        if (res.ok) { showToast('Đã xóa hồ sơ PAKN.', 'success'); loadCases(); }
      });
    });
  }

  loadCases();
}
