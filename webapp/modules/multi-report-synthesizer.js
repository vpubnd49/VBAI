/**
 * Multi-Report Synthesizer Module — Tổng hợp Báo cáo Đa đơn vị (Sở + Xã/Phường)
 * Phục vụ báo cáo định kỳ Nghị quyết 57-NQ/TW, Chuyển đổi số & nhập liệu hệ thống nq57.vn
 */
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, WidthType, BorderStyle, VerticalAlign, LineRuleType,
} from 'docx';
import { saveAs } from 'file-saver';
import { parseUniversalFile } from './universal-doc-parser.js';
import { sendChatRequest } from './ai-proxy.js';
import { showToast } from './ui-utils.js';

const LAM_DONG_6_SO_MOI = [
  'Sở Tài chính',
  'Sở Xây dựng',
  'Sở Nông nghiệp và Môi trường',
  'Sở Khoa học và Công nghệ',
  'Sở Nội vụ',
  'Sở Dân tộc và Tôn giáo',
];

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
const THIN_BORDER = {
  top: { style: BorderStyle.SINGLE, size: 4, color: '333333' },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: '333333' },
  left: { style: BorderStyle.SINGLE, size: 4, color: '333333' },
  right: { style: BorderStyle.SINGLE, size: 4, color: '333333' },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: '333333' },
  insideVertical: { style: BorderStyle.SINGLE, size: 4, color: '333333' },
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
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('AI không trả về dữ liệu JSON hợp lệ.');
  }
  return JSON.parse(cleaned.slice(start, end + 1));
}

function buildSynthesizePrompt({ period, reportDate, expectedUnits, parsedDocs }) {
  const perDocLimit = parsedDocs.length > 15 ? 2800 : (parsedDocs.length > 6 ? 5000 : 8500);
  const docsBlock = parsedDocs.map((d, idx) => {
    const snippet = String(d.text || '').slice(0, perDocLimit);
    return `--- HỒ SƠ ${idx + 1}: ${d.name} ---\n${snippet}`;
  }).join('\n\n');

  const expectedLine = expectedUnits.length
    ? `Danh sách đơn vị dự kiến phải nộp (${expectedUnits.length} đơn vị): ${expectedUnits.join('; ')}.`
    : 'Không có danh sách đơn vị dự kiến cố định — tự nhận diện toàn bộ đơn vị từ các file tải lên.';

  return `Bạn là chuyên viên tổng hợp cao cấp tại Văn phòng UBND tỉnh Lâm Đồng, chuyên tổng hợp báo cáo Nghị quyết 57-NQ/TW và Chuyển đổi số từ nhiều Sở, ban, ngành và UBND các xã, phường, đặc khu phục vụ nhập liệu lên hệ thống nq57.vn.

THÔNG TIN KỲ BÁO CÁO:
- Kỳ báo cáo: ${period}
- Ngày lập báo cáo tổng hợp: ngày ${reportDate}
- ${expectedLine}

QUY TẮC BẮT BUỘC:
1. Mọi ngày tháng văn bản BẮT BUỘC định dạng "ngày DD/MM/YYYY" (ví dụ: "ngày 23/10/2026"), TUYỆT ĐỐI KHÔNG viết dài dạng "ngày 23 tháng 10 năm 2026".
2. Không bịa số liệu. Nếu đơn vị nào không ghi rõ số liệu thì ghi "Chưa báo cáo" và đưa vào mục canh_bao_so_lieu.
3. Đối chiếu với danh sách đơn vị dự kiến (nếu có) để liệt kê chính xác don_vi_chua_nop.
4. Phát hiện mâu thuẫn, thiếu sót hoặc số liệu bất thường giữa các báo cáo (canh_bao_so_lieu).
5. Viết văn phong hành chính chuẩn mực, súc tích, bám sát 5 mục chuẩn báo cáo nq57.vn.

CHỈ TRẢ VỀ JSON THUẦN (không markdown, không giải thích) theo cấu trúc sau:
{
  "trich_yeu": "Tổng hợp tình hình triển khai Nghị quyết số 57-NQ/TW và công tác chuyển đổi số (${period})",
  "don_vi_da_nop": [
    {
      "ten_don_vi": "Tên Sở/Xã",
      "ten_file": "Tên file gốc",
      "tong_nhiem_vu": "Số hoặc 'Chưa báo cáo'",
      "hoan_thanh": "Số hoặc 'Chưa báo cáo'",
      "dang_thuc_hien": "Số hoặc 'Chưa báo cáo'",
      "qua_han": "Số hoặc '0'",
      "ty_le_dvctt": "VD: 92,5% hoặc 'Chưa báo cáo'",
      "ty_le_so_hoa": "VD: 88,0% hoặc 'Chưa báo cáo'",
      "diem_nghen": "Tóm tắt ngắn điểm nghẽn chính",
      "kien_nghi": "Tóm tắt ngắn kiến nghị chính",
      "ghi_chu_kiem_tra": "Đầy đủ / Thiếu số liệu KPI / ..."
    }
  ],
  "don_vi_chua_nop": ["Tên đơn vị chưa thấy báo cáo"],
  "canh_bao_so_lieu": [
    "Cảnh báo cụ thể về đơn vị thiếu số liệu, lệch tổng hoặc chưa cập nhật mốc thời gian..."
  ],
  "noi_dung_bao_cao": {
    "phan_1_chi_dao": "Đoạn văn tổng hợp công tác chỉ đạo, điều hành và văn bản mới ban hành...",
    "phan_2_tien_do": "Đoạn văn tổng hợp tiến độ các nhiệm vụ NQ 57 được giao (tổng số, hoàn thành, trong hạn, quá hạn)...",
    "phan_3_kpi": "Đoạn văn tổng hợp kết quả KPI trọng tâm (DVC trực tuyến toàn trình, số hóa, Đề án 06, Học tập số, chỉ số 766/DTI)...",
    "phan_4_diem_nghen": "Đoạn văn phân nhóm các điểm nghẽn về Thể chế, Hạ tầng, Dữ liệu, Nhân lực, Kinh phí...",
    "phan_5_kien_nghi": "Đoạn văn tổng hợp đề xuất, kiến nghị cụ thể của các đơn vị và đề xuất chỉ đạo của UBND tỉnh..."
  }
}

DỮ LIỆU CÁC BÁO CÁO ĐƠN VỊ (${parsedDocs.length} tệp):
${docsBlock}`;
}

