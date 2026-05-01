/**
 * Spell Check & Format Validation Module
 * Kiểm tra chính tả + thể thức VB theo NĐ30/HD36
 */
import { Document, Packer, Paragraph, TextRun, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { showToast } from '../main.js';
import { GoogleGenAI } from "https://esm.run/@google/genai";
import { SPELLING_ERRORS, CAPITALIZATION_RULES, OFFICIAL_TITLES, WHITELIST } from './vn-dictionary.js';
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp, getDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { firebaseConfig } from '../firebase-config.js';

let checkState = { file: null, fileName: '', paragraphs: [], errors: [], docType: 'unknown', formatErrors: [], xmlDoc: null, rawXml: '' };

export function renderSpellCheck(container) {
  checkState = { file: null, fileName: '', paragraphs: [], errors: [], docType: 'unknown', formatErrors: [], xmlDoc: null, rawXml: '' };
  container.innerHTML = `
    <div class="page-header">
      <div class="page-title">🔍 Kiểm Tra Văn Bản</div>
      <div class="page-subtitle">Kiểm tra chính tả & thể thức theo NĐ30/HD36</div>
    </div>
    <div class="section-card">
      <div class="section-title">📂 Tải file văn bản cần kiểm tra</div>
      <div class="upload-zone" id="sc-drop-zone">
        <div class="upload-icon">📄</div>
        <div class="upload-text">Kéo thả hoặc nhấp để chọn file <strong>.docx</strong></div>
        <div class="upload-hint">Chỉ hỗ trợ định dạng .docx (Open XML). Nếu bạn có file .doc, vui lòng chuyển sang .docx trước.</div>
        <input type="file" id="sc-file-input" accept=".docx" style="display:none">
      </div>
    </div>
    <div id="sc-progress" style="display:none; margin-top:20px; padding: 20px; background: var(--bg-card); border-radius: var(--radius-md); border: 1px solid var(--border-subtle); text-align: center;">
      <div style="margin-bottom:10px; font-weight:bold; color:var(--daquy-400)">🤖 Đang dùng AI để rà soát văn bản...</div>
      <div id="sc-progress-text" style="font-size:0.9rem; color:var(--text-secondary)">Khởi tạo AI...</div>
    </div>
    <div id="sc-results" style="display:none"></div>`;
  const zone = container.querySelector('#sc-drop-zone');
  const input = container.querySelector('#sc-file-input');
  zone.addEventListener('click', () => input.click());
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.style.borderColor = 'var(--pine-500)'; });
  zone.addEventListener('dragleave', () => { zone.style.borderColor = ''; });
  zone.addEventListener('drop', e => { e.preventDefault(); zone.style.borderColor = ''; if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0], container); });
  input.addEventListener('change', e => { if (e.target.files[0]) processFile(e.target.files[0], container); });
}

async function processFile(file, container) {
  if (!file.name.endsWith('.docx')) { showToast('Chỉ hỗ trợ file .docx', 'error'); return; }
  checkState.file = file;
  checkState.fileName = file.name;
  showToast('Đang phân tích văn bản...');
  try {
    const JSZip = (await import('https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm')).default;
    const zip = await JSZip.loadAsync(file);
    const docXml = await zip.file('word/document.xml')?.async('text');
    if (!docXml) { showToast('Không đọc được nội dung file', 'error'); return; }
    checkState.rawXml = docXml;
    const parser = new DOMParser();
    checkState.xmlDoc = parser.parseFromString(docXml, 'text/xml');
    checkState.paragraphs = extractParagraphs(checkState.xmlDoc);
    detectDocType(checkState);
    
    // Show progress UI
    container.querySelector('#sc-drop-zone').parentElement.style.display = 'none';
    const progressEl = container.querySelector('#sc-progress');
    const progressText = container.querySelector('#sc-progress-text');
    progressEl.style.display = 'block';

    // Bước 1: Kiểm tra từ điển cục bộ (nhanh, chính xác)
    progressText.innerText = 'Đang quét từ điển cục bộ...';
    const localErrors = checkSpellingLocal(checkState.paragraphs);
    
    // Bước 2: Kiểm tra bằng AI (sâu hơn)
    const aiErrors = await checkSpellingAI(checkState.paragraphs, progressText);
    
    // Bước 3: Kết hợp kết quả, ưu tiên local, loại bỏ trùng lặp
    checkState.errors = [...localErrors];
    aiErrors.forEach(ae => {
      const isDuplicate = checkState.errors.some(le => le.paraIdx === ae.paraIdx && Math.abs(le.pos - ae.pos) < 5);
      if (!isDuplicate) checkState.errors.push(ae);
    });
    
    checkState.formatErrors = checkFormat(checkState);
    
    progressEl.style.display = 'none';
    renderResults(container);
    logToFirestore(file.name, checkState.errors.length, checkState.formatErrors.length);
  } catch (e) { 
    console.error(e); 
    showToast('Lỗi: ' + e.message, 'error'); 
    container.querySelector('#sc-progress').style.display = 'none';
    container.querySelector('#sc-drop-zone').parentElement.style.display = 'block';
  }
}

