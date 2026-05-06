/**
 * Spell Check & Format Validation Module
 * Kiá»ƒm tra chÃ­nh táº£ + thá»ƒ thá»©c VB theo NÄ30/HD36
 */
import { Document, Packer, Paragraph, TextRun, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { showToast } from '../main.js';
import { sendChatRequest } from './ai-proxy.js';
import { SPELLING_ERRORS, CAPITALIZATION_RULES, TITLE_CONTEXT_RULES, OFFICIAL_TITLES, WHITELIST } from './vn-dictionary.js';
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { firebaseConfig } from '../firebase-config.js';

let checkState = { file: null, fileName: '', paragraphs: [], errors: [], docType: 'unknown', formatErrors: [], xmlDoc: null, rawXml: '' };

export function renderSpellCheck(container) {
  checkState = { file: null, fileName: '', paragraphs: [], errors: [], docType: 'unknown', formatErrors: [], xmlDoc: null, rawXml: '' };
  container.innerHTML = `
    <div class="page-header">
      <div class="page-title">ðŸ” Kiá»ƒm Tra VÄƒn Báº£n</div>
      <div class="page-subtitle">Kiá»ƒm tra chÃ­nh táº£ & thá»ƒ thá»©c theo NÄ30/HD36</div>
    </div>
    <div class="section-card">
      <div class="section-title">ðŸ“‚ Táº£i file vÄƒn báº£n cáº§n kiá»ƒm tra</div>
      <div class="upload-zone" id="sc-drop-zone">
        <div class="upload-icon">ðŸ“„</div>
        <div class="upload-text">KÃ©o tháº£ hoáº·c nháº¥p Ä‘á»ƒ chá»n file <strong>.docx</strong></div>
        <div class="upload-hint">Chá»‰ há»— trá»£ Ä‘á»‹nh dáº¡ng .docx (Open XML). Náº¿u báº¡n cÃ³ file .doc, vui lÃ²ng chuyá»ƒn sang .docx trÆ°á»›c.</div>
        <input type="file" id="sc-file-input" accept=".docx" style="display:none">
      </div>
    </div>
    <div id="sc-progress" style="display:none; margin-top:20px; padding: 20px; background: var(--bg-card); border-radius: var(--radius-md); border: 1px solid var(--border-subtle); text-align: center;">
      <div style="margin-bottom:10px; font-weight:bold; color:var(--daquy-400)">ðŸ¤– Äang dÃ¹ng AI Ä‘á»ƒ rÃ  soÃ¡t vÄƒn báº£n...</div>
      <div id="sc-progress-text" style="font-size:0.9rem; color:var(--text-secondary)">Khá»Ÿi táº¡o AI...</div>
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
  if (!file.name.endsWith('.docx')) { showToast('Chá»‰ há»— trá»£ file .docx', 'error'); return; }
  checkState.file = file;
  checkState.fileName = file.name;
  showToast('Äang phÃ¢n tÃ­ch vÄƒn báº£n...');
  try {
    const JSZip = (await import('https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm')).default;
    const zip = await JSZip.loadAsync(file);
    const docXml = await zip.file('word/document.xml')?.async('text');
    if (!docXml) { showToast('KhÃ´ng Ä‘á»c Ä‘Æ°á»£c ná»™i dung file', 'error'); return; }
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

    // BÆ°á»›c 1: Kiá»ƒm tra tá»« Ä‘iá»ƒn cá»¥c bá»™ (nhanh, chÃ­nh xÃ¡c)
    progressText.innerText = 'Äang quÃ©t tá»« Ä‘iá»ƒn cá»¥c bá»™...';
    const localErrors = checkSpellingLocal(checkState.paragraphs);
    
    // BÆ°á»›c 2: Kiá»ƒm tra báº±ng AI (sÃ¢u hÆ¡n)
    const aiErrors = await checkSpellingAI(checkState.paragraphs, progressText);
    
    // BÆ°á»›c 3: Káº¿t há»£p káº¿t quáº£, Æ°u tiÃªn local, loáº¡i bá» trÃ¹ng láº·p
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
    showToast('Lá»—i: ' + e.message, 'error'); 
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
  if (allText.includes('Äáº¢NG Cá»˜NG Sáº¢N VIá»†T NAM')) state.docType = 'hd36';
  else if (allText.includes('Cá»˜NG HÃ’A XÃƒ Há»˜I CHá»¦ NGHÄ¨A VIá»†T NAM')) state.docType = 'nd30';
  else state.docType = 'unknown';
}

async function checkSpellingAI(paragraphs, progressTextEl) {
  const errors = [];
  
  progressTextEl.innerText = "Dang ket noi 9router...";
  const modelName = localStorage.getItem('vbai_gemini_model') || 'gemini-2.5-pro';

  // 2. Batching paragraphs â€” batch nhá» hÆ¡n Ä‘á»ƒ AI chÃ­nh xÃ¡c hÆ¡n
  const validParas = paragraphs.filter(p => p.text.trim().length > 10);
  const BATCH_SIZE = 3;
  const batches = [];
  for (let i = 0; i < validParas.length; i += BATCH_SIZE) {
    batches.push(validParas.slice(i, i + BATCH_SIZE));
  }

  const systemInstruction = `Báº¡n lÃ  chuyÃªn gia rÃ  soÃ¡t vÄƒn báº£n hÃ nh chÃ­nh vÃ  vÄƒn báº£n Äáº£ng cá»§a Viá»‡t Nam.
Nhiá»‡m vá»¥: Äá»c tá»«ng Ä‘oáº¡n vÄƒn báº£n (cÃ³ Ä‘Ã¡nh dáº¥u [ID:sá»‘]) vÃ  tÃ¬m ra Lá»–I CHÃNH Táº¢ THá»°C Sá»°, lá»—i dÃ¹ng tá»« sai ngá»¯ cáº£nh.

QUY Táº®C NGHIÃŠM NGáº¶T:
1. CHá»ˆ bÃ¡o lá»—i chÃ­nh táº£ thá»±c sá»± (Ä‘Ã¡nh mÃ¡y sai, thiáº¿u dáº¥u, sai phá»¥ Ã¢m). KHÃ”NG bÃ¡o lá»—i viáº¿t hoa chá»©c danh.
2. KHÃ”NG sá»­a viáº¿t hoa/viáº¿t thÆ°á»ng cho cÃ¡c chá»©c danh nhÆ°: á»§y viÃªn, chá»§ tá»‹ch, giÃ¡m Ä‘á»‘c, bÃ­ thÆ°... ÄÃ¢y lÃ  TRÃCH NHIá»†M Cá»¦A Há»† THá»NG Cá»¤C Bá»˜, khÃ´ng pháº£i cá»§a báº¡n.
3. Bá» qua viáº¿t táº¯t: UBND, HÄND, THCS, BHXH, PCT, CVP...
4. "á»¦y ban nhÃ¢n dÃ¢n", "Há»™i Ä‘á»“ng nhÃ¢n dÃ¢n", "TÃ²a Ã¡n nhÃ¢n dÃ¢n", "Viá»‡n kiá»ƒm sÃ¡t nhÃ¢n dÃ¢n" giá»¯ nguyÃªn chá»¯ thÆ°á»ng cho "nhÃ¢n dÃ¢n".
5. KHÃ”NG Ä‘á»•i "Há»™i viÃªn" thÃ nh "á»¦y viÃªn" (hai khÃ¡i niá»‡m khÃ¡c nhau).
6. TrÆ°á»ng "original" PHáº¢I lÃ  chuá»—i CHÃNH XÃC Tá»ª VÄ‚N Báº¢N Gá»C, copy nguyÃªn xi.
7. TrÆ°á»ng "para_id" PHáº¢I lÃ  sá»‘ ID Ä‘oáº¡n vÄƒn chá»©a lá»—i (láº¥y tá»« [ID:sá»‘] á»Ÿ Ä‘áº§u Ä‘oáº¡n).

VÃ Dá»¤ ÄÃšNG:
- "triá»ƒm khai" â†’ "triá»ƒn khai" (sai phá»¥ Ã¢m) âœ“
- "thá»±c hiá»‡ng" â†’ "thá»±c hiá»‡n" (thá»«a chá»¯ g) âœ“
- "báº£o cÃ¡o" â†’ "bÃ¡o cÃ¡o" (sai dáº¥u) âœ“

VÃ Dá»¤ SAI (KHÃ”NG ÄÆ¯á»¢C LÃ€M):
- "á»§y viÃªn" â†’ "á»¦y viÃªn" (viáº¿t hoa chá»©c danh) âœ—
- "nhÃ  nÆ°á»›c" â†’ "NhÃ  nÆ°á»›c" (viáº¿t hoa) âœ—
- "chá»§ tá»‹ch" â†’ "Chá»§ tá»‹ch" (viáº¿t hoa) âœ—

TRáº¢ Vá»€ JSON ARRAY:
[{"para_id": 5, "original": "triá»ƒm khai", "suggestion": "triá»ƒn khai", "reason": "Sai phá»¥ Ã¢m: triá»ƒm â†’ triá»ƒn"}]
Náº¿u khÃ´ng cÃ³ lá»—i, tráº£ []. CHá»ˆ JSON, KHÃ”NG markdown, KHÃ”NG giáº£i thÃ­ch.`;

  // 3. Process batches
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    progressTextEl.innerText = `Äang phÃ¢n tÃ­ch Ä‘oáº¡n ${i * BATCH_SIZE + 1} Ä‘áº¿n ${Math.min((i + 1) * BATCH_SIZE, validParas.length)} / ${validParas.length}...`;
    
    let combinedText = "";
    batch.forEach(p => combinedText += `[ID:${p.index}] ${p.text}\n`);

    try {
      const messages = [
        { role: "system", content: systemInstruction },
        { role: "user", content: combinedText }
      ];
      let resText = await sendChatRequest(messages, modelName, { temperature: 0.1 });
      resText = resText.replace(/^\`\`\`json/m, '').replace(/^\`\`\`/m, '').trim();
      
      let aiErrors = [];
      try { aiErrors = JSON.parse(resText); } catch(err) { console.warn("Parse JSON failed for batch", i, resText); }

      for (const err of aiErrors) {
        if (!err.original || !err.suggestion) continue;
        if (err.original === err.suggestion) continue;

        // Báº¢O Vá»†: KhÃ´ng láº«n Há»™i viÃªn/á»¦y viÃªn
        const lowOrig = err.original.toLowerCase();
        const lowSugg = err.suggestion.toLowerCase();
        if ((lowOrig.includes('há»™i viÃªn') && lowSugg.includes('á»§y viÃªn')) ||
            (lowOrig.includes('á»§y viÃªn') && lowSugg.includes('há»™i viÃªn'))) {
          continue;
        }

        // Báº¢O Vá»†: Bá» qua náº¿u AI chá»‰ thay Ä‘á»•i viáº¿t hoa (chá»©c danh)
        if (lowOrig === lowSugg) continue;

        // TÃ¬m Ä‘oáº¡n chÃ­nh xÃ¡c báº±ng para_id hoáº·c fallback tÃ¬m trong batch
        const targetParas = err.para_id !== undefined
          ? batch.filter(p => p.index === err.para_id)
          : batch;

        for (const p of targetParas) {
          // DÃ¹ng indexOf chÃ­nh xÃ¡c thay vÃ¬ regex fuzzy
          const pos = p.text.indexOf(err.original);
          if (pos === -1) continue;

          // Kiá»ƒm tra khÃ´ng trÃ¹ng láº·p/chá»“ng chÃ©o
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
              reason: err.reason || "Sá»­a lá»—i chÃ­nh táº£/ngá»¯ phÃ¡p",
              message: `"${err.original}" â†’ "${err.suggestion}"`
            });
          }
          break; // Chá»‰ match 1 láº§n má»—i Ä‘oáº¡n
        }
      }
    } catch(err) {
      console.warn("AI Generation error for batch", i, err);
    }
  }

  progressTextEl.innerText = "HoÃ n táº¥t kiá»ƒm tra AI!";
  return errors;
}

/**
 * Kiá»ƒm tra chÃ­nh táº£ báº±ng tá»« Ä‘iá»ƒn cá»¥c bá»™ â€” nhanh vÃ  chÃ­nh xÃ¡c 100%
 */
function checkSpellingLocal(paragraphs) {
  const localErrors = [];
  const VN_WORD_CHARS = /[a-zA-Z0-9Ã Ã¡áº£Ã£áº¡Äƒáº±áº¯áº³áºµáº·Ã¢áº§áº¥áº©áº«áº­Ã¨Ã©áº»áº½áº¹Ãªá»áº¿á»ƒá»…á»‡Ã¬Ã­á»‰Ä©á»‹Ã²Ã³á»Ãµá»Ã´á»“á»‘á»•á»—á»™Æ¡á»á»›á»Ÿá»¡á»£Ã¹Ãºá»§Å©á»¥Æ°á»«á»©á»­á»¯á»±á»³Ã½á»·á»¹á»µÄ‘Ã€Ãáº¢Ãƒáº Ä‚áº°áº®áº²áº´áº¶Ã‚áº¦áº¤áº¨áºªáº¬ÃˆÃ‰áººáº¼áº¸ÃŠá»€áº¾á»‚á»„á»†ÃŒÃá»ˆÄ¨á»ŠÃ’Ã“á»ŽÃ•á»ŒÃ”á»’á»á»”á»–á»˜Æ á»œá»šá»žá» á»¢Ã™Ãšá»¦Å¨á»¤Æ¯á»ªá»¨á»¬á»®á»°á»²Ãá»¶á»¸á»´Ä]/;
  
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
          reason: 'Lá»—i chÃ­nh táº£ (Tá»« Ä‘iá»ƒn VBAI)',
          message: `"${p.text.substring(pos, pos + wrong.length)}" \u2192 "${correct}"`
        });
      }
    }
    
    // Kiá»ƒm tra má»Ÿ rá»™ng UBND/HÄND (YÃªu cáº§u má»›i)
    const ABBR_RULES = [
      { abbr: 'UBND', full: 'á»¦y ban nhÃ¢n dÃ¢n' },
      { abbr: 'HÄND', full: 'Há»™i Ä‘á»“ng nhÃ¢n dÃ¢n' }
    ];

    ABBR_RULES.forEach(rule => {
      let sf = 0;
      while (true) {
        const pos = p.text.indexOf(rule.abbr, sf);
        if (pos === -1) break;
        sf = pos + rule.abbr.length;

        const charBefore = pos > 0 ? p.text[pos - 1] : '';
        const charAfter = pos + rule.abbr.length < p.text.length ? p.text[pos + rule.abbr.length] : '';

        // 1. Kiá»ƒm tra dáº¥u gáº¡ch ngang (Sá»‘ hiá»‡u VB: -UBND, UBND-, -HÄND, HÄND-)
        if (charBefore === '-' || charAfter === '-') continue;

        // 2. Kiá»ƒm tra ranh giá»›i tá»« (TrÃ¡nh VPUBND)
        if (VN_WORD_CHARS.test(charBefore) || VN_WORD_CHARS.test(charAfter)) continue;

        // 3. Kiá»ƒm tra cá»¥m tá»« báº£o vá»‡ (khÃ´ng dá»‹ch)
        const contextText = p.text;
        
        // Báº£o vá»‡ cá»¥m: "VÄƒn phÃ²ng ÄÄBQH vÃ  HÄND tá»‰nh"
        if (rule.abbr === 'HÄND') {
           const p1 = "VÄƒn phÃ²ng ÄÄBQH vÃ  HÄND tá»‰nh";
           const idxInP1 = p1.indexOf('HÄND');
           const startP1 = pos - idxInP1;
           if (startP1 >= 0 && contextText.substring(startP1, startP1 + p1.length) === p1) continue;
        }

        // Báº£o vá»‡ cá»¥m: "VÄƒn phÃ²ng HÄND vÃ  UBND xÃ£" (phÆ°á»ng, Ä‘áº·c khu)
        const pPatterns = ["VÄƒn phÃ²ng HÄND vÃ  UBND xÃ£", "VÄƒn phÃ²ng HÄND vÃ  UBND phÆ°á»ng", "VÄƒn phÃ²ng HÄND vÃ  UBND Ä‘áº·c khu"];
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

        // Náº¿u vÆ°á»£t qua bá»™ lá»c -> Äá» xuáº¥t má»Ÿ rá»™ng
        localErrors.push({
          type: 'capitalization',
          paraIdx: p.index,
          pos: pos,
          length: rule.abbr.length,
          original: rule.abbr,
          suggestion: rule.full,
          reason: `Má»Ÿ rá»™ng viáº¿t táº¯t: ${rule.full}`,
          message: `"${rule.abbr}" \u2192 "${rule.full}"`
        });
      }
    });
    
    // Kiá»ƒm tra viáº¿t hoa Tá»” CHá»¨C (cá»¥m dÃ i â€” luÃ´n Ã¡p dá»¥ng)
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
              reason: `Viáº¿t hoa chá»©c danh/tá»• chá»©c: "${correct}"`,
              message: `"${actual}" \u2192 "${correct}"`
            });
          }
        }
      }
    }
    
    // Kiá»ƒm tra "NhÃ¢n dÃ¢n" riÃªng láº» â€” PHáº¢I bá» qua khi náº±m trong cá»¥m tá»« ghÃ©p
    // BÆ°á»›c 1: Pre-scan táº¥t cáº£ vá»‹ trÃ­ cá»¥m tá»« ghÃ©p chá»©a "nhÃ¢n dÃ¢n"
    const NHAN_DAN_COMPOUNDS = [
      'á»§y ban nhÃ¢n dÃ¢n', 'há»™i Ä‘á»“ng nhÃ¢n dÃ¢n',
      'tÃ²a Ã¡n nhÃ¢n dÃ¢n', 'toÃ  Ã¡n nhÃ¢n dÃ¢n',      // Há»— trá»£ cáº£ 2 dáº¡ng dáº¥u
      'viá»‡n kiá»ƒm sÃ¡t nhÃ¢n dÃ¢n'
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

    // BÆ°á»›c 2: TÃ¬m táº¥t cáº£ "nhÃ¢n dÃ¢n" vÃ  chá»‰ bÃ¡o lá»—i náº¿u KHÃ”NG náº±m trong vÃ¹ng báº£o vá»‡
    const ndPattern = /nh\u00e2n d\u00e2n/gi;
    let ndMatch;
    while ((ndMatch = ndPattern.exec(p.text)) !== null) {
      const pos = ndMatch.index;
      const actual = p.text.substring(pos, pos + 8);
      
      // Bá» qua náº¿u Ä‘Ã£ viáº¿t hoa Ä‘Ãºng "NhÃ¢n dÃ¢n" hoáº·c IN HOA "NHÃ‚N DÃ‚N"
      if (actual === 'Nh\u00e2n d\u00e2n' || actual === 'NH\u00c2N D\u00c2N') continue;
      
      // Bá» qua náº¿u náº±m trong vÃ¹ng báº£o vá»‡ (cá»¥m tá»« ghÃ©p)
      const isProtected = protectedRanges.some(r => pos >= r.start && (pos + 8) <= r.end);
      if (isProtected) continue;
      
      // "nhÃ¢n dÃ¢n" Ä‘á»©ng riÃªng láº» â†’ cáº§n viáº¿t hoa thÃ nh "NhÃ¢n dÃ¢n"
      const isDuplicate = localErrors.some(e => e.paraIdx === p.index && Math.abs(e.pos - pos) < 3);
      if (!isDuplicate) {
        localErrors.push({
          type: 'capitalization',
          paraIdx: p.index,
          pos: pos,
          length: 8,
          original: actual,
          suggestion: 'Nh\u00e2n d\u00e2n',
          reason: 'Viáº¿t hoa "NhÃ¢n dÃ¢n" khi Ä‘á»©ng riÃªng láº»',
          message: `"${actual}" \u2192 "NhÃ¢n dÃ¢n"`
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
        if (Math.abs(top - 1134) > 100) errors.push({ type: 'format', rule: 'NÄ30', message: `Lá» trÃªn sai: ${Math.round(top/56.7)}mm (chuáº©n: 20mm)` });
        if (Math.abs(bottom - 1134) > 100) errors.push({ type: 'format', rule: 'NÄ30', message: `Lá» dÆ°á»›i sai: ${Math.round(bottom/56.7)}mm (chuáº©n: 20mm)` });
        if (Math.abs(left - 1701) > 100) errors.push({ type: 'format', rule: 'NÄ30', message: `Lá» trÃ¡i sai: ${Math.round(left/56.7)}mm (chuáº©n: 30mm)` });
        if (Math.abs(right - 1134) > 100) errors.push({ type: 'format', rule: 'NÄ30', message: `Lá» pháº£i sai: ${Math.round(right/56.7)}mm (chuáº©n: 20mm)` });
      } else if (state.docType === 'hd36') {
        if (Math.abs(left - 1701) > 100) errors.push({ type: 'format', rule: 'HD36', message: `Lá» trÃ¡i sai: ${Math.round(left/56.7)}mm (chuáº©n: 30mm)` });
        if (Math.abs(right - 850) > 100) errors.push({ type: 'format', rule: 'HD36', message: `Lá» pháº£i sai: ${Math.round(right/56.7)}mm (chuáº©n: 15mm)` });
      }
    }
  }
  // Check font
  const allText = state.paragraphs.map(p => p.text).join(' ');
  state.paragraphs.forEach(p => {
    p.runs.forEach(r => {
      if (r.font && r.font !== 'Times New Roman' && r.font !== '' && !r.font.startsWith('Symbol') && r.font !== 'Wingdings') {
        const msg = `Font "${r.font}" khÃ´ng Ä‘Ãºng chuáº©n (pháº£i dÃ¹ng Times New Roman)`;
        if (!errors.find(e => e.message === msg)) errors.push({ type: 'format', rule: state.docType === 'hd36' ? 'HD36' : 'NÄ30', message: msg });
      }
    });
  });
  // Check NÄ30 specific
  if (state.docType === 'nd30') {
    if (!allText.includes('Cá»˜NG HÃ’A XÃƒ Há»˜I CHá»¦ NGHÄ¨A VIá»†T NAM')) errors.push({ type: 'format', rule: 'NÄ30', message: 'Thiáº¿u Quá»‘c hiá»‡u "Cá»˜NG HÃ’A XÃƒ Há»˜I CHá»¦ NGHÄ¨A VIá»†T NAM"' });
    if (!allText.includes('Äá»™c láº­p - Tá»± do - Háº¡nh phÃºc') && !allText.includes('Äá»™c láº­p â€“ Tá»± do â€“ Háº¡nh phÃºc')) errors.push({ type: 'format', rule: 'NÄ30', message: 'Thiáº¿u hoáº·c sai TiÃªu ngá»¯ "Äá»™c láº­p - Tá»± do - Háº¡nh phÃºc"' });
    if (!allText.includes('NÆ¡i nháº­n')) errors.push({ type: 'format', rule: 'NÄ30', message: 'Thiáº¿u pháº§n "NÆ¡i nháº­n"' });
  }
  // Check HD36 specific
  if (state.docType === 'hd36') {
    if (!allText.includes('Äáº¢NG Cá»˜NG Sáº¢N VIá»†T NAM')) errors.push({ type: 'format', rule: 'HD36', message: 'Thiáº¿u tiÃªu Ä‘á» "Äáº¢NG Cá»˜NG Sáº¢N VIá»†T NAM"' });
    if (allText.includes('Äá»™c láº­p - Tá»± do - Háº¡nh phÃºc')) errors.push({ type: 'format', rule: 'HD36', message: 'VB Äáº£ng KHÃ”NG cÃ³ tiÃªu ngá»¯ "Äá»™c láº­p - Tá»± do - Háº¡nh phÃºc"' });
    if (allText.includes('TM.') || allText.includes('KT.') || allText.includes('TL.')) {
      errors.push({ type: 'format', rule: 'HD36', message: 'VB Äáº£ng dÃ¹ng T/M, K/T, T/L (gáº¡ch chÃ©o), KHÃ”NG dÃ¹ng TM., KT., TL. (dáº¥u cháº¥m)' });
    }
    if (!allText.includes('*') && state.paragraphs.length > 3) {
      const hasCQ = state.paragraphs.some(p => p.runs.some(r => r.bold) && p.text.length < 60);
      if (hasCQ) errors.push({ type: 'format', rule: 'HD36', message: 'CÃ³ thá»ƒ thiáº¿u dáº¥u sao (*) dÆ°á»›i tÃªn cÆ¡ quan ban hÃ nh' });
    }
  }
  
  return errors;
}

function renderResults(container) {
  const results = container.querySelector('#sc-results');
  results.style.display = 'block';
  const totalErrors = checkState.errors.length + checkState.formatErrors.length;
  const docLabel = checkState.docType === 'nd30' ? 'VB HÃ nh ChÃ­nh (NÄ30)' : checkState.docType === 'hd36' ? 'VB Äáº£ng (HD36)' : 'KhÃ´ng xÃ¡c Ä‘á»‹nh';
  results.innerHTML = `
    <div class="sc-summary-grid">
      <div class="sc-summary-card"><div class="sc-summary-icon">ðŸ“„</div><div class="sc-summary-info"><div class="sc-summary-value">${checkState.fileName}</div><div class="sc-summary-label">Loáº¡i: ${docLabel}</div></div></div>
      <div class="sc-summary-card ${totalErrors === 0 ? 'sc-ok' : 'sc-warn'}"><div class="sc-summary-icon">${totalErrors === 0 ? 'âœ…' : 'âš ï¸'}</div><div class="sc-summary-info"><div class="sc-summary-value">${totalErrors}</div><div class="sc-summary-label">Tá»•ng sá»‘ lá»—i</div></div></div>
      <div class="sc-summary-card sc-clickable" onclick="document.getElementById('sc-spell-details').scrollIntoView({behavior: 'smooth'})" style="cursor:pointer" title="Click Ä‘á»ƒ xem chi tiáº¿t"><div class="sc-summary-icon">ðŸ”¤</div><div class="sc-summary-info"><div class="sc-summary-value">${checkState.errors.length}</div><div class="sc-summary-label">Lá»—i chÃ­nh táº£ / Ngá»¯ phÃ¡p</div></div></div>
      <div class="sc-summary-card sc-clickable" onclick="document.getElementById('sc-format-details').scrollIntoView({behavior: 'smooth'})" style="cursor:pointer" title="Click Ä‘á»ƒ xem chi tiáº¿t"><div class="sc-summary-icon">ðŸ“</div><div class="sc-summary-info"><div class="sc-summary-value">${checkState.formatErrors.length}</div><div class="sc-summary-label">Lá»—i thá»ƒ thá»©c</div></div></div>
    </div>
    
    <div id="sc-spell-details" class="section-card" style="margin-top:20px; display: ${checkState.errors.length > 0 ? 'block' : 'none'}">
      <div class="section-title">ðŸ”¤ Lá»—i chÃ­nh táº£ & Ngá»¯ phÃ¡p (AI Äá» xuáº¥t)</div>
      <div class="sc-format-errors">
        ${checkState.errors.map(e => `
          <div class="sc-format-item" style="flex-direction: column; gap: 4px; background: rgba(230,162,0,0.08); border-color: rgba(230,162,0,0.2);">
            <div><span class="sc-format-badge" style="background:var(--daquy-500); color:#fff">Sai</span> <span style="text-decoration:line-through; color:var(--text-muted)">${escapeHtml(e.original)}</span> âž¡ï¸ <span style="font-weight:bold; color:var(--pine-500)">${escapeHtml(e.suggestion)}</span></div>
            <div style="font-size:0.8rem; color:var(--text-secondary); font-style:italic; margin-top:4px">ðŸ’¡ LÃ½ do: ${escapeHtml(e.reason)}</div>
          </div>
        `).join('')}
      </div>
    </div>

    ${checkState.formatErrors.length > 0 ? `
    <div id="sc-format-details" class="section-card" style="margin-top:20px">
      <div class="section-title">ðŸ“ Lá»—i thá»ƒ thá»©c ${docLabel}</div>
      <div class="sc-format-errors">${checkState.formatErrors.map(e => `<div class="sc-format-item"><span class="sc-format-badge">${e.rule}</span><span>${e.message}</span></div>`).join('')}</div>
    </div>` : ''}
    
    <div class="section-card" style="margin-top:20px">
      <div class="section-title">ðŸ‘ï¸ Xem trÆ°á»›c â€” So sÃ¡nh vÄƒn báº£n</div>
      <div class="sc-preview-grid">
        <div class="sc-preview-col"><div class="sc-preview-label">ðŸ“„ VÄƒn báº£n gá»‘c</div><div class="sc-preview-box" id="sc-original"></div></div>
        <div class="sc-preview-col"><div class="sc-preview-label">âœ… VÄƒn báº£n Ä‘Ã£ kiá»ƒm tra</div><div class="sc-preview-box" id="sc-checked"></div></div>
      </div>
    </div>
    <div class="btn-row" style="justify-content:center;margin-top:24px">
      <button class="btn btn-secondary" id="sc-btn-new">ðŸ“‚ Kiá»ƒm tra file khÃ¡c</button>
      <button class="btn btn-success" id="sc-btn-export">â¬‡ Táº£i file Ä‘Ã£ sá»­a (.docx)</button>
      <button class="btn btn-primary" id="sc-btn-report">ðŸ“‹ Táº£i bÃ¡o cÃ¡o lá»—i (.docx)</button>
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
  // Hiá»ƒn thá»‹ vÄƒn báº£n Gá»C: bÃ´i Ä‘á» cÃ¡c vá»‹ trÃ­ cÃ³ lá»—i
  el.innerHTML = checkState.paragraphs.map((p, pIdx) => {
    const paraErrors = checkState.errors.filter(e => e.paraIdx === p.index);
    if (paraErrors.length === 0) return `<div class="sc-para">${escapeHtml(p.text)}</div>`;
    
    let text = p.text;
    let result = '';
    let lastIdx = 0;
    const sortedAsc = [...paraErrors].sort((a, b) => a.pos - b.pos);
    sortedAsc.forEach(err => {
      result += escapeHtml(text.substring(lastIdx, err.pos));
      // BÃ´i Ä‘á» tá»« sai
      result += `<span class="sc-error" title="${escapeHtml(err.reason)}: ${escapeHtml(err.suggestion)}">${escapeHtml(text.substring(err.pos, err.pos + err.length))}</span>`;
      lastIdx = err.pos + err.length;
    });
    result += escapeHtml(text.substring(lastIdx));
    return `<div class="sc-para">${result}</div>`;
  }).join('');
}

function renderChecked(el) {
  // Hiá»ƒn thá»‹ vÄƒn báº£n ÄÃƒ Sá»¬A: thay tháº¿ lá»—i báº±ng gá»£i Ã½, highlight mÃ u xanh
  el.innerHTML = checkState.paragraphs.map((p, pIdx) => {
    const paraErrors = checkState.errors.filter(e => e.paraIdx === p.index);
    if (paraErrors.length === 0) return `<div class="sc-para">${escapeHtml(p.text)}</div>`;
    
    let text = p.text;
    let result = '';
    let lastIdx = 0;
    const sortedAsc = [...paraErrors].sort((a, b) => a.pos - b.pos);
    sortedAsc.forEach(err => {
      result += escapeHtml(text.substring(lastIdx, err.pos));
      // Hiá»ƒn thá»‹ tá»« ÄÃƒ Sá»¬A (suggestion) vá»›i highlight xanh lÃ¡
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
    children.push(new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: `File gá»‘c: ${checkState.fileName}`, font: 'Times New Roman', size: 24, italics: true, color: '888888' })] }));
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
    showToast('âœ“ ÄÃ£ táº£i file Ä‘Ã£ sá»­a!');
  } catch (e) { showToast('Lá»—i: ' + e.message, 'error'); }
}

