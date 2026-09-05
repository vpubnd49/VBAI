/**
 * docx-highlighter.js - Xuất DOCX với lỗi được tô màu đỏ (Track Changes style)
 * Từ sai: gạch xuyên đỏ | Từ đúng: xanh lá kế bên
 * Sử dụng thư viện docx (đã có sẵn trong project)
 */

import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle, Table, TableRow, TableCell, WidthType } from 'docx';
import { saveAs } from 'file-saver';

/**
 * Áp dụng corrections vào đoạn text, trả về mảng TextRun segments
 * @param {string} text - Đoạn text gốc
 * @param {Array} errors - Danh sách lỗi từ spell checker
 * @returns {TextRun[]}
 */
function buildTextRunsWithHighlight(text, errors) {
  if (!errors || errors.length === 0) {
    return [new TextRun({ text })];
  }

  // Tìm vị trí các lỗi trong text
  const replacements = []; // { start, end, wrong, correct, reason }

  for (const err of errors) {
    const { wrong, correct, context } = err;
    if (!wrong || wrong === correct) continue;

    let searchFrom = 0;
    let found = false;

    // Nếu có context, tìm vị trí chính xác hơn
    if (context) {
      const ctxIdx = text.indexOf(context.replace(wrong, '').trim().slice(0, 10));
      if (ctxIdx !== -1) searchFrom = Math.max(0, ctxIdx - 5);
    }

    const idx = text.indexOf(wrong, searchFrom);
    if (idx !== -1) {
      // Kiểm tra không overlap với replacement đã có
      const overlaps = replacements.some(r => r.start < idx + wrong.length && r.end > idx);
      if (!overlaps) {
        replacements.push({ start: idx, end: idx + wrong.length, wrong, correct, reason: err.reason });
        found = true;
      }
    }

    // Nếu không tìm thấy với searchFrom, thử từ đầu
    if (!found) {
      const idx2 = text.indexOf(wrong);
      if (idx2 !== -1) {
        const overlaps = replacements.some(r => r.start < idx2 + wrong.length && r.end > idx2);
        if (!overlaps) {
          replacements.push({ start: idx2, end: idx2 + wrong.length, wrong, correct, reason: err.reason });
        }
      }
    }
  }

  // Sắp xếp theo vị trí
  replacements.sort((a, b) => a.start - b.start);

  const runs = [];
  let cursor = 0;

  for (const rep of replacements) {
    // Text trước lỗi (màu bình thường)
    if (rep.start > cursor) {
      const before = text.slice(cursor, rep.start);
      if (before) runs.push(new TextRun({ text: before }));
    }

    // Từ sai: gạch xuyên đỏ + nền đỏ nhạt
    runs.push(new TextRun({
      text: rep.wrong,
      color: 'CC0000',
      strike: true,
      shading: { fill: 'FFE4E4' },
    }));

    // Dấu mũi tên và từ đúng: xanh lá đậm + bold
    runs.push(new TextRun({
      text: ` → ${rep.correct}`,
      color: '166534',
      bold: true,
      shading: { fill: 'DCFCE7' },
    }));

    cursor = rep.end;
  }

  // Phần text còn lại
  if (cursor < text.length) {
    runs.push(new TextRun({ text: text.slice(cursor) }));
  }

  return runs.length > 0 ? runs : [new TextRun({ text })];
}

/**
 * Tạo DOCX với các lỗi được đánh dấu màu đỏ
 * @param {string} originalText - Văn bản gốc
 * @param {import('./spell-checker.js').SpellCheckResult} spellResult - Kết quả kiểm tra
 * @param {string} filename - Tên file gốc (không bắt buộc)
 * @returns {Promise<Blob>} DOCX blob
 */
