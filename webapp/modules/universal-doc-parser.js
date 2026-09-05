/**
 * VBAI Universal Deep Document Parser
 * Parses and extracts deep structured content from:
 * - Word (.docx, .doc)
 * - Excel (.xlsx, .xls, .csv)
 * - PDF (.pdf) with AI OCR fallback
 * - Text (.txt, .json, .md)
 */

import { fetchSystemConfig } from './system-config.js';
import { sendChatRequest } from './ai-proxy.js';

/**
 * Load external library script dynamically
 */
function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve();
    script.onerror = (e) => reject(new Error(`Không thể tải thư viện: ${src}`));
    document.head.appendChild(script);
  });
}

/**
 * Parse Excel (.xlsx, .xls, .csv) into structured Markdown tables
 */
async function parseExcelFile(file, statusCallback) {
  statusCallback('Đang nạp bộ giải mã bảng tính Excel...');
  if (!window.XLSX) {
    await loadScript('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js');
  }

  statusCallback('Đang đọc toàn bộ Sheet và dữ liệu bảng tính...');
  const arrayBuffer = await file.arrayBuffer();
  const workbook = window.XLSX.read(arrayBuffer, { type: 'array', cellDates: true });

  const sheetNames = workbook.SheetNames || [];
  if (sheetNames.length === 0) {
    throw new Error('File Excel không có dữ liệu bảng tính (không tìm thấy Sheet).');
  }

  let fullExtractedText = `📊 [DỮ LIỆU TẬP TIN BẢNG TÍNH EXCEL: ${file.name}]\n`;
  fullExtractedText += `* Tổng số Sheet: ${sheetNames.length} (${sheetNames.join(', ')})\n\n`;

  let totalRowsAcrossSheets = 0;

  for (let i = 0; i < sheetNames.length; i++) {
    const sheetName = sheetNames[i];
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) continue;

    // Convert sheet to JSON array of arrays
    const sheetData = window.XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
    if (!sheetData || sheetData.length === 0) {
      fullExtractedText += `### Sheet ${i + 1}: ${sheetName} (Trống)\n\n`;
      continue;
    }

    // Filter out completely empty rows
    const nonEmptyRows = sheetData.filter(row => row.some(cell => String(cell).trim() !== ''));
    totalRowsAcrossSheets += nonEmptyRows.length;

    fullExtractedText += `### 📄 Sheet ${i + 1}: ${sheetName} (Gồm ${nonEmptyRows.length} dòng dữ liệu)\n\n`;

    // Format as Markdown table
    if (nonEmptyRows.length > 0) {
      // Find max columns
      const maxCols = Math.max(...nonEmptyRows.map(r => r.length));
      
      // First non-empty row as header (or generic headers)
      const headerRow = nonEmptyRows[0];
      const headers = [];
      for (let c = 0; c < maxCols; c++) {
        const val = headerRow[c] !== undefined && String(headerRow[c]).trim() !== '' 
          ? String(headerRow[c]).replace(/\|/g, '-').trim() 
          : `Cột ${c + 1}`;
        headers.push(val);
      }

      fullExtractedText += '| ' + headers.join(' | ') + ' |\n';
      fullExtractedText += '| ' + headers.map(() => '---').join(' | ') + ' |\n';

      // Data rows
      const dataRows = nonEmptyRows.slice(1);
      for (const row of dataRows) {
        const cells = [];
        for (let c = 0; c < maxCols; c++) {
          const val = row[c] !== undefined ? String(row[c]).replace(/\|/g, '/').replace(/\n/g, ' ').trim() : '';
          cells.push(val);
        }
        fullExtractedText += '| ' + cells.join(' | ') + ' |\n';
      }
      fullExtractedText += '\n';
    }
  }

  return {
    text: fullExtractedText,
    type: 'excel',
    meta: {
      sheetCount: sheetNames.length,
      sheets: sheetNames,
      totalRows: totalRowsAcrossSheets
    }
  };
}

/**
 * Parse Word (.docx) into structured text & tables
 */