function extractParagraphs(xmlDoc) {
  const paragraphs = [];
  const ns = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const pNodes = xmlDoc.getElementsByTagNameNS(ns, 'p');
  for (let i = 0; i < pNodes.length; i++) {
    const p = pNodes[i];
    const runs = p.getElementsByTagNameNS(ns, 'r');
    let text = '';
    const runDetails = [];
    for (let j = 0; j < runs.length; j++) {
      const tNodes = runs[j].getElementsByTagNameNS(ns, 't');
      let runText = '';
      for (let k = 0; k < tNodes.length; k++) runText += tNodes[k].textContent || '';
      if (runText) {
        const rPr = runs[j].getElementsByTagNameNS(ns, 'rPr')[0];
        let bold = false, italic = false, size = 0, font = '';
        if (rPr) {
          bold = !!rPr.getElementsByTagNameNS(ns, 'b')[0];
          italic = !!rPr.getElementsByTagNameNS(ns, 'i')[0];
          const szEl = rPr.getElementsByTagNameNS(ns, 'sz')[0];
          if (szEl) size = parseInt(szEl.getAttribute('w:val') || '0');
          const fnEl = rPr.getElementsByTagNameNS(ns, 'rFonts')[0];
          if (fnEl) font = fnEl.getAttribute('w:ascii') || fnEl.getAttribute('w:hAnsi') || '';
        }
        runDetails.push({ text: runText, bold, italic, size, font });
        text += runText;
      }
    }
    if (text.trim()) paragraphs.push({ text, runs: runDetails, index: i });
  }
  return paragraphs;
}

function detectDocType(state) {
  const allText = state.paragraphs.map(p => p.text).join(' ');
  if (allText.includes('ĐẢNG CỘNG SẢN VIỆT NAM')) state.docType = 'hd36';
  else if (allText.includes('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM')) state.docType = 'nd30';
  else state.docType = 'unknown';
}