async function exportReport() {
  try {
    const children = [];
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 300 }, children: [new TextRun({ text: 'BÃO CÃO KIá»‚M TRA VÄ‚N Báº¢N', font: 'Times New Roman', size: 32, bold: true })] }));
    children.push(new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: `File: ${checkState.fileName}`, font: 'Times New Roman', size: 28 })] }));
    children.push(new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: `Loáº¡i VB: ${checkState.docType === 'nd30' ? 'HÃ nh chÃ­nh (NÄ30)' : checkState.docType === 'hd36' ? 'Äáº£ng (HD36)' : 'KhÃ´ng xÃ¡c Ä‘á»‹nh'}`, font: 'Times New Roman', size: 28 })] }));
    children.push(new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: `NgÃ y kiá»ƒm tra: ${new Date().toLocaleDateString('vi-VN')}`, font: 'Times New Roman', size: 28 })] }));
    if (checkState.errors.length > 0) {
      children.push(new Paragraph({ spacing: { before: 200, after: 100 }, children: [new TextRun({ text: `I. Lá»–I CHÃNH Táº¢ (${checkState.errors.length} lá»—i)`, font: 'Times New Roman', size: 28, bold: true })] }));
      checkState.errors.forEach((err, i) => {
        children.push(new Paragraph({ spacing: { after: 60 }, indent: { firstLine: 567 }, children: [
          new TextRun({ text: `${i + 1}. `, font: 'Times New Roman', size: 28, bold: true }),
          new TextRun({ text: `"${err.original}"`, font: 'Times New Roman', size: 28, color: 'FF0000' }),
          new TextRun({ text: ` â†’ "${err.suggestion}"`, font: 'Times New Roman', size: 28 }),
        ] }));
      });
    }
    if (checkState.formatErrors.length > 0) {
      children.push(new Paragraph({ spacing: { before: 200, after: 100 }, children: [new TextRun({ text: `II. Lá»–I THá»‚ THá»¨C (${checkState.formatErrors.length} lá»—i)`, font: 'Times New Roman', size: 28, bold: true })] }));
      checkState.formatErrors.forEach((err, i) => {
        children.push(new Paragraph({ spacing: { after: 60 }, indent: { firstLine: 567 }, children: [
          new TextRun({ text: `${i + 1}. [${err.rule}] `, font: 'Times New Roman', size: 28, bold: true }),
          new TextRun({ text: err.message, font: 'Times New Roman', size: 28 }),
        ] }));
      });
    }
    if (checkState.errors.length === 0 && checkState.formatErrors.length === 0) {
      children.push(new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: 'KhÃ´ng phÃ¡t hiá»‡n lá»—i nÃ o.', font: 'Times New Roman', size: 28, color: '008000' })] }));
    }
    const doc = new Document({ styles: { default: { document: { run: { font: 'Times New Roman', size: 28 } } } }, sections: [{ children }] });
    const blob = await Packer.toBlob(doc);
    saveAs(blob, `bao_cao_loi_${checkState.fileName}`);
    showToast('âœ“ ÄÃ£ táº£i bÃ¡o cÃ¡o lá»—i!');
  } catch (e) { showToast('Lá»—i: ' + e.message, 'error'); }
}

function logToFirestore(fileName, spellCount, formatCount) {
  try {
    const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    const db = getFirestore(app);
    addDoc(collection(db, 'search_logs'), {
      query: `[Kiá»ƒm Tra VB] ${fileName} â€” ${spellCount} lá»—i CT, ${formatCount} lá»—i TT`,
      model: "Spell Check Engine", userEmail: window.currentUser?.email || 'Unknown', timestamp: serverTimestamp()
    }).catch(() => {});
  } catch (e) {}
}


