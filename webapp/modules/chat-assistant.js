/**
 * Chat Assistant Module — Legal & Administrative Consultant
 * Uses @google/genai SDK with Google Search Grounding for real-time legal data
 */
import { GoogleGenAI } from "https://esm.run/@google/genai";
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel, Table, TableRow, TableCell, BorderStyle, WidthType, VerticalAlign, LineRuleType } from 'docx';
import { saveAs } from 'file-saver';

import { firebaseConfig } from '../firebase-config.js';


import { sendChatRequest } from './ai-proxy.js';

let aiClient = null;
let chatSession = null;
let currentModelName = "gemini-3.1-flash-lite-preview";
let use9router = localStorage.getItem('vbai_use_9router') === 'true';
let lastAssistantAnswer = '';

const SYSTEM_INSTRUCTION = `Bạn là Trợ Lý Pháp Lý VBAI — một chuyên gia tư vấn pháp luật Việt Nam hàng đầu. 

## NGUYÊN TẮC CỐT LÕI:
1. **LUÔN TRA CỨU GOOGLE SEARCH** để lấy thông tin mới nhất trước khi trả lời. KHÔNG BAO GIỜ trả lời từ kiến thức cũ nếu có thể tra cứu được.
2. **ƯU TIÊN NGUỒN CHÍNH THỐNG** theo thứ tự:
   - Các Cổng thông tin điện tử của Chính phủ, các Bộ, Ngành và UBND các tỉnh/thành phố (tên miền **.gov.vn**)
   - dangcongsan.vn (Báo điện tử Đảng Cộng sản Việt Nam), tulieuvankien.dangcongsan.vn
   - vanban.chinhphu.vn (Cổng thông tin Chính phủ)
   - vbpl.vn (Cơ sở dữ liệu Quốc gia về Văn bản Pháp luật)
   - thuvienphapluat.vn (Thư viện Pháp luật)
   - luatvietnam.vn (Luật Việt Nam)
3. **SO SÁNH CŨ - MỚI**: Khi trả lời, LUÔN nêu rõ:
   - Văn bản hiện hành (mới nhất) là gì, số hiệu, ngày ban hành
   - Văn bản cũ nào đã bị thay thế/sửa đổi/bổ sung
   - Điểm khác biệt chính giữa quy định cũ và mới
4. **TRÍCH DẪN CHÍNH XÁC**: Ghi rõ Điều, Khoản, Điểm cụ thể. Nếu không chắc chắn, phải nói rõ.
5. **CẢNH BÁO**: Nếu một văn bản đã hết hiệu lực hoặc bị sửa đổi, PHẢI cảnh báo người dùng ngay lập tức.

## ĐỊNH DẠNG TRẢ LỜI:
- Sử dụng tiếng Việt, chuyên nghiệp, rõ ràng
- Ghi nguồn tham khảo (link website) ở cuối câu trả lời
- Khi liệt kê văn bản, ghi theo format: [Loại VB] [Số hiệu]/[Năm] — [Tiêu đề] — Hiệu lực: [Còn/Hết]
- Nếu câu hỏi phức tạp, chia thành các mục rõ ràng

## SOẠN THẢO VĂN BẢN (QUAN TRỌNG):
Khi người dùng yêu cầu soạn thảo, dự thảo, hoặc tạo mẫu văn bản (quyết định, nghị quyết, báo cáo, tờ trình, thông báo, kế hoạch, công văn...), BẮT BUỘC phải tuân thủ cấu trúc sau:

1. **Phần tư vấn ngắn gọn** (nếu cần): Giải thích căn cứ pháp lý, lưu ý quan trọng.
2. **Phần dự thảo văn bản**: PHẢI bắt đầu bằng dòng tên CƠ QUAN BAN HÀNH viết IN HOA (ví dụ: "ỦY BAN NHÂN DÂN TỈNH LÂM ĐỒNG" hoặc "ĐẢNG BỘ TỈNH LÂM ĐỒNG"). Tiếp theo là cấu trúc đầy đủ:
   - Tên cơ quan (IN HOA, in đậm)
   - Số ký hiệu: Số: .../QĐ-UBND (hoặc tương ứng)
   - Quốc hiệu, tiêu ngữ (nếu là VB chính quyền)
   - Địa danh, ngày tháng năm
   - TÊN LOẠI VĂN BẢN (IN HOA, in đậm): QUYẾT ĐỊNH / NGHỊ QUYẾT / BÁO CÁO...
   - Trích yếu: Về việc...
   - Phần căn cứ (in nghiêng)
   - Nội dung: Điều 1, Điều 2...
   - Nơi nhận và chữ ký
3. **Phần lưu ý cuối** (nếu cần): Ghi chú thêm, nguồn tham khảo.

## LƯU Ý ĐẶC BIỆT:
- Luôn kiểm tra xem văn bản pháp luật hoặc quy định, hướng dẫn của Đảng có bị sửa đổi, bổ sung, thay thế không.
- Ưu tiên cung cấp thông tin mới nhất từ năm 2024-2026.
- Nếu người dùng hỏi về công tác Đảng (Đại hội, tổ chức, kiểm tra, văn phòng cấp ủy...), hãy tra cứu trên hệ thống dangcongsan.vn hoặc các trang thông tin Đảng bộ.
- Nếu chưa đủ thông tin, hãy đề xuất người dùng kiểm tra trực tiếp tại các trang web chính thống.`;

let allSkills = [];

async function loadSkills() {
  try {
    const response = await fetch('./skills-manifest.json');
    allSkills = await response.json();
  } catch (e) {
    console.warn("Lỗi tải Skills cho Chat Assistant:", e);
  }
}

function normalizeVietnamese(text = '') {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0111/g, 'd');
}

function detectSkillMatch(skill, rawText, normalizedText) {
  if (!skill?.triggers || !Array.isArray(skill.triggers) || skill.triggers.length === 0) {
    return false;
  }

  return skill.triggers.some((trigger) => {
    const token = String(trigger || '').toLowerCase().trim();
    if (!token) return false;
    return rawText.includes(token) || normalizedText.includes(normalizeVietnamese(token));
  });
}