async function checkSpellingAI(paragraphs, progressTextEl) {
  const errors = [];
  
  // 1. Fetch API Key
  progressTextEl.innerText = "Đang lấy cấu hình AI...";
  let apiKey = '';
  try {
    const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    const db = getFirestore(app);
    const configDoc = await getDoc(doc(db, 'config', 'system'));
    if (configDoc.exists()) {
      apiKey = configDoc.data().gemini_api_key || '';
    }
  } catch (e) { console.warn("Lỗi lấy API Key:", e); }

  if (!apiKey) {
    throw new Error("Chưa cấu hình Google AI Studio API Key. Vui lòng vào Trợ Lý Tra Cứu (icon ⚙️) để cấu hình.");
  }

  const aiClient = new GoogleGenAI({ apiKey });
  const modelName = 'gemini-3.1-flash-lite-preview';

  // 2. Batching paragraphs
  // Filter out empty or very short paragraphs to save tokens
  const validParas = paragraphs.filter(p => p.text.trim().length > 10);
  const BATCH_SIZE = 5; // Process 5 paragraphs at a time
  const batches = [];
  for (let i = 0; i < validParas.length; i += BATCH_SIZE) {
    batches.push(validParas.slice(i, i + BATCH_SIZE));
  }

  const systemInstruction = `Bạn là chuyên gia rà soát văn bản hành chính và văn bản Đảng của Việt Nam.
Nhiệm vụ: Đọc các đoạn văn bản được cung cấp và tìm ra các lỗi chính tả, lỗi dùng từ sai ngữ cảnh, câu lủng củng.
Yêu cầu QUAN TRỌNG:
- Sửa lỗi cho chuẩn xác, hợp ngữ cảnh văn phong hành chính.
- Bỏ qua các từ viết tắt phổ biến như UBND, HĐND, THCS...
- Từ "Nhân dân" khi đứng RIÊNG LẺ phải viết hoa chữ "Nhân": "Nhân dân".
- LƯU Ý QUAN TRỌNG: "Ủy ban nhân dân" và "Hội đồng nhân dân" giữ nguyên chữ thường, KHÔNG viết thành "Ủy ban Nhân dân" hay "Hội đồng Nhân dân".
- Đầu câu hoặc sau dấu chấm (.) bắt buộc phải viết hoa.
- Các chức danh và tổ chức phải viết hoa đúng:
  ${OFFICIAL_TITLES.join(', ')}
- LƯU Ý: Tuyệt đối không đổi từ "Hội viên" thành "Ủy viên" (đây là hai khái niệm khác nhau trong văn bản hội).
- TRẢ VỀ KẾT QUẢ DƯỚI DẠNG CHUỖI JSON ARRAY chứa các object có cấu trúc:
[
  { "original": "câu hoặc từ bị sai trích chính xác từ văn bản gốc", "suggestion": "câu/từ đã sửa", "reason": "lý do sửa" }
]
Nếu không có lỗi nào, trả về mảng rỗng: []
CHỈ trả về JSON, KHÔNG giải thích gì thêm, KHÔNG dùng markdown tick (như \`\`\`json).`;

  // 3. Process batches
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    progressTextEl.innerText = `Đang phân tích đoạn ${i * BATCH_SIZE + 1} đến ${Math.min((i + 1) * BATCH_SIZE, validParas.length)} / ${validParas.length}...`;
    
    let combinedText = "";
    batch.forEach(p => combinedText += `[ID:${p.index}] ${p.text}\n`);

    try {
      const response = await aiClient.models.generateContent({
        model: modelName,
        contents: combinedText,
        config: { systemInstruction: systemInstruction, temperature: 0.2 },
      });
      
      let resText = response.text || "[]";
      // Clean up markdown if AI still outputs it
      resText = resText.replace(/^\`\`\`json/m, '').replace(/^\`\`\`/m, '').trim();
      
      let aiErrors = [];
      try { aiErrors = JSON.parse(resText); } catch(err) { console.warn("Parse JSON failed for batch", i, resText); }

      // Map AI errors back to exact paragraph and position
      for (const err of aiErrors) {
        if (!err.original || !err.suggestion) continue;
        if (err.original === err.suggestion) continue;

        // BẢO VỆ ĐẶC BIỆT: Không được lẫn lộn giữa Hội viên và Ủy viên
        const lowOrig = err.original.toLowerCase();
        const lowSugg = err.suggestion.toLowerCase();
        if ((lowOrig.includes('hội viên') && lowSugg.includes('ủy viên')) ||
            (lowOrig.includes('ủy viên') && lowSugg.includes('hội viên'))) {
          console.warn("Blocked AI suggestion swapping Hội viên/Ủy viên:", err);
          continue;
        }

        // Escape regex special chars
        const escapedOriginal = err.original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(?<=\\s|^|\\p{P})${escapedOriginal}(?=\\s|$|\\p{P})`, 'gui');

        for (const p of batch) {
          let match;
          // Reset regex state
          regex.lastIndex = 0;
          
          while ((match = regex.exec(p.text)) !== null) {
            const pos = match.index;
            // Prevent duplicate or overlapping errors
            const isOverlap = errors.some(e => e.paraIdx === p.index && 
              ((pos >= e.pos && pos < e.pos + e.length) || (e.pos >= pos && e.pos < pos + err.original.length)));
            
            if (!isOverlap) {
              errors.push({
                type: 'spelling_ai',
                paraIdx: p.index,
                pos: pos,
                length: err.original.length,
                original: p.text.substring(pos, pos + err.original.length),
                suggestion: err.suggestion,
                reason: err.reason || "Sửa lỗi chính tả/ngữ pháp",
                message: `"${err.original}" → "${err.suggestion}"`
              });
            }
          }
        }
      }
    } catch(err) {
      console.warn("AI Generation error for batch", i, err);
    }
  }

  progressTextEl.innerText = "Hoàn tất kiểm tra AI!";
  return errors;
}

