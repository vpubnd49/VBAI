/**
 * Meeting Minutes Module
 * Chuyển đổi audio cuộc họp thành Thông báo kết luận (NĐ30/HD36)
 */
import { Document, Packer, Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, BorderStyle, WidthType, VerticalAlign, LineRuleType, UnderlineType } from 'docx';
import { saveAs } from 'file-saver';
import { showToast } from '../main.js';
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { GoogleGenAI } from "https://esm.run/@google/genai";
import { firebaseConfig } from '../firebase-config.js';

let formState = {
  step: 1,
  audioFile: null,
  isProcessing: false,
  
  // Dữ liệu bóc băng
  chu_tri: '',
  thanh_phan: '',
  tom_tat_noi_dung: '',
  ket_luan: [],
  transcript: '',

  // Dữ liệu xuất văn bản
  the_thuc: 'nd30',
  co_quan_chu_quan: '',
  co_quan_ban_hanh: '',
  so_ky_hieu: '',
  dia_danh: 'Lâm Đồng',
  ngay: '',
  thang: '',
  nam: '',
  nguoi_ky: '',
  chuc_vu_ky: '',
  quyen_han_ky: 'Ký trực tiếp',
  noi_nhan: '',
  dong_chuc_danh_1: '',
  dong_chuc_danh_2: '',
  dong_chuc_danh_3: ''
};

export function renderMeetingMinutes(container) {
  const now = new Date();
  if (!formState.ngay) {
    formState.ngay = String(now.getDate()).padStart(2, '0');
    formState.thang = String(now.getMonth() + 1).padStart(2, '0');
    formState.nam = String(now.getFullYear());
  }
  doRender(container);
}

function doRender(c) {
  c.innerHTML = `
    <div class="page-header">
      <div class="page-title">🎙️ Ghi Âm → Thông Báo Kết Luận</div>
      <div class="page-subtitle">Sử dụng AI phân tích file ghi âm cuộc họp và tự động tạo Thông báo kết luận (NĐ30/HD36)</div>
    </div>
    <div class="steps-bar">
      ${[1, 2, 3].map(i => `<button class="step-indicator ${formState.step === i ? 'active' : formState.step > i ? 'completed' : ''}" data-step="${i}"><span class="step-num">${formState.step > i ? '✓' : i}</span><span>${['Upload & Phân tích', 'Chỉnh sửa nội dung', 'Xuất văn bản'][i - 1]}</span></button>`).join('')}
    </div>
    <div id="sc" class="section-card"></div>
  `;

  c.querySelectorAll('.step-indicator').forEach(b => b.addEventListener('click', () => {
    const st = +b.dataset.step;
    if (st <= formState.step && !formState.isProcessing) {
      formState.step = st;
      doRender(c);
    }
  }));

  const sc = c.querySelector('#sc');
  if (formState.step === 1) renderStep1(sc, c);
  else if (formState.step === 2) renderStep2(sc, c);
  else renderStep3(sc, c);
}