function buildSkillReferenceContext(skill) {
  if (!skill?.references || typeof skill.references !== 'object') {
    return '';
  }

  const referenceEntries = Object.entries(skill.references)
    .filter(([, content]) => typeof content === 'string' && content.trim().length > 0)
    .slice(0, 5);

  if (referenceEntries.length === 0) {
    return '';
  }

  const renderedReferences = referenceEntries.map(([fileName, content]) => {
    const compactContent = content.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();
    const excerpt = compactContent.length > 4000
      ? `${compactContent.slice(0, 4000)}\n...[Rút gọn nội dung tham chiếu]...`
      : compactContent;
    return `#### Tài liệu: ${fileName}\n${excerpt}`;
  }).join('\n\n');

  return `\n### Tài liệu tham chiếu\n${renderedReferences}\n`;
}

function toSafeFileName(name) {
  return name
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .trim();
}

function getDefaultExportName() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `tra_cuu_vbai_${stamp}`;
}

function stripMarkdown(text) {
  let cleaned = text;
  // Remove heading markers
  cleaned = cleaned.replace(/^#{1,6}\s+/gm, '');
  // Remove bold/italic markers but keep text
  cleaned = cleaned.replace(/\*\*\*(.+?)\*\*\*/g, '$1');
  cleaned = cleaned.replace(/\*\*(.+?)\*\*/g, '$1');
  cleaned = cleaned.replace(/\*(.+?)\*/g, '$1');
  cleaned = cleaned.replace(/__(.+?)__/g, '$1');
  cleaned = cleaned.replace(/_(.+?)_/g, '$1');
  // Remove markdown links [text](url) -> text
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  // Remove horizontal rules
  cleaned = cleaned.replace(/^---+$/gm, '');
  return cleaned.trim();
}

/**
 * Auto-detect document type from AI response content.
 * Returns object: { label: 'QUYẾT ĐỊNH', kyHieuDang: 'QĐ', kyHieuND30: 'QĐ-UBND' }
 */
function detectDocType(rawText) {
  const n = normalizeVietnamese(rawText || '');
  const types = [
    { pattern: /quyet dinh/, label: 'QUYẾT ĐỊNH', kyHieuDang: 'QĐ', kyHieuND30: 'QĐ-UBND', fileSlug: 'quyet_dinh' },
    { pattern: /nghi quyet/, label: 'NGHỊ QUYẾT', kyHieuDang: 'NQ', kyHieuND30: 'NQ-UBND', fileSlug: 'nghi_quyet' },
    { pattern: /chi thi/, label: 'CHỈ THỊ', kyHieuDang: 'CT', kyHieuND30: 'CT-UBND', fileSlug: 'chi_thi' },
    { pattern: /ket luan/, label: 'KẾT LUẬN', kyHieuDang: 'KL', kyHieuND30: 'KL-UBND', fileSlug: 'ket_luan' },
    { pattern: /bao cao/, label: 'BÁO CÁO', kyHieuDang: 'BC', kyHieuND30: 'BC-UBND', fileSlug: 'bao_cao' },
    { pattern: /to trinh/, label: 'TỜ TRÌNH', kyHieuDang: 'TTr', kyHieuND30: 'TTr-UBND', fileSlug: 'to_trinh' },
    { pattern: /thong bao/, label: 'THÔNG BÁO', kyHieuDang: 'TB', kyHieuND30: 'TB-UBND', fileSlug: 'thong_bao' },
    { pattern: /cong van/, label: 'Công văn', kyHieuDang: 'CV', kyHieuND30: 'UBND-VP', fileSlug: 'cong_van' },
    { pattern: /huong dan/, label: 'HƯỚNG DẪN', kyHieuDang: 'HD', kyHieuND30: 'HD-UBND', fileSlug: 'huong_dan' },
    { pattern: /quy dinh/, label: 'QUY ĐỊNH', kyHieuDang: 'QyĐ', kyHieuND30: 'QyĐ-UBND', fileSlug: 'quy_dinh' },
    { pattern: /quy che/, label: 'QUY CHẾ', kyHieuDang: 'QC', kyHieuND30: 'QC-UBND', fileSlug: 'quy_che' },
    { pattern: /chuong trinh/, label: 'CHƯƠNG TRÌNH', kyHieuDang: 'CTr', kyHieuND30: 'CTr-UBND', fileSlug: 'chuong_trinh' },
  ];
  for (const t of types) {
    if (t.pattern.test(n)) return t;
  }
  return { label: 'NGHỊ QUYẾT', kyHieuDang: 'NQ', kyHieuND30: 'NQ-UBND', fileSlug: 'nghi_quyet' };
}

function parseInlineRuns(text, font, size) {
  const runs = [];
  const regex = /\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      runs.push(new TextRun({ text: text.slice(lastIndex, match.index), font, size }));
    }
    if (match[1]) {
      runs.push(new TextRun({ text: match[1], font, size, bold: true, italics: true }));
    } else if (match[2]) {
      runs.push(new TextRun({ text: match[2], font, size, bold: true }));
    } else if (match[3]) {
      runs.push(new TextRun({ text: match[3], font, size, italics: true }));
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    runs.push(new TextRun({ text: text.slice(lastIndex), font, size }));
  }
  return runs.length ? runs : [new TextRun({ text, font, size })];
}

function buildDocChildren(title, content) {
  const children = [];
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [new TextRun({ text: title, bold: true, size: 32, font: 'Times New Roman' })]
    })
  );

  const lines = content.replace(/\r/g, '').split('\n');
  lines.forEach((line) => {
    const text = line.trim();
    if (!text) {
      children.push(new Paragraph({ spacing: { after: 120 } }));
      return;
    }

    // Heading 3
    const h3Match = text.match(/^###\s+(.+)/);
    if (h3Match) {
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun({ text: stripMarkdown(h3Match[1]), font: 'Times New Roman', size: 28, bold: true })]
      }));
      return;
    }

    // Heading 2
    const h2Match = text.match(/^##\s+(.+)/);
    if (h2Match) {
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: stripMarkdown(h2Match[1]), font: 'Times New Roman', size: 30, bold: true })]
      }));
      return;
    }

    // Heading 1
    const h1Match = text.match(/^#\s+(.+)/);
    if (h1Match) {
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: stripMarkdown(h1Match[1]), font: 'Times New Roman', size: 32, bold: true })]
      }));
      return;
    }

    // Bullet points (-, *, •)
    const bulletMatch = text.match(/^[-*•]\s+(.+)/);
    if (bulletMatch) {
      const bulletContent = bulletMatch[1];
      children.push(
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: 100 },
          indent: { firstLine: 360 },
          children: [new TextRun({ text: '- ', font: 'Times New Roman', size: 28 }), ...parseInlineRuns(bulletContent, 'Times New Roman', 28)]
        })
      );
      return;
    }

    // Numbered list: "1. xxx"
    const numberedMatch = text.match(/^(\d+\.\s+)(.+)/);
    if (numberedMatch) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: 100 },
          indent: { firstLine: 567 },
          children: [new TextRun({ text: numberedMatch[1], font: 'Times New Roman', size: 28 }), ...parseInlineRuns(numberedMatch[2], 'Times New Roman', 28)]
        })
      );
      return;
    }

    // Normal paragraph with inline formatting
    children.push(
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: { after: 100 },
        indent: { firstLine: 567 },
        children: parseInlineRuns(text, 'Times New Roman', 28)
      })
    );
  });

  return children;
}