/**
 * Kiểm tra chính tả bằng từ điển cục bộ — nhanh và chính xác 100%
 */
function checkSpellingLocal(paragraphs) {
  const localErrors = [];
  const VN_WORD_CHARS = /[a-zA-Z0-9àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴĐ]/;
  
  paragraphs.forEach(p => {
    const lowerText = p.text.toLowerCase();
    for (const [wrong, correct] of Object.entries(SPELLING_ERRORS)) {
      if (wrong.toLowerCase() === correct.toLowerCase()) continue; // Skip identity mappings
      const wrongLower = wrong.toLowerCase();
      let searchFrom = 0;
      while (true) {
        const pos = lowerText.indexOf(wrongLower, searchFrom);
        if (pos === -1) break;
        searchFrom = pos + 1;
        
        // Kiểm tra word boundary
        const prevChar = pos > 0 ? p.text[pos - 1] : ' ';
        const nextChar = pos + wrong.length < p.text.length ? p.text[pos + wrong.length] : ' ';
        if (VN_WORD_CHARS.test(prevChar) || VN_WORD_CHARS.test(nextChar)) continue;
        
        localErrors.push({
          type: 'spelling_local',
          paraIdx: p.index,
          pos: pos,
          length: wrong.length,
          original: p.text.substring(pos, pos + wrong.length),
          suggestion: correct,
          reason: 'Lỗi chính tả (Từ điển VBAI)',
          message: `"${p.text.substring(pos, pos + wrong.length)}" \u2192 "${correct}"`
        });
      }
    }
    
    // Kiểm tra viết hoa chức danh/tổ chức
    for (const [wrongLower, correct] of Object.entries(CAPITALIZATION_RULES)) {
      let searchFrom = 0;
      while (true) {
        const pos = lowerText.indexOf(wrongLower, searchFrom);
        if (pos === -1) break;
        searchFrom = pos + 1;
        
        const actual = p.text.substring(pos, pos + wrongLower.length);
        // Chỉ báo lỗi nếu viết sai (khác với dạng chuẩn và không phải IN HOA toàn bộ)
        if (actual !== correct && actual !== actual.toUpperCase()) {
          // Kiểm tra không trùng với lỗi đã tìm
          const isDuplicate = localErrors.some(e => e.paraIdx === p.index && Math.abs(e.pos - pos) < 3);
          if (!isDuplicate) {
            localErrors.push({
              type: 'capitalization',
              paraIdx: p.index,
              pos: pos,
              length: wrongLower.length,
              original: actual,
              suggestion: correct,
              reason: `Viết hoa chức danh/tổ chức: "${correct}"`,
              message: `"${actual}" \u2192 "${correct}"`
            });
          }
        }
      }
    }
    
    // Kiểm tra "Nhân dân" riêng lẻ (không nằm trong "Ủy ban nhân dân" hoặc "Hội đồng nhân dân")
    const ndPattern = /nh\u00e2n d\u00e2n/gi;
    let ndMatch;
    while ((ndMatch = ndPattern.exec(p.text)) !== null) {
      const pos = ndMatch.index;
      const actual = p.text.substring(pos, pos + 8); // "nhân dân" = 8 chars
      
      // Bỏ qua nếu đã viết hoa đúng "Nhân dân" hoặc IN HOA "NHÂN DÂN"
      if (actual === 'Nh\u00e2n d\u00e2n' || actual === 'NH\u00c2N D\u00c2N') continue;
      
      // Kiểm tra xem có nằm trong "Ủy ban nhân dân" hoặc "Hội đồng nhân dân" không
      const prefixStart = Math.max(0, pos - 15);
      const prefix = p.text.substring(prefixStart, pos).toLowerCase();
      if (prefix.endsWith('ủy ban ') || prefix.endsWith('y ban ') ||
          prefix.endsWith('ban nhân dân') ||
          prefix.endsWith('đồng ') || prefix.endsWith('ng ')) {
        // Kiểm tra cụ thể hơn
        const longPrefix = p.text.substring(Math.max(0, pos - 20), pos + 8).toLowerCase();
        if (longPrefix.includes('ủy ban nhân dân') || longPrefix.includes('hội đồng nhân dân')) {
          continue; // Bỏ qua - đây là cụm từ ghép, giữ nguyên
        }
      }
      
      // "nhân dân" riêng lẻ, cần viết hoa
      const isDuplicate = localErrors.some(e => e.paraIdx === p.index && Math.abs(e.pos - pos) < 3);
      if (!isDuplicate) {
        localErrors.push({
          type: 'capitalization',
          paraIdx: p.index,
          pos: pos,
          length: 8,
          original: actual,
          suggestion: 'Nh\u00e2n d\u00e2n',
          reason: 'Viết hoa "Nhân dân" khi đứng riêng lẻ',
          message: `"${actual}" \u2192 "Nhân dân"`
        });
      }
    }
  });
  return localErrors;
}