function renderStep1(sc, c) {
  sc.innerHTML = `
    <div class="section-title">📌 Bước 1: Tải lên file ghi âm cuộc họp</div>
    <div class="panel-group">
      <div class="panel-body" style="text-align: center;">
        <input type="file" id="audio-upload" accept="audio/*" style="display: none;" />
        <div class="upload-zone" id="drop-zone" onclick="document.getElementById('audio-upload').click()">
          <div class="upload-icon">🎤</div>
          <div class="upload-text">Nhấp hoặc kéo thả file ghi âm vào đây</div>
          <div class="upload-hint">Hỗ trợ: MP3, WAV, M4A, OGG, AAC (Tối đa 20MB cho xử lý trực tiếp)</div>
          ${formState.audioFile ? `<div style="margin-top: 15px; color: var(--success); font-weight: bold;">Đã chọn: ${formState.audioFile.name}</div>` : ''}
        </div>
      </div>
    </div>
    <div id="processing-indicator" style="display: none; text-align: center; padding: 20px;">
      <div class="spinner"></div>
      <div style="margin-top: 10px; color: var(--daquy-400); font-weight: 600;">Hệ thống AI đang nghe và phân tích cuộc họp... (Có thể mất 1-3 phút)</div>
    </div>
    <div class="btn-row">
      <button class="btn btn-primary" id="btn-process" ${!formState.audioFile ? 'disabled' : ''}>Phân tích bằng AI →</button>
    </div>
  `;

  const fileInput = sc.querySelector('#audio-upload');
  const dropZone = sc.querySelector('#drop-zone');
  const btnProcess = sc.querySelector('#btn-process');
  const indicator = sc.querySelector('#processing-indicator');

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      formState.audioFile = e.target.files[0];
      doRender(c);
    }
  });

  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.style.borderColor = 'var(--pine-500)'; });
  dropZone.addEventListener('dragleave', () => { dropZone.style.borderColor = 'var(--border-default)'; });
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = 'var(--border-default)';
    if (e.dataTransfer.files.length > 0) {
      formState.audioFile = e.dataTransfer.files[0];
      doRender(c);
    }
  });

  btnProcess.addEventListener('click', async () => {
    if (!formState.audioFile) return;
    formState.isProcessing = true;
    btnProcess.disabled = true;
    indicator.style.display = 'block';

    try {
      await processAudioWithGemini(formState.audioFile);
      formState.isProcessing = false;
      formState.step = 2;
      doRender(c);
    } catch (error) {
      console.error(error);
      showToast('Lỗi khi phân tích audio: ' + error.message, 'error');
      formState.isProcessing = false;
      doRender(c);
    }
  });
}

function renderStep2(sc, c) {
  sc.innerHTML = `
    <div class="section-title">✍️ Bước 2: Chỉnh sửa nội dung phân tích</div>
    <div class="panel-group">
      <div class="panel-header"><div class="panel-header-icon">👥</div>Thông tin cuộc họp</div>
      <div class="panel-body form-grid">
        <div class="form-group span-2">
          <label class="form-label">Người chủ trì</label>
          <input class="form-input" id="f-chutri" value="${formState.chu_tri}" placeholder="VD: Đồng chí Nguyễn Ngọc Phúc - Phó Chủ tịch UBND tỉnh">
        </div>
        <div class="form-group span-2">
          <label class="form-label">Thành phần tham dự</label>
          <textarea class="form-textarea" id="f-thanhphan" rows="3">${formState.thanh_phan}</textarea>
        </div>
        <div class="form-group span-2">
          <label class="form-label">Tóm tắt nội dung cuộc họp</label>
          <textarea class="form-textarea" id="f-tomtat" rows="4">${formState.tom_tat_noi_dung}</textarea>
        </div>
      </div>
    </div>

    <div class="panel-group">
      <div class="panel-header"><div class="panel-header-icon">✅</div>Kết luận / Chỉ đạo</div>
      <div class="panel-body">
        <div id="conclusions-container" style="display: flex; flex-direction: column; gap: 10px;">
          ${formState.ket_luan.map((kl, idx) => `
            <div class="form-group conclusion-item">
              <label class="form-label">Kết luận ${idx + 1}</label>
              <div style="display: flex; gap: 10px;">
                <textarea class="form-textarea kl-val" rows="3" style="flex: 1;">${kl}</textarea>
                <button class="btn btn-secondary btn-del-kl" data-idx="${idx}" style="padding: 10px;">🗑️</button>
              </div>
            </div>
          `).join('')}
        </div>
        <button class="btn btn-secondary" id="btn-add-kl" style="margin-top: 15px;">+ Thêm kết luận</button>
      </div>
    </div>

    <div class="panel-group">
      <div class="panel-header"><div class="panel-header-icon">📝</div>Transcript toàn văn (Bóc băng)</div>
      <div class="panel-body">
        <textarea class="form-textarea" rows="8" readonly style="background: rgba(0,0,0,0.1);">${formState.transcript}</textarea>
      </div>
    </div>

    <div class="btn-row">
      <button class="btn btn-secondary" id="btn-back-1">← Quay lại</button>
      <button class="btn btn-primary" id="btn-next-3">Tiếp tục: Xuất văn bản →</button>
    </div>
  `;

  const saveState = () => {
    formState.chu_tri = sc.querySelector('#f-chutri').value;
    formState.thanh_phan = sc.querySelector('#f-thanhphan').value;
    formState.tom_tat_noi_dung = sc.querySelector('#f-tomtat').value;
    formState.ket_luan = Array.from(sc.querySelectorAll('.kl-val')).map(el => el.value);
  };

  sc.querySelector('#btn-add-kl').addEventListener('click', () => {
    saveState();
    formState.ket_luan.push("");
    renderStep2(sc, c);
  });

  sc.querySelectorAll('.btn-del-kl').forEach(btn => {
    btn.addEventListener('click', (e) => {
      saveState();
      const idx = parseInt(e.currentTarget.dataset.idx);
      formState.ket_luan.splice(idx, 1);
      renderStep2(sc, c);
    });
  });

  sc.querySelector('#btn-back-1').addEventListener('click', () => { saveState(); formState.step = 1; doRender(c); });
  sc.querySelector('#btn-next-3').addEventListener('click', () => { saveState(); formState.step = 3; doRender(c); });
}