async function parseDocxFile(file, statusCallback) {
  statusCallback('Đang phân tích cấu trúc văn bản Word (.docx)...');
  const JSZip = (await import('https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm')).default;
  const zip = await JSZip.loadAsync(file);
  const docXml = await zip.file('word/document.xml')?.async('text');
  if (!docXml) throw new Error('Không tìm thấy nội dung document.xml trong file Word.');

  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(docXml, 'application/xml');
  const body = xmlDoc.getElementsByTagName('w:body')[0] || xmlDoc.getElementsByTagName('body')[0];
  if (!body) throw new Error('Không thể phân tích cấu trúc file Word.');

  let resultText = `📄 [NỘI DUNG VĂN BẢN WORD: ${file.name}]\n\n`;
  let tableCount = 0;
  let paragraphCount = 0;

  function traverse(node) {
    const name = node.nodeName.replace(/^.*:/, '');
    if (name === 'p') {
      let pText = '';
      const tNodes = Array.from(node.querySelectorAll('*')).filter(n => n.nodeName.replace(/^.*:/, '') === 't');
      for (let t of tNodes) {
        pText += t.textContent;
      }
      if (pText.trim()) {
        paragraphCount++;
        resultText += pText + '\n';
      }
    } else if (name === 'tbl') {
      tableCount++;
      resultText += `\n[BẢNG DỮ LIỆU #${tableCount} TRONG VĂN BẢN]:\n`;
      const rows = Array.from(node.querySelectorAll('*')).filter(n => n.nodeName.replace(/^.*:/, '') === 'tr');
      for (let r of rows) {
        let rowText = [];
        const cells = Array.from(r.childNodes).filter(n => n.nodeName.replace(/^.*:/, '') === 'tc');
        for (let c of cells) {
          const tNodes = Array.from(c.querySelectorAll('*')).filter(n => n.nodeName.replace(/^.*:/, '') === 't');
          let cellText = tNodes.map(t => t.textContent).join('');
          rowText.push(cellText.trim());
        }
        resultText += '| ' + rowText.join(' | ') + ' |\n';
      }
      resultText += '\n';
    } else {
      for (let child of node.childNodes) {
        traverse(child);
      }
    }
  }

  traverse(body);

  return {
    text: resultText,
    type: 'docx',
    meta: {
      paragraphCount,
      tableCount
    }
  };
}

/**
 * Parse Word 97-2003 (.doc) binary format via mammoth.js
 * Mammoth.js hỗ trợ cả .docx lẫn .doc, dùng làm fallback an toàn
 */
async function parseDocFile(file, statusCallback) {
  statusCallback('Đang nạp bộ giải mã tệp Word cũ (.doc)...');

  // Thử dùng mammoth.js (hỗ trợ cả .doc binary và .docx)
  if (!window.mammoth) {
    await loadScript('https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js');
  }

  statusCallback('Đang trích xuất nội dung văn bản Word (.doc)...');
  const arrayBuffer = await file.arrayBuffer();

  let resultText = `📄 [NỘI DUNG VĂN BẢN WORD CŨ: ${file.name}]\n\n`;
  let tableCount = 0;
  let paragraphCount = 0;

  try {
    // Trích xuất raw text (giữ bảng biểu dạng văn bản)
    const result = await window.mammoth.extractRawText({ arrayBuffer });
    const rawText = result.value || '';

    if (rawText.trim().length < 10) {
      throw new Error('Không trích xuất được nội dung từ file .doc này.');
    }

    // Đếm đoạn văn
    const lines = rawText.split('\n').filter(l => l.trim());
    paragraphCount = lines.length;

    resultText += rawText;

    // Cảnh báo nếu có thông điệp lỗi từ mammoth
    if (result.messages && result.messages.length > 0) {
      const warnings = result.messages.filter(m => m.type === 'warning').slice(0, 3);
      if (warnings.length > 0) {
        resultText += `\n\n[Lưu ý: ${warnings.map(w => w.message).join('; ')}]`;
      }
    }
  } catch (mammothErr) {
    // Fallback: thử parse như DOCX (nếu file thực ra là DOCX đổi tên)
    try {
      statusCallback('Thử phân tích theo định dạng DOCX...');
      const fallback = await parseDocxFile(file, statusCallback);
      return { ...fallback, type: 'doc' };
    } catch (_) {
      throw new Error(`Không thể đọc file .doc: ${mammothErr.message}. File có thể bị hỏng hoặc được mã hóa.`);
    }
  }

  return {
    text: resultText,
    type: 'doc',
    meta: { paragraphCount, tableCount },
  };
}

