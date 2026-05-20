/**
 * PDF & Image OCR Tool Module — Upload & extract text from PDF or images
 */
import { showToast } from './ui-utils.js';
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { sendChatRequest } from './ai-proxy.js';
import { fetchSystemConfig } from './system-config.js';

import { firebaseConfig } from '../firebase-config.js';

const OCR_PROMPT = `Bạn là chuyên gia OCR tiếng Việt. Hãy đọc và trích xuất NGUYÊN VĂN TOÀN BỘ nội dung chữ tiếng Việt có trong các hình ảnh tài liệu này.

QUY TẮC BẮT BUỘC:
1. Giữ nguyên BỐ CỤC văn bản gốc: tiêu đề, đề mục, đánh số, thụt đầu dòng.
2. Giữ nguyên các DẤU tiếng Việt (sắc, huyền, hỏi, ngã, nặng) chính xác.
3. Giữ nguyên SỐ HIỆU văn bản (VD: 117/2025/QH15, NĐ30/2020/NĐ-CP).
4. Giữ nguyên NGÀY THÁNG, tên cơ quan, tên người ký.
5. Phân tách các TRANG bằng dấu "--- Trang X ---".
6. Nếu có bảng biểu, trình bày dưới dạng bảng markdown.
7. Không thêm bất kỳ bình luận, giải thích hay tóm tắt nào. Chỉ trả về nội dung nguyên văn.
8. Nếu chữ bị mờ hoặc không đọc được, ghi [không rõ] tại vị trí đó.`;

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'];
const ACCEPTED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'];

function isImageFile(file) {
  return ACCEPTED_IMAGE_TYPES.includes(file.type) || /\.(jpg|jpeg|png|webp|gif|bmp)$/i.test(file.name);
}

export function renderPdfTool(container) {
  container.innerHTML = `
    <div class="page-header">
      <div class="page-title">📄 Xử Lý PDF / OCR Ảnh</div>
      <div class="page-subtitle">Upload file PDF hoặc ảnh để trích xuất nội dung văn bản bằng AI</div>
    </div>
    <div class="section-card" style="position:relative;">
      <button class="btn btn-secondary" onclick="window.location.reload();" style="position:absolute; top:16px; right:16px; display:flex; align-items:center; gap:6px; padding:6px 12px; font-size:12px; border-radius:6px; z-index:10;" title="Làm mới công cụ">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>
        Làm mới
      </button>
      <div class="upload-zone" id="pdf-drop-zone">
        <div class="upload-icon">📄</div>
        <div class="upload-text">Kéo thả file PDF hoặc ảnh vào đây hoặc click để chọn</div>
        <div class="upload-hint">Hỗ trợ: PDF, JPG, PNG, WEBP — tối đa 50MB</div>
        <input type="file" id="pdf-file-input" accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,.bmp" style="display:none">
      </div>
    </div>
    <div id="pdf-result" style="display:none" class="section-card">
      <div class="section-title">📋 Nội dung trích xuất</div>
      <div style="display:flex;gap:8px;margin-bottom:12px">
        <button class="btn btn-secondary" id="pdf-copy-btn">📋 Copy nội dung</button>
        <button class="btn btn-primary" id="pdf-ocr-btn" style="display:none; background:var(--daquy-500); border-color:var(--daquy-600)">🔍 Quét OCR bằng AI</button>
      </div>
      <div id="pdf-text-content" style="background:var(--bg-input);padding:16px;border-radius:var(--radius-md);font-size:0.85rem;line-height:1.7;max-height:500px;overflow-y:auto;white-space:pre-wrap;color:var(--text-primary);border:1px solid var(--border-subtle)"></div>
    </div>
  `;

  const zone = container.querySelector('#pdf-drop-zone');
  const input = container.querySelector('#pdf-file-input');

  zone.addEventListener('click', () => input.click());
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.style.borderColor = 'var(--pine-500)'; });
  zone.addEventListener('dragleave', () => { zone.style.borderColor = ''; });
  zone.addEventListener('drop', e => { e.preventDefault(); zone.style.borderColor = ''; if(e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0], container); });
  input.addEventListener('change', e => { if(e.target.files[0]) handleFile(e.target.files[0], container); });
}

