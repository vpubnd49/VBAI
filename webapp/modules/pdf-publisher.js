import { marked } from 'marked';
import { showToast } from './ui-utils.js';
import { sendChatRequest, sendWebExtractRequest, sendWebSearchRequest } from './ai-proxy.js';
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { firebaseConfig } from '../firebase-config.js';
import { saveAs } from 'file-saver';
import { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle } from 'docx';

const TEMPLATE_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',sans-serif;font-size:12.5px;color:#333;line-height:1.55;background:#f0f4f3}

/* === HEADER === */
.page-header{
    background:linear-gradient(135deg,#ffffff 0%,#edf2f7 100%);
    color:#2d3748;padding:14px 40px;
    border-bottom:3px solid #3182ce;
    display:flex;align-items:center;justify-content:space-between;
}
.header-left {
    height: 65px;
    display: flex;
    align-items: center;
}
.header-left img {
    width: 300px; 
    height: 65px; 
    object-fit: cover; 
    object-position: center; 
    margin-left: -15px; 
    margin-right: 15px; 
    border-radius: 4px;
}
.header-right{text-align:right}
.header-right .doc-title{font-size:15px;font-weight:800;letter-spacing:0.3px;color:#1a365d;text-transform:uppercase}
.header-right .doc-number{font-size:11.5px;color:#4a5568;margin-top:2px;font-weight:500}
.header-right .doc-effect{
    display:inline-block;margin-top:6px;
    background:#e53e3e;color:#fff;font-size:10px;font-weight:700;
    padding:3px 12px;border-radius:20px;letter-spacing:0.3px;
}

/* === CONTAINER === */
.container{max-width:800px;margin:0 auto;background:#fff;padding:35px 40px;box-shadow:0 4px 6px rgba(0,0,0,.1)}

h1{font-size:20px;text-align:center;color:#1a365d;margin-bottom:18px;font-weight:800}
h2{font-size:16px;color:#276749;border-bottom:2px solid #c6f6d5;padding-bottom:5px;margin-top:28px;font-weight:700}
.meta{background:#ebf8ff;border-left:4px solid #3182ce;padding:14px 16px;margin-bottom:18px;border-radius:4px}
.meta p{margin:4px 0;font-weight:500;font-size:12px}

/* === HIỆU LỰC BOX === */
.effect-box{
    background:linear-gradient(135deg,#fff5f5,#fed7d7);
    border:2px solid #fc8181;border-radius:10px;
    padding:18px 22px;margin:18px 0;text-align:center;
}
.effect-box .label{font-size:12px;color:#c53030;font-weight:600;text-transform:uppercase;letter-spacing:1px}
.effect-box .date{font-size:28px;font-weight:800;color:#e53e3e;margin:6px 0}
.effect-box .note{font-size:11px;color:#742a2a}

/* === CARDS === */
.card{background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:18px;margin-bottom:18px;box-shadow:0 2px 4px rgba(0,0,0,.05)}
.card h3{font-size:13.5px;color:#2d3748;margin-top:0;margin-bottom:10px}
.card h2:first-child{margin-top:0}
.action{background:#fffaf0;border-left:4px solid #dd6b20;padding:12px;margin-top:12px;border-radius:4px}
.action strong{color:#dd6b20;font-size:12px;font-weight:700}
.action ul{margin:0;padding-left:18px}
.action li{margin-bottom:3px;font-size:12px}

table{width:100%;border-collapse:collapse;margin:8px 0}
th,td{border:1px solid #e2e8f0;padding:7px 9px;text-align:left;font-size:11.5px}
th{background:#edf2f7;color:#4a5568;font-weight:600}
ul{padding-left:18px}
li{margin-bottom:3px}
hr{display:none}

/* === SUMMARY === */
.summary{display:flex;flex-wrap:wrap;gap:16px}
.scard{flex:1 1 calc(50% - 16px);background:#f7fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px;page-break-inside:avoid}
.scard h4{margin-top:0;color:#276749;font-size:12.5px;margin-bottom:8px}
.scard ul{padding-left:16px;margin-bottom:0;font-size:11.5px}

/* === FOOTER === */
.page-footer{
    background:linear-gradient(135deg,#1a3a5c 0%,#2c5282 100%);
    color:#fff;padding:20px 40px;margin-top:0;
    page-break-inside:avoid;
}
.footer-disclaimer{
    text-align:center;font-size:10.5px;color:#fbd38d;
    font-style:italic;margin-bottom:14px;padding-bottom:12px;
    border-bottom:1px solid rgba(255,255,255,0.2);
}
.footer-contact{display:flex;justify-content:center;gap:120px;font-size:10px;color:#bee3f8}
.footer-col{text-align:left}
.footer-col h5{color:#fff;font-size:11px;margin-bottom:6px;font-weight:700}
.footer-col p{margin:2px 0;color:#bee3f8}
.footer-services{
    text-align:center;margin-top:14px;padding-top:12px;
    border-top:1px solid rgba(255,255,255,0.2);
    font-size:10px;color:#90cdf4;
}
.footer-services span{margin:0 8px;display:inline-block}
.footer-bottom{text-align:center;margin-top:10px;font-size:9px;color:rgba(255,255,255,0.5)}

@media print{
    body{background:#fff;padding:0;margin:0}
    .page-header,.page-footer{-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .container{box-shadow:none;padding:25px 30px;max-width:100%}
    .card,.scard{border:1px solid #cbd5e0;box-shadow:none}
    h2{page-break-after:avoid}
    .effect-box{-webkit-print-color-adjust:exact;print-color-adjust:exact}
    @page{margin:10mm}
}
`;

function extractMeta(key, text) {
  const regex = new RegExp('\\*\\*' + key + ':\\*\\* (.*?)(?:\\n|$)', 'i');
  const match = text.match(regex);
  return match ? match[1].trim() : '';
}

function processMarkdown(mdContent) {
  const tenDayDu = extractMeta("Tên đầy đủ", mdContent);
  const soHieu = extractMeta("Số hiệu", mdContent);
  const ngayBanHanh = extractMeta("Ngày ban hành", mdContent);
  const hieuLuc = extractMeta("Hiệu lực", mdContent);
  const canCu = extractMeta("Căn cứ chính", mdContent);

  const titleMatch = mdContent.match(/^# (.*?)(?:\n|$)/);
  const tieuDeChinh = titleMatch ? titleMatch[1].trim() : soHieu;
  
  let soHieuVanBan = soHieu;
  if (soHieu.includes("NĐ-CP")) {
    soHieuVanBan = "NGHỊ ĐỊNH " + soHieu;
  }
  
  let tenNganGon = tenDayDu;
  if (tenNganGon.length > 60) {
    tenNganGon = tenNganGon.substring(0, 57) + "...";
  }

  // Remove YAML Frontmatter if present
  let mdBody = mdContent.replace(/^---\n[\s\S]*?\n---\n/, '');
  // Remove metadata blockquote block at top
  mdBody = mdBody.replace(/^# .*?\n\n(?:> .*?\n)+\n---\n/, '');
  // If fallback, just try removing blockquotes at start
  if (mdBody === mdContent) {
     mdBody = mdBody.replace(/^(>.*?\n)+/m, '');
  }

  let htmlContent = marked.parse(mdBody, { breaks: true });

  // Wrap h3 into .action
  htmlContent = htmlContent.replace(/(<h3[^>]*>.*?<\/h3>)([\s\S]*?)(?=(<h3|<h2|<h1|$))/gi, '<div class="action">$1$2</div>');
  // Wrap h2 into .card
  htmlContent = htmlContent.replace(/(<h2[^>]*>.*?<\/h2>)([\s\S]*?)(?=(<h2|<h1|$))/gi, '<div class="card">$1$2</div>');

  return {
    tenDayDu, soHieu, ngayBanHanh, hieuLuc, canCu, tieuDeChinh, soHieuVanBan, tenNganGon, htmlContent
  };
}

function generateFullHtml(meta, logoUrl) {
  const dateObj = new Date();
  const ngayCapNhat = `${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${dateObj.getFullYear()}`;

  return `
<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<title>${meta.tieuDeChinh} - ${meta.tenNganGon}</title>
<style>
${TEMPLATE_CSS}
</style>
</head>
<body>
<!-- ===== HEADER ===== -->
<div class="page-header">
    <div class="header-left">
        <img src="${logoUrl}" alt="Hệ thống Trợ lý Hành chính">
    </div>
    <div class="header-right">
        <div class="doc-title">${meta.soHieuVanBan}</div>
        <div class="doc-number">${meta.tenNganGon}</div>
        <div class="doc-effect">HIỆU LỰC TỪ ${meta.hieuLuc}</div>
    </div>
</div>

<!-- ===== CONTENT ===== -->
<div class="container">
    <h1>${meta.tieuDeChinh}</h1>
    
    <div class="meta">
        <p><strong>Tên đầy đủ:</strong> ${meta.tenDayDu}</p>
        <p><strong>Số hiệu:</strong> ${meta.soHieu}</p>
        <p><strong>Ngày ban hành:</strong> ${meta.ngayBanHanh}</p>
        <p><strong>Căn cứ chính:</strong> ${meta.canCu}</p>
    </div>

    ${meta.htmlContent}
    
</div>

<!-- ===== FOOTER ===== -->
<div class="page-footer">
    <div class="footer-disclaimer">
        📋 Đây là tài liệu do <strong>Hệ thống Trợ lý Hành chính</strong> tổng hợp và xuất bản. 
        Nội dung chỉ mang tính chất tham khảo.
    </div>
    <div class="footer-contact">
        <div class="footer-col">
            <h5>📍 Ban Quản trị Hệ thống</h5>
            <p>📧 Email: admin@vbai.vn</p>
        </div>
        <div class="footer-col">
            <h5>📍 Hỗ trợ Kỹ thuật</h5>
            <p>📞 Điện thoại: 1900 xxxx</p>
        </div>
    </div>
    <div class="footer-services">
        <strong>TIỆN ÍCH CỦA HỆ THỐNG TRỢ LÝ</strong>
        <div style="display: grid; grid-template-columns: repeat(3, max-content); gap: 6px 24px; justify-content: center; margin-top: 8px;">
            <span>📖 Tra cứu pháp luật</span>
            <span>📝 Soạn thảo văn bản</span>
            <span>✓ Kiểm tra thể thức</span>
            <span>📑 Xử lý PDF/OCR</span>
            <span>🎙️ Tổng hợp ghi âm</span>
            <span>📊 Báo cáo thông minh</span>
        </div>
    </div>
    <div class="footer-bottom">
        LIÊN HỆ HỆ THỐNG TRỢ LÝ ĐỂ ĐƯỢC HỖ TRỢ &nbsp;|&nbsp; Cập nhật: ${ngayCapNhat}
    </div>
</div>
</body>
</html>
`;
}

function logToFirestore(meta) {
  try {
    const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    const db = getFirestore(app);
    addDoc(collection(db, 'search_logs'), {
      query: `[Xuất PDF] ${meta.soHieuVanBan} — ${meta.tieuDeChinh}`,
      model: "PDF Publisher", 
      userEmail: window.currentUser?.email || 'Unknown', 
      timestamp: serverTimestamp()
    }).catch(() => {});
  } catch (e) {
    console.warn("Lỗi ghi log Firestore:", e);
  }
}

// Helper for parsing inline markdown formatted text (**bold**, *italic*)
function parseInline(text, font, size, baseOptions = {}) {
  const runs = [];
  let remaining = text;
  
  const tokens = [];
  let i = 0;
  while (i < remaining.length) {
    if (remaining.substring(i, i + 2) === '**') {
      tokens.push({ type: 'bold_marker' });
      i += 2;
    } else if (remaining.charAt(i) === '*') {
      tokens.push({ type: 'italic_marker' });
      i += 1;
    } else {
      let nextMarker = remaining.indexOf('*', i);
      if (nextMarker === -1) {
        tokens.push({ type: 'text', value: remaining.substring(i) });
        break;
      } else {
        tokens.push({ type: 'text', value: remaining.substring(i, nextMarker) });
        i = nextMarker;
      }
    }
  }
  
  let boldActive = false;
  let italicActive = false;
  
  for (const token of tokens) {
    if (token.type === 'bold_marker') {
      boldActive = !boldActive;
    } else if (token.type === 'italic_marker') {
      italicActive = !italicActive;
    } else if (token.type === 'text') {
      if (token.value) {
        runs.push(new TextRun({
          text: token.value,
          font: font,
          size: size,
          bold: boldActive || baseOptions.bold || false,
          italic: italicActive || baseOptions.italic || false,
          color: baseOptions.color || undefined,
        }));
      }
    }
  }
  
  if (runs.length === 0 && text) {
    runs.push(new TextRun({ text, font, size, ...baseOptions }));
  }
  return runs;
}

// Helper for parsing Markdown tables to docx Table structure
function parseMarkdownTable(tableLines, font, size) {
  const parsedRows = [];
  
  for (const line of tableLines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    const cells = trimmed.split('|').map(c => c.trim());
    if (cells.length > 0 && !cells[0]) cells.shift();
    if (cells.length > 0 && !cells[cells.length - 1]) cells.pop();
    
    const isSeparator = cells.every(c => /^[:\s-]*$/.test(c));
    if (isSeparator) continue;
    
    parsedRows.push(cells);
  }
  
  if (parsedRows.length === 0) return null;
  
  const rows = [];
  
  for (let r = 0; r < parsedRows.length; r++) {
    const rowCells = parsedRows[r];
    const isHeader = r === 0;
    
    const docxCells = rowCells.map(cellText => {
      return new TableCell({
        shading: {
          fill: isHeader ? 'EDF2F7' : (r % 2 === 0 ? 'F7FAFC' : 'FFFFFF')
        },
        margins: {
          top: 100,
          bottom: 100,
          left: 150,
          right: 150
        },
        borders: {
          top: { color: 'E2E8F0', size: 4, val: BorderStyle.SINGLE },
          bottom: { color: 'E2E8F0', size: 4, val: BorderStyle.SINGLE },
          left: { color: 'E2E8F0', size: 4, val: BorderStyle.SINGLE },
          right: { color: 'E2E8F0', size: 4, val: BorderStyle.SINGLE }
        },
        children: [
          new Paragraph({
            children: parseInline(cellText, font, size - (isHeader ? 0 : 2), { bold: isHeader }),
            alignment: AlignmentType.LEFT
          })
        ]
      });
    });
    
    rows.push(new TableRow({
      children: docxCells
    }));
  }
  
  return new Table({
    width: {
      size: 100,
      type: WidthType.PERCENTAGE
    },
    rows: rows
  });
}

// Main function to convert the Markdown summary into a stylized DOCX document
async function exportDocx(mdContent, meta) {
  const font = "Times New Roman";
  const bodySize = 26; // 13pt
  const h1Size = 32; // 16pt
  const h2Size = 28; // 14pt
  const h3Size = 24; // 12pt
  
  const children = [];

  // 1. Header block: Borderless table mimicking the PDF Publisher header
  const headerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { val: BorderStyle.NONE },
      bottom: { val: BorderStyle.NONE },
      left: { val: BorderStyle.NONE },
      right: { val: BorderStyle.NONE },
      insideHorizontal: { val: BorderStyle.NONE },
      insideVertical: { val: BorderStyle.NONE },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: "HỆ THỐNG TRỢ LÝ HÀNH CHÍNH", font, size: 20, bold: true, color: "1A365D" }),
                ],
                spacing: { after: 40 },
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: "Trợ lý hành chính số chuyên nghiệp", font, size: 18, italic: true, color: "718096" }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({ text: String(meta.soHieuVanBan || '').toUpperCase(), font, size: 20, bold: true, color: "1A365D" }),
                ],
                spacing: { after: 40 },
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({ text: `Hiệu lực: ${meta.hieuLuc || 'Đang cập nhật'}`, font, size: 18, bold: true, color: "E53E3E" }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
  
  children.push(headerTable);
  
  // Blue accent line
  children.push(new Paragraph({
    border: {
      bottom: { color: "3182CE", size: 12, space: 1, val: BorderStyle.SINGLE }
    },
    spacing: { before: 100, after: 200 }
  }));

  // 2. Main Title
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 200, after: 200 },
    keepWithNext: true,
    children: [
      new TextRun({ text: meta.tieuDeChinh || 'TÀI LIỆU TÓM TẮT VĂN BẢN', font, size: h1Size, bold: true, color: "1A365D" }),
    ],
  }));

  // 3. Metadata box: Callout style with shaded background and thick blue left border
  const metaTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { fill: "F0F4F8" },
            margins: { top: 140, bottom: 140, left: 160, right: 160 },
            borders: {
              left: { color: "3182CE", size: 24, val: BorderStyle.SINGLE },
              top: { val: BorderStyle.NONE },
              right: { val: BorderStyle.NONE },
              bottom: { val: BorderStyle.NONE },
            },
            children: [
              new Paragraph({
                spacing: { after: 60 },
                children: [
                  new TextRun({ text: "Tên đầy đủ: ", font, size: 22, bold: true }),
                  new TextRun({ text: meta.tenDayDu || '...', font, size: 22 }),
                ],
              }),
              new Paragraph({
                spacing: { after: 60 },
                children: [
                  new TextRun({ text: "Số hiệu: ", font, size: 22, bold: true }),
                  new TextRun({ text: meta.soHieu || '...', font, size: 22 }),
                ],
              }),
              new Paragraph({
                spacing: { after: 60 },
                children: [
                  new TextRun({ text: "Ngày ban hành: ", font, size: 22, bold: true }),
                  new TextRun({ text: meta.ngayBanHanh || '...', font, size: 22 }),
                ],
              }),
              new Paragraph({
                spacing: { after: 60 },
                children: [
                  new TextRun({ text: "Hiệu lực: ", font, size: 22, bold: true }),
                  new TextRun({ text: meta.hieuLuc || '...', font, size: 22 }),
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: "Căn cứ chính: ", font, size: 22, bold: true }),
                  new TextRun({ text: meta.canCu || '...', font, size: 22 }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  children.push(metaTable);
  children.push(new Paragraph({ spacing: { after: 200 } }));

  // 4. Markdown body parsing & formatting
  let mdBody = mdContent.replace(/^---\n[\s\S]*?\n---\n/, '');
  mdBody = mdBody.replace(/^# .*?\n\n(?:> .*?\n)+\n---\n/, '');
  if (mdBody === mdContent) {
     mdBody = mdBody.replace(/^(>.*?\n)+/m, '');
  }

  const lines = mdBody.split('\n');
  let inTable = false;
  let tableLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line.startsWith('|')) {
      inTable = true;
      tableLines.push(line);
      continue;
    } else if (inTable) {
      inTable = false;
      if (tableLines.length > 0) {
        const tableNode = parseMarkdownTable(tableLines, font, bodySize);
        if (tableNode) {
          children.push(tableNode);
          children.push(new Paragraph({ spacing: { after: 120 } }));
        }
        tableLines = [];
      }
    }
    
    if (!line) continue;
    
    if (line.startsWith('# ')) {
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 240, after: 120 },
        keepWithNext: true,
        children: parseInline(line.substring(2).trim(), font, h1Size, { bold: true, color: '1A365D' }),
      }));
    } else if (line.startsWith('## ')) {
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 100 },
        keepWithNext: true,
        children: parseInline(line.substring(3).trim(), font, h2Size, { bold: true, color: '276749' }),
      }));
    } else if (line.startsWith('### ')) {
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 160, after: 80 },
        keepWithNext: true,
        children: parseInline(line.substring(4).trim(), font, h3Size, { bold: true, color: '2D3748' }),
      }));
    } else if (line.startsWith('---')) {
      children.push(new Paragraph({
        border: {
          bottom: { color: 'CBD5E0', size: 6, space: 1, val: BorderStyle.SINGLE }
        },
        spacing: { before: 120, after: 120 }
      }));
    } else if (line.startsWith('- ') || line.startsWith('* ') || line.startsWith('+ ')) {
      children.push(new Paragraph({
        bullet: { level: 0 },
        spacing: { after: 60 },
        children: parseInline(line.substring(2).trim(), font, bodySize),
      }));
    } else if (/^\d+\.\s/.test(line)) {
      const match = line.match(/^(\d+)\.\s(.*)/);
      const num = match[1];
      const content = match[2];
      children.push(new Paragraph({
        spacing: { after: 60 },
        indent: { left: 360, hanging: 360 },
        children: [
          new TextRun({ text: `${num}. `, font, size: bodySize, bold: true }),
          ...parseInline(content.trim(), font, bodySize)
        ],
      }));
    } else {
      children.push(new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: { after: 100 },
        children: parseInline(line, font, bodySize),
      }));
    }
  }

  if (inTable && tableLines.length > 0) {
    const tableNode = parseMarkdownTable(tableLines, font, bodySize);
    if (tableNode) {
      children.push(tableNode);
    }
  }

  // 5. Footer notice
  children.push(new Paragraph({
    border: {
      top: { color: "CBD5E0", size: 6, space: 1, val: BorderStyle.SINGLE }
    },
    spacing: { before: 300, after: 100 }
  }));
  
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 60 },
    children: [
      new TextRun({ text: "📋 Đây là tài liệu do Hệ thống Trợ lý Hành chính tổng hợp và xuất bản. Nội dung chỉ mang tính chất tham khảo.", font, size: 18, italic: true, color: "718096" })
    ]
  }));

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font, size: bodySize },
        },
      },
    },
    sections: [{
      properties: {
        page: {
          margin: {
            top: 1440, // 1 inch = 1440 twip
            bottom: 1440,
            left: 1440,
            right: 1440,
          }
        }
      },
      children
    }]
  });

  const blob = await Packer.toBlob(doc);
  return blob;
}

export function renderPdfPublisher(container) {
  container.innerHTML = `
    <div class="pdf-publisher-container" style="display: flex; height: calc(100vh - 120px); gap: 20px; padding-bottom: 20px;">
        <div class="editor-pane" style="flex: 1; display: flex; flex-direction: column; background: #fff; border-radius: 8px; border: 1px solid var(--border-color); overflow: hidden;">
            <div style="padding: 12px 16px; border-bottom: 1px solid var(--border-color); background: #f0f4f3; display: flex; flex-direction: column; gap: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="font-weight: 600; font-size: 13px; color: var(--text-primary);">🪄 Tự động hóa bằng AI</div>
                </div>
                <div style="display: flex; gap: 8px;">
                    <input type="text" id="pdf-ai-input" placeholder="Nhập số hiệu hoặc link VB (VD: 25/2026/NĐ-CP)" style="flex: 1; padding: 6px 12px; border: 1px solid var(--border-subtle); border-radius: 4px; outline: none; font-size: 13px;">
                    <button id="btn-ai-generate" class="btn-primary" style="padding: 6px 12px; font-size: 13px; background: #8b5cf6; border-color: #8b5cf6;">✨ Tự động tạo</button>
                    <button class="btn btn-secondary" onclick="window.location.reload();" style="padding: 6px 12px; font-size: 13px; display:flex; align-items:center; gap:6px;" title="Làm mới">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>
                    </button>
                </div>
            </div>
            <div style="padding: 12px 16px; border-bottom: 1px solid var(--border-color); background: #f8fafc; display: flex; justify-content: space-between; align-items: center;">
                <span style="font-weight: 600; font-size: 14px; color: var(--text-primary);">Markdown Editor</span>
                <button id="btn-render-pdf" class="btn-primary" style="padding: 6px 12px; font-size: 13px; display: none;">Render Preview</button>
            </div>
            <textarea id="pdf-markdown-input" style="flex: 1; border: none; padding: 16px; font-family: monospace; font-size: 13px; line-height: 1.6; outline: none; resize: none;"></textarea>
        </div>
        <div class="preview-pane" style="flex: 1; display: flex; flex-direction: column; background: #fff; border-radius: 8px; border: 1px solid var(--border-color); overflow: hidden;">
            <div style="padding: 12px 16px; border-bottom: 1px solid var(--border-color); background: #f8fafc; display: flex; justify-content: space-between; align-items: center;">
                <span style="font-weight: 600; font-size: 14px; color: var(--text-primary);">Live Preview</span>
                <div style="display: flex; gap: 8px;">
                    <button id="btn-export-docx" class="btn-primary" style="padding: 6px 12px; font-size: 13px; background-color: #2b579a; border-color: #2b579a;">Xuất Word</button>
                    <button id="btn-export-pdf" class="btn-primary" style="padding: 6px 12px; font-size: 13px; background-color: var(--pine-500); border-color: var(--pine-500);">Xuất PDF</button>
                </div>
            </div>
            <div id="pdf-html-preview" style="flex: 1; padding: 16px; background: #f0f4f3; overflow-y: auto;">
                <div style="text-align: center; color: var(--text-tertiary); margin-top: 40px; font-style: italic;">Nhấn Render Preview để xem trước</div>
            </div>
        </div>
    </div>
  `;

  const btnRender = document.getElementById('btn-render-pdf');
  const btnExportDocx = document.getElementById('btn-export-docx');
  const btnExport = document.getElementById('btn-export-pdf');
  const txtInput = document.getElementById('pdf-markdown-input');
  const previewDiv = document.getElementById('pdf-html-preview');

  let currentHtml = '';

  // Load sample on init if empty
  txtInput.value = `# Nghị định 25/2026/NĐ-CP - Highlights & Lưu Ý

> **Tên đầy đủ:** Nghị định quy định chi tiết một số điều của Luật Đất đai
>
> **Số hiệu:** 25/2026/NĐ-CP
>
> **Ngày ban hành:** 01/01/2026
>
> **Hiệu lực:** 15/02/2026
>
> **Căn cứ chính:** Luật Đất đai 2024
>
> **Nguồn:** https://thuvienphapluat.vn

---

## 1. PHẠM VI ĐIỀU CHỈNH (Điều 1)

Nghị định này quy định chi tiết về việc giao đất, cho thuê đất, chuyển mục đích sử dụng đất.

---

## 2. CÁC ĐIỂM HIGHLIGHT QUAN TRỌNG

### 🔴 2.1 Điểm mới về thủ tục giao đất (Điều 5)

Thủ tục giao đất đã được rút ngắn thời gian xử lý từ 30 ngày xuống còn 15 ngày làm việc.

**💡 Đề xuất lưu ý:**
- Doanh nghiệp cần chuẩn bị hồ sơ đầy đủ ngay từ bước nộp ban đầu để không bị trả hồ sơ.

---

## 3. BẢNG HÀNH ĐỘNG ƯU TIÊN

| Ưu tiên | Hành động | Deadline |
|---------|----------|----------|
| 🔴 Cao | Nộp hồ sơ xin giao đất mới | 28/02/2026 |
| 🟡 TB  | Rà soát lại hợp đồng thuê đất cũ | 30/03/2026 |`;

  const btnAiGenerate = document.getElementById('btn-ai-generate');
  const aiInput = document.getElementById('pdf-ai-input');

  btnAiGenerate.addEventListener('click', async () => {
    const query = aiInput.value.trim();
    if (!query) {
      showToast('Vui lòng nhập link hoặc số hiệu văn bản', 'error');
      return;
    }
    
    btnAiGenerate.disabled = true;
    btnAiGenerate.textContent = '⏳ Đang xử lý...';
    
    try {
      let documentContext = `Yêu cầu/Văn bản cần xử lý: ${query}`;
      
      if (query.startsWith('http')) {
        // Nếu người dùng nhập link, tiến hành cào dữ liệu trước để đọc toàn diện
        btnAiGenerate.textContent = '⏳ Đang đọc link...';
        try {
          const extractRes = await sendWebExtractRequest(query, [], { timeoutMs: 25000 });
          if (extractRes && (extractRes.content || extractRes.text)) {
            documentContext = `URL nguồn: ${query}\n\nNỘI DUNG VĂN BẢN TRÍCH XUẤT ĐƯỢC:\n${extractRes.content || extractRes.text}`;
          }
        } catch (err) {
          console.warn("Không thể trích xuất web tự động, fallback sang AI tự đọc", err);
        }
        btnAiGenerate.textContent = '⏳ Đang soạn thảo...';
      } else {
        // Nếu người dùng nhập số hiệu văn bản, tiến hành tra cứu trước
        btnAiGenerate.textContent = '⏳ Đang tra cứu văn bản...';
        try {
          const searchResults = await sendWebSearchRequest(query, null, { forceFresh: true });
          if (searchResults && String(searchResults).trim()) {
            documentContext = `Kết quả tra cứu cho văn bản "${query}":\n\n${searchResults}`;
          }
        } catch (searchErr) {
          console.warn("Tra cứu văn bản tự động thất bại:", searchErr);
        }
        btnAiGenerate.textContent = '⏳ Đang soạn thảo...';
      }

      const systemPrompt = `Bạn là Trợ lý phân tích văn bản pháp luật. Nhiệm vụ của bạn là ĐỌC TOÀN DIỆN nội dung văn bản, phân tích và trích xuất thành tài liệu highlights định dạng Markdown ĐÚNG CHUẨN như sau.
TUYỆT ĐỐI KHÔNG dùng YAML Frontmatter (---) ở đầu file.
KHÔNG bọc kết quả trong markdown codeblock (\`\`\`markdown). Trả về thuần text.

QUY TẮC TÌM KIẾM VÀ XỬ LÝ DỮ LIỆU (TỐI QUAN TRỌNG):
1. Tôn trọng tuyệt đối dữ liệu đầu vào:
   - Nếu người dùng cung cấp đường link (URL), bạn CHỈ ĐƯỢC PHÉP phân tích dựa trên dữ liệu trích xuất từ đúng link đó. Tuyệt đối không lấy thông tin khác ngoài nội dung yêu cầu.
   - Nếu người dùng cung cấp Số hiệu hoặc Ngày tháng của Luật, Nghị định, Thông tư... bạn PHẢI tìm đúng chính xác văn bản pháp luật đó. Khớp chính xác từng con số, từng ngày tháng. Không được phép lấy văn bản khác đắp vào, không được bịa đặt (hallucinate).
2. Hãy phân tích cực kỳ CHI TIẾT, ĐẦY ĐỦ và TOÀN DIỆN. Tránh tóm tắt sơ sài hoặc quá ngắn gọn. Tài liệu highlights phải phản ánh được toàn bộ các điểm thay đổi cốt lõi, quyền lợi, nghĩa vụ hoặc quy định mới.

QUY TẮC BÓC TÁCH CĂN CỨ VÀ SỐ HIỆU (RẤT QUAN TRỌNG):
1. Mục "Căn cứ chính": Tuyệt đối KHÔNG ĐƯỢC ghi là "Hiến pháp nước Cộng hòa xã hội chủ nghĩa Việt Nam" or "Hiến pháp". 
   - Khi đọc nội dung thấy rõ cơ quan phát hành (ví dụ: của Quốc hội, của Chính phủ, của Bộ Tài chính, của Ủy ban nhân dân...), thì **Căn cứ chính phải ghi ĐÚNG LÀ TÊN CƠ QUAN PHÁT HÀNH ĐÓ**.
   - Ví dụ: "Luật Viên chức số 129/2025/QH15 của Quốc hội" -> Căn cứ chính: Quốc hội.
   - Ví dụ: "Nghị định số... của Chính phủ" -> Căn cứ chính: Chính phủ.
2. Dịch các từ viết tắt trong cơ quan ban hành/số hiệu:
   - "QH14", "QH15" -> "Quốc hội"
   - "NĐ", "NĐ-CP" -> "Nghị định"
   - "TT", "TT-BTC", "TT-BXD"... -> "Thông tư"
   - "QĐ", "QĐ-UBND"... -> "Quyết định"

CẤU TRÚC BẮT BUỘC:
# [Tên Ngắn Gọn Của Văn Bản] - Highlights & Lưu Ý

> **Tên đầy đủ:** [Tên chính thức đầy đủ]
>
> **Số hiệu:** [Số hiệu (VD: 129/2025/QH15)]
>
> **Ngày ban hành:** [DD/MM/YYYY]
>
> **Hiệu lực:** [DD/MM/YYYY]
>
> **Căn cứ chính:** [Tên Cơ quan phát hành - KHÔNG ghi Hiến pháp]
>
> **Nguồn:** [URL hoặc Tên nguồn]

---

## 1. PHẠM VI ĐIỀU CHỈNH (Điều X)

[Tóm tắt chi tiết phạm vi điều chỉnh và đối tượng áp dụng của văn bản]

---

## 2. CÁC ĐIỂM HIGHLIGHT QUAN TRỌNG
(Yêu cầu phân tích chi tiết từ 4 đến 8 điểm nhấn quan trọng nhất của văn bản pháp luật, mỗi điểm nhấn trình bày riêng biệt theo cấu trúc sau)

### 🔴 2.1 [Tên điểm nhấn thứ nhất] (Điều XX)

[Phân tích nội dung chi tiết, cụ thể và diễn giải đầy đủ các quy định mới hoặc thay đổi quan trọng của điều khoản này]

**💡 Đề xuất lưu ý:**
- [Gợi ý hành động thực tế hoặc đề xuất giải pháp cụ thể cho cơ quan/đơn vị/doanh nghiệp]

### 🔴 2.2 [Tên điểm nhấn thứ hai] (Điều YY)

[Phân tích nội dung chi tiết...]

**💡 Đề xuất lưu ý:**
- [Gợi ý hành động...]

(Và tiếp tục tạo các điểm 2.3, 2.4, 2.5... tương ứng cho đến hết các điểm quan trọng được trích xuất)

---

## 3. BẢNG HÀNH ĐỘNG ƯU TIÊN

| Ưu tiên | Hành động | Deadline |
|---------|----------|----------|
| 🔴 Cao | [Hành động] | [Thời hạn] |
| 🟡 TB  | [Hành động] | [Thời hạn] |
| 🟢 Thấp | [Hành động] | [Thời hạn] |
`;

      const responseText = await sendChatRequest([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Hãy đọc toàn diện nội dung sau và tạo highlights chuẩn xác:\n\n${documentContext}` }
      ], null, { timeoutMs: 90000 });

      // Gán vào textarea
      txtInput.value = responseText.replace(/^```markdown\n/i, '').replace(/```$/i, '').trim();
      
      // Kích hoạt render preview
      txtInput.dispatchEvent(new Event('input'));
      
      showToast('Đã tạo xong Markdown!', 'success');

      // Log to firestore
      try {
        const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
        const db = getFirestore(app);
        addDoc(collection(db, 'search_logs'), {
          query: `[PDF Publisher AI] Tạo tài liệu từ: ${query}`,
          model: "PDF Publisher AI", 
          userEmail: window.currentUser?.email || 'Unknown', 
          timestamp: serverTimestamp()
        }).catch(() => {});
      } catch (e) {}
      
    } catch (e) {
      console.error(e);
      showToast('Lỗi AI: ' + e.message, 'error');
    } finally {
      btnAiGenerate.disabled = false;
      btnAiGenerate.textContent = '✨ Tự động tạo';
    }
  });

  let cachedLogoBase64 = '';
  async function getLogoBase64() {
    if (cachedLogoBase64) return cachedLogoBase64;
    try {
      const res = await fetch(window.location.origin + '/admin-assistant-logo.svg');
      const blob = await res.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => { cachedLogoBase64 = reader.result; resolve(cachedLogoBase64); };
        reader.readAsDataURL(blob);
      });
    } catch(e) {
      console.warn("Lỗi load logo:", e);
      return window.location.origin + '/admin-assistant-logo.svg';
    }
  }

  btnRender.addEventListener('click', async () => {
    try {
      const mdContent = txtInput.value;
      const meta = processMarkdown(mdContent);
      // We will use the absolute URL or Base64 for the logo so it resolves correctly in iframe
      const logoUrl = await getLogoBase64();
      currentHtml = generateFullHtml(meta, logoUrl);
      
      // Inject into preview by putting it in a shadow dom or iframe so styles don't leak
      previewDiv.innerHTML = '<iframe id="preview-iframe" style="width:100%; height:100%; border:none; box-shadow: 0 4px 12px rgba(0,0,0,0.1); background:#fff;"></iframe>';
      const iframe = document.getElementById('preview-iframe');
      iframe.contentWindow.document.open();
      iframe.contentWindow.document.write(currentHtml);
      iframe.contentWindow.document.close();
    } catch (e) {
      console.error(e);
      showToast('Lỗi parse Markdown', 'error');
    }
  });

  let renderTimeout;
  txtInput.addEventListener('input', () => {
    clearTimeout(renderTimeout);
    renderTimeout = setTimeout(() => {
      btnRender.click();
    }, 500);
  });

  btnExportDocx.addEventListener('click', async () => {
    btnExportDocx.disabled = true;
    btnExportDocx.textContent = '⏳ Đang tạo...';
    try {
      const mdContent = txtInput.value;
      const meta = processMarkdown(mdContent);
      const blob = await exportDocx(mdContent, meta);
      const filename = `${meta.soHieu ? meta.soHieu.replace(/[^a-zA-Z0-9À-ỹ]/g, '_') : 'tai_lieu'}.docx`;
      saveAs(blob, filename);
      showToast('✓ Đã xuất file Word thành công!', 'success');
      
      // Ghi log hoạt động xuất Word vào Firestore
      try {
        const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
        const db = getFirestore(app);
        addDoc(collection(db, 'search_logs'), {
          query: `[Xuất Word] ${meta.soHieuVanBan} — ${meta.tieuDeChinh}`,
          model: "PDF Publisher", 
          userEmail: window.currentUser?.email || 'Unknown', 
          timestamp: serverTimestamp()
        }).catch(() => {});
      } catch(e) {}
    } catch (e) {
      console.error(e);
      showToast('Lỗi xuất Word: ' + e.message, 'error');
    } finally {
      btnExportDocx.disabled = false;
      btnExportDocx.textContent = 'Xuất Word';
    }
  });

  btnExport.addEventListener('click', () => {
    if (!currentHtml) {
      btnRender.click();
    }
    
    // Ghi log hoạt động xuất bản vào Firestore
    try {
      const meta = processMarkdown(txtInput.value);
      logToFirestore(meta);
    } catch(e) {}

    setTimeout(() => {
      // Create hidden iframe for printing
      const printIframe = document.createElement('iframe');
      printIframe.style.position = 'absolute';
      printIframe.style.width = '1px';
      printIframe.style.height = '1px';
      printIframe.style.left = '-10000px';
      printIframe.style.border = 'none';
      document.body.appendChild(printIframe);

      printIframe.contentWindow.document.open();
      printIframe.contentWindow.document.write(currentHtml);
      printIframe.contentWindow.document.close();

      printIframe.contentWindow.focus();
      // Delay to ensure images load
      setTimeout(() => {
        printIframe.contentWindow.print();
        setTimeout(() => {
          document.body.removeChild(printIframe);
        }, 1000);
      }, 500);
    }, 100);
  });

  // Initial render
  btnRender.click();
}

