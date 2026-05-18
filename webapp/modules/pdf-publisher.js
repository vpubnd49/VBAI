import { marked } from 'marked';
import { showToast } from '../main.js';

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

  // Remove metadata blockquote block at top
  let mdBody = mdContent.replace(/^# .*?\n\n(?:> .*?\n)+\n---\n/, '');
  // If fallback, just try removing blockquotes at start
  if (mdBody === mdContent) {
     mdBody = mdContent.replace(/^(>.*?\n)+/m, '');
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

export function renderPdfPublisher(container) {
  container.innerHTML = `
    <div class="pdf-publisher-container" style="display: flex; height: calc(100vh - 120px); gap: 20px; padding-bottom: 20px;">
        <div class="editor-pane" style="flex: 1; display: flex; flex-direction: column; background: #fff; border-radius: 8px; border: 1px solid var(--border-color); overflow: hidden;">
            <div style="padding: 12px 16px; border-bottom: 1px solid var(--border-color); background: #f8fafc; display: flex; justify-content: space-between; align-items: center;">
                <span style="font-weight: 600; font-size: 14px; color: var(--text-primary);">Markdown Editor</span>
                <button id="btn-render-pdf" class="btn-primary" style="padding: 6px 12px; font-size: 13px;">Render Preview</button>
            </div>
            <textarea id="pdf-markdown-input" style="flex: 1; border: none; padding: 16px; font-family: monospace; font-size: 13px; line-height: 1.6; outline: none; resize: none;"></textarea>
        </div>
        <div class="preview-pane" style="flex: 1; display: flex; flex-direction: column; background: #fff; border-radius: 8px; border: 1px solid var(--border-color); overflow: hidden;">
            <div style="padding: 12px 16px; border-bottom: 1px solid var(--border-color); background: #f8fafc; display: flex; justify-content: space-between; align-items: center;">
                <span style="font-weight: 600; font-size: 14px; color: var(--text-primary);">Live Preview</span>
                <button id="btn-export-pdf" class="btn-primary" style="padding: 6px 12px; font-size: 13px; background-color: var(--pine-500); border-color: var(--pine-500);">Xuất PDF</button>
            </div>
            <div id="pdf-html-preview" style="flex: 1; padding: 16px; background: #f0f4f3; overflow-y: auto;">
                <div style="text-align: center; color: var(--text-tertiary); margin-top: 40px; font-style: italic;">Nhấn Render Preview để xem trước</div>
            </div>
        </div>
    </div>
  `;

  const btnRender = document.getElementById('btn-render-pdf');
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

## 3. BẢNG HÀNH ĐỘNG ƯU TIÊN CHO DOANH NGHIỆP

| Ưu tiên | Hành động | Deadline |
|---------|----------|----------|
| 🔴 Cao | Nộp hồ sơ xin giao đất mới | 28/02/2026 |
| 🟡 TB  | Rà soát lại hợp đồng thuê đất cũ | 30/03/2026 |`;

  btnRender.addEventListener('click', () => {
    try {
      const mdContent = txtInput.value;
      const meta = processMarkdown(mdContent);
      // We will use the absolute URL for the logo so it resolves correctly in iframe
      const logoUrl = window.location.origin + '/admin-assistant-logo.svg';
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

  btnExport.addEventListener('click', () => {
    if (!currentHtml) {
      btnRender.click();
    }
    setTimeout(() => {
      // Create hidden iframe for printing
      const printIframe = document.createElement('iframe');
      printIframe.style.position = 'absolute';
      printIframe.style.width = '0px';
      printIframe.style.height = '0px';
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