async function handleFile(file, container) {
  const ext = '.' + file.name.split('.').pop().toLowerCase();
  if (!ACCEPTED_EXTENSIONS.includes(ext)) {
    showToast('Định dạng không hỗ trợ. Vui lòng chọn PDF hoặc ảnh.', 'error');
    return;
  }

  if (isImageFile(file)) {
    await handleImage(file, container);
  } else {
    await handlePdf(file, container);
  }
}

async function handleImage(file, container) {
  const zone = container.querySelector('#pdf-drop-zone');
  zone.innerHTML = `<div class="spinner"></div><div class="upload-text" style="margin-top:12px">Đang quét OCR ảnh ${file.name}...</div>`;

  try {
    const base64 = await fileToBase64(file);
    const mimeType = file.type || 'image/jpeg';
    
    const content = [
      { type: "text", text: OCR_PROMPT },
      { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } }
    ];

    const config = await fetchSystemConfig();
    const model = (
      config?.gemini_model || 'gemini-2.5-flash'
    );

    const ocrText = await sendChatRequest([{ role: "user", content }], model, { temperature: 0, context: 'ocr' });

    zone.innerHTML = `<div class="upload-icon">✅</div><div class="upload-text">${file.name} — OCR hoàn tất</div><div class="upload-hint">Click để chọn file khác</div><input type="file" id="pdf-file-input" accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,.bmp" style="display:none">`;
    container.querySelector('#pdf-file-input').addEventListener('change', e => { if(e.target.files[0]) handleFile(e.target.files[0], container); });

    const result = container.querySelector('#pdf-result');
    result.style.display = 'block';
    result.querySelector('#pdf-text-content').textContent = ocrText || 'Không quét được nội dung.';
    
    // Copy button
    let fullText = ocrText || '';
    container.querySelector('#pdf-copy-btn').addEventListener('click', () => {
      navigator.clipboard.writeText(fullText).then(() => showToast('Đã copy nội dung!')).catch(() => showToast('Không thể copy', 'error'));
    });

    showToast('✓ Đã quét OCR ảnh thành công!');

    // Log
    try {
      const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
      const db = getFirestore(app);
      addDoc(collection(db, 'search_logs'), {
        query: `[OCR Ảnh] ${file.name}`,
        model: `${model} (OCR)`,
        userEmail: window.currentUser?.email || 'Unknown',
        timestamp: serverTimestamp()
      }).catch(e => console.warn(e));
    } catch(e) {}

  } catch (e) {
    console.error(e);
    zone.innerHTML = `<div class="upload-icon">❌</div><div class="upload-text">Lỗi OCR: ${e.message}</div><div class="upload-hint">Click để thử lại</div><input type="file" id="pdf-file-input" accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,.bmp" style="display:none">`;
    container.querySelector('#pdf-file-input').addEventListener('change', e2 => { if(e2.target.files[0]) handleFile(e2.target.files[0], container); });
    showToast('Lỗi OCR: ' + e.message, 'error');
  }
}