function checkFormat(state) {
  const errors = [];
  const ns = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const xmlDoc = state.xmlDoc;
  // Check page margins
  const sectPr = xmlDoc.getElementsByTagNameNS(ns, 'sectPr');
  if (sectPr.length > 0) {
    const pgMar = sectPr[0].getElementsByTagNameNS(ns, 'pgMar')[0];
    if (pgMar) {
      const top = parseInt(pgMar.getAttribute('w:top') || '0');
      const bottom = parseInt(pgMar.getAttribute('w:bottom') || '0');
      const left = parseInt(pgMar.getAttribute('w:left') || '0');
      const right = parseInt(pgMar.getAttribute('w:right') || '0');
      if (state.docType === 'nd30') {
        if (Math.abs(top - 1134) > 100) errors.push({ type: 'format', rule: 'NĐ30', message: `Lề trên sai: ${Math.round(top/56.7)}mm (chuẩn: 20mm)` });
        if (Math.abs(bottom - 1134) > 100) errors.push({ type: 'format', rule: 'NĐ30', message: `Lề dưới sai: ${Math.round(bottom/56.7)}mm (chuẩn: 20mm)` });
        if (Math.abs(left - 1701) > 100) errors.push({ type: 'format', rule: 'NĐ30', message: `Lề trái sai: ${Math.round(left/56.7)}mm (chuẩn: 30mm)` });
        if (Math.abs(right - 1134) > 100) errors.push({ type: 'format', rule: 'NĐ30', message: `Lề phải sai: ${Math.round(right/56.7)}mm (chuẩn: 20mm)` });
      } else if (state.docType === 'hd36') {
        if (Math.abs(left - 1701) > 100) errors.push({ type: 'format', rule: 'HD36', message: `Lề trái sai: ${Math.round(left/56.7)}mm (chuẩn: 30mm)` });
        if (Math.abs(right - 850) > 100) errors.push({ type: 'format', rule: 'HD36', message: `Lề phải sai: ${Math.round(right/56.7)}mm (chuẩn: 15mm)` });
      }
    }
  }
  // Check font
  const allText = state.paragraphs.map(p => p.text).join(' ');
  state.paragraphs.forEach(p => {
    p.runs.forEach(r => {
      if (r.font && r.font !== 'Times New Roman' && r.font !== '' && !r.font.startsWith('Symbol') && r.font !== 'Wingdings') {
        const msg = `Font "${r.font}" không đúng chuẩn (phải dùng Times New Roman)`;
        if (!errors.find(e => e.message === msg)) errors.push({ type: 'format', rule: state.docType === 'hd36' ? 'HD36' : 'NĐ30', message: msg });
      }
    });
  });
  // Check NĐ30 specific
  if (state.docType === 'nd30') {
    if (!allText.includes('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM')) errors.push({ type: 'format', rule: 'NĐ30', message: 'Thiếu Quốc hiệu "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM"' });
    if (!allText.includes('Độc lập - Tự do - Hạnh phúc') && !allText.includes('Độc lập – Tự do – Hạnh phúc')) errors.push({ type: 'format', rule: 'NĐ30', message: 'Thiếu hoặc sai Tiêu ngữ "Độc lập - Tự do - Hạnh phúc"' });
    if (!allText.includes('Nơi nhận')) errors.push({ type: 'format', rule: 'NĐ30', message: 'Thiếu phần "Nơi nhận"' });
  }
  // Check HD36 specific
  if (state.docType === 'hd36') {
    if (!allText.includes('ĐẢNG CỘNG SẢN VIỆT NAM')) errors.push({ type: 'format', rule: 'HD36', message: 'Thiếu tiêu đề "ĐẢNG CỘNG SẢN VIỆT NAM"' });
    if (allText.includes('Độc lập - Tự do - Hạnh phúc')) errors.push({ type: 'format', rule: 'HD36', message: 'VB Đảng KHÔNG có tiêu ngữ "Độc lập - Tự do - Hạnh phúc"' });
    if (allText.includes('TM.') || allText.includes('KT.') || allText.includes('TL.')) {
      errors.push({ type: 'format', rule: 'HD36', message: 'VB Đảng dùng T/M, K/T, T/L (gạch chéo), KHÔNG dùng TM., KT., TL. (dấu chấm)' });
    }
    if (!allText.includes('*') && state.paragraphs.length > 3) {
      const hasCQ = state.paragraphs.some(p => p.runs.some(r => r.bold) && p.text.length < 60);
      if (hasCQ) errors.push({ type: 'format', rule: 'HD36', message: 'Có thể thiếu dấu sao (*) dưới tên cơ quan ban hành' });
    }
  }
  
  // Kiểm tra tính nhất quán: UBND vs Ủy ban nhân dân
  const countUBND = (allText.match(/\bUBND\b/g) || []).length;
  const countUyBan = (allText.match(/Ủy ban nhân dân/gi) || []).length;
  if (countUBND > 0 && countUyBan > 0) {
    errors.push({ type: 'format', rule: 'Nhất quán', message: `Phát hiện dùng lẫn lộn "Ủy ban nhân dân" (${countUyBan} lần) và "UBND" (${countUBND} lần). Nên viết đầy đủ lần đầu, sau đó dùng viết tắt.` });
  }
  
  return errors;
}

