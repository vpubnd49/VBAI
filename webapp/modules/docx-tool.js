/**
 * DOCX Tool Module — Quick document creation
 */
import { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';
import { showToast } from '../main.js';
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAmdSiD2byxr19cZZ7xc2HUpbsAWDChZzw",
  authDomain: "vbai-a1729.firebaseapp.com",
  projectId: "vbai-a1729",
  storageBucket: "vbai-a1729.firebasestorage.app",
  messagingSenderId: "691819234622",
  appId: "1:691819234622:web:d34caa7684c1949a5c986f",
  measurementId: "G-XLHHMNXRND"
};


export function renderDocxTool(container) {
  container.innerHTML = `
    <div class="page-header">
      <div class="page-title">📝 Tạo File DOCX Nhanh</div>
      <div class="page-subtitle">Tạo file Word (.docx) với định dạng chuyên nghiệp</div>
    </div>
    <div class="section-card">
      <div class="section-title">📄 Nội dung tài liệu</div>
      <div class="form-grid">
        <div class="form-group span-2">
          <label class="form-label">Tiêu đề tài liệu</label>
          <input class="form-input" id="docx-title" placeholder="Nhập tiêu đề tài liệu...">
        </div>
        <div class="form-group span-2">
          <label class="form-label">Nội dung (mỗi đoạn cách nhau 1 dòng trống, dòng bắt đầu # sẽ thành Heading)</label>
          <textarea class="form-textarea" id="docx-body" rows="15" placeholder="# Phần 1: Giới thiệu&#10;Nội dung phần 1...&#10;&#10;# Phần 2: Chi tiết&#10;Nội dung phần 2..."></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Font chữ</label>
          <select class="form-select" id="docx-font">
            <option value="Times New Roman" selected>Times New Roman</option>
            <option value="Arial">Arial</option>
            <option value="Calibri">Calibri</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Cỡ chữ (pt)</label>
          <input class="form-input" id="docx-size" type="number" value="14" min="8" max="72">
        </div>
      </div>
      <div class="btn-row">
        <button class="btn btn-success" id="docx-gen">⬇ Tạo & Tải DOCX</button>
      </div>
    </div>

    <div class="section-card" style="margin-top:20px">
      <div class="section-title">📂 Phân tích file DOCX có sẵn</div>
      <div class="upload-zone" id="docx-drop-zone">
        <div class="upload-icon">📝</div>
        <div class="upload-text">Kéo thả file .docx vào để xem nội dung XML</div>
        <div class="upload-hint">Chỉ hỗ trợ .docx (Open XML)</div>
        <input type="file" id="docx-file-input" accept=".docx" style="display:none">
      </div>
      <div id="docx-analysis" style="display:none;margin-top:16px">
        <div style="background:var(--bg-input);padding:16px;border-radius:var(--radius-md);font-size:0.8rem;max-height:400px;overflow-y:auto;white-space:pre-wrap;font-family:monospace;color:var(--text-primary);border:1px solid var(--border-subtle)" id="docx-xml-content"></div>
      </div>
    </div>
  `;

  // Generate DOCX
  container.querySelector('#docx-gen').addEventListener('click', async () => {
    const title = container.querySelector('#docx-title').value || 'Tài liệu';
    const body = container.querySelector('#docx-body').value;
    const font = container.querySelector('#docx-font').value;
    const size = parseInt(container.querySelector('#docx-size').value) * 2;

    if (!body.trim()) { showToast('Vui lòng nhập nội dung', 'error'); return; }

    try {
      const children = [];
      // Title
      children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 300 }, children: [new TextRun({ text: title, font, size: size + 8, bold: true })] }));

      // Body
      body.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) { children.push(new Paragraph({ spacing: { after: 100 }, children: [] })); return; }
        if (trimmed.startsWith('# ')) {
          children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 200, after: 100 }, children: [new TextRun({ text: trimmed.slice(2), font, size: size + 4, bold: true })] }));
        } else if (trimmed.startsWith('## ')) {
          children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 150, after: 80 }, children: [new TextRun({ text: trimmed.slice(3), font, size: size + 2, bold: true })] }));
        } else {
          children.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 80 }, indent: { firstLine: 567 }, children: [new TextRun({ text: trimmed, font, size })] }));
        }
      });

      const doc = new Document({ styles: { default: { document: { run: { font, size } } } }, sections: [{ children }] });
      const blob = await Packer.toBlob(doc);
      saveAs(blob, `${title.replace(/[^a-zA-Z0-9À-ỹ]/g, '_')}.docx`);
      showToast('✓ Đã tạo file DOCX!');

      // Log to Firestore
      try {
        const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
        const db = getFirestore(app);
        addDoc(collection(db, 'search_logs'), {
          query: `[Tạo DOCX Nhanh] Tiêu đề: ${title}`,
          model: "Local DOCX Generator",
          timestamp: serverTimestamp()
        }).catch(e => console.warn(e));
      } catch(e) {}

    } catch (e) { showToast('Lỗi: ' + e.message, 'error'); }
  });

  // Analyze DOCX
  const zone = container.querySelector('#docx-drop-zone');
  const input = container.querySelector('#docx-file-input');
  zone.addEventListener('click', () => input.click());
  zone.addEventListener('dragover', e => { e.preventDefault(); });
  zone.addEventListener('drop', e => { e.preventDefault(); if (e.dataTransfer.files[0]) analyzeDocx(e.dataTransfer.files[0], container); });
  input.addEventListener('change', e => { if (e.target.files[0]) analyzeDocx(e.target.files[0], container); });
}

async function analyzeDocx(file, container) {
  try {
    const JSZip = (await import('https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm')).default;
    const zip = await JSZip.loadAsync(file);
    const docXml = await zip.file('word/document.xml')?.async('text');
    if (!docXml) { showToast('Không tìm thấy document.xml', 'error'); return; }

    // Pretty print XML
    const formatted = docXml.replace(/></g, '>\n<');
    container.querySelector('#docx-analysis').style.display = 'block';
    container.querySelector('#docx-xml-content').textContent = formatted;
    showToast(`✓ Đã phân tích: ${file.name}`);

    // Log to Firestore
    try {
      const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
      const db = getFirestore(app);
      addDoc(collection(db, 'search_logs'), {
        query: `[Phân tích XML DOCX] Tên file: ${file.name}`,
        model: "Local DOCX Parser",
        timestamp: serverTimestamp()
      }).catch(e => console.warn(e));
    } catch(e) {}

  } catch (e) { showToast('Lỗi: ' + e.message, 'error'); }
}