async function handlePdf(file, container) {
  if (!file.name.toLowerCase().endsWith('.pdf')) { showToast('Chỉ hỗ trợ file PDF', 'error'); return; }
  const zone = container.querySelector('#pdf-drop-zone');
  zone.innerHTML = `<div class="spinner"></div><div class="upload-text" style="margin-top:12px">Đang xử lý ${file.name}...</div>`;

  try {
    // Use pdf.js CDN
    if (!window.pdfjsLib) {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      document.head.appendChild(script);
      await new Promise((resolve, reject) => { script.onload = resolve; script.onerror = reject; });
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map(item => item.str).join(' ');
      fullText += `--- Trang ${i} ---\n${pageText}\n\n`;
    }

    zone.innerHTML = `<div class="upload-icon">✅</div><div class="upload-text">${file.name} — ${pdf.numPages} trang</div><div class="upload-hint">Click để chọn file khác</div><input type="file" id="pdf-file-input" accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,.bmp" style="display:none">`;
    container.querySelector('#pdf-file-input').addEventListener('change', e => { if(e.target.files[0]) handleFile(e.target.files[0], container); });

    const result = container.querySelector('#pdf-result');
    result.style.display = 'block';
    const textContentArea = result.querySelector('#pdf-text-content');
    const ocrBtn = container.querySelector('#pdf-ocr-btn');
    
    const extractedTextLength = fullText.trim().replace(/--- Trang \d+ ---/g, '').trim().length;
    if (extractedTextLength < 50) {
      textContentArea.textContent = '(Không trích xuất được nội dung text — file có thể là ảnh scan. Đang tự động quét OCR bằng AI...)';
      ocrBtn.style.display = 'none';
      // Auto-OCR for scanned PDFs
      await runPdfOcr(pdf, file, textContentArea, ocrBtn, container);
    } else {
      textContentArea.textContent = fullText;
      ocrBtn.style.display = 'inline-block';
      ocrBtn.textContent = '🔍 Quét OCR bằng AI (kết quả chính xác hơn)';
    }

    // Handle OCR click for text PDFs that want better extraction
    ocrBtn.onclick = async () => {
      ocrBtn.disabled = true;
      ocrBtn.textContent = '⏳ Đang quét AI...';
      textContentArea.textContent = 'Đang chuyển trang thành ảnh và gửi lên AI... Vui lòng chờ...';
      await runPdfOcr(pdf, file, textContentArea, ocrBtn, container);
    };

    container.querySelector('#pdf-copy-btn').addEventListener('click', () => {
      const currentText = textContentArea.textContent;
      navigator.clipboard.writeText(currentText).then(() => showToast('Đã copy nội dung!')).catch(() => showToast('Không thể copy', 'error'));
    });

    // Log to Firestore
    try {
      const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
      const db = getFirestore(app);
      addDoc(collection(db, 'search_logs'), {
        query: `[Xử lý PDF] Trích xuất file: ${file.name} (${pdf.numPages} trang)`,
        model: "Local PDF Extractor",
        userEmail: window.currentUser?.email || 'Unknown',
        timestamp: serverTimestamp()
      }).catch(e => console.warn(e));
    } catch(e) {}

  } catch (e) {
    console.error(e);
    zone.innerHTML = `<div class="upload-icon">❌</div><div class="upload-text">Lỗi xử lý: ${e.message}</div>`;
    showToast('Lỗi xử lý PDF: ' + e.message, 'error');
  }
}

async function runPdfOcr(pdf, file, textContentArea, ocrBtn, container) {
  try {
    const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    const db = getFirestore(app);
    const content = [{ type: "text", text: OCR_PROMPT }];
    
    // Render up to 15 pages at scale 2.0 for better quality
    const limitPages = Math.min(pdf.numPages, 15);
    for (let i = 1; i <= limitPages; i++) {
      textContentArea.textContent = `Đang chuyển trang ${i}/${limitPages} thành ảnh...`;
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      await page.render({ canvasContext: context, viewport }).promise;
      const base64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
      content.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64}` } });
    }

    textContentArea.textContent = `Đang gửi ${limitPages} trang lên AI để quét OCR...`;

    const config = await fetchSystemConfig();
    const model = (
      config?.gemini_model || 'gemini-2.5-flash'
    );
    const ocrText = await sendChatRequest([{ role: "user", content }], model, { temperature: 0, context: 'ocr' });
    const finalText = ocrText || "Không quét được nội dung.";
    textContentArea.textContent = finalText;
    showToast('✓ Đã quét OCR thành công!');
    if (ocrBtn) ocrBtn.style.display = 'none';
    
    // Log OCR usage
    addDoc(collection(db, 'search_logs'), {
      query: `[OCR PDF] Quét ảnh Scan: ${file.name} (${limitPages} trang)`,
      model: `${model} (OCR)`,
      userEmail: window.currentUser?.email || 'Unknown',
      timestamp: serverTimestamp()
    }).catch(e => console.warn(e));

  } catch (err) {
    textContentArea.textContent = 'Lỗi OCR: ' + err.message;
    if (ocrBtn) {
      ocrBtn.disabled = false;
      ocrBtn.textContent = '🔍 Quét lại OCR';
      ocrBtn.style.display = 'inline-block';
    }
    showToast('Lỗi OCR: ' + err.message, 'error');
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