function renderStep3(sc, c) {
  sc.innerHTML = `
    <div class="section-title">📄 Bước 3: Xuất Thông báo kết luận</div>
    
    <div class="panel-group">
      <div class="panel-header"><div class="panel-header-icon">⚙️</div>Cấu hình thể thức</div>
      <div class="panel-body form-grid">
        <div class="form-group span-2" style="display: flex; gap: 20px;">
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
            <input type="radio" name="the_thuc" value="nd30" ${formState.the_thuc === 'nd30' ? 'checked' : ''}> Hành chính (NĐ30)
          </label>
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
            <input type="radio" name="the_thuc" value="hd36" ${formState.the_thuc === 'hd36' ? 'checked' : ''}> Đảng (HD36)
          </label>
        </div>
      </div>
    </div>

    <div class="panel-group">
      <div class="panel-header"><div class="panel-header-icon">🏛️</div>Thông tin phát hành</div>
      <div class="panel-body form-grid">
        <div class="form-group"><label class="form-label">CQ chủ quản (nếu có)</label><input class="form-input" id="f-cqcq" value="${formState.co_quan_chu_quan}"></div>
        <div class="form-group"><label class="form-label">CQ ban hành <span class="required">*</span></label><input class="form-input" id="f-cqbh" value="${formState.co_quan_ban_hanh}"></div>
        <div class="form-group"><label class="form-label">Số, ký hiệu</label><input class="form-input" id="f-skh" value="${formState.so_ky_hieu}" placeholder="Số:    /TB-UBND"></div>
        <div class="form-group"><label class="form-label">Ngày ban hành</label><div style="display:flex;gap:8px"><input class="form-input" id="f-ng" value="${formState.ngay}" style="flex:1"><input class="form-input" id="f-th" value="${formState.thang}" style="flex:1"><input class="form-input" id="f-na" value="${formState.nam}" style="flex:1"></div></div>
        
        <div class="form-group span-2"><label class="form-label">Người ký <span class="required">*</span></label><input class="form-input" id="f-nk" value="${formState.nguoi_ky}"></div>
        
        <div class="span-2" style="margin-top: 10px; font-weight: bold; font-size: 0.8rem; color: var(--daquy-500);">Dòng chức danh</div>
        <div class="form-group span-2"><label class="form-label">Dòng 1</label><input class="form-input" id="f-cd1" value="${formState.dong_chuc_danh_1}" placeholder="TL. CHỦ TỊCH"></div>
        <div class="form-group span-2"><label class="form-label">Dòng 2</label><input class="form-input" id="f-cd2" value="${formState.dong_chuc_danh_2}" placeholder="KT. CHÁNH VĂN PHÒNG"></div>
        <div class="form-group span-2"><label class="form-label">Dòng 3</label><input class="form-input" id="f-cd3" value="${formState.dong_chuc_danh_3}"></div>

        <div class="form-group span-2"><label class="form-label">Nơi nhận</label><textarea class="form-textarea" id="f-nn" rows="4" placeholder="Như trên;\nLưu: VT, ...">${formState.noi_nhan}</textarea></div>
      </div>
    </div>

    <div class="btn-row" style="justify-content: center; margin-top: 24px;">
      <button class="btn btn-secondary" id="btn-back-2">← Quay lại chỉnh sửa</button>
      <button class="btn btn-success" id="btn-export">⬇ Tải Thông báo (.DOCX)</button>
    </div>
  `;

  const saveState = () => {
    formState.the_thuc = sc.querySelector('input[name="the_thuc"]:checked').value;
    formState.co_quan_chu_quan = sc.querySelector('#f-cqcq').value;
    formState.co_quan_ban_hanh = sc.querySelector('#f-cqbh').value;
    formState.so_ky_hieu = sc.querySelector('#f-skh').value;
    formState.ngay = sc.querySelector('#f-ng').value;
    formState.thang = sc.querySelector('#f-th').value;
    formState.nam = sc.querySelector('#f-na').value;
    formState.nguoi_ky = sc.querySelector('#f-nk').value;
    formState.dong_chuc_danh_1 = sc.querySelector('#f-cd1').value;
    formState.dong_chuc_danh_2 = sc.querySelector('#f-cd2').value;
    formState.dong_chuc_danh_3 = sc.querySelector('#f-cd3').value;
    formState.noi_nhan = sc.querySelector('#f-nn').value;
  };

  sc.querySelectorAll('input[name="the_thuc"]').forEach(rad => {
    rad.addEventListener('change', () => { saveState(); renderStep3(sc, c); });
  });

  sc.querySelector('#btn-back-2').addEventListener('click', () => { saveState(); formState.step = 2; doRender(c); });
  sc.querySelector('#btn-export').addEventListener('click', () => {
    saveState();
    if (!formState.co_quan_ban_hanh || !formState.nguoi_ky) {
      showToast('Vui lòng nhập cơ quan ban hành và người ký!', 'error');
      return;
    }
    generateNotificationDocx();
  });
}

