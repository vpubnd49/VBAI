/**
 * Spell Check & Format Validation Module
 * Kiểm tra chính tả + thể thức VB theo NĐ30/HD05
 */
import { Document, Packer, Paragraph, TextRun, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { showToast } from './ui-utils.js';
import { sendChatRequest } from './ai-proxy.js';
import { fetchSystemConfig } from './system-config.js';
import { SPELLING_ERRORS, CAPITALIZATION_RULES, TITLE_CONTEXT_RULES, OFFICIAL_TITLES, WHITELIST } from './vn-dictionary.js';
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { firebaseConfig } from '../firebase-config.js';

let checkState = { file: null, fileName: '', paragraphs: [], errors: [], docType: 'unknown', formatErrors: [], xmlDoc: null, rawXml: '' };

export function renderSpellCheck(container) {
  checkState = { file: null, fileName: '', paragraphs: [], errors: [], docType: 'unknown', formatErrors: [], xmlDoc: null, rawXml: '' };
  container.innerHTML = `
    <div class="page-header">
      <div class="page-title">🔍 Kiểm Tra Văn Bản</div>
      <div class="page-subtitle">Kiểm tra chính tả & thể thức theo NĐ30/HD05</div>
    </div>
    <div class="section-card" style="position:relative;">
      <button class="btn btn-secondary" onclick="window.location.reload();" style="position:absolute; top:16px; right:16px; display:flex; align-items:center; gap:6px; padding:6px 12px; font-size:12px; border-radius:6px; z-index:10;" title="Làm mới công cụ">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>
        Làm mới
      </button>
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
  if (allText.includes('ĐẢNG CỘNG SẢN VIỆT NAM')) state.docType = 'hd05';
  else if (allText.includes('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM')) state.docType = 'nd30';
  else state.docType = 'unknown';
}

async function checkSpellingAI(paragraphs, progressTextEl) {
  const errors = [];
  
  progressTextEl.innerText = "Đang kết nối AI...";
  const config = await fetchSystemConfig();
  const isNineRouter = config?.active_chat_provider === '9router' || config?.active_provider === '9router';
  const modelName = isNineRouter
    ? (config?.nine_router_model || 'DevGOVietnam-Frontier')
    : (config?.gemini_model || 'gemini-2.5-flash');

  // 2. Batching paragraphs — batch lớn hơn để tối ưu số lần gọi API
  const validParas = paragraphs.filter(p => p.text.trim().length > 10);
  const BATCH_SIZE = 30;
  const batches = [];
  for (let i = 0; i < validParas.length; i += BATCH_SIZE) {
    batches.push(validParas.slice(i, i + BATCH_SIZE));
  }

  const systemInstruction = `Bạn là chuyên gia rà soát văn bản hành chính và văn bản Đảng của Việt Nam.
Nhiệm vụ: Đọc từng đoạn văn bản (có đánh dấu [ID:số]) và tìm ra LỖI CHÍNH TẢ THỰC SỰ, lỗi dùng từ sai ngữ cảnh.

QUY TẮC NGHIÊM NGẶT:
1. CHỈ báo lỗi chính tả thực sự (đánh máy sai, thiếu dấu, sai phụ âm). KHÔNG báo lỗi viết hoa chức danh.
2. KHÔNG sửa viết hoa/viết thường cho các chức danh như: ủy viên, chủ tịch, giám đốc, bí thư... Đây là TRÁCH NHIỆM CỦA HỆ THỐNG CỤC BỘ, không phải của bạn.
3. Bỏ qua viết tắt: UBND, HĐND, THCS, BHXH, PCT, CVP...
4. "Ủy ban nhân dân", "Hội đồng nhân dân", "Tòa án nhân dân", "Viện kiểm sát nhân dân" giữ nguyên chữ thường cho "nhân dân".
5. KHÔNG đổi "Hội viên" thành "Ủy viên" (hai khái niệm khác nhau).
6. Trường "original" PHẢI là chuỗi CHÍNH XÁC TỪ VĂN BẢN GỐC, copy nguyên xi.
7. Trường "para_id" PHẢI là số ID đoạn văn chứa lỗi (lấy từ [ID:số] ở đầu đoạn).

VÍ DỤ ĐÚNG:
- "triểm khai" → "triển khai" (sai phụ âm) ✓
- "thực hiệng" → "thực hiện" (thừa chữ g) ✓
- "bảo cáo" → "báo cáo" (sai dấu) ✓

VÍ DỤ SAI (KHÔNG ĐƯỢC LÀM):
- "ủy viên" → "Ủy viên" (viết hoa chức danh) ✗
- "nhà nước" → "Nhà nước" (viết hoa) ✗
- "chủ tịch" → "Chủ tịch" (viết hoa) ✗

TRẢ VỀ JSON ARRAY:
[{"para_id": 5, "original": "triểm khai", "suggestion": "triển khai", "reason": "Sai phụ âm: triểm → triển"}]
Nếu không có lỗi, trả []. CHỈ JSON, KHÔNG markdown, KHÔNG giải thích.`;

  // 3. Process batches concurrently
  let completedBatches = 0;
  const MAX_CONCURRENT = 6;
  
  for (let i = 0; i < batches.length; i += MAX_CONCURRENT) {
    const currentChunk = batches.slice(i, i + MAX_CONCURRENT);
    
    await Promise.all(currentChunk.map(async (batch) => {
      let combinedText = "";
      batch.forEach(p => combinedText += `[ID:${p.index}] ${p.text}\n`);

      try {
        const messages = [
          { role: "system", content: systemInstruction },
          { role: "user", content: combinedText }
        ];
        let resText = await sendChatRequest(messages, modelName, { temperature: 0.1, context: 'spellcheck' });
        resText = resText.replace(/^\`\`\`json/m, '').replace(/^\`\`\`/m, '').trim();
        
        let aiErrors = [];
        try { aiErrors = JSON.parse(resText); } catch(err) { console.warn("Parse JSON failed for batch", resText); }

        for (const err of aiErrors) {
          if (!err.original || !err.suggestion) continue;
          if (err.original === err.suggestion) continue;

          // BẢO VỆ: Không lẫn Hội viên/Ủy viên
          const lowOrig = err.original.toLowerCase();
          const lowSugg = err.suggestion.toLowerCase();
          if ((lowOrig.includes('hội viên') && lowSugg.includes('ủy viên')) ||
              (lowOrig.includes('ủy viên') && lowSugg.includes('hội viên'))) {
            continue;
          }

          // BẢO VỆ: Bỏ qua nếu AI chỉ thay đổi viết hoa (chức danh)
          if (lowOrig === lowSugg) continue;

          // Tìm đoạn chính xác bằng para_id hoặc fallback tìm trong batch
          const targetParas = err.para_id !== undefined
            ? batch.filter(p => p.index === err.para_id)
            : batch;

          for (const p of targetParas) {
            // Dùng indexOf chính xác thay vì regex fuzzy
            const pos = p.text.indexOf(err.original);
            if (pos === -1) continue;

            // Kiểm tra không trùng lặp/chồng chéo
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
            break; // Chỉ match 1 lần mỗi đoạn
          }
        }
      } catch(err) {
        console.warn("AI Generation error for batch", err);
      } finally {
        completedBatches++;
        progressTextEl.innerText = `Đang phân tích... hoàn thành ${Math.min(completedBatches * BATCH_SIZE, validParas.length)} / ${validParas.length} đoạn.`;
      }
    }));
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
      if (wrong.toLowerCase() === correct.toLowerCase()) continue;
      const wrongLower = wrong.toLowerCase();
      let searchFrom = 0;
      while (true) {
        const pos = lowerText.indexOf(wrongLower, searchFrom);
        if (pos === -1) break;
        searchFrom = pos + 1;
        
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
          reason: 'Lỗi chính tả (Từ điển Trợ lý hành chính)',
          message: `"${p.text.substring(pos, pos + wrong.length)}" \u2192 "${correct}"`
        });
      }
    }
    
    // Kiểm tra mở rộng UBND/HĐND (Yêu cầu mới)
    const ABBR_RULES = [
      { abbr: 'UBND', full: 'Ủy ban nhân dân' },
      { abbr: 'HĐND', full: 'Hội đồng nhân dân' }
    ];

    ABBR_RULES.forEach(rule => {
      let sf = 0;
      while (true) {
        const pos = p.text.indexOf(rule.abbr, sf);
        if (pos === -1) break;
        sf = pos + rule.abbr.length;

        const charBefore = pos > 0 ? p.text[pos - 1] : '';
        const charAfter = pos + rule.abbr.length < p.text.length ? p.text[pos + rule.abbr.length] : '';

        // 1. Kiểm tra dấu gạch ngang (Số hiệu VB: -UBND, UBND-, -HĐND, HĐND-)
        if (charBefore === '-' || charAfter === '-') continue;

        // 2. Kiểm tra ranh giới từ (Tránh VPUBND)
        if (VN_WORD_CHARS.test(charBefore) || VN_WORD_CHARS.test(charAfter)) continue;

        // 3. Kiểm tra cụm từ bảo vệ (không dịch)
        const contextText = p.text;
        
        // Bảo vệ cụm: "Văn phòng ĐĐBQH và HĐND tỉnh"
        if (rule.abbr === 'HĐND') {
           const p1 = "Văn phòng ĐĐBQH và HĐND tỉnh";
           const idxInP1 = p1.indexOf('HĐND');
           const startP1 = pos - idxInP1;
           if (startP1 >= 0 && contextText.substring(startP1, startP1 + p1.length) === p1) continue;
        }

        // Bảo vệ cụm: "Văn phòng HĐND và UBND xã" (phường, đặc khu)
        const pPatterns = ["Văn phòng HĐND và UBND xã", "Văn phòng HĐND và UBND phường", "Văn phòng HĐND và UBND đặc khu"];
        let isProtected = false;
        for (const pattern of pPatterns) {
          const idxInP = pattern.indexOf(rule.abbr);
          if (idxInP !== -1) {
            const startP = pos - idxInP;
            if (startP >= 0 && contextText.substring(startP, startP + pattern.length) === pattern) {
              isProtected = true;
              break;
            }
          }
        }
        if (isProtected) continue;

        // Nếu vượt qua bộ lọc -> Đề xuất mở rộng
        localErrors.push({
          type: 'capitalization',
          paraIdx: p.index,
          pos: pos,
          length: rule.abbr.length,
          original: rule.abbr,
          suggestion: rule.full,
          reason: `Mở rộng viết tắt: ${rule.full}`,
          message: `"${rule.abbr}" \u2192 "${rule.full}"`
        });
      }
    });
    
    // Kiểm tra viết hoa TỔ CHỨC (cụm dài — luôn áp dụng)
    for (const [wrongLower, correct] of Object.entries(CAPITALIZATION_RULES)) {
      let searchFrom = 0;
      while (true) {
        const pos = lowerText.indexOf(wrongLower, searchFrom);
        if (pos === -1) break;
        searchFrom = pos + 1;
        
        const actual = p.text.substring(pos, pos + wrongLower.length);
        if (actual !== correct && actual !== actual.toUpperCase()) {
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
    
    // Kiểm tra "Nhân dân" riêng lẻ — PHẢI bỏ qua khi nằm trong cụm từ ghép
    // Bước 1: Pre-scan tất cả vị trí cụm từ ghép chứa "nhân dân"
    const NHAN_DAN_COMPOUNDS = [
      'ủy ban nhân dân', 'hội đồng nhân dân',
      'tòa án nhân dân', 'toà án nhân dân',      // Hỗ trợ cả 2 dạng dấu
      'viện kiểm sát nhân dân'
    ];
    const protectedRanges = [];
    for (const compound of NHAN_DAN_COMPOUNDS) {
      let sf = 0;
      while (true) {
        const cp = lowerText.indexOf(compound, sf);
        if (cp === -1) break;
        protectedRanges.push({ start: cp, end: cp + compound.length });
        sf = cp + 1;
      }
    }

    // Bước 2: Tìm tất cả "nhân dân" và chỉ báo lỗi nếu KHÔNG nằm trong vùng bảo vệ
    const ndPattern = /nh\u00e2n d\u00e2n/gi;
    let ndMatch;
    while ((ndMatch = ndPattern.exec(p.text)) !== null) {
      const pos = ndMatch.index;
      const actual = p.text.substring(pos, pos + 8);
      
      // Bỏ qua nếu đã viết hoa đúng "Nhân dân" hoặc IN HOA "NHÂN DÂN"
      if (actual === 'Nh\u00e2n d\u00e2n' || actual === 'NH\u00c2N D\u00c2N') continue;
      
      // Bỏ qua nếu nằm trong vùng bảo vệ (cụm từ ghép)
      const isProtected = protectedRanges.some(r => pos >= r.start && (pos + 8) <= r.end);
      if (isProtected) continue;
      
      // "nhân dân" đứng riêng lẻ → cần viết hoa thành "Nhân dân"
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
      } else if (state.docType === 'hd05') {
        if (Math.abs(left - 1701) > 100) errors.push({ type: 'format', rule: 'HD05', message: `Lề trái sai: ${Math.round(left/56.7)}mm (chuẩn: 30mm)` });
        if (Math.abs(right - 850) > 100) errors.push({ type: 'format', rule: 'HD05', message: `Lề phải sai: ${Math.round(right/56.7)}mm (chuẩn: 15mm)` });
      }
    }
  }
  // Check font
  const allText = state.paragraphs.map(p => p.text).join(' ');
  state.paragraphs.forEach(p => {
    p.runs.forEach(r => {
      if (r.font && r.font !== 'Times New Roman' && r.font !== '' && !r.font.startsWith('Symbol') && r.font !== 'Wingdings') {
        const msg = `Font "${r.font}" không đúng chuẩn (phải dùng Times New Roman)`;
        if (!errors.find(e => e.message === msg)) errors.push({ type: 'format', rule: state.docType === 'hd05' ? 'HD05' : 'NĐ30', message: msg });
      }
    });
  });
  // Check NĐ30 specific
  if (state.docType === 'nd30') {
    if (!allText.includes('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM')) errors.push({ type: 'format', rule: 'NĐ30', message: 'Thiếu Quốc hiệu "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM"' });
    if (!allText.includes('Độc lập - Tự do - Hạnh phúc') && !allText.includes('Độc lập – Tự do – Hạnh phúc')) errors.push({ type: 'format', rule: 'NĐ30', message: 'Thiếu hoặc sai Tiêu ngữ "Độc lập - Tự do - Hạnh phúc"' });
    if (!allText.includes('Nơi nhận')) errors.push({ type: 'format', rule: 'NĐ30', message: 'Thiếu phần "Nơi nhận"' });
  }
  // Check HD05 specific
  if (state.docType === 'hd05') {
    if (!allText.includes('ĐẢNG CỘNG SẢN VIỆT NAM')) errors.push({ type: 'format', rule: 'HD05', message: 'Thiếu tiêu đề "ĐẢNG CỘNG SẢN VIỆT NAM"' });
    if (allText.includes('Độc lập - Tự do - Hạnh phúc')) errors.push({ type: 'format', rule: 'HD05', message: 'VB Đảng KHÔNG có tiêu ngữ "Độc lập - Tự do - Hạnh phúc"' });
    if (allText.includes('TM.') || allText.includes('KT.') || allText.includes('TL.')) {
      errors.push({ type: 'format', rule: 'HD05', message: 'VB Đảng dùng T/M, K/T, T/L (gạch chéo), KHÔNG dùng TM., KT., TL. (dấu chấm)' });
    }
    if (!allText.includes('*') && state.paragraphs.length > 3) {
      const hasCQ = state.paragraphs.some(p => p.runs.some(r => r.bold) && p.text.length < 60);
      if (hasCQ) errors.push({ type: 'format', rule: 'HD05', message: 'Có thể thiếu dấu sao (*) dưới tên cơ quan ban hành' });
    }
    
    // HD05 Tờ trình check: Kính trình instead of Kính gửi
    const isToTrinh = state.paragraphs.some(p => p.text.toUpperCase().includes('TỜ TRÌNH'));
    if (isToTrinh) {
      const hasKinhGui = state.paragraphs.some(p => p.text.includes('Kính gửi'));
      if (hasKinhGui) {
        errors.push({ type: 'format', rule: 'HD05', message: 'Tờ trình Đảng theo HD05 phải dùng "Kính trình", không dùng "Kính gửi"' });
      }
    }

    // HD05 Recipient punctuation check (semicolon instead of comma)
    let inNoiNhan = false;
    state.paragraphs.forEach(p => {
      if (p.text.trim().startsWith('Nơi nhận:')) {
        inNoiNhan = true;
        return;
      }
      if (inNoiNhan) {
        if (p.text.trim() && !p.text.trim().startsWith('-') && p.text.length > 50) {
          inNoiNhan = false;
        }
        if (inNoiNhan && p.text.trim().startsWith('-')) {
          const txt = p.text.trim();
          if (txt.endsWith(',')) {
            errors.push({ type: 'format', rule: 'HD05', message: `Dấu câu nơi nhận: "${txt}" dùng dấu phẩy (,), HD05 yêu cầu dùng dấu chấm phẩy (;)` });
          }
        }
      }
    });
  }
  
  return errors;
}

function renderResults(container) {
  const results = container.querySelector('#sc-results');
  results.style.display = 'block';
  const totalErrors = checkState.errors.length + checkState.formatErrors.length;
  const docLabel = checkState.docType === 'nd30' ? 'VB Hành Chính (NĐ30)' : checkState.docType === 'hd05' ? 'VB Đảng (HD05)' : 'Không xác định';
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
    const paraErrors = checkState.errors.filter(e => e.paraIdx === p.index);
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
    const paraErrors = checkState.errors.filter(e => e.paraIdx === p.index);
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
      const paraErrors = checkState.errors.filter(e => e.paraIdx === p.index).sort((a, b) => b.pos - a.pos);
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
    children.push(new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: `Loại VB: ${checkState.docType === 'nd30' ? 'Hành chính (NĐ30)' : checkState.docType === 'hd05' ? 'Đảng (HD05)' : 'Không xác định'}`, font: 'Times New Roman', size: 28 })] }));
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