function renderResults(container) {
  const results = container.querySelector('#sc-results');
  results.style.display = 'block';
  const totalErrors = checkState.errors.length + checkState.formatErrors.length;
  const docLabel = checkState.docType === 'nd30' ? 'VB Hành Chính (NĐ30)' : checkState.docType === 'hd36' ? 'VB Đảng (HD36)' : 'Không xác định';
  results.innerHTML = `
    <div class="sc-summary-grid">
      <div class="sc-summary-card"><div class="sc-summary-icon">📄</div><div class="sc-summary-info"><div class="sc-summary-value">${checkState.fileName}</div><div class="sc-summary-label">Loại: ${docLabel}</div></div></div>
      <div class="sc-summary-card ${totalErrors === 0 ? 'sc-ok' : 'sc-warn'}"><div class="sc-summary-icon">${totalErrors === 0 ? '✅' : '⚠️'}</div><div class="sc-summary-info"><div class="sc-summary-value">${totalErrors}</div><div class="sc-summary-label">Tổng số lỗi</div></div></div>
      <div class="sc-summary-card sc-clickable" onclick="document.getElementById('sc-spell-details').scrollIntoView({behavior: 'smooth'})" style="cursor:pointer" title="Click để xem chi tiết"><div class="sc-summary-icon">🔤</div><div class="sc-summary-info"><div class="sc-summary-value">${checkState.errors.length}</div><div class="sc-summary-label">Lỗi chính tả / Ngữ pháp</div></div></div>
      <div class="sc-summary-card sc-clickable" onclick="document.getElementById('sc-format-details').scrollIntoView({behavior: 'smooth'})" style="cursor:pointer" title="Click để xem chi tiết"><div class="sc-summary-icon">📐</div><div class="sc-summary-info"><div class="sc-summary-value">${checkState.formatErrors.length}</div><div class="sc-summary-label">Lỗi thể thức</div></div></div>
    </div>
    
    <div id="sc-spell-details" class="section-card" style="margin-top:20px; display: ${checkState.errors.length > 0 ? 'block' : 'none'}">
      <div class="section-title">🔤 Lỗi chính tả & Ngữ pháp (AI Đề xuất)</div>
      <div class="sc-format-errors">
        ${checkState.errors.map(e => `
          <div class="sc-format-item" style="flex-direction: column; gap: 4px; background: rgba(230,162,0,0.08); border-color: rgba(230,162,0,0.2);">
            <div><span class="sc-format-badge" style="background:var(--daquy-500); color:#fff">Sai</span> <span style="text-decoration:line-through; color:var(--text-muted)">${escapeHtml(e.original)}</span> ➡️ <span style="font-weight:bold; color:var(--pine-500)">${escapeHtml(e.suggestion)}</span></div>
            <div style="font-size:0.8rem; color:var(--text-secondary); font-style:italic; margin-top:4px">💡 Lý do: ${escapeHtml(e.reason)}</div>
          </div>
        `).join('')}
      </div>
    </div>

    ${checkState.formatErrors.length > 0 ? `
    <div id="sc-format-details" class="section-card" style="margin-top:20px">
      <div class="section-title">📐 Lỗi thể thức ${docLabel}</div>
      <div class="sc-format-errors">${checkState.formatErrors.map(e => `<div class="sc-format-item"><span class="sc-format-badge">${e.rule}</span><span>${e.message}</span></div>`).join('')}</div>
    </div>` : ''}
    
    <div class="section-card" style="margin-top:20px">
      <div class="section-title">👁️ Xem trước — So sánh văn bản</div>
      <div class="sc-preview-grid">
        <div class="sc-preview-col"><div class="sc-preview-label">📄 Văn bản gốc</div><div class="sc-preview-box" id="sc-original"></div></div>
        <div class="sc-preview-col"><div class="sc-preview-label">✅ Văn bản đã kiểm tra</div><div class="sc-preview-box" id="sc-checked"></div></div>
      </div>
    </div>
    <div class="btn-row" style="justify-content:center;margin-top:24px">
      <button class="btn btn-secondary" id="sc-btn-new">📂 Kiểm tra file khác</button>
      <button class="btn btn-success" id="sc-btn-export">⬇ Tải file đã sửa (.docx)</button>
      <button class="btn btn-primary" id="sc-btn-report">📋 Tải báo cáo lỗi (.docx)</button>
    </div>`;
  // Render previews
  renderOriginal(container.querySelector('#sc-original'));
  renderChecked(container.querySelector('#sc-checked'));
  // Buttons
  results.querySelector('#sc-btn-new').onclick = () => renderSpellCheck(container);
  results.querySelector('#sc-btn-export').onclick = () => exportCorrected();
  results.querySelector('#sc-btn-report').onclick = () => exportReport();
}

