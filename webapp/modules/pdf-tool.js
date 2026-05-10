/**
 * PDF Tool Module — Upload & extract text from PDF
 */
import { showToast } from '../main.js';
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { sendChatRequest } from './ai-proxy.js';

import { firebaseConfig } from '../firebase-config.js';


export function renderPdfTool(container) {
  container.innerHTML = `
    <div class="page-header">
      <div class="page-title">📄 Xử Lý PDF</div>
      <div class="page-subtitle">Upload file PDF để trích xuất nội dung văn bản</div>
    </div>
    <div class="section-card">
      <div class="upload-zone" id="pdf-drop-zone">
        <div class="upload-icon">📄</div>
        <div class="upload-text">Kéo thả file PDF vào đây hoặc click để chọn</div>
        <div class="upload-hint">Hỗ trợ file .pdf — tối đa 20MB</div>
        <input type="file" id="pdf-file-input" accept=".pdf" style="display:none">
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
  zone.addEventListener('drop', e => { e.preventDefault(); zone.style.borderColor = ''; if(e.dataTransfer.files[0]) handlePdf(e.dataTransfer.files[0], container); });
  input.addEventListener('change', e => { if(e.target.files[0]) handlePdf(e.target.files[0], container); });
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

    zone.innerHTML = `<div class="upload-icon">✅</div><div class="upload-text">${file.name} — ${pdf.numPages} trang</div><div class="upload-hint">Click để chọn file khác</div><input type="file" id="pdf-file-input" accept=".pdf" style="display:none">`;
    container.querySelector('#pdf-file-input').addEventListener('change', e => { if(e.target.files[0]) handlePdf(e.target.files[0], container); });

    const result = container.querySelector('#pdf-result');
    result.style.display = 'block';
    const textContentArea = result.querySelector('#pdf-text-content');
    const ocrBtn = container.querySelector('#pdf-ocr-btn');
    
    if (fullText.trim().replace(/--- Trang \d+ ---/g, '').trim().length < 50) {
      textContentArea.textContent = '(Không trích xuất được nội dung — file có thể là ảnh scan. Hãy dùng chức năng Quét OCR bên trên)';
      ocrBtn.style.display = 'inline-block';
    } else {
      textContentArea.textContent = fullText;
      ocrBtn.style.display = 'none';
    }

    // Handle OCR click
    ocrBtn.onclick = async () => {
      ocrBtn.disabled = true;
      ocrBtn.textContent = '⏳ Đang quét AI...';
      textContentArea.textContent = 'Đang chuyển trang thành ảnh và gửi lên AI... Vui lòng chờ vài giây...';
      
      try {
        const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
        const db = getFirestore(app);
        const content = [{ type: "text", text: "Hãy đọc và trích xuất nguyên văn toàn bộ chữ tiếng Việt có trong các hình ảnh tài liệu này. Giữ nguyên bố cục và xuống dòng nếu có thể." }];
        
        // Keep payload moderate for OpenAI-compatible multimodal endpoint
        const limitPages = Math.min(pdf.numPages, 8);
        for (let i = 1; i <= limitPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 1.5 });
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          await page.render({ canvasContext: context, viewport }).promise;
          const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
          content.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64}` } });
        }

        const model = (localStorage.getItem('vbai_router_model') || 'cx/gpt-5.5');
        fullText = await sendChatRequest([{ role: "user", content }], model, { temperature: 0, context: 'pdf' });
        fullText = fullText || "Không quét được nội dung.";
        textContentArea.textContent = fullText;
        showToast('✓ Đã quét OCR thành công!');
        ocrBtn.style.display = 'none'; // hide after success
        
        // Log OCR usage
        addDoc(collection(db, 'search_logs'), {
          query: `[OCR PDF] Quét ảnh Scan: ${file.name} (${limitPages} trang)`,
          model: `${model} (OCR)`,
          userEmail: window.currentUser?.email || 'Unknown',
          timestamp: serverTimestamp()
        }).catch(e => console.warn(e));

      } catch (err) {
        textContentArea.textContent = 'Lỗi OCR: ' + err.message;
        ocrBtn.disabled = false;
        ocrBtn.textContent = '🔍 Quét lại OCR';
        showToast('Lỗi OCR: ' + err.message, 'error');
      }
    };

    container.querySelector('#pdf-copy-btn').addEventListener('click', () => {
      navigator.clipboard.writeText(fullText).then(() => showToast('Đã copy nội dung!')).catch(() => showToast('Không thể copy', 'error'));
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