// ==============================================
// XỬ LÝ GEMINI AI
// ==============================================
async function getApiKey() {
  const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  const db = getFirestore(app);
  const docSnap = await getDoc(doc(db, 'config', 'system'));
  if (docSnap.exists() && docSnap.data().gemini_api_key) {
    return docSnap.data().gemini_api_key;
  }
  throw new Error("Vui lòng cấu hình Gemini API Key trong phần Trợ Lý Pháp Lý (Dashboard) trước khi sử dụng tính năng này.");
}

async function processAudioWithGemini(file) {
  const apiKey = await getApiKey();
  const aiClient = new GoogleGenAI({ apiKey });
  const model = "gemini-3.1-flash-lite-preview";

  // Chuyển file sang Base64
  const base64Audio = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const prompt = `
Bạn là một trợ lý thư ký cuộc họp chuyên nghiệp. Hãy nghe kỹ file ghi âm cuộc họp này và thực hiện các yêu cầu sau:

1. Xác định NGƯỜI CHỦ TRÌ cuộc họp (nếu có, có thể kèm theo chức vụ).
2. Liệt kê THÀNH PHẦN THAM DỰ.
3. TÓM TẮT nội dung chính của cuộc họp (ngắn gọn, súc tích).
4. Liệt kê các KẾT LUẬN và CHỈ ĐẠO cụ thể của người chủ trì. Mỗi kết luận/chỉ đạo là một mục riêng biệt. Cần chú ý tóm tắt chính xác nội dung kết luận dựa vào biên bản/ghi âm.
5. Tạo bản TRANSCRIPT (bóc băng) toàn văn nếu có thể.

Vui lòng trả về ĐÚNG định dạng JSON theo cấu trúc sau, không kèm theo bất kỳ văn bản giải thích nào:
{
  "chu_tri": "Họ và tên - Chức vụ",
  "thanh_phan": "Danh sách các đơn vị/cá nhân tham dự",
  "tom_tat_noi_dung": "Đoạn văn tóm tắt nội dung chính đã thảo luận...",
  "ket_luan": [
    "Kết luận số 1:...",
    "Kết luận số 2:..."
  ],
  "transcript": "Nội dung bóc băng chi tiết..."
}
  `;

  const response = await aiClient.models.generateContent({
    model: model,
    contents: [
      {
        role: 'user',
        parts: [
          { inlineData: { data: base64Audio, mimeType: file.type } },
          { text: prompt }
        ]
      }
    ]
  });

  let text = response.text || "";
  text = text.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
  
  try {
    const data = JSON.parse(text);
    formState.chu_tri = data.chu_tri || "";
    formState.thanh_phan = data.thanh_phan || "";
    formState.tom_tat_noi_dung = data.tom_tat_noi_dung || "";
    formState.ket_luan = data.ket_luan || [];
    formState.transcript = data.transcript || "";
  } catch (e) {
    console.error("Lỗi parse JSON:", e, "Text response:", text);
    formState.transcript = response.text;
    formState.tom_tat_noi_dung = "Không thể trích xuất cấu trúc JSON. Vui lòng xem bản transcript bên dưới.";
  }

  // Log
  try {
    const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    const db = getFirestore(app);
    addDoc(collection(db, 'search_logs'), {
      query: `[Ghi Âm → Thông Báo] Xử lý file: ${file.name}`,
      model: model,
      userEmail: window.currentUser?.email || 'Unknown',
      timestamp: serverTimestamp()
    }).catch(e => console.warn(e));
  } catch (e) {}
}