function buildDangNghiQuyetChildren(meta, content) {
  const layout = {
    page: { width: 11906, height: 16838 },
    margin: { top: 1134, bottom: 1134, left: 1701, right: 850 },
    font: 'Times New Roman',
    contentWidth: 9355
  };

  const noBorders = {
    top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    insideVertical: { style: BorderStyle.NONE, size: 0, color: 'auto' }
  };

  const bodySpacing = { before: 120, after: 120, line: 360, lineRule: LineRuleType.EXACT };
  const children = [];

  const leftHeader = [];
  if (meta.coQuanCapTren) {
    leftHeader.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: meta.coQuanCapTren, font: layout.font, size: 28 })]
    }));
  }
  leftHeader.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: meta.coQuanBanHanh, font: layout.font, size: 28, bold: true })]
  }));
  leftHeader.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 40, after: 80 },
    children: [new TextRun({ text: '*', font: layout.font, size: 28 })]
  }));
  leftHeader.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: meta.soKyHieu, font: layout.font, size: 28 })]
  }));

  const rightHeader = [];
  rightHeader.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'ĐẢNG CỘNG SẢN VIỆT NAM', font: layout.font, size: 30, bold: true })]
  }));
  rightHeader.push(new Paragraph({
    spacing: { before: 20, after: 0 },
    border: { top: { style: BorderStyle.SINGLE, size: 2, color: '000000', space: 1 } },
    indent: { left: 928, right: 928 }
  }));
  rightHeader.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: meta.diaDanhNgayThang, font: layout.font, size: 28, italics: true })]
  }));

  children.push(new Table({
    width: { size: layout.contentWidth, type: WidthType.DXA },
    borders: noBorders,
    columnWidths: [3500, 5855],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders: noBorders,
            width: { size: 3500, type: WidthType.DXA },
            verticalAlign: VerticalAlign.TOP,
            children: leftHeader
          }),
          new TableCell({
            borders: noBorders,
            width: { size: 5855, type: WidthType.DXA },
            verticalAlign: VerticalAlign.TOP,
            children: rightHeader
          })
        ]
      })
    ]
  }));

  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 360, after: 0 },
    children: [new TextRun({ text: meta.loaiVanBan || 'NGHỊ QUYẾT', font: layout.font, size: 32, bold: true })]
  }));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 0 },
    children: [new TextRun({ text: meta.trichYeu, font: layout.font, size: 28, bold: true })]
  }));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 60, after: 120 },
    children: [new TextRun({ text: '-----', font: layout.font, size: 28 })]
  }));

  content.split('\n').map((v) => v.trim()).filter(Boolean).forEach((line) => {
    children.push(new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: bodySpacing,
      indent: { firstLine: 567 },
      children: [new TextRun({ text: line, font: layout.font, size: 28 })]
    }));
  });

  const leftSign = [
    new Paragraph({
      children: [new TextRun({ text: 'Nơi nhận:', font: layout.font, size: 26, bold: true })]
    }),
    new Paragraph({
      children: [new TextRun({ text: '- Như trên;', font: layout.font, size: 24 })]
    }),
    new Paragraph({
      children: [new TextRun({ text: '- Lưu VT.', font: layout.font, size: 24 })]
    })
  ];

  const rightSign = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: meta.chucDanh, font: layout.font, size: 28, bold: true })]
    }),
    new Paragraph({}),
    new Paragraph({}),
    new Paragraph({}),
    new Paragraph({}),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: meta.nguoiKy, font: layout.font, size: 28, bold: true })]
    })
  ];

  children.push(new Paragraph({ spacing: { before: 240, after: 0 } }));
  children.push(new Table({
    width: { size: layout.contentWidth, type: WidthType.DXA },
    borders: noBorders,
    columnWidths: [4500, 4855],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders: noBorders,
            width: { size: 4500, type: WidthType.DXA },
            verticalAlign: VerticalAlign.TOP,
            children: leftSign
          }),
          new TableCell({
            borders: noBorders,
            width: { size: 4855, type: WidthType.DXA },
            verticalAlign: VerticalAlign.TOP,
            children: rightSign
          })
        ]
      })
    ]
  }));

  return { children, layout };
}

