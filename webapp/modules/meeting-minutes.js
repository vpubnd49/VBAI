/**
 * Meeting Minutes Module � Redesigned
 * Chuy?n d?i audio cu?c h?p th�nh Th�ng b�o k?t lu?n (N�30/HD36)
 * H? tr? file >100MB qua Gemini Files API
 */
import { Document, Packer, Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, BorderStyle, WidthType, VerticalAlign, LineRuleType } from 'docx';
import { saveAs } from 'file-saver';
import { showToast } from '../main.js';
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { GoogleGenAI } from "https://esm.run/@google/genai";
import { firebaseConfig } from '../firebase-config.js';
import { sendChatRequest, sendAudioTranscription, sendAudioTranscriptionViaChat } from './ai-proxy.js';

const DEFAULT_GEMINI_MODEL = "gemini-2.5-pro";
const DEFAULT_TRANSCRIBE_MODEL = "gemini-2.5-pro";

let formState = {
  step: 1, audioFile: null, isProcessing: false,
  chu_tri: '', thanh_phan: '', dia_diem: '', tom_tat: '',
  noi_dung_cuoc_hop: [],
  transcript: '',
  the_thuc: 'nd30', co_quan_chu_quan: '', co_quan_ban_hanh: '',
  so_ky_hieu: '', dia_danh: 'L�m �?ng', ngay: '', thang: '', nam: '',
  nguoi_ky: '', noi_nhan: '',
  dong_chuc_danh_1: '', dong_chuc_danh_2: '', dong_chuc_danh_3: ''
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
      <div class="page-title">??? Ghi �m ? Th�ng B�o K?t Lu?n</div>
      <div class="page-subtitle">S? d?ng AI ph�n t�ch file ghi �m cu?c h?p v� t? d?ng t?o Th�ng b�o k?t lu?n (N�30/HD36)</div>
    </div>
    <div class="steps-bar">
      ${[1, 2, 3].map(i => `<button class="step-indicator ${formState.step === i ? 'active' : formState.step > i ? 'completed' : ''}" data-step="${i}"><span class="step-num">${formState.step > i ? '?' : i}</span><span>${['Upload & Ph�n t�ch', 'Ch?nh s?a n?i dung', 'Xu?t van b?n'][i - 1]}</span></button>`).join('')}
    </div>
    <div id="sc" class="section-card"></div>
  `;
  c.querySelectorAll('.step-indicator').forEach(b => b.addEventListener('click', () => {
    const st = +b.dataset.step;
    if (st <= formState.step && !formState.isProcessing) { formState.step = st; doRender(c); }
  }));
  const sc = c.querySelector('#sc');
  if (formState.step === 1) renderStep1(sc, c);
  else if (formState.step === 2) renderStep2(sc, c);
  else renderStep3(sc, c);
}

function renderStep1(sc, c) {
  sc.innerHTML = `
    <div class="section-title">?? Bu?c 1: T?i l�n file ghi �m cu?c h?p</div>
    <div class="panel-group">
      <div class="panel-body" style="text-align: center;">
        <input type="file" id="audio-upload" accept="audio/*" style="display: none;" />
        <div class="upload-zone" id="drop-zone" onclick="document.getElementById('audio-upload').click()">
          <div class="upload-icon">??</div>
          <div class="upload-text">Nh?p ho?c k�o th? file ghi �m v�o d�y</div>
          <div class="upload-hint">H? tr?: MP3, WAV, M4A, OGG, AAC � <strong>T?i da 200MB</strong> (qua Gemini Files API)</div>
          ${formState.audioFile ? `<div style="margin-top: 15px; color: var(--success); font-weight: bold;">�� ch?n: ${formState.audioFile.name} (${(formState.audioFile.size / 1024 / 1024).toFixed(1)}MB)</div>` : ''}
        </div>
      </div>
    </div>
    <div id="processing-indicator" style="display: none; text-align: center; padding: 20px;">
      <div class="spinner"></div>
      <div id="processing-text" style="margin-top: 10px; color: var(--daquy-400); font-weight: 600;">�ang t?i file l�n Gemini...</div>
    </div>
    <div class="btn-row">
      <button class="btn btn-primary" id="btn-process" ${!formState.audioFile ? 'disabled' : ''}>Ph�n t�ch b?ng AI ?</button>
    </div>
  `;
  const fileInput = sc.querySelector('#audio-upload');
  const dropZone = sc.querySelector('#drop-zone');
  const btnProcess = sc.querySelector('#btn-process');
  const indicator = sc.querySelector('#processing-indicator');

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) { formState.audioFile = e.target.files[0]; doRender(c); }
  });
  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.style.borderColor = 'var(--pine-500)'; });
  dropZone.addEventListener('dragleave', () => { dropZone.style.borderColor = 'var(--border-default)'; });
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault(); dropZone.style.borderColor = 'var(--border-default)';
    if (e.dataTransfer.files.length > 0) { formState.audioFile = e.dataTransfer.files[0]; doRender(c); }
  });
  btnProcess.addEventListener('click', async () => {
    if (!formState.audioFile) return;
    formState.isProcessing = true; btnProcess.disabled = true; indicator.style.display = 'block';
    try {
      await processAudioWithGemini(formState.audioFile, sc.querySelector('#processing-text'));
      formState.isProcessing = false; formState.step = 2; doRender(c);
    } catch (error) {
      console.error(error); showToast('L?i khi ph�n t�ch audio: ' + error.message, 'error');
      formState.isProcessing = false; doRender(c);
    }
  });
}

function escHtml(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderStep2(sc, c) {
  const nds = formState.noi_dung_cuoc_hop;
  sc.innerHTML = `
    <div class="section-title">?? Bu?c 2: Ch?nh s?a n?i dung ph�n t�ch</div>
    <div class="panel-group">
      <div class="panel-header"><div class="panel-header-icon">??</div>Th�ng tin cu?c h?p</div>
      <div class="panel-body form-grid">
        <div class="form-group span-2"><label class="form-label">Ngu?i ch? tr�</label><input class="form-input" id="f-chutri" value="${escHtml(formState.chu_tri)}" placeholder="VD: �?ng ch� Nguy?n Ng?c Ph�c - Ph� Ch? t?ch UBND t?nh"></div>
        <div class="form-group span-2"><label class="form-label">Th�nh ph?n tham d?</label><textarea class="form-textarea" id="f-thanhphan" rows="3">${escHtml(formState.thanh_phan)}</textarea></div>
        <div class="form-group span-2"><label class="form-label">�?a di?m</label><input class="form-input" id="f-diadiem" value="${escHtml(formState.dia_diem)}" placeholder="VD: Ph�ng h?p s? 1, UBND t?nh"></div>
        <div class="form-group span-2"><label class="form-label">T�m t?t n?i dung cu?c h?p</label><textarea class="form-textarea" id="f-tomtat" rows="3">${escHtml(formState.tom_tat)}</textarea></div>
      </div>
    </div>

    <div class="panel-group">
      <div class="panel-header"><div class="panel-header-icon">??</div>N?i dung k?t lu?n theo t?ng v?n d?</div>
      <div class="panel-body">
        <div id="topics-container" style="display: flex; flex-direction: column; gap: 20px;">
          ${nds.map((nd, ti) => `
            <div class="panel-group" style="border: 1px solid var(--daquy-400); margin-bottom: 0;">
              <div class="panel-header" style="justify-content: space-between;">
                <span>?? V?n d? ${ti + 1}</span>
                <button class="btn btn-secondary btn-del-topic" data-ti="${ti}" style="padding: 4px 10px; font-size: 0.75rem;">??? X�a</button>
              </div>
              <div class="panel-body">
                <div class="form-group" style="margin-bottom: 12px;">
                  <label class="form-label">Ti�u d? v?n d?</label>
                  <input class="form-input topic-title" data-ti="${ti}" value="${escHtml(nd.tieu_de)}" placeholder="VD: V? c�ng t�c c?i c�ch h�nh ch�nh">
                </div>
                <div class="form-group" style="margin-bottom: 12px;">
                  <label class="form-label">��nh gi� / Nh?n d?nh (ph?n m? d?u)</label>
                  <textarea class="form-textarea topic-eval" data-ti="${ti}" rows="3">${escHtml(nd.danh_gia)}</textarea>
                </div>
                <div class="form-group">
                  <label class="form-label">C�c k?t lu?n, ch? d?o c? th?</label>
                  <div class="kl-list" data-ti="${ti}" style="display: flex; flex-direction: column; gap: 8px;">
                    ${(nd.ket_luan || []).map((kl, ki) => `
                      <div style="display: flex; gap: 8px; align-items: flex-start;">
                        <span style="min-width: 24px; padding-top: 10px; font-weight: bold; color: var(--daquy-400);">${ki + 1}.</span>
                        <textarea class="form-textarea kl-item" data-ti="${ti}" data-ki="${ki}" rows="2" style="flex: 1;">${escHtml(kl)}</textarea>
                        <button class="btn btn-secondary btn-del-kl" data-ti="${ti}" data-ki="${ki}" style="padding: 8px;">???</button>
                      </div>
                    `).join('')}
                  </div>
                  <button class="btn btn-secondary btn-add-kl" data-ti="${ti}" style="margin-top: 8px; font-size: 0.8rem;">+ Th�m k?t lu?n</button>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
        <button class="btn btn-secondary" id="btn-add-topic" style="margin-top: 16px;">+ Th�m v?n d? m?i</button>
      </div>
    </div>

    <div class="panel-group">
      <div class="panel-header"><div class="panel-header-icon">??</div>Transcript to�n van (B�c bang) � <em>C� th? ch?nh s?a</em></div>
      <div class="panel-body">
        <textarea class="form-textarea" id="f-transcript" rows="8">${escHtml(formState.transcript)}</textarea>
        <button class="btn btn-secondary" id="btn-reanalyze" style="margin-top: 10px;">?? Ph�n t�ch l?i t? transcript d� s?a</button>
      </div>
    </div>

    <div class="btn-row">
      <button class="btn btn-secondary" id="btn-back-1">? Quay l?i</button>
      <button class="btn btn-primary" id="btn-next-3">Ti?p t?c: Xu?t van b?n ?</button>
    </div>
  `;

  const saveState = () => {
    formState.chu_tri = sc.querySelector('#f-chutri').value;
    formState.thanh_phan = sc.querySelector('#f-thanhphan').value;
    formState.dia_diem = sc.querySelector('#f-diadiem').value;
    formState.tom_tat = sc.querySelector('#f-tomtat').value;
    formState.transcript = sc.querySelector('#f-transcript').value;
    formState.noi_dung_cuoc_hop = [];
    sc.querySelectorAll('.topic-title').forEach(el => {
      const ti = parseInt(el.dataset.ti);
      if (!formState.noi_dung_cuoc_hop[ti]) formState.noi_dung_cuoc_hop[ti] = { tieu_de: '', danh_gia: '', ket_luan: [] };
      formState.noi_dung_cuoc_hop[ti].tieu_de = el.value;
    });
    sc.querySelectorAll('.topic-eval').forEach(el => {
      const ti = parseInt(el.dataset.ti);
      if (formState.noi_dung_cuoc_hop[ti]) formState.noi_dung_cuoc_hop[ti].danh_gia = el.value;
    });
    sc.querySelectorAll('.kl-item').forEach(el => {
      const ti = parseInt(el.dataset.ti);
      const ki = parseInt(el.dataset.ki);
      if (formState.noi_dung_cuoc_hop[ti]) {
        if (!formState.noi_dung_cuoc_hop[ti].ket_luan) formState.noi_dung_cuoc_hop[ti].ket_luan = [];
        formState.noi_dung_cuoc_hop[ti].ket_luan[ki] = el.value;
      }
    });
  };

  sc.querySelector('#btn-add-topic').addEventListener('click', () => {
    saveState();
    formState.noi_dung_cuoc_hop.push({ tieu_de: '', danh_gia: '', ket_luan: [''] });
    renderStep2(sc, c);
  });
  sc.querySelectorAll('.btn-del-topic').forEach(btn => btn.addEventListener('click', () => {
    saveState(); formState.noi_dung_cuoc_hop.splice(parseInt(btn.dataset.ti), 1); renderStep2(sc, c);
  }));
  sc.querySelectorAll('.btn-add-kl').forEach(btn => btn.addEventListener('click', () => {
    saveState(); const ti = parseInt(btn.dataset.ti);
    formState.noi_dung_cuoc_hop[ti].ket_luan.push(''); renderStep2(sc, c);
  }));
  sc.querySelectorAll('.btn-del-kl').forEach(btn => btn.addEventListener('click', () => {
    saveState(); const ti = parseInt(btn.dataset.ti); const ki = parseInt(btn.dataset.ki);
    formState.noi_dung_cuoc_hop[ti].ket_luan.splice(ki, 1); renderStep2(sc, c);
  }));
  sc.querySelector('#btn-back-1').addEventListener('click', () => { saveState(); formState.step = 1; doRender(c); });
  sc.querySelector('#btn-next-3').addEventListener('click', () => { saveState(); formState.step = 3; doRender(c); });
  sc.querySelector('#btn-reanalyze').addEventListener('click', async () => {
    saveState(); formState.transcript = sc.querySelector('#f-transcript').value;
    if (!formState.transcript.trim()) { showToast('Vui l�ng nh?p transcript!', 'error'); return; }
    try {
      showToast('�ang ph�n t�ch l?i transcript...');
      await reanalyzeTranscript();
      renderStep2(sc, c); showToast('? �� c?p nh?t!', 'success');
    } catch (e) { showToast('L?i: ' + e.message, 'error'); }
  });
}


function renderStep3(sc, c) {
  sc.innerHTML = `
    <div class="section-title">?? Bu?c 3: Xu?t Th�ng b�o k?t lu?n</div>
    <div class="panel-group">
      <div class="panel-header"><div class="panel-header-icon">??</div>C?u h�nh th? th?c</div>
      <div class="panel-body form-grid">
        <div class="form-group span-2" style="display: flex; gap: 20px;">
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;"><input type="radio" name="the_thuc" value="nd30" ${formState.the_thuc === 'nd30' ? 'checked' : ''}> H�nh ch�nh (N�30)</label>
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;"><input type="radio" name="the_thuc" value="hd36" ${formState.the_thuc === 'hd36' ? 'checked' : ''}> �?ng (HD36)</label>
        </div>
      </div>
    </div>
    <div class="panel-group">
      <div class="panel-header"><div class="panel-header-icon">???</div>Th�ng tin ph�t h�nh</div>
      <div class="panel-body form-grid">
        <div class="form-group"><label class="form-label">CQ ch? qu?n</label><input class="form-input" id="f-cqcq" value="${formState.co_quan_chu_quan}"></div>
        <div class="form-group"><label class="form-label">CQ ban h�nh <span class="required">*</span></label><input class="form-input" id="f-cqbh" value="${formState.co_quan_ban_hanh}"></div>
        <div class="form-group"><label class="form-label">S?, k� hi?u</label><input class="form-input" id="f-skh" value="${formState.so_ky_hieu}" placeholder="S?:    /TB-UBND"></div>
        <div class="form-group"><label class="form-label">Ng�y ban h�nh</label><div style="display:flex;gap:8px"><input class="form-input" id="f-ng" value="${formState.ngay}" style="flex:1"><input class="form-input" id="f-th" value="${formState.thang}" style="flex:1"><input class="form-input" id="f-na" value="${formState.nam}" style="flex:1"></div></div>
        <div class="form-group span-2"><label class="form-label">Ngu?i k� <span class="required">*</span></label><input class="form-input" id="f-nk" value="${formState.nguoi_ky}"></div>
        <div class="span-2" style="margin-top: 10px; font-weight: bold; font-size: 0.8rem; color: var(--daquy-500);">D�ng ch?c danh</div>
        <div class="form-group span-2"><label class="form-label">D�ng 1</label><input class="form-input" id="f-cd1" value="${formState.dong_chuc_danh_1}" placeholder="TL. CH? T?CH"></div>
        <div class="form-group span-2"><label class="form-label">D�ng 2</label><input class="form-input" id="f-cd2" value="${formState.dong_chuc_danh_2}" placeholder="KT. CH�NH VAN PH�NG"></div>
        <div class="form-group span-2"><label class="form-label">D�ng 3</label><input class="form-input" id="f-cd3" value="${formState.dong_chuc_danh_3}"></div>
        <div class="form-group span-2"><label class="form-label">Noi nh?n</label><textarea class="form-textarea" id="f-nn" rows="4" placeholder="- Ch? t?ch, c�c PCT UBND t?nh;\n- C�c s?, ban, ng�nh;\n- Luu: VT, ...">${formState.noi_nhan}</textarea></div>
      </div>
    </div>
    <div class="btn-row" style="justify-content: center; margin-top: 24px;">
      <button class="btn btn-secondary" id="btn-back-2">? Quay l?i ch?nh s?a</button>
      <button class="btn btn-success" id="btn-export">? T?i Th�ng b�o (.DOCX)</button>
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
  sc.querySelectorAll('input[name="the_thuc"]').forEach(rad => rad.addEventListener('change', () => { saveState(); renderStep3(sc, c); }));
  sc.querySelector('#btn-back-2').addEventListener('click', () => { saveState(); formState.step = 2; doRender(c); });
  sc.querySelector('#btn-export').addEventListener('click', () => {
    saveState();
    if (!formState.co_quan_ban_hanh || !formState.nguoi_ky) { showToast('Vui l�ng nh?p co quan ban h�nh v� ngu?i k�!', 'error'); return; }
    generateNotificationDocx();
  });
}

// ==============================================
// X? L� GEMINI AI � Files API cho file >100MB
// ==============================================
async function getApiKey() {
  const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  const db = getFirestore(app);
  const docSnap = await getDoc(doc(db, 'config', 'system'));
  if (docSnap.exists() && docSnap.data().gemini_api_key) return docSnap.data().gemini_api_key;
  throw new Error("Vui l�ng c?u h�nh Gemini API Key tru?c khi s? d?ng.");
}

const MEETING_PROMPT = `B?n l� tr? l� thu k� cu?c h?p chuy�n nghi?p trong co quan h�nh ch�nh nh� nu?c Vi?t Nam.
H�y nghe K? file ghi �m cu?c h?p n�y v� tr�ch xu?t theo c?u tr�c chu?n Th�ng b�o k?t lu?n:

1. NGU?I CH? TR� (h? t�n + ch?c v?).
2. TH�NH PH?N THAM D? (c�c don v?, c� nh�n).
3. �?A �I?M cu?c h?p (n?u x�c d?nh du?c).
4. T�M T?T n?i dung ch�nh � vi?t theo van phong h�nh ch�nh.
5. N?I DUNG CU?C H?P � Ph�n t�ch theo c?u tr�c ph�n c?p chuy�n nghi?p:
   - N?u cu?c h?p ph?c t?p, h�y chia th�nh c�c ph?n l?n b?ng s? La M� (I. ��nh gi� chung, II. Nhi?m v? v� gi?i ph�p...).
   - B�n trong c�c ph?n, chia th�nh c�c m?c nh? d�nh s? 1, 2, 3...
   - C�c k?t lu?n/ch? d?o c? th? d�nh s? a, b, c...
   M?i v?n d?/m?c g?m:
   - tieu_de: Ti�u d? v?n d? (VD: "1. V? x�y d?ng h? th?ng ph?n m?m chuy�n ng�nh" ho?c "I. ��NH GI� CHUNG")
   - danh_gia: ��nh gi�, nh?n d?nh t�nh h�nh ho?c b?i c?nh (n?u c�).
   - ket_luan: M?ng c�c k?t lu?n/ch? d?o C? TH?. M?i k?t lu?n n�n b?t d?u b?ng d?ng t? m?nh (Giao, Y�u c?u, �? ngh?...) v� x�c d?nh r� don v? ch? tr�, don v? ph?i h?p, th?i h?n ho�n th�nh.
6. TRANSCRIPT to�n van (b�c bang).

LUU �: D�ng d�ng thu?t ng? h�nh ch�nh VN (v� d?: "S?, ban, ng�nh", "d?a phuong", "quy d?nh hi?n h�nh").

Tr? v? JSON:
{
  "chu_tri": "�/c Nguy?n Ng?c Ph�c - Ph� Ch? t?ch UBND t?nh",
  "thanh_phan": "L�nh d?o c�c s?, ng�nh: Khoa h?c v� C�ng ngh?, T�i ch�nh, N?i v?; Van ph�ng UBND t?nh.",
  "dia_diem": "Ph�ng h?p s? 1, UBND t?nh",
  "tom_tat": "Ng�y 16/4/2026, d?ng ch� Nguy?n Ng?c Ph�c - Ph� Ch? t?ch UBND t?nh d� ch? tr� bu?i l�m vi?c d? nghe S? Khoa h?c v� C�ng ngh? b�o c�o v? m?t s? nhi?m v? tr?ng t�m...",
  "noi_dung_cuoc_hop": [
    {
      "tieu_de": "I. ��NH GI� CHUNG",
      "danh_gia": "Th?i gian qua, c�ng t�c chuy?n d?i s? d� c� nhi?u chuy?n bi?n t�ch c?c, tuy nhi�n ti?n d? tri?n khai m?t s? ph?n m?m chuy�n ng�nh c�n ch?m...",
      "ket_luan": []
    },
    {
      "tieu_de": "II. NHI?M V? C? TH?",
      "danh_gia": "",
      "ket_luan": [
        "Giao S? Khoa h?c v� C�ng ngh? ch? tr�, ph?i h?p v?i c�c don v? li�n quan kh?n truong r� so�t danh m?c ph?n m?m, b�o c�o UBND t?nh tru?c ng�y 10/5/2026.",
        "Y�u c?u c�c s?, ng�nh ch? d?ng d? xu?t nhu c?u x�y d?ng co s? d? li?u d�ng chung c?a ng�nh m�nh."
      ]
    }
  ],
  "transcript": "[Ngu?i n�i 1]: ...\\n[Ngu?i n�i 2]: ..."
}
CH? tr? v? JSON.`;

async function processAudioWithGemini(file, progressEl) {
  const use9router = localStorage.getItem('vbai_use_9router') === 'true';
  if (use9router) {
    progressEl.textContent = 'Dang chuyen giong noi thanh van ban qua 9router...';
    const transcriptModel = localStorage.getItem('vbai_transcribe_model') || DEFAULT_TRANSCRIBE_MODEL;
    const chatModel = localStorage.getItem('vbai_gemini_model') || DEFAULT_GEMINI_MODEL;
    let transcript = '';
    try {
      transcript = await sendAudioTranscription(file, transcriptModel, { temperature: 0 });
    } catch (e) {
      progressEl.textContent = 'Khong dung duoc /audio/transcriptions, dang fallback qua chat/completions...';
      try {
        transcript = await sendAudioTranscriptionViaChat(file, chatModel, {
          temperature: 0,
          maxBytes: 12 * 1024 * 1024
        });
      } catch (fallbackErr) {
        throw new Error(`9router khong ho tro transcription endpoint va fallback chat that bai (${fallbackErr.message}).`);
      }
    }
    if (!transcript || !transcript.trim()) {
      throw new Error('Khong nhan duoc transcript tu 9router.');
    }

    progressEl.textContent = 'Dang phan tich transcript va trich xuat cau truc...';
    const model = chatModel;
    const prompt = `${MEETING_PROMPT}\n\nTRANSCRIPT:\n${transcript}`;
    let text = await sendChatRequest([{ role: "user", content: prompt }], model, { temperature: 0.1 });
    text = (text || '').replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();

    try {
      const data = JSON.parse(text);
      formState.chu_tri = data.chu_tri || "";
      formState.thanh_phan = data.thanh_phan || "";
      formState.dia_diem = data.dia_diem || "";
      formState.tom_tat = data.tom_tat || data.tom_tat_noi_dung || "";
      formState.noi_dung_cuoc_hop = (data.noi_dung_cuoc_hop || []).map(nd => ({
        tieu_de: nd.tieu_de || '',
        danh_gia: nd.danh_gia || '',
        ket_luan: nd.ket_luan || []
      }));
      if (formState.noi_dung_cuoc_hop.length === 0 && data.ket_luan) {
        formState.noi_dung_cuoc_hop = [{ tieu_de: 'Ket luan chung', danh_gia: '', ket_luan: data.ket_luan }];
      }
      formState.transcript = data.transcript || transcript;
    } catch (e) {
      console.error("Loi parse JSON:", e, text);
      formState.transcript = transcript;
      formState.tom_tat = "Khong the trich xuat cau truc JSON. Vui long xem transcript ben duoi.";
    }

    try {
      const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
      const db = getFirestore(app);
      addDoc(collection(db, 'search_logs'), {
        query: `[Ghi Am -> TB] ${file.name} (${(file.size/1024/1024).toFixed(1)}MB)`,
        model: `${transcriptModel} + ${model} (via 9router)`,
        userEmail: window.currentUser?.email || 'Unknown',
        timestamp: serverTimestamp()
      }).catch(() => {});
    } catch (e) {}
    return;
  }

  const apiKey = await getApiKey();
  const aiClient = new GoogleGenAI({ apiKey });
  const model = DEFAULT_GEMINI_MODEL;

  let contentParts;

  if (file.size > 20 * 1024 * 1024) {
    // File >20MB: d�ng Files API
    progressEl.textContent = `�ang t?i file l�n Gemini (${(file.size / 1024 / 1024).toFixed(1)}MB)...`;
    const uploaded = await aiClient.files.upload({
      file: file,
      config: { mimeType: file.type || 'audio/mpeg', displayName: file.name }
    });
    progressEl.textContent = '�ang ch? AI x? l� file...';
    // Poll until file is ACTIVE
    let fileInfo = uploaded;
    while (fileInfo.state === 'PROCESSING') {
      await new Promise(r => setTimeout(r, 3000));
      fileInfo = await aiClient.files.get({ name: fileInfo.name });
      progressEl.textContent = `�ang x? l� file... (${fileInfo.state})`;
    }
    if (fileInfo.state === 'FAILED') throw new Error('Gemini kh�ng th? x? l� file audio n�y.');
    contentParts = [
      { fileData: { mimeType: fileInfo.mimeType, fileUri: fileInfo.uri } },
      { text: MEETING_PROMPT }
    ];
  } else {
    // File <=20MB: inline base64
    progressEl.textContent = '�ang m� h�a file...';
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    contentParts = [
      { inlineData: { data: base64, mimeType: file.type } },
      { text: MEETING_PROMPT }
    ];
  }

  progressEl.textContent = 'AI dang nghe v� ph�n t�ch cu?c h?p... (1-5 ph�t)';
  const response = await aiClient.models.generateContent({
    model, contents: [{ role: 'user', parts: contentParts }]
  });

  let text = response.text || "";
  text = text.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();

  try {
    const data = JSON.parse(text);
    formState.chu_tri = data.chu_tri || "";
    formState.thanh_phan = data.thanh_phan || "";
    formState.dia_diem = data.dia_diem || "";
    formState.tom_tat = data.tom_tat || data.tom_tat_noi_dung || "";
    formState.noi_dung_cuoc_hop = (data.noi_dung_cuoc_hop || []).map(nd => ({
      tieu_de: nd.tieu_de || '',
      danh_gia: nd.danh_gia || '',
      ket_luan: nd.ket_luan || []
    }));
    if (formState.noi_dung_cuoc_hop.length === 0 && data.ket_luan) {
      formState.noi_dung_cuoc_hop = [{ tieu_de: 'K?t lu?n chung', danh_gia: '', ket_luan: data.ket_luan }];
    }
    formState.transcript = data.transcript || "";
  } catch (e) {
    console.error("L?i parse JSON:", e, text);
    formState.transcript = response.text;
    formState.tom_tat = "Kh�ng th? tr�ch xu?t c?u tr�c JSON. Vui l�ng xem transcript b�n du?i.";
  }

  try {
    const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    const db = getFirestore(app);
    addDoc(collection(db, 'search_logs'), {
      query: `[Ghi �m ? TB] ${file.name} (${(file.size/1024/1024).toFixed(1)}MB)`,
      model, userEmail: window.currentUser?.email || 'Unknown', timestamp: serverTimestamp()
    }).catch(() => {});
  } catch (e) {}
}

async function reanalyzeTranscript() {
  const use9router = localStorage.getItem('vbai_use_9router') === 'true';
  const prompt = `��y l� b?n transcript cu?c h?p h�nh ch�nh d� ch?nh s?a. Ph�n t�ch l?i v� tr? v? JSON:
{
  "chu_tri": "...",
  "thanh_phan": "...",
  "dia_diem": "...",
  "tom_tat": "...",
  "noi_dung_cuoc_hop": [
    { "tieu_de": "...", "danh_gia": "...", "ket_luan": ["..."] }
  ]
}
CH? JSON, KH�NG gi?i th�ch.

TRANSCRIPT:
${formState.transcript}`;

  let text = "";
  if (use9router) {
    const messages = [{ role: "user", content: prompt }];
    const model = localStorage.getItem('vbai_gemini_model') || DEFAULT_GEMINI_MODEL;
    text = await sendChatRequest(messages, model, { temperature: 0.1 });
  } else {
    const apiKey = await getApiKey();
    const aiClient = new GoogleGenAI({ apiKey });
    const response = await aiClient.models.generateContent({
      model: DEFAULT_GEMINI_MODEL, contents: prompt, config: { temperature: 0.1 }
    });
    text = response.text || "";
  }

  text = text.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
  try {
    const data = JSON.parse(text);
    formState.chu_tri = data.chu_tri || formState.chu_tri;
    formState.thanh_phan = data.thanh_phan || formState.thanh_phan;
    formState.dia_diem = data.dia_diem || formState.dia_diem;
    formState.tom_tat = data.tom_tat || formState.tom_tat;
    formState.noi_dung_cuoc_hop = (data.noi_dung_cuoc_hop || []).map(nd => ({
      tieu_de: nd.tieu_de || '', danh_gia: nd.danh_gia || '', ket_luan: nd.ket_luan || []
    }));
  } catch (e) { throw new Error("Kh�ng th? ph�n t�ch l?i transcript."); }
}


// ==============================================
// XU?T DOCX � M?u TBKL chu?n N�30
// ==============================================
const L = { PAGE: { width: 11906, height: 16838 }, MARGIN: { top: 1134, bottom: 1134, left: 1701, right: 1134 }, FONT: 'Times New Roman', CW: 9071 };
const BN = { top: { style: BorderStyle.NONE, size: 0, color: 'auto' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' }, left: { style: BorderStyle.NONE, size: 0, color: 'auto' }, right: { style: BorderStyle.NONE, size: 0, color: 'auto' }, insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'auto' }, insideVertical: { style: BorderStyle.NONE, size: 0, color: 'auto' } };
const BS = { before: 120, after: 0, line: 340, lineRule: LineRuleType.AT_LEAST };

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

async function generateNotificationDocx() {
  try {
    const fs = formState;
    const isND30 = fs.the_thuc === 'nd30';
    const ch = [];

    // ===== HEADER =====
    const lc = [], rc = [];
    if (fs.co_quan_chu_quan) lc.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [new TextRun({ text: fs.co_quan_chu_quan, font: L.FONT, size: 26 })] }));
    lc.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [new TextRun({ text: fs.co_quan_ban_hanh, font: L.FONT, size: 26, bold: true })] }));
    lc.push(new Paragraph({ spacing: { before: 20, after: 80 }, border: { top: { style: BorderStyle.SINGLE, size: 2, color: '000000', space: 1 } }, indent: { left: 1500, right: 1500 } }));
    lc.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [new TextRun({ text: fs.so_ky_hieu || 'S?:    /TB-...', font: L.FONT, size: 26 })] }));

    if (isND30) {
      rc.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [new TextRun({ text: 'C?NG H�A X� H?I CH? NGHIA VI?T NAM', font: L.FONT, size: 26, bold: true })] }));
      rc.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [new TextRun({ text: '�?c l?p - T? do - H?nh ph�c', font: L.FONT, size: 28, bold: true })] }));
      rc.push(new Paragraph({ spacing: { before: 20, after: 0 }, border: { top: { style: BorderStyle.SINGLE, size: 2, color: '000000', space: 1 } }, indent: { left: 1100, right: 1100 } }));
    } else {
      rc.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [new TextRun({ text: '�?NG C?NG S?N VI?T NAM', font: L.FONT, size: 30, bold: true })] }));
      rc.push(new Paragraph({ spacing: { before: 20, after: 0 }, border: { top: { style: BorderStyle.SINGLE, size: 2, color: '000000', space: 1 } }, indent: { left: 928, right: 928 } }));
    }
    rc.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [new TextRun({ text: `${fs.dia_danh}, ng�y ${fs.ngay || '...'} th�ng ${fs.thang || '...'} nam ${fs.nam}`, font: L.FONT, size: 28, italics: true })] }));
    ch.push(new Table({ width: { size: L.CW, type: WidthType.DXA }, borders: BN, columnWidths: [3500, 5571], rows: [new TableRow({ children: [new TableCell({ borders: BN, width: { size: 3500, type: WidthType.DXA }, verticalAlign: VerticalAlign.TOP, children: lc }), new TableCell({ borders: BN, width: { size: 5571, type: WidthType.DXA }, verticalAlign: VerticalAlign.TOP, children: rc })] })] }));

    // ===== TITLE =====
    ch.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 360, after: 120 }, children: [new TextRun({ text: 'TH�NG B�O', font: L.FONT, size: 28, bold: true })] }));

    // Tr�ch y?u d?a tr�n t�m t?t
    const trichYeu = fs.tom_tat ? `K?t lu?n c?a ${fs.chu_tri || 'l�nh d?o'} t?i bu?i l�m vi?c v? ${extractTopicSummary(fs)}` : `K?t lu?n c?a ${fs.chu_tri || 'l�nh d?o'} t?i cu?c h?p`;
    ch.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 }, children: [new TextRun({ text: trichYeu, font: L.FONT, size: 28, bold: true })] }));
    ch.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 240 }, children: [new TextRun({ text: '_______________', font: L.FONT, size: 28 })] }));

    // ===== PH?N M? �?U =====
    const introText = fs.tom_tat || `Ng�y ${fs.ngay || '...'} th�ng ${fs.thang || '...'} nam ${fs.nam}, t?i ${fs.dia_diem || '[d?a di?m]'}, ${fs.chu_tri} d� ch? tr� cu?c h?p.`;
    ch.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: BS, indent: { firstLine: 567 }, children: [new TextRun({ text: introText, font: L.FONT, size: 28 })] }));

    if (fs.thanh_phan) {
      ch.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: BS, indent: { firstLine: 567 }, children: [
        new TextRun({ text: 'Tham d? bu?i l�m vi?c c� ', font: L.FONT, size: 28 }),
        new TextRun({ text: `l�nh d?o c�c s?, ng�nh: ${fs.thanh_phan}.`, font: L.FONT, size: 28 })
      ] }));
    }

    // C�u chuy?n ti?p
    const transitionText = `Sau khi nghe b�o c�o v� � ki?n c?a c�c d?i bi?u t?i bu?i l�m vi?c, tr�n co s? trao d?i, th?o lu?n; ${fs.chu_tri || 'ngu?i ch? tr�'} k?t lu?n v� ch? d?o nhu sau:`;
    ch.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: BS, indent: { firstLine: 567 }, children: [new TextRun({ text: transitionText, font: L.FONT, size: 28 })] }));

    // ===== N?I DUNG K?T LU?N THEO T?NG V?N �? =====
    const nds = fs.noi_dung_cuoc_hop || [];
    nds.forEach((nd, idx) => {
      if (!nd.tieu_de && (!nd.ket_luan || nd.ket_luan.length === 0)) return;

      const isMainSection = /^(I|II|III|IV|V|VI|VII|VIII|IX|X)\./.test(nd.tieu_de);
      const stt = (nds.length > 1 && !nd.tieu_de.match(/^\d+\./) && !isMainSection) ? `${idx + 1}. ` : '';
      
      ch.push(new Paragraph({ 
        alignment: AlignmentType.JUSTIFIED, 
        spacing: { ...BS, before: 200 }, 
        indent: { firstLine: isMainSection ? 0 : 567 },
        children: [
          new TextRun({ 
            text: `${stt}${nd.tieu_de || 'N?i dung'}`, 
            font: L.FONT, 
            size: 28, 
            bold: true,
            allCaps: isMainSection 
          })
        ] 
      }));

      // ��nh gi� t�nh h�nh (n?u c�)
      if (nd.danh_gia && nd.danh_gia.trim()) {
        nd.danh_gia.split('\n').filter(l => l.trim()).forEach(line => {
          ch.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: BS, indent: { firstLine: 567 }, children: [new TextRun({ text: line.trim(), font: L.FONT, size: 28 })] }));
        });
      }

      // C�c k?t lu?n chi ti?t: a) b) c)...
      const klList = nd.ket_luan || [];
      const letters = 'abcdefghijklmnopqrstuvwxyz';
      klList.forEach((kl, ki) => {
        if (!kl || !kl.trim()) return;
        
        // Check if item already has a prefix like "a)" or "1."
        const hasPrefix = /^[a-z0-9]\)/.test(kl.trim().toLowerCase());
        const prefix = (klList.length > 1 && !hasPrefix) ? `${letters[ki] || (ki + 1)}) ` : '';
        
        const lines = kl.trim().split('\n').filter(l => l.trim());
        lines.forEach((line, li) => {
          ch.push(new Paragraph({ 
            alignment: AlignmentType.JUSTIFIED, 
            spacing: BS, 
            indent: { firstLine: 567 }, 
            children: [
              ...(li === 0 ? [new TextRun({ text: prefix, font: L.FONT, size: 28, bold: prefix !== '' })] : []),
              new TextRun({ text: line.trim(), font: L.FONT, size: 28 })
            ] 
          }));
        });
      });
    });

    // ===== C�U K?T =====
    ch.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { ...BS, before: 200 }, indent: { firstLine: 567 }, children: [
      new TextRun({ text: `Tr�n tr?ng th�ng b�o k?t lu?n c?a ${fs.chu_tri || 'l�nh d?o'} d? c�c s?, ng�nh, don v? li�n quan bi?t, th?c hi?n./.`, font: L.FONT, size: 28 })
    ] }));

    // ===== NOI NH?N + CH? K� =====
    const nn = [new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: 'Noi nh?n:', font: L.FONT, size: 24, bold: true, italics: true })] })];
    (fs.noi_nhan || 'Nhu tr�n;\nLuu: VT.').split('\n').filter(l => l.trim()).forEach(n => {
      const line = n.trim().startsWith('-') ? n.trim() : '- ' + n.trim();
      nn.push(new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: line, font: L.FONT, size: 22 })] }));
    });

    const sg = [];
    if (fs.dong_chuc_danh_1) sg.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [new TextRun({ text: fs.dong_chuc_danh_1, font: L.FONT, size: 28, bold: true })] }));
    if (fs.dong_chuc_danh_2) sg.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [new TextRun({ text: fs.dong_chuc_danh_2, font: L.FONT, size: 28, bold: true })] }));
    if (fs.dong_chuc_danh_3) sg.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [new TextRun({ text: fs.dong_chuc_danh_3, font: L.FONT, size: 28, bold: true })] }));
    for (let i = 0; i < 4; i++) sg.push(new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: '', font: L.FONT, size: 28 })] }));
    sg.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [new TextRun({ text: fs.nguoi_ky, font: L.FONT, size: 28, bold: true })] }));

    ch.push(new Paragraph({ spacing: { before: 240 }, children: [] }));
    ch.push(new Table({ width: { size: L.CW, type: WidthType.DXA }, borders: BN, columnWidths: [4300, 4771], rows: [new TableRow({ children: [new TableCell({ borders: BN, width: { size: 4300, type: WidthType.DXA }, verticalAlign: VerticalAlign.TOP, children: nn }), new TableCell({ borders: BN, width: { size: 4771, type: WidthType.DXA }, verticalAlign: VerticalAlign.TOP, children: sg })] })] }));

    const docObj = new Document({ styles: { default: { document: { run: { font: L.FONT, size: 28 } } } }, sections: [{ properties: { page: { size: L.PAGE, margin: L.MARGIN } }, children: ch }] });
    const blob = await Packer.toBlob(docObj);
    saveAs(blob, `TBKL_${isND30 ? 'ND30' : 'HD36'}.docx`);
    showToast('? �� t?i file Th�ng b�o k?t lu?n!');
  } catch (e) {
    console.error(e);
    showToast('L?i khi t?o file DOCX: ' + e.message, 'error');
  }
}

function extractTopicSummary(fs) {
  const topics = (fs.noi_dung_cuoc_hop || []).map(nd => nd.tieu_de).filter(t => t);
  if (topics.length === 0) return 'm?t s? nhi?m v? tr?ng t�m';
  if (topics.length <= 3) return topics.join('; ').toLowerCase();
  return topics.slice(0, 2).join('; ').toLowerCase() + ` v� ${topics.length - 2} n?i dung kh�c`;
}