/**
 * Parse PDF (.pdf) with OCR AI Fallback
 */
async function parsePdfFile(file, statusCallback) {
  statusCallback('Đang đọc tài liệu PDF...');
  if (!window.pdfjsLib) {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = `📑 [NỘI DUNG TÀI LIỆU PDF: ${file.name} (Gồm ${pdf.numPages} trang)]\n\n`;
  
  for (let i = 1; i <= pdf.numPages; i++) {
    statusCallback(`Đang trích xuất văn bản trang ${i}/${pdf.numPages}...`);
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map(item => item.str).join(' ');
    fullText += `--- Trang ${i} ---\n${pageText}\n\n`;
  }

  const textLen = fullText.trim().replace(/--- Trang \d+ ---/g, '').trim().length;
  if (textLen < 50) {
    statusCallback('Tài liệu dạng quét ảnh, đang kích hoạt OCR AI...');
    const ocrPrompt = `Bạn là chuyên gia OCR tiếng Việt. Hãy đọc và trích xuất NGUYÊN VĂN TOÀN BỘ nội dung chữ tiếng Việt có trong các hình ảnh tài liệu này. Giữ nguyên cấu trúc bảng biểu, số liệu, tiêu đề. Không bình luận hay giải thích.`;
    const content = [{ type: 'text', text: ocrPrompt }];
    const limitPages = Math.min(pdf.numPages, 10);

    for (let i = 1; i <= limitPages; i++) {
      statusCallback(`Đang quét xử lý ảnh trang ${i}/${limitPages}...`);
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      await page.render({ canvasContext: context, viewport }).promise;
      const base64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
      content.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } });
    }

    statusCallback('Đang nhận diện ký tự bằng AI...');
    const config = await fetchSystemConfig();
    const model = String(config?.gemini_model || '').trim();
    if (!model) throw new Error('OCR unavailable: AI model is not configured.');
    const ocrText = await sendChatRequest([{ role: 'user', content }], model, { temperature: 0, context: 'ocr', provider: 'gemini' });
    if (!ocrText) throw new Error('Không thể nhận diện được nội dung chữ từ file quét scan.');
    fullText = `📑 [NỘI DUNG NHẬN DIỆN OCR TÀI LIỆU SCAN: ${file.name}]\n\n` + ocrText;
  }

  return {
    text: fullText,
    type: 'pdf',
    meta: {
      pageCount: pdf.numPages
    }
  };
}

/**
 * Universal Entrypoint for parsing any file
 */
export async function parseUniversalFile(file, statusCallback = () => {}) {
  if (!file) throw new Error('Chưa chọn file.');
  
  const ext = '.' + file.name.split('.').pop().toLowerCase();
  
  if (['.xlsx', '.xls', '.csv'].includes(ext)) {
    return await parseExcelFile(file, statusCallback);
  }
  
  if (['.docx'].includes(ext)) {
    return await parseDocxFile(file, statusCallback);
  }

  if (['.doc'].includes(ext)) {
    return await parseDocFile(file, statusCallback);
  }

  if (['.pdf'].includes(ext)) {
    return await parsePdfFile(file, statusCallback);
  }
  
  if (['.txt', '.json', '.md'].includes(ext)) {
    statusCallback('Đang đọc tệp văn bản...');
    const text = await file.text();
    return {
      text: `📄 [TẬP TIN VĂN BẢN: ${file.name}]\n\n` + text,
      type: 'text',
      meta: {
        charCount: text.length
      }
    };
  }

  throw new Error(`Định dạng tệp "${ext}" chưa được hỗ trợ. Vui lòng tải file .doc, .docx, .xlsx, .xls, .csv, .pdf hoặc .txt.`);
}