function buildNd30Children(meta, content) {
  const layout = {
    page: { width: 11906, height: 16838 },
    margin: { top: 1134, bottom: 1134, left: 1701, right: 1134 },
    font: 'Times New Roman',
    contentWidth: 9071
  };

  const noBorders = {
    top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    insideVertical: { style: BorderStyle.NONE, size: 0, color: 'auto' }
  };

  const bodySpacing = { before: 120, after: 0, line: 340, lineRule: LineRuleType.AT_LEAST };
  const children = [];

  const leftHeader = [];
  if (meta.coQuanCapTren) {
    leftHeader.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: meta.coQuanCapTren, font: layout.font, size: 26 })]
    }));
  }
  leftHeader.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: meta.coQuanBanHanh, font: layout.font, size: 26, bold: true })]
  }));
  leftHeader.push(new Paragraph({
    spacing: { before: 20, after: 80 },
    border: { top: { style: BorderStyle.SINGLE, size: 2, color: '000000', space: 1 } },
    indent: { left: 1500, right: 1500 }
  }));
  leftHeader.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: meta.soKyHieu, font: layout.font, size: 26 })]
  }));

  const rightHeader = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', font: layout.font, size: 26, bold: true })]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'Độc lập - Tự do - Hạnh phúc', font: layout.font, size: 28, bold: true })]
    }),
    new Paragraph({
      spacing: { before: 20, after: 0 },
      border: { top: { style: BorderStyle.SINGLE, size: 2, color: '000000', space: 1 } },
      indent: { left: 1100, right: 1100 }
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: meta.diaDanhNgayThang, font: layout.font, size: 28, italics: true })]
    })
  ];

  children.push(new Table({
    width: { size: layout.contentWidth, type: WidthType.DXA },
    borders: noBorders,
    columnWidths: [3500, 5571],
    rows: [
      new TableRow({
        children: [
          new TableCell({ borders: noBorders, width: { size: 3500, type: WidthType.DXA }, verticalAlign: VerticalAlign.TOP, children: leftHeader }),
          new TableCell({ borders: noBorders, width: { size: 5571, type: WidthType.DXA }, verticalAlign: VerticalAlign.TOP, children: rightHeader })
        ]
      })
    ]
  }));

  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 360, after: 0 },
    children: [new TextRun({ text: meta.loaiVanBan || 'NGHỊ QUYẾT', font: layout.font, size: 28, bold: true })]
  }));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 0 },
    children: [new TextRun({ text: meta.trichYeu, font: layout.font, size: 28, bold: true })]
  }));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 60, after: 120 },
    children: [new TextRun({ text: '_______________', font: layout.font, size: 28 })]
  }));

  content.split('\n').map((v) => v.trim()).filter(Boolean).forEach((line) => {
    children.push(new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: bodySpacing,
      indent: { firstLine: 567 },
      children: [new TextRun({ text: line, font: layout.font, size: 28 })]
    }));
  });

  const leftSign = [
    new Paragraph({ children: [new TextRun({ text: 'Nơi nhận:', font: layout.font, size: 24, bold: true, italics: true })] }),
    new Paragraph({ children: [new TextRun({ text: '- Như trên;', font: layout.font, size: 22 })] }),
    new Paragraph({ children: [new TextRun({ text: '- Lưu VT.', font: layout.font, size: 22 })] })
  ];

  const rightSign = [
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: meta.chucDanh, font: layout.font, size: 28, bold: true })] }),
    new Paragraph({}), new Paragraph({}), new Paragraph({}), new Paragraph({}),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: meta.nguoiKy, font: layout.font, size: 28, bold: true })] })
  ];

  children.push(new Paragraph({ spacing: { before: 240 } }));
  children.push(new Table({
    width: { size: layout.contentWidth, type: WidthType.DXA },
    borders: noBorders,
    columnWidths: [4300, 4771],
    rows: [new TableRow({
      children: [
        new TableCell({ borders: noBorders, width: { size: 4300, type: WidthType.DXA }, verticalAlign: VerticalAlign.TOP, children: leftSign }),
        new TableCell({ borders: noBorders, width: { size: 4771, type: WidthType.DXA }, verticalAlign: VerticalAlign.TOP, children: rightSign })
      ]
    })]
  }));

  return { children, layout };
}

export function initChat(apiKey, modelName = "gemini-3.1-flash-lite-preview") {
  currentModelName = "gemini-3.1-flash-lite-preview";
  use9router = localStorage.getItem('vbai_use_9router') === 'true';
  
  if (!use9router && !apiKey) return null;
  
  try {
    if (!use9router) {
      aiClient = new GoogleGenAI({ apiKey });
    } else {
      aiClient = { proxy: true }; // Dummy client for 9router mode
    }
    currentModelName = modelName;
    chatSession = null;
    loadSkills(); // Tải skills khi init
    return true;
  } catch (e) {
    console.error("Chat Init Error:", e);
    return false;
  }
}

export async function sendMessage(text, onChunk) {
  if (!aiClient) throw new Error("Chưa cấu hình API Key hoặc 9router");

  // Tìm kiếm skill liên quan dựa trên triggers
  let dynamicInstruction = SYSTEM_INSTRUCTION;
  const lowerText = text.toLowerCase();
  const normalizedText = normalizeVietnamese(text);
  const matchedSkills = allSkills.filter((s) => detectSkillMatch(s, lowerText, normalizedText));

  if (matchedSkills.length > 0) {
    dynamicInstruction += `\n\n## KIẾN THỨC BỔ SUNG (Dựa trên context người dùng):\n`;
    matchedSkills.forEach(s => {
      dynamicInstruction += `\n### Kỹ năng: ${s.name}\n${s.instructions}\n`;
      dynamicInstruction += buildSkillReferenceContext(s);
    });
    console.log("Đã nạp thêm context từ các skills:", matchedSkills.map(s => s.name));
  }

  try {
    let fullText = "";
    
    if (use9router) {
      // Giao tiếp qua 9router (OpenAI format)
      const messages = [
        { role: "system", content: dynamicInstruction },
        { role: "user", content: text }
      ];
      fullText = await sendChatRequest(messages, currentModelName);
    } else {
      // Giao tiếp trực tiếp qua Gemini SDK
      const response = await aiClient.models.generateContent({
        model: currentModelName,
        contents: text,
        config: {
          systemInstruction: dynamicInstruction,
          tools: [{ googleSearch: {} }],
        },
      });
      fullText = response.text || "";
    }

    try {
      const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
      const db = getFirestore(app);
      addDoc(collection(db, 'search_logs'), {
        query: text,
        model: currentModelName + (use9router ? " (via 9router)" : ""),
        userEmail: window.currentUser?.email || 'Unknown',
        timestamp: serverTimestamp(),
        skillsApplied: matchedSkills.map(s => s.id)
      }).catch(err => console.warn("Log Err:", err));
    } catch (e) {}

    if (onChunk) onChunk(fullText);
    return fullText;
  } catch (e) {
    console.error("Send Error:", e);
    throw e;
  }
}