function renderOriginal(el) {
  // Hiển thị văn bản GỐC: bôi đỏ các vị trí có lỗi
  el.innerHTML = checkState.paragraphs.map((p, pIdx) => {
    const paraErrors = checkState.errors.filter(e => e.paraIdx === pIdx);
    if (paraErrors.length === 0) return `<div class="sc-para">${escapeHtml(p.text)}</div>`;
    
    let text = p.text;
    let result = '';
    let lastIdx = 0;
    const sortedAsc = [...paraErrors].sort((a, b) => a.pos - b.pos);
    sortedAsc.forEach(err => {
      result += escapeHtml(text.substring(lastIdx, err.pos));
      // Bôi đỏ từ sai
      result += `<span class="sc-error" title="${escapeHtml(err.reason)}: ${escapeHtml(err.suggestion)}">${escapeHtml(text.substring(err.pos, err.pos + err.length))}</span>`;
      lastIdx = err.pos + err.length;
    });
    result += escapeHtml(text.substring(lastIdx));
    return `<div class="sc-para">${result}</div>`;
  }).join('');
}

function renderChecked(el) {
  // Hiển thị văn bản ĐÃ SỬA: thay thế lỗi bằng gợi ý, highlight màu xanh
  el.innerHTML = checkState.paragraphs.map((p, pIdx) => {
    const paraErrors = checkState.errors.filter(e => e.paraIdx === pIdx);
    if (paraErrors.length === 0) return `<div class="sc-para">${escapeHtml(p.text)}</div>`;
    
    let text = p.text;
    let result = '';
    let lastIdx = 0;
    const sortedAsc = [...paraErrors].sort((a, b) => a.pos - b.pos);
    sortedAsc.forEach(err => {
      result += escapeHtml(text.substring(lastIdx, err.pos));
      // Hiển thị từ ĐÃ SỬA (suggestion) với highlight xanh lá
      result += `<span class="sc-corrected" title="G\u1ed1c: ${escapeHtml(err.original)}">${escapeHtml(err.suggestion)}</span>`;
      lastIdx = err.pos + err.length;
    });
    result += escapeHtml(text.substring(lastIdx));
    return `<div class="sc-para">${result}</div>`;
  }).join('');
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function exportCorrected() {
  try {
    const children = [];
    children.push(new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: `File gốc: ${checkState.fileName}`, font: 'Times New Roman', size: 24, italics: true, color: '888888' })] }));
    checkState.paragraphs.forEach((p, pIdx) => {
      let text = p.text;
      const paraErrors = checkState.errors.filter(e => e.paraIdx === pIdx).sort((a, b) => b.pos - a.pos);
      paraErrors.forEach(err => {
        text = text.substring(0, err.pos) + err.suggestion + text.substring(err.pos + err.length);
      });
      children.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { before: 60, after: 60 }, indent: { firstLine: 567 }, children: [new TextRun({ text, font: 'Times New Roman', size: 28 })] }));
    });
    const doc = new Document({ styles: { default: { document: { run: { font: 'Times New Roman', size: 28 } } } }, sections: [{ children }] });
    const blob = await Packer.toBlob(doc);
    saveAs(blob, `da_sua_${checkState.fileName}`);
    showToast('✓ Đã tải file đã sửa!');
  } catch (e) { showToast('Lỗi: ' + e.message, 'error'); }
}