// ==============================================
// XUẤT DOCX
// ==============================================
const L = { PAGE: { width: 11906, height: 16838 }, MARGIN: { top: 1134, bottom: 1134, left: 1701, right: 1134 }, FONT: 'Times New Roman', CW: 9071 };
const BN = { top: { style: BorderStyle.NONE, size: 0, color: 'auto' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' }, left: { style: BorderStyle.NONE, size: 0, color: 'auto' }, right: { style: BorderStyle.NONE, size: 0, color: 'auto' }, insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'auto' }, insideVertical: { style: BorderStyle.NONE, size: 0, color: 'auto' } };
const BS = { before: 120, after: 0, line: 340, lineRule: LineRuleType.AT_LEAST };

async function generateNotificationDocx() {
  try {
    const fs = formState;
    const isND30 = fs.the_thuc === 'nd30';
    const ch = [];

    // Header
    const lc = [], rc = [];
    if (fs.co_quan_chu_quan) lc.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [new TextRun({ text: fs.co_quan_chu_quan, font: L.FONT, size: 26 })] }));
    lc.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [new TextRun({ text: fs.co_quan_ban_hanh, font: L.FONT, size: 26, bold: true })] }));
    lc.push(new Paragraph({ spacing: { before: 20, after: 80 }, border: { top: { style: BorderStyle.SINGLE, size: 2, color: '000000', space: 1 } }, indent: { left: 1500, right: 1500 } }));
    lc.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [new TextRun({ text: fs.so_ky_hieu || 'Số:    /TB-...', font: L.FONT, size: 26 })] }));

    if (isND30) {
      rc.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [new TextRun({ text: 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', font: L.FONT, size: 26, bold: true })] }));
      rc.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [new TextRun({ text: 'Độc lập - Tự do - Hạnh phúc', font: L.FONT, size: 28, bold: true })] }));
      rc.push(new Paragraph({ spacing: { before: 20, after: 0 }, border: { top: { style: BorderStyle.SINGLE, size: 2, color: '000000', space: 1 } }, indent: { left: 1100, right: 1100 } }));
    } else {
      rc.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [new TextRun({ text: 'ĐẢNG CỘNG SẢN VIỆT NAM', font: L.FONT, size: 30, bold: true })] }));
      rc.push(new Paragraph({ spacing: { before: 20, after: 0 }, border: { top: { style: BorderStyle.SINGLE, size: 2, color: '000000', space: 1 } }, indent: { left: 928, right: 928 } }));
    }
    
    rc.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [new TextRun({ text: `${fs.dia_danh}, ngày ${fs.ngay || '...'} tháng ${fs.thang || '...'} năm ${fs.nam}`, font: L.FONT, size: 28, italics: true })] }));
    ch.push(new Table({ width: { size: L.CW, type: WidthType.DXA }, borders: BN, columnWidths: [3500, 5571], rows: [new TableRow({ children: [new TableCell({ borders: BN, width: { size: 3500, type: WidthType.DXA }, verticalAlign: VerticalAlign.TOP, children: lc }), new TableCell({ borders: BN, width: { size: 5571, type: WidthType.DXA }, verticalAlign: VerticalAlign.TOP, children: rc })] })] }));

    // Title
    ch.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 360, after: 120 }, children: [new TextRun({ text: 'THÔNG BÁO', font: L.FONT, size: 28, bold: true })] }));
    ch.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 }, children: [new TextRun({ text: `Kết luận của ${fs.chu_tri || 'lãnh đạo'} tại cuộc họp...`, font: L.FONT, size: 28, bold: true })] }));
    
    // Line separator
    ch.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 240 }, children: [new TextRun({ text: '_______________', font: L.FONT, size: 28 })] }));

    // Body Content
    const intro = `Ngày ${fs.ngay || '...'} tháng ${fs.thang || '...'} năm ${fs.nam}, tại [địa điểm], ${fs.chu_tri} đã chủ trì cuộc họp về [nội dung cuộc họp].`;
    ch.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: BS, indent: { firstLine: 567 }, children: [new TextRun({ text: intro, font: L.FONT, size: 28 })] }));
    
    if (fs.thanh_phan) {
      ch.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: BS, indent: { firstLine: 567 }, children: [new TextRun({ text: `Thành phần tham dự: ${fs.thanh_phan}`, font: L.FONT, size: 28 })] }));
    }

    if (fs.tom_tat_noi_dung) {
      ch.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: BS, indent: { firstLine: 567 }, children: [new TextRun({ text: fs.tom_tat_noi_dung, font: L.FONT, size: 28 })] }));
    }

    ch.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: BS, indent: { firstLine: 567 }, children: [new TextRun({ text: `Sau khi nghe báo cáo và ý kiến thảo luận của các đại biểu dự họp, ${fs.chu_tri} kết luận, chỉ đạo như sau:`, font: L.FONT, size: 28 })] }));

    // Conclusions
    fs.ket_luan.forEach((kl, i) => {
      if (kl.trim()) {
        ch.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: BS, indent: { firstLine: 0, left: 567, hanging: 567 }, children: [
          new TextRun({ text: `${i + 1}. `, font: L.FONT, size: 28, bold: true }),
          new TextRun({ text: kl.trim(), font: L.FONT, size: 28 })
        ]}));
      }
    });

    ch.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: BS, indent: { firstLine: 567 }, children: [new TextRun({ text: `Trân trọng thông báo kết luận của ${fs.chu_tri} để các cơ quan, đơn vị liên quan biết, phối hợp thực hiện./.`, font: L.FONT, size: 28 })] }));

    // Signature
    const nn = [new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: 'Nơi nhận:', font: L.FONT, size: 24, bold: true, italics: true })] })];
    (fs.noi_nhan || 'Như trên;\nLưu: VT.').split('\n').filter(l => l.trim()).forEach(n => nn.push(new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: '- ' + n.trim(), font: L.FONT, size: 22 })] })));
    
    const sg = [];
    if (fs.dong_chuc_danh_1) sg.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [new TextRun({ text: fs.dong_chuc_danh_1, font: L.FONT, size: 28, bold: true })] }));
    if (fs.dong_chuc_danh_2) sg.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [new TextRun({ text: fs.dong_chuc_danh_2, font: L.FONT, size: 28, bold: true })] }));
    if (fs.dong_chuc_danh_3) sg.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [new TextRun({ text: fs.dong_chuc_danh_3, font: L.FONT, size: 28, bold: true })] }));
    for (let i = 0; i < 4; i++) sg.push(new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: '', font: L.FONT, size: 28 })] }));
    sg.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [new TextRun({ text: fs.nguoi_ky, font: L.FONT, size: 28, bold: true })] }));
    
    ch.push(new Paragraph({ spacing: { before: 240 }, children: [] }));
    ch.push(new Table({ width: { size: L.CW, type: WidthType.DXA }, borders: BN, columnWidths: [4300, 4771], rows: [new TableRow({ children: [new TableCell({ borders: BN, width: { size: 4300, type: WidthType.DXA }, verticalAlign: VerticalAlign.TOP, children: nn }), new TableCell({ borders: BN, width: { size: 4771, type: WidthType.DXA }, verticalAlign: VerticalAlign.TOP, children: sg })] })] }));
    
    const doc = new Document({ styles: { default: { document: { run: { font: L.FONT, size: 28 } } } }, sections: [{ properties: { page: { size: L.PAGE, margin: L.MARGIN } }, children: ch }] });
    const blob = await Packer.toBlob(doc);
    saveAs(blob, `TBKL_${isND30 ? 'ND30' : 'HD36'}.docx`);
    showToast('✓ Đã tải file Thông báo kết luận thành công!');
  } catch (e) {
    console.error(e);
    showToast('Lỗi khi tạo file DOCX: ' + e.message, 'error');
  }
}