export async function renderChatUI(container) {
  const savedModel = 'gemini-3.1-flash-lite-preview';
  
  container.innerHTML = `
    <div class="chat-assistant-panel panel-group">
      <div class="panel-header">
        <div class="panel-header-icon">⚖️</div>
        Trợ Lý Tra Cứu Pháp Luật & Quy Định Đảng AI
        <div style="flex:1"></div>
        <button id="chat-settings-btn" class="btn-icon" title="Cấu hình" style="display: ${localStorage.getItem('vbai_admin') === 'true' ? 'block' : 'none'}; width:28px; height:28px; font-size:0.8rem">⚙️</button>
      </div>
      <div class="panel-body">
        <div id="chat-messages" class="chat-messages-area">
          <div class="chat-msg ai">
            <strong>Xin chào! Tôi là Trợ lý VBAI.</strong><br>
            Tôi hỗ trợ tra cứu các quy định pháp luật và các quy định, hướng dẫn của Đảng mới nhất dựa trên dữ liệu thời gian thực từ Google Search Grounding.
            <br><br>
            <strong>Nguồn dữ liệu chính thống:</strong><br>
            • dangcongsan.vn (Tư liệu Văn kiện Đảng)<br>
            • vanban.chinhphu.vn (Cổng thông tin Chính phủ)<br>
            • thuvienphapluat.vn (Thư viện Pháp luật)<br>
            • Các cổng thông tin điện tử (.gov.vn)
            <br><br>
            <em>Bạn hãy đặt câu hỏi bằng ngôn ngữ tự nhiên (VD: "Quy định mới nhất về công tác văn thư của Đảng")</em>
          </div>
        </div>
        
        <div class="chat-input-wrapper">
          <input type="text" id="chat-input" placeholder="Nhập nội dung cần tra cứu..." class="form-input chat-input-field">
          <button id="chat-send-btn" class="btn btn-primary chat-send-btn">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M2.5 10l15-7.5L10 10l7.5 7.5L2.5 10z" fill="currentColor"/></svg>
          </button>
        </div>
        <div id="chat-template-modal" class="modal-overlay chat-template-overlay" style="display:none">
          <div class="modal-content panel-group chat-template-modal-content">
            <div class="panel-header" id="chat-template-title">Xuất theo mẫu</div>
            <div class="panel-body chat-template-modal-body">
              <div class="form-grid">
                <div class="form-group span-2">
                  <label class="form-label">Loại văn bản <span class="required">*</span></label>
                  <input type="text" id="chat-template-loaivb" class="form-input" placeholder="QUYẾT ĐỊNH / NGHỊ QUYẾT / BÁO CÁO...">
                </div>
                <div class="form-group span-2">
                  <label class="form-label" id="chat-template-label-captr">Cơ quan cấp trên</label>
                  <input type="text" id="chat-template-captr" class="form-input" placeholder="Để trống nếu không có">
                </div>
                <div class="form-group span-2">
                  <label class="form-label">Cơ quan ban hành <span class="required">*</span></label>
                  <input type="text" id="chat-template-cqbh" class="form-input" placeholder="Nhập cơ quan ban hành">
                </div>
                <div class="form-group">
                  <label class="form-label">Số ký hiệu</label>
                  <input type="text" id="chat-template-sokh" class="form-input" placeholder="Số 01-QĐ/...">
                </div>
                <div class="form-group">
                  <label class="form-label">Địa danh</label>
                  <input type="text" id="chat-template-diadan" class="form-input" placeholder="Lâm Đồng">
                </div>
                <div class="form-group span-2">
                  <label class="form-label">Trích yếu</label>
                  <input type="text" id="chat-template-trichyeu" class="form-input" placeholder="về công tác ...">
                </div>
                <div class="form-group">
                  <label class="form-label">Chức danh người ký</label>
                  <input type="text" id="chat-template-chucdanh" class="form-input" placeholder="BÍ THƯ / CHỦ TỊCH">
                </div>
                <div class="form-group">
                  <label class="form-label">Người ký</label>
                  <input type="text" id="chat-template-nguoiky" class="form-input" placeholder="Nguyễn Văn A">
                </div>
              </div>
              <div class="btn-row chat-template-modal-actions">
                <button id="chat-template-submit" class="btn btn-primary">Xuất file</button>
                <button id="chat-template-cancel" class="btn btn-secondary">Đóng</button>
              </div>
            </div>
          </div>
        </div>
        <div class="chat-disclaimer" style="margin-top: 12px; padding: 10px; background: rgba(239, 68, 68, 0.05); border-left: 3px solid #ef4444; border-radius: 4px; font-size: 0.75rem; color: var(--text-secondary);">
          <strong>⚠️ CẢNH BÁO RỦI RO:</strong> VBAI là công cụ hỗ trợ dựa trên AI, không thay thế trách nhiệm của cán bộ, công chức trong việc kiểm tra, đối chiếu với văn bản pháp luật chính thức. Kết quả do AI cung cấp chỉ mang tính chất gợi ý, người dùng cần kiểm tra hiệu lực văn bản trước khi đưa vào dự thảo.
        </div>
      </div>
    </div>

    <!-- API Key Modal -->
    <div id="key-modal" class="modal-overlay" style="display:none">
      <div class="modal-content panel-group" style="max-width:420px; margin: 100px auto">
        <div class="panel-header">Cấu hình Trợ Lý AI</div>
        <div class="panel-body">
          <div class="form-group" style="margin-bottom:16px">
            <label class="form-label">Google AI Studio API Key</label>
            <input type="password" id="api-key-input" class="form-input" value="" placeholder="Dán API Key vào đây...">
            <p style="font-size:0.7rem; color:var(--text-secondary); margin-top:4px">Lấy Key miễn phí tại <a href="https://aistudio.google.com/app/apikey" target="_blank" style="color:var(--daquy-400)">Google AI Studio</a></p>
          </div>

          <div class="form-group" style="margin-bottom:16px">
            <label class="form-label">Model AI</label>
            <input type="text" class="form-input" value="Gemini 3.1 Flash Lite (Preview)" readonly style="background:var(--bg-secondary); cursor:default; opacity:0.8">
            <input type="hidden" id="model-select" value="gemini-3.1-flash-lite-preview">
          </div>

          <div style="padding:10px; background:rgba(230,162,0,0.1); border-radius:8px; margin-bottom:16px; border: 1px solid rgba(230,162,0,0.2)">
            <p style="font-size:0.75rem; color:var(--daquy-400); margin:0; font-weight:600">🔍 Google Search Grounding: BẬT</p>
            <p style="font-size:0.7rem; color:var(--text-secondary); margin:4px 0 0">Trợ lý sẽ tự động tìm kiếm Google để lấy thông tin pháp luật mới nhất.</p>
          </div>

          <div style="padding:12px; background:rgba(66,133,244,0.1); border-radius:8px; margin-bottom:16px; border: 1px solid rgba(66,133,244,0.2); display: flex; align-items: center; justify-content: space-between;">
            <div>
              <p style="font-size:0.75rem; color:var(--daquy-400); margin:0; font-weight:600">🚀 Sử dụng 9router Proxy</p>
              <p style="font-size:0.65rem; color:var(--text-secondary); margin:2px 0 0">Chạy yêu cầu AI qua 9router local (localhost:20128)</p>
            </div>
            <label class="switch-toggle">
              <input type="checkbox" id="use-9router-chk" ${localStorage.getItem('vbai_use_9router') === 'true' ? 'checked' : ''}>
              <span class="slider-round"></span>
            </label>
          </div>
          
          <div class="btn-row" style="margin-top:20px">
            <button id="save-key-btn" class="btn btn-primary">Lưu cấu hình</button>
            <button id="close-modal-btn" class="btn btn-secondary">Đóng</button>
          </div>
        </div>
      </div>
    </div>
  `;

  const input = container.querySelector('#chat-input');
  const sendBtn = container.querySelector('#chat-send-btn');
  const msgsArea = container.querySelector('#chat-messages');
  const settingsBtn = container.querySelector('#chat-settings-btn');
  const keyModal = container.querySelector('#key-modal');
  const apiKeyInput = container.querySelector('#api-key-input');
  const modelSelect = container.querySelector('#model-select');
  const templateDangBtn = container.querySelector('#chat-export-template-dang-btn');
  const templateNd30Btn = container.querySelector('#chat-export-template-nd30-btn');
  const exportBtn = container.querySelector('#chat-export-docx-btn');
  const templateModal = container.querySelector('#chat-template-modal');
  const templateTitle = container.querySelector('#chat-template-title');
  const templateCapTrLabel = container.querySelector('#chat-template-label-captr');
  const templateLoaiVb = container.querySelector('#chat-template-loaivb');
  const templateCapTr = container.querySelector('#chat-template-captr');
  const templateCqbh = container.querySelector('#chat-template-cqbh');
  const templateSokh = container.querySelector('#chat-template-sokh');
  const templateDiadan = container.querySelector('#chat-template-diadan');
  const templateTrichyeu = container.querySelector('#chat-template-trichyeu');
  const templateChucdanh = container.querySelector('#chat-template-chucdanh');
  const templateNguoiky = container.querySelector('#chat-template-nguoiky');
  const templateSubmit = container.querySelector('#chat-template-submit');
  const templateCancel = container.querySelector('#chat-template-cancel');

  // Khởi tạo Firebase và tải API Key
  let apiKey = '';
  const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  const db = getFirestore(app);

  try {
    const configDoc = await getDoc(doc(db, 'config', 'system'));
    if (configDoc.exists()) {
      apiKey = configDoc.data().gemini_api_key || '';
      if(apiKeyInput) apiKeyInput.value = apiKey;
    }
  } catch (e) {
    console.warn("Lỗi tải API Key:", e);
  }

  // Init if key exists
  if (apiKey) initChat(apiKey, savedModel);

  const addMsg = (text, role) => {
    const div = document.createElement('div');
    div.className = `chat-msg ${role}`;
    div.style.whiteSpace = 'pre-wrap';
    div.innerText = text;
    msgsArea.appendChild(div);
    msgsArea.scrollTop = msgsArea.scrollHeight;
    return div;
  };

  const detectExportModeFromText = (text) => {
    const normalized = normalizeVietnamese(text || '');
    if (/chu tich ubnd|uy ban nhan dan|cong hoa xa hoi chu nghia viet nam|so:|can cu/.test(normalized)) return 'nd30';
    if (/dang uy|dang bo|chi bo|t\/m|k\/t|t\/l|dang cong san viet nam/.test(normalized)) return 'dang';
    return 'auto';
  };

  const extractMainContentForWord = (rawText, mode = 'auto') => {
    const raw = String(rawText || '').replace(/\r/g, '');
    const lines = raw.split('\n').map((line) => line.trim()).filter(Boolean);
    if (!lines.length) return '';

    // === TIER 1: Look for formal document header lines (CƠ QUAN IN HOA or QUỐC HIỆU) ===
    // These are unmistakable document start markers
    const formalHeaderPatterns = [
      /^\*{0,2}(UY BAN NHAN DAN|UBND|HOI DONG NHAN DAN|HDND|BO [A-Z]|SO [A-Z]|VAN PHONG)/,
      /^\*{0,2}(DANG BO|DANG UY|CHI BO|BAN CHAP HANH|BAN THUONG VU)/,
      /^\*{0,2}(CONG HOA XA HOI CHU NGHIA VIET NAM)/,
      /^\*{0,2}(DANG CONG SAN VIET NAM)/
    ];

    // Document end markers
    const endMarkers = [
      'noi nhan:', 'nguon tham khao', 'tai lieu tham khao',
      'luu y dac biet', 'luu y quan trong khi soan',
      'canh bao rui ro', 'de xuat tu tro ly',
      'google search grounding'
    ];

    const isEndMarker = (line) => {
      const n = normalizeVietnamese(line);
      if (endMarkers.some((m) => n.includes(m))) return true;
      if (/^\*{0,2}(Noi nhan|Nguon tham khao|Luu y|Canh bao)/i.test(stripMarkdown(line))) return true;
      return /(https?:\/\/|\.gov\.vn|dangcongsan\.vn|thuvienphapluat\.vn|vanban\.chinhphu\.vn|vbpl\.vn)/i.test(line);
    };

    // Find document start: look for first line matching a formal header
    let docStartIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      const n = normalizeVietnamese(stripMarkdown(lines[i]));
      if (formalHeaderPatterns.some((p) => p.test(n))) {
        docStartIdx = i;
        break;
      }
    }

    // If no formal header found, try finding document type keyword as standalone header
    if (docStartIdx < 0) {
      const typePatterns = /^\*{0,2}(QUYET DINH|NGHI QUYET|BAO CAO|TO TRINH|THONG BAO|KE HOACH|CHI THI|KET LUAN|HUONG DAN|QUY DINH|QUY CHE|CHUONG TRINH|CONG VAN)\*{0,2}$/;
      for (let i = 0; i < lines.length; i++) {
        const n = normalizeVietnamese(stripMarkdown(lines[i])).trim();
        if (typePatterns.test(n)) {
          // Look back up to 3 lines to find the org header
          docStartIdx = Math.max(0, i - 3);
          break;
        }
      }
    }

    // === TIER 2: Fallback — find first line with formal content pattern ===
    if (docStartIdx < 0) {
      const effectiveMode = mode === 'auto' ? detectExportModeFromText(raw) : mode;
      const startPatterns = {
        dang: /^(dang uy|dang bo|chi bo|ban chap hanh)/,
        nd30: /^(uy ban nhan dan|ubnd|chu tich|so:|can cu)/,
        auto: /^(uy ban nhan dan|ubnd|dang uy|dang bo|chu tich|can cu|dieu 1)/
      };
      const startPattern = startPatterns[effectiveMode] || startPatterns.auto;
      docStartIdx = lines.findIndex((line) => startPattern.test(normalizeVietnamese(stripMarkdown(line))));
    }

    // === TIER 3: Ultimate fallback — skip conversation lines ===
    if (docStartIdx < 0) {
      const conversationMarkers = [
        'xin chao', 'toi la', 'ban hay', 'duoi day', 'nguon du lieu chinh thong',
        'voi tu cach la tro ly', 'toi xin huong dan', 'chao ban',
        'de ho tro ban', 'ban vui long cho biet', 'ban can cung cap',
        'toi co the ho tro', 'co so phap ly quan trong', 'co so phap ly',
        'cau truc mau', 'huong dan soan thao',
        'de xuat tu tro ly phap ly'
      ];
      docStartIdx = lines.findIndex((line) => {
        const n = normalizeVietnamese(line);
        return !conversationMarkers.some((m) => n.includes(m));
      });
      if (docStartIdx < 0) docStartIdx = 0;
    }

    // Find document end
    const sliced = lines.slice(docStartIdx);
    let docEndIdx = sliced.length;

    // Find "Nơi nhận" line — include it + a few lines after for the signature block
    const noiNhanIdx = sliced.findIndex((line) => normalizeVietnamese(stripMarkdown(line)).includes('noi nhan'));
    if (noiNhanIdx > 0) {
      // Include up to 8 lines after "Nơi nhận" for the complete signature block
      docEndIdx = Math.min(sliced.length, noiNhanIdx + 8);
    } else {
      // No "Nơi nhận" found — look for source/reference lines
      for (let i = 1; i < sliced.length; i++) {
        const n = normalizeVietnamese(sliced[i]);
        if (['nguon tham khao', 'tai lieu tham khao', 'luu y dac biet', 'luu y quan trong khi soan', 'de xuat tu tro ly', 'canh bao rui ro', 'google search grounding'].some(m => n.includes(m))) {
          docEndIdx = i;
          break;
        }
        if (/^[-*•]\s*(https?:\/\/|www\.|\[?https?)/i.test(sliced[i])) {
          docEndIdx = i;
          break;
        }
      }
    }

    const cleaned = sliced
      .slice(0, docEndIdx)
      .filter((line) => {
        if (/^[-*•]\s*(https?:\/\/|www\.|\[?https?)/i.test(line)) return false;
        if (/^---+$/.test(line)) return false;
        return true;
      })
      .map((line) => stripMarkdown(line));

    if (cleaned.length < 3) {
      return lines.map((l) => stripMarkdown(l)).join('\n');
    }
    return cleaned.join('\n');
  };

  const clearInlineActions = () => {
    msgsArea.querySelectorAll('.chat-inline-actions').forEach((node) => node.remove());
  };

  const exportCurrentAnswerDocx = async (triggerBtn = null) => {
    const answer = (lastAssistantAnswer || '').trim();
    if (!answer) {
      alert('Chưa có nội dung trả lời để xuất DOCX.');
      return;
    }

    try {
      if (triggerBtn) triggerBtn.disabled = true;
      if (exportBtn) exportBtn.disabled = true;
      const title = 'Kết quả Tra cứu VBAI';
      const content = extractMainContentForWord(answer, 'auto');
      const doc = new Document({
        styles: { default: { document: { run: { font: 'Times New Roman', size: 28 } } } },
        sections: [{ children: buildDocChildren(title, content) }]
      });
      const blob = await Packer.toBlob(doc);
      saveAs(blob, `${toSafeFileName(getDefaultExportName())}.docx`);
    } catch (e) {
      console.error('Export DOCX error:', e);
      alert('Không thể xuất DOCX: ' + e.message);
    } finally {
      if (triggerBtn) triggerBtn.disabled = false;
      if (exportBtn) exportBtn.disabled = false;
    }
  };

  const attachInlineActions = (aiMsgDiv) => {
    if (!aiMsgDiv || !(lastAssistantAnswer || '').trim()) return;
    clearInlineActions();

    const actions = document.createElement('div');
    actions.className = 'chat-inline-actions';
    actions.innerHTML = `
      <button type="button" class="btn chat-inline-btn chat-inline-btn-dang">📜 Xuất mẫu HD36</button>
      <button type="button" class="btn chat-inline-btn chat-inline-btn-nd30">📄 Xuất mẫu NĐ30</button>
      <button type="button" class="btn chat-inline-btn chat-inline-btn-docx">⬇ Xuất file Word</button>
    `;
    aiMsgDiv.appendChild(actions);

    const inlineDangBtn = actions.querySelector('.chat-inline-btn-dang');
    const inlineNd30Btn = actions.querySelector('.chat-inline-btn-nd30');
    const inlineDocxBtn = actions.querySelector('.chat-inline-btn-docx');

    inlineDangBtn.onclick = () => openTemplateModal('dang');
    inlineNd30Btn.onclick = () => openTemplateModal('nd30');
    inlineDocxBtn.onclick = () => exportCurrentAnswerDocx(inlineDocxBtn);
  };

  const handleSend = async () => {
    const text = input.value.trim();
    if (!text) return;
    if (!aiClient) {
      alert("Vui lòng cấu hình API Key trước (bấm vào icon ⚙️)");
      return;
    }

    input.value = '';
    sendBtn.disabled = true;
    addMsg(text, 'user');
    lastAssistantAnswer = '';
    
    const aiMsgDiv = addMsg('🔍 Đang tra cứu từ Google Search...', 'ai');
    try {
      await sendMessage(text, (full) => {
        lastAssistantAnswer = full || '';
        aiMsgDiv.innerText = full;
        msgsArea.scrollTop = msgsArea.scrollHeight;
      });
      attachInlineActions(aiMsgDiv);
    } catch (e) {
      aiMsgDiv.innerText = "❌ Lỗi: " + e.message;
      aiMsgDiv.classList.add('error');
    } finally {
      sendBtn.disabled = false;
    }
  };

  sendBtn.onclick = handleSend;
  input.onkeypress = (e) => { if(e.key==='Enter') handleSend(); };
  let templateMode = 'dang';
  let detectedType = null;
  const openTemplateModal = (mode) => {
    const answer = (lastAssistantAnswer || '').trim();
    if (!answer) {
      alert("Chưa có nội dung trả lời để xuất theo mẫu.");
      return;
    }

    templateMode = mode;
    detectedType = detectDocType(answer);
    const mainContentPreview = extractMainContentForWord(answer, mode);
    const previewLines = mainContentPreview.split('\n').map((v) => v.trim()).filter(Boolean);
    
    // Smart trích yếu: search for 'Về việc...' pattern IN the extracted document, not raw AI text
    let trichYeuDefault = '';
    for (const line of previewLines) {
      const match = line.match(/^[Vv]ề việc\s+(.+)/);
      if (match) {
        trichYeuDefault = line;
        break;
      }
    }
    if (!trichYeuDefault) {
      // Try 'về ' pattern
      for (const line of previewLines) {
        const match = line.match(/^[Vv]ề\s+(.{5,120})/);
        if (match) {
          trichYeuDefault = line;
          break;
        }
      }
    }
    if (!trichYeuDefault) {
      // Fallback: find a non-header, non-org-name line
      const firstContentLine = previewLines.find((l) => {
        const n = normalizeVietnamese(l);
        return l.length > 10 && !/^(uy ban|ubnd|dang bo|chi bo|cong hoa|doc lap|so:|dang cong san)/.test(n);
      }) || '';
      trichYeuDefault = firstContentLine.length > 90 ? `${firstContentLine.slice(0, 90)}...` : firstContentLine;
    }

    // Set loại văn bản
    templateLoaiVb.value = detectedType.label;

    if (mode === 'dang') {
      templateTitle.innerText = `Xuất mẫu ${detectedType.label} — Đảng (HD36)`;
      templateCapTrLabel.innerText = 'Cơ quan cấp trên';
      templateCapTr.placeholder = 'VD: ĐẢNG BỘ TỈNH ...';
      templateCqbh.placeholder = 'VD: CHI BỘ ...';
      templateSokh.value = `Số 01-${detectedType.kyHieuDang}/CB`;
      templateChucdanh.value = 'BÍ THƯ';
    } else {
      templateTitle.innerText = `Xuất mẫu ${detectedType.label} — NĐ30`;
      templateCapTrLabel.innerText = 'Cơ quan chủ quản';
      templateCapTr.placeholder = 'VD: ỦY BAN NHÂN DÂN TỈNH ...';
      templateCqbh.placeholder = 'VD: ỦY BAN NHÂN DÂN TỈNH LÂM ĐỒNG';
      templateSokh.value = `Số: 01/${detectedType.kyHieuND30}`;
      templateChucdanh.value = 'CHỦ TỊCH';
    }

    templateCapTr.value = '';
    templateCqbh.value = '';
    templateDiadan.value = 'Lâm Đồng';
    templateTrichyeu.value = trichYeuDefault || 'về công tác triển khai nhiệm vụ';
    templateNguoiky.value = 'Nguyễn Văn A';
    templateModal.style.display = 'flex';
  };

  if (templateDangBtn) templateDangBtn.onclick = () => openTemplateModal('dang');
  if (templateNd30Btn) templateNd30Btn.onclick = () => openTemplateModal('nd30');
  templateCancel.onclick = () => {
    templateModal.style.display = 'none';
  };
  templateModal.onclick = (e) => {
    if (e.target === templateModal) {
      templateModal.style.display = 'none';
    }
  };

  templateSubmit.onclick = async () => {
    const answer = (lastAssistantAnswer || '').trim();
    if (!answer) return;

    const coQuanBanHanh = (templateCqbh.value || '').trim();
    if (!coQuanBanHanh) {
      alert('Bạn cần nhập cơ quan ban hành.');
      return;
    }

    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = String(now.getFullYear());

    const loaiVbInput = (templateLoaiVb.value || '').trim();
    const meta = {
      loaiVanBan: loaiVbInput || (detectedType ? detectedType.label : 'NGHỊ QUYẾT'),
      coQuanCapTren: (templateCapTr.value || '').trim(),
      coQuanBanHanh,
      soKyHieu: (templateSokh.value || '').trim() || (templateMode === 'dang' ? `Số 01-${detectedType?.kyHieuDang || 'NQ'}/CB` : `Số: 01/${detectedType?.kyHieuND30 || 'NQ-UBND'}`),
      trichYeu: (templateTrichyeu.value || '').trim() || 'về công tác triển khai nhiệm vụ',
      nguoiKy: (templateNguoiky.value || '').trim() || 'Nguyễn Văn A',
      chucDanh: (templateChucdanh.value || '').trim() || (templateMode === 'dang' ? 'BÍ THƯ' : 'CHỦ TỊCH'),
      diaDanhNgayThang: `${(templateDiadan.value || 'Lâm Đồng').trim()}, ngày ${dd} tháng ${mm} năm ${yyyy}`
    };

    try {
      templateSubmit.disabled = true;
      const mainContent = extractMainContentForWord(answer, templateMode);
      const templateResult = templateMode === 'dang'
        ? buildDangNghiQuyetChildren(meta, mainContent)
        : buildNd30Children(meta, mainContent);

      const doc = new Document({
        styles: { default: { document: { run: { font: templateResult.layout.font, size: 28 } } } },
        sections: [{
          properties: { titlePage: true, page: { size: templateResult.layout.page, margin: templateResult.layout.margin } },
          children: templateResult.children
        }]
      });

      const suffix = templateMode === 'dang' ? 'hd36' : 'nd30';
      const fileSlug = detectedType?.fileSlug || 'van_ban';
      const base = (meta.soKyHieu || fileSlug).replace(/^Số:?\s*/i, '').replace(/\s+/g, '_');
      const blob = await Packer.toBlob(doc);
      saveAs(blob, `${toSafeFileName(base || `${fileSlug}_${suffix}`)}_${suffix}.docx`);
      templateModal.style.display = 'none';
    } catch (e) {
      console.error("Template export error:", e);
      alert("Không thể xuất theo mẫu: " + e.message);
    } finally {
      templateSubmit.disabled = false;
    }
  };
  if (exportBtn) {
    exportBtn.onclick = async () => {
      await exportCurrentAnswerDocx(exportBtn);
    };
  }
  
  settingsBtn.onclick = () => keyModal.style.display = 'block';
  container.querySelector('#close-modal-btn').onclick = () => keyModal.style.display = 'none';
  container.querySelector('#save-key-btn').onclick = async () => {
    const key = apiKeyInput.value.trim();
    const isUsing9router = container.querySelector('#use-9router-chk').checked;
    const model = 'gemini-3.1-flash-lite-preview';
    
    localStorage.setItem('vbai_use_9router', isUsing9router ? 'true' : 'false');
    localStorage.setItem('vbai_gemini_model', model);
    
    try {
      if (key) {
        await setDoc(doc(db, 'config', 'system'), { gemini_api_key: key }, { merge: true });
      }
      
      if(initChat(key, model)) {
        alert("Đã lưu cấu hình thành công!");
        keyModal.style.display = 'none';
      } else {
        alert("Lỗi khi khởi tạo Model!");
      }
    } catch (e) {
      console.error("Lưu cấu hình lỗi:", e);
      alert("Lỗi lưu cấu hình: " + e.message);
    }
  };
}