async function exportReport() {
  try {
    const children = [];
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 300 }, children: [new TextRun({ text: 'BÁO CÁO KIỂM TRA VĂN BẢN', font: 'Times New Roman', size: 32, bold: true })] }));
    children.push(new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: `File: ${checkState.fileName}`, font: 'Times New Roman', size: 28 })] }));
    children.push(new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: `Loại VB: ${checkState.docType === 'nd30' ? 'Hành chính (NĐ30)' : checkState.docType === 'hd36' ? 'Đảng (HD36)' : 'Không xác định'}`, font: 'Times New Roman', size: 28 })] }));
    children.push(new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: `Ngày kiểm tra: ${new Date().toLocaleDateString('vi-VN')}`, font: 'Times New Roman', size: 28 })] }));
    if (checkState.errors.length > 0) {
      children.push(new Paragraph({ spacing: { before: 200, after: 100 }, children: [new TextRun({ text: `I. LỖI CHÍNH TẢ (${checkState.errors.length} lỗi)`, font: 'Times New Roman', size: 28, bold: true })] }));
      checkState.errors.forEach((err, i) => {
        children.push(new Paragraph({ spacing: { after: 60 }, indent: { firstLine: 567 }, children: [
          new TextRun({ text: `${i + 1}. `, font: 'Times New Roman', size: 28, bold: true }),
          new TextRun({ text: `"${err.original}"`, font: 'Times New Roman', size: 28, color: 'FF0000' }),
          new TextRun({ text: ` → "${err.suggestion}"`, font: 'Times New Roman', size: 28 }),
        ] }));
      });
    }
    if (checkState.formatErrors.length > 0) {
      children.push(new Paragraph({ spacing: { before: 200, after: 100 }, children: [new TextRun({ text: `II. LỖI THỂ THỨC (${checkState.formatErrors.length} lỗi)`, font: 'Times New Roman', size: 28, bold: true })] }));
      checkState.formatErrors.forEach((err, i) => {
        children.push(new Paragraph({ spacing: { after: 60 }, indent: { firstLine: 567 }, children: [
          new TextRun({ text: `${i + 1}. [${err.rule}] `, font: 'Times New Roman', size: 28, bold: true }),
          new TextRun({ text: err.message, font: 'Times New Roman', size: 28 }),
        ] }));
      });
    }
    if (checkState.errors.length === 0 && checkState.formatErrors.length === 0) {
      children.push(new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: 'Không phát hiện lỗi nào.', font: 'Times New Roman', size: 28, color: '008000' })] }));
    }
    const doc = new Document({ styles: { default: { document: { run: { font: 'Times New Roman', size: 28 } } } }, sections: [{ children }] });
    const blob = await Packer.toBlob(doc);
    saveAs(blob, `bao_cao_loi_${checkState.fileName}`);
    showToast('✓ Đã tải báo cáo lỗi!');
  } catch (e) { showToast('Lỗi: ' + e.message, 'error'); }
}

function logToFirestore(fileName, spellCount, formatCount) {
  try {
    const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    const db = getFirestore(app);
    addDoc(collection(db, 'search_logs'), {
      query: `[Kiểm Tra VB] ${fileName} — ${spellCount} lỗi CT, ${formatCount} lỗi TT`,
      model: "Spell Check Engine", userEmail: window.currentUser?.email || 'Unknown', timestamp: serverTimestamp()
    }).catch(() => {});
  } catch (e) {}
}