function exportAppendixCsv(result, period) {
  const headers = [
    'STT', 'Đơn vị báo cáo', 'Tên tệp nguồn', 'Tổng nhiệm vụ', 'Hoàn thành',
    'Đang thực hiện', 'Quá hạn', 'Tỷ lệ DVCTT', 'Tỷ lệ số hóa',
    'Điểm nghẽn chính', 'Kiến nghị chính', 'Tình trạng kiểm tra',
  ];
  const csvEsc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = (result.don_vi_da_nop || []).map((u, i) => [
    i + 1,
    u.ten_don_vi,
    u.ten_file,
    u.tong_nhiem_vu,
    u.hoan_thanh,
    u.dang_thuc_hien,
    u.qua_han,
    u.ty_le_dvctt,
    u.ty_le_so_hoa,
    u.diem_nghen,
    u.kien_nghi,
    u.ghi_chu_kiem_tra,
  ].map(csvEsc).join(','));

  const bom = '\uFEFF';
  const blob = new Blob([bom + headers.map(csvEsc).join(',') + '\n' + rows.join('\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  const slug = String(period || 'NQ57').replace(/[^\w\d]+/g, '_');
  saveAs(blob, `Phu_Luc_Tong_Hop_${slug}.csv`);
}

async function exportSynthesizedDocx(result, meta) {
  const ch = [];
  const lc = [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [new TextRun({ text: meta.co_quan_ban_hanh || 'ỦY BAN NHÂN DÂN TỈNH LÂM ĐỒNG', font: L.FONT, size: 26, bold: true })] }),
    new Paragraph({ spacing: { before: 20, after: 80 }, border: { top: { style: BorderStyle.SINGLE, size: 2, color: '000000', space: 1 } }, indent: { left: 1400, right: 1400 } }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [new TextRun({ text: meta.so_ky_hieu || 'Số:      /BC-UBND', font: L.FONT, size: 26 })] }),
  ];
  const rc = [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [new TextRun({ text: 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', font: L.FONT, size: 26, bold: true })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [new TextRun({ text: 'Độc lập - Tự do - Hạnh phúc', font: L.FONT, size: 28, bold: true })] }),
    new Paragraph({ spacing: { before: 20, after: 0 }, border: { top: { style: BorderStyle.SINGLE, size: 2, color: '000000', space: 1 } }, indent: { left: 1100, right: 1100 } }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [new TextRun({ text: `${meta.dia_danh || 'Lâm Đồng'}, ngày ${meta.reportDate}`, font: L.FONT, size: 28, italics: true })] }),
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

  ch.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 320, after: 60 }, children: [new TextRun({ text: 'BÁO CÁO', font: L.FONT, size: 28, bold: true })] }));
  ch.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: result.trich_yeu || 'Tổng hợp tình hình triển khai Nghị quyết số 57-NQ/TW và chuyển đổi số', font: L.FONT, size: 28, bold: true })] }));
  ch.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 40, after: 180 }, children: [new TextRun({ text: '_______________', font: L.FONT, size: 28 })] }));

  const sections = [
    ['I. TÌNH HÌNH CHỈ ĐẠO, ĐIỀU HÀNH', result.noi_dung_bao_cao?.phan_1_chi_dao],
    ['II. TIẾN ĐỘ THỰC HIỆN CÁC NHIỆM VỤ ĐƯỢC GIAO', result.noi_dung_bao_cao?.phan_2_tien_do],
    ['III. KẾT QUẢ CÁC CHỈ TIÊU TRỌNG TÂM (KPI)', result.noi_dung_bao_cao?.phan_3_kpi],
    ['IV. ĐIỂM NGHẼN, KHÓ KHĂN, VƯỚNG MẮC', result.noi_dung_bao_cao?.phan_4_diem_nghen],
    ['V. ĐỀ XUẤT, KIẾN NGHỊ', result.noi_dung_bao_cao?.phan_5_kien_nghi],
  ];

  sections.forEach(([heading, body], sIdx) => {
    ch.push(new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: { before: 180, after: 60 },
      indent: { firstLine: 567 },
      children: [new TextRun({ text: heading, font: L.FONT, size: 28, bold: true })],
    }));
    const lines = String(body || 'Chưa có dữ liệu tổng hợp.').split('\n').map((l) => l.trim()).filter(Boolean);
    lines.forEach((line, lIdx) => {
      let text = line;
      if (sIdx === sections.length - 1 && lIdx === lines.length - 1 && !text.endsWith('./.')) {
        text = text.replace(/\.$/, '') + './.';
      }
      ch.push(new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: BS,
        indent: { firstLine: 567 },
        children: [new TextRun({ text, font: L.FONT, size: 28 })],
      }));
    });
  });

  // Bảng phụ lục tổng hợp ngay trong báo cáo
  if (Array.isArray(result.don_vi_da_nop) && result.don_vi_da_nop.length) {
    ch.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 280, after: 100 },
      children: [new TextRun({ text: 'PHỤ LỤC TỔNG HỢP SỐ LIỆU CÁC ĐƠN VỊ', font: L.FONT, size: 26, bold: true })],
    }));
    const colWidths = [700, 2271, 1100, 1100, 1100, 1400, 1400];
    const headerLabels = ['STT', 'Đơn vị', 'Tổng NV', 'Hoàn thành', 'Quá hạn', 'DVCTT', 'Ghi chú'];
    const headerRow = new TableRow({
      children: headerLabels.map((lbl, idx) => new TableCell({
        width: { size: colWidths[idx], type: WidthType.DXA },
        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: lbl, font: L.FONT, size: 22, bold: true })] })],
      })),
    });
    const dataRows = result.don_vi_da_nop.map((u, idx) => new TableRow({
      children: [
        String(idx + 1),
        u.ten_don_vi || '',
        String(u.tong_nhiem_vu ?? ''),
        String(u.hoan_thanh ?? ''),
        String(u.qua_han ?? ''),
        String(u.ty_le_dvctt ?? ''),
        String(u.ghi_chu_kiem_tra ?? ''),
      ].map((val, cIdx) => new TableCell({
        width: { size: colWidths[cIdx], type: WidthType.DXA },
        children: [new Paragraph({ alignment: cIdx === 1 || cIdx === 6 ? AlignmentType.LEFT : AlignmentType.CENTER, children: [new TextRun({ text: val, font: L.FONT, size: 22 })] })],
      })),
    }));
    ch.push(new Table({
      width: { size: L.CW, type: WidthType.DXA },
      borders: THIN_BORDER,
      columnWidths: colWidths,
      rows: [headerRow, ...dataRows],
    }));
  }

  // Khối Nơi nhận & Chữ ký
  const nn = [
    new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: 'Nơi nhận:', font: L.FONT, size: 24, bold: true, italics: true })] }),
    new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: '- Thường trực Tỉnh ủy;', font: L.FONT, size: 22 })] }),
    new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: '- Ban Chỉ đạo NQ 57 tỉnh;', font: L.FONT, size: 22 })] }),
    new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: '- Chủ tịch, các PCT UBND tỉnh;', font: L.FONT, size: 22 })] }),
    new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: '- Các sở, ban, ngành; UBND các xã, phường, đặc khu;', font: L.FONT, size: 22 })] }),
    new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: '- Lưu: VT, TH.', font: L.FONT, size: 22 })] }),
  ];
  const sg = [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [new TextRun({ text: 'TM. ỦY BAN NHÂN DÂN', font: L.FONT, size: 28, bold: true })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [new TextRun({ text: 'CHỦ TỊCH', font: L.FONT, size: 28, bold: true })] }),
    new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: '', font: L.FONT, size: 28 })] }),
    new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: '', font: L.FONT, size: 28 })] }),
    new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: '', font: L.FONT, size: 28 })] }),
    new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: '', font: L.FONT, size: 28 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [new TextRun({ text: meta.nguoi_ky || '', font: L.FONT, size: 28, bold: true })] }),
  ];
  ch.push(new Paragraph({ spacing: { before: 200, after: 0 }, children: [] }));
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
    sections: [{
      properties: { page: { size: L.PAGE, margin: L.MARGIN } },
      children: ch,
    }],
  });
  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Bao_Cao_Tong_Hop_NQ57_${meta.reportDate.replace(/\//g, '-')}.docx`);
}

export function renderMultiReportSynthesizer(container) {
  const state = {
    files: [],
    period: 'Báo cáo tháng',
    reportDate: getTodayVN(),
    co_quan_ban_hanh: 'ỦY BAN NHÂN DÂN TỈNH LÂM ĐỒNG',
    dia_danh: 'Lâm Đồng',
    so_ky_hieu: 'Số:      /BC-UBND',
    nguoi_ky: '',
    expectedUnitsText: '',
    processing: false,
    progressMsg: '',
    result: null,
  };

  function render() {
    const res = state.result;
    container.innerHTML = `
      <div class="page-wrapper" style="max-width:1280px;margin:0 auto;padding:16px 20px;">
        <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:12px;margin-bottom:18px;">
          <div>
            <h2 style="margin:0;font-size:1.4rem;color:var(--text-main);">📊 Tổng hợp Báo cáo Đa đơn vị (Sở + Xã/Phường)</h2>
            <p style="margin:4px 0 0;color:var(--text-muted);font-size:0.92rem;">Tải đồng loạt nhiều file báo cáo (.docx, .pdf, .xlsx, .csv) → AI tự chuẩn hóa số liệu, phát hiện đơn vị thiếu/lệch và xuất Báo cáo NĐ30 + Phụ lục cho <a href="https://nq57.tracuu.lamdong.vn/" target="_blank" rel="noopener noreferrer" style="color:#0f766e;font-weight:700;">nq57.tracuu.lamdong.vn</a>.</p>
          </div>
          <a class="btn btn-secondary" href="https://nq57.tracuu.lamdong.vn/" target="_blank" rel="noopener noreferrer" style="text-decoration:none;">🔗 Mở cổng NQ 57 Lâm Đồng</a>
        </div>

        <div class="panel-group" style="margin-bottom:16px;">
          <h3 style="margin:0 0 12px;font-size:1.05rem;">1. Thông tin kỳ báo cáo & Danh sách đơn vị đối chiếu</h3>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;">
            <div class="form-group">
              <label class="form-label">Kỳ báo cáo</label>
              <select class="form-input" id="mrs-period">
                ${['Báo cáo tuần', 'Báo cáo tháng', 'Báo cáo quý', 'Báo cáo 6 tháng / Năm', 'Báo cáo đột xuất NQ 57'].map((p) => `<option value="${p}" ${state.period === p ? 'selected' : ''}>${p}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Ngày lập báo cáo (DD/MM/YYYY)</label>
              <input class="form-input" id="mrs-date" value="${escapeHtml(state.reportDate)}" placeholder="23/10/2026">
            </div>
            <div class="form-group">
              <label class="form-label">Cơ quan ban hành</label>
              <input class="form-input" id="mrs-cq" value="${escapeHtml(state.co_quan_ban_hanh)}">
            </div>
            <div class="form-group">
              <label class="form-label">Người ký (tùy chọn)</label>
              <input class="form-input" id="mrs-signer" value="${escapeHtml(state.nguoi_ky)}" placeholder="Họ và tên người ký">
            </div>
            <div class="form-group" style="grid-column:1/-1;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                <label class="form-label" style="margin:0;">Danh sách đơn vị phải nộp (mỗi đơn vị cách nhau bằng dấu chấm phẩy <code>;</code> — để tự động đối chiếu đơn vị chưa nộp)</label>
                <button type="button" class="btn btn-sm btn-secondary" id="mrs-fill-6so">+ Điền nhanh 6 Sở mới Lâm Đồng</button>
              </div>
              <textarea class="form-textarea" id="mrs-expected" rows="2" placeholder="VD: Sở Tài chính; Sở Khoa học và Công nghệ; UBND phường Xuân Hương - Đà Lạt...">${escapeHtml(state.expectedUnitsText)}</textarea>
            </div>
          </div>
        </div>

        <div class="panel-group" style="margin-bottom:16px;">
          <h3 style="margin:0 0 12px;font-size:1.05rem;">2. Tải lên báo cáo của các Sở / Xã (${state.files.length}/50 tệp)</h3>
          <div style="border:2px dashed var(--border-color);border-radius:10px;padding:22px;text-align:center;background:var(--bg-secondary,#f8fafc);">
            <input type="file" id="mrs-file-input" multiple accept=".docx,.doc,.pdf,.xlsx,.xls,.csv,.txt,.md" style="display:none;">
            <button type="button" class="btn btn-primary" id="mrs-pick-files">📁 Chọn nhiều file báo cáo (.docx, .pdf, .xlsx...)</button>
            <p style="margin:8px 0 0;font-size:0.85rem;color:var(--text-muted);">Hỗ trợ chọn tối đa 50 tệp cùng lúc. Tài liệu có dấu MẬT sẽ được hệ thống tự động chặn bảo vệ.</p>
          </div>
          ${state.files.length ? `
            <div style="margin-top:12px;display:flex;flex-wrap:wrap;gap:8px;">
              ${state.files.map((f, idx) => `
                <span style="display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:8px;background:var(--bg-card,#fff);border:1px solid var(--border-color);font-size:0.85rem;">
                  📄 ${escapeHtml(f.name)}
                  <button type="button" class="mrs-rm-file" data-idx="${idx}" style="border:none;background:none;color:#dc2626;cursor:pointer;font-weight:bold;">×</button>
                </span>
              `).join('')}
            </div>
            <div style="margin-top:14px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
              <button type="button" class="btn btn-success" id="mrs-run-btn" ${state.processing ? 'disabled' : ''}>
                ${state.processing ? '⏳ Đang tổng hợp...' : `✨ Tổng hợp ${state.files.length} báo cáo bằng AI`}
              </button>
              <button type="button" class="btn btn-secondary" id="mrs-clear-files" ${state.processing ? 'disabled' : ''}>Xóa tất cả tệp</button>
              ${state.progressMsg ? `<span style="font-size:0.88rem;color:var(--daquy-600,#0f766e);font-weight:600;">${escapeHtml(state.progressMsg)}</span>` : ''}
            </div>
          ` : ''}
        </div>

        ${res ? `
          <div class="panel-group" style="border-left:4px solid #0f766e;">
            <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px;margin-bottom:14px;">
              <h3 style="margin:0;font-size:1.15rem;">3. Kết quả Tổng hợp: ${escapeHtml(res.trich_yeu || '')}</h3>
              <div style="display:flex;gap:8px;flex-wrap:wrap;">
                <button type="button" class="btn btn-success" id="mrs-export-docx">⬇ Tải Báo cáo NĐ30 (.DOCX)</button>
                <button type="button" class="btn btn-secondary" id="mrs-export-csv">⬇ Tải Phụ lục Excel/CSV (nq57.vn)</button>
              </div>
            </div>

            ${(res.don_vi_chua_nop?.length || res.canh_bao_so_lieu?.length) ? `
              <div style="padding:12px 14px;border-radius:8px;background:#fef2f2;border:1px solid #fecaca;margin-bottom:14px;font-size:0.9rem;">
                ${res.don_vi_chua_nop?.length ? `<div style="margin-bottom:6px;"><strong>⚠️ Đơn vị chưa thấy báo cáo (${res.don_vi_chua_nop.length}):</strong> ${escapeHtml(res.don_vi_chua_nop.join(', '))}</div>` : ''}
                ${res.canh_bao_so_lieu?.length ? `<div><strong>🔍 Cảnh báo rà soát số liệu:</strong><ul style="margin:4px 0 0 18px;">${res.canh_bao_so_lieu.map((w) => `<li>${escapeHtml(w)}</li>`).join('')}</ul></div>` : ''}
              </div>
            ` : ''}

            <div style="overflow-x:auto;margin-bottom:18px;">
              <table style="width:100%;border-collapse:collapse;font-size:0.88rem;">
                <thead>
                  <tr style="border-bottom:2px solid var(--border-color);text-align:left;">
                    <th style="padding:8px;">Đơn vị</th>
                    <th style="padding:8px;">Tổng NV</th>
                    <th style="padding:8px;">Hoàn thành</th>
                    <th style="padding:8px;">Quá hạn</th>
                    <th style="padding:8px;">DVCTT</th>
                    <th style="padding:8px;">Số hóa</th>
                    <th style="padding:8px;">Điểm nghẽn chính</th>
                    <th style="padding:8px;">Kiểm tra</th>
                  </tr>
                </thead>
                <tbody>
                  ${(res.don_vi_da_nop || []).map((u) => `
                    <tr style="border-bottom:1px solid var(--border-color);">
                      <td style="padding:8px;font-weight:600;">${escapeHtml(u.ten_don_vi)}</td>
                      <td style="padding:8px;">${escapeHtml(u.tong_nhiem_vu)}</td>
                      <td style="padding:8px;">${escapeHtml(u.hoan_thanh)}</td>
                      <td style="padding:8px;color:${Number(u.qua_han) > 0 ? '#dc2626' : 'inherit'};font-weight:${Number(u.qua_han) > 0 ? '700' : '400'};">${escapeHtml(u.qua_han)}</td>
                      <td style="padding:8px;">${escapeHtml(u.ty_le_dvctt)}</td>
                      <td style="padding:8px;">${escapeHtml(u.ty_le_so_hoa)}</td>
                      <td style="padding:8px;max-width:280px;">${escapeHtml(u.diem_nghen)}</td>
                      <td style="padding:8px;">${escapeHtml(u.ghi_chu_kiem_tra)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>

            <div style="display:grid;gap:12px;font-size:0.95rem;line-height:1.6;">
              <div><strong>I. Tình hình chỉ đạo, điều hành:</strong><div style="white-space:pre-line;margin-top:4px;">${escapeHtml(res.noi_dung_bao_cao?.phan_1_chi_dao || '')}</div></div>
              <div><strong>II. Tiến độ thực hiện nhiệm vụ NQ 57:</strong><div style="white-space:pre-line;margin-top:4px;">${escapeHtml(res.noi_dung_bao_cao?.phan_2_tien_do || '')}</div></div>
              <div><strong>III. Kết quả các chỉ tiêu trọng tâm (KPI):</strong><div style="white-space:pre-line;margin-top:4px;">${escapeHtml(res.noi_dung_bao_cao?.phan_3_kpi || '')}</div></div>
              <div><strong>IV. Điểm nghẽn, khó khăn, vướng mắc:</strong><div style="white-space:pre-line;margin-top:4px;">${escapeHtml(res.noi_dung_bao_cao?.phan_4_diem_nghen || '')}</div></div>
              <div><strong>V. Đề xuất, kiến nghị:</strong><div style="white-space:pre-line;margin-top:4px;">${escapeHtml(res.noi_dung_bao_cao?.phan_5_kien_nghi || '')}</div></div>
            </div>
          </div>
        ` : ''}
      </div>
    `;

    const syncInputs = () => {
      state.period = container.querySelector('#mrs-period')?.value || state.period;
      state.reportDate = container.querySelector('#mrs-date')?.value?.trim() || state.reportDate;
      state.co_quan_ban_hanh = container.querySelector('#mrs-cq')?.value?.trim() || state.co_quan_ban_hanh;
      state.nguoi_ky = container.querySelector('#mrs-signer')?.value?.trim() || '';
      state.expectedUnitsText = container.querySelector('#mrs-expected')?.value || '';
    };

    container.querySelector('#mrs-fill-6so')?.addEventListener('click', () => {
      syncInputs();
      state.expectedUnitsText = LAM_DONG_6_SO_MOI.join('; ');
      render();
    });

    const fileInput = container.querySelector('#mrs-file-input');
    container.querySelector('#mrs-pick-files')?.addEventListener('click', () => {
      syncInputs();
      fileInput?.click();
    });
    fileInput?.addEventListener('change', (e) => {
      const picked = Array.from(e.target.files || []);
      if (!picked.length) return;
      const merged = [...state.files, ...picked].slice(0, 50);
      state.files = merged;
      render();
    });

    container.querySelectorAll('.mrs-rm-file').forEach((btn) => {
      btn.addEventListener('click', () => {
        syncInputs();
        state.files.splice(Number(btn.dataset.idx), 1);
        render();
      });
    });

    container.querySelector('#mrs-clear-files')?.addEventListener('click', () => {
      syncInputs();
      state.files = [];
      state.result = null;
      render();
    });

    container.querySelector('#mrs-run-btn')?.addEventListener('click', async () => {
      syncInputs();
      if (!state.files.length) return;
      state.processing = true;
      state.result = null;
      state.progressMsg = `Đang đọc 0/${state.files.length} tệp...`;
      render();

      try {
        const parsedDocs = [];
        for (let i = 0; i < state.files.length; i += 1) {
          const f = state.files[i];
          state.progressMsg = `Đang đọc tệp ${i + 1}/${state.files.length}: ${f.name}`;
          render();
          const parsed = await parseUniversalFile(f, () => {});
          parsedDocs.push({ name: f.name, text: parsed?.text || '' });
        }

        state.progressMsg = `Đang tổng hợp và đối chiếu số liệu ${parsedDocs.length} báo cáo bằng AI...`;
        render();

        const expectedUnits = state.expectedUnitsText
          .split(/[;\n]+/)
          .map((s) => s.trim())
          .filter(Boolean);
        const prompt = buildSynthesizePrompt({
          period: state.period,
          reportDate: state.reportDate,
          expectedUnits,
          parsedDocs,
        });

        const rawResp = await sendChatRequest(
          [{ role: 'user', content: prompt }],
          null,
          { temperature: 0.1, timeoutMs: 180000, provider: 'gemini' }
        );
        state.result = parseJsonSafe(rawResp);
        showToast(`Đã tổng hợp thành công ${parsedDocs.length} báo cáo!`, 'success');
      } catch (err) {
        showToast('Lỗi tổng hợp báo cáo: ' + err.message, 'error');
      } finally {
        state.processing = false;
        state.progressMsg = '';
        render();
      }
    });

    container.querySelector('#mrs-export-docx')?.addEventListener('click', async () => {
      syncInputs();
      try {
        await exportSynthesizedDocx(state.result, state);
        showToast('Đã xuất Báo cáo tổng hợp chuẩn NĐ30 (.DOCX)!', 'success');
      } catch (err) {
        showToast('Lỗi xuất DOCX: ' + err.message, 'error');
      }
    });

    container.querySelector('#mrs-export-csv')?.addEventListener('click', () => {
      exportAppendixCsv(state.result, state.period);
      showToast('Đã xuất Phụ lục số liệu Excel/CSV phục vụ nq57.vn!', 'success');
    });
  }

  render();
}