export async function generateHighlightedDocx(originalText, spellResult, filename = 'kiem-tra-chinh-ta') {
  const { errors, score, errorCount, summary, totalWords } = spellResult;

  // === Header Info Table ===
  const headerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: '📊 KẾT QUẢ KIỂM TRA', bold: true, size: 22, color: '0F766E' })] })],
            shading: { fill: 'F0FFFE' },
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: `Điểm: ${score}/100  |  Lỗi: ${errorCount}  |  Từ: ${totalWords}`, color: score >= 90 ? '059669' : score >= 70 ? 'D97706' : 'DC2626' })] })],
            shading: { fill: 'F0FFFE' },
          }),
        ],
      }),
    ],
  });

  // === Summary paragraph ===
  const summaryPara = new Paragraph({
    children: [
      new TextRun({ text: '📝 Nhận xét: ', bold: true, color: '374151' }),
      new TextRun({ text: summary || `Văn bản có ${errorCount} lỗi cần chỉnh sửa.`, color: '374151', italics: true }),
    ],
    spacing: { before: 200, after: 200 },
  });

  // === Legend ===
  const legendPara = new Paragraph({
    children: [
      new TextRun({ text: 'CHÚ THÍCH: ', bold: true }),
      new TextRun({ text: 'từ sai', color: 'CC0000', strike: true, shading: { fill: 'FFE4E4' } }),
      new TextRun({ text: ' → ', bold: true }),
      new TextRun({ text: 'từ đúng', color: '166534', bold: true, shading: { fill: 'DCFCE7' } }),
    ],
    spacing: { after: 300 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
    },
  });

  // === Error Summary Table ===
  const errorSummaryRows = [
    new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '#', bold: true })] })], width: { size: 5, type: WidthType.PERCENTAGE } }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Từ sai', bold: true })] })], width: { size: 20, type: WidthType.PERCENTAGE } }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Từ đúng', bold: true })] })], width: { size: 20, type: WidthType.PERCENTAGE } }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Loại lỗi', bold: true })] })], width: { size: 15, type: WidthType.PERCENTAGE } }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Lý do', bold: true })] })], width: { size: 40, type: WidthType.PERCENTAGE } }),
      ],
      tableHeader: true,
    }),
  ];

  const typeMap = { spelling: 'Chính tả', grammar: 'Ngữ pháp', style: 'Văn phong', nd30: 'Thể thức NĐ30' };
  errors.forEach((err, idx) => {
    errorSummaryRows.push(new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(idx + 1) })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: err.wrong || '', color: 'CC0000', strike: true })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: err.correct || '', color: '166534', bold: true })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: typeMap[err.type] || err.type || '' })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: err.reason || '' })] })] }),
      ],
    }));
  });

  const errorTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: errorSummaryRows,
  });

  // === Main content with highlights ===
  const contentHeading = new Paragraph({
    children: [new TextRun({ text: 'VĂN BẢN ĐÃ CHỈNH SỬA:', bold: true, color: '0F766E', size: 24 })],
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 400, after: 200 },
  });

  // Chia văn bản thành các đoạn (paragraph)
  const paragraphs_text = originalText.split('\n');
  const contentParagraphs = paragraphs_text.map(line => {
    const runs = buildTextRunsWithHighlight(line || ' ', errors);
    return new Paragraph({
      children: runs,
      spacing: { after: 120 },
    });
  });

  // === Build document ===
  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        // Title
        new Paragraph({
          children: [new TextRun({ text: `KẾT QUẢ KIỂM TRA VĂN BẢN: ${filename}`, bold: true, size: 28, color: '0F766E' })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [new TextRun({ text: `Ngày kiểm tra: ${new Date().toLocaleString('vi-VN')}`, color: '6B7280', italics: true })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 300 },
        }),
        headerTable,
        summaryPara,
        ...(errorCount > 0 ? [
          new Paragraph({
            children: [new TextRun({ text: 'DANH SÁCH LỖI CHI TIẾT:', bold: true, color: '374151' })],
            spacing: { before: 200, after: 100 },
          }),
          errorTable,
        ] : []),
        legendPara,
        contentHeading,
        ...contentParagraphs,
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  return blob;
}

/**
 * Tải xuống DOCX đã highlight
 * @param {string} text - Văn bản gốc
 * @param {object} spellResult - Kết quả kiểm tra
 * @param {string} originalFilename - Tên file gốc
 */
export async function downloadHighlightedDocx(text, spellResult, originalFilename = 'van-ban') {
  const base = originalFilename.replace(/\.[^/.]+$/, ''); // bỏ extension
  const blob = await generateHighlightedDocx(text, spellResult, originalFilename);
  saveAs(blob, `${base}_chinh-ta-da-kiem-tra.docx`);
}
