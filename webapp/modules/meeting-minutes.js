/**
 * Meeting Minutes Module — Redesigned
 * Chuyển đổi audio cuộc họp thành Thông báo kết luận (NĐ30/HD36)
 * Dung Gemini API cho xu ly ghi am va phan tich noi dung
 */
import { Document, Packer, Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, BorderStyle, WidthType, VerticalAlign, LineRuleType } from 'docx';
import { saveAs } from 'file-saver';
import { showToast } from './ui-utils.js';
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { firebaseConfig } from '../firebase-config.js';
import {
  sendChatRequest,
  sendAudioTranscription,
  getProxyModelIds,
  getProxyEndpointForContext,
} from './ai-proxy.js';
import { convertToWav } from './audio-utils.js';
import { fetchSystemConfig } from './system-config.js';

let systemConfigCache = null;

async function ensureSystemConfig() {
  if (systemConfigCache) return systemConfigCache;
  try {
    systemConfigCache = await fetchSystemConfig();
  } catch (e) {
    console.warn('Không thể tải cấu hình hệ thống cho module ghi âm:', e);
  }
  return systemConfigCache;
}

const GEMINI_MEETING_MODEL_FALLBACK_ORDER = [
  "gemini-2.5-pro",
  "gemini-2.0-flash-exp",
  "gemini-2.0-flash-lite-preview",
  "gemini-3-flash-preview",
];

function getMeetingModelFallbackOrder() {
  return GEMINI_MEETING_MODEL_FALLBACK_ORDER;
}

const PROCESSING_TEXT = "Đang xử lý......";
const MAX_AUDIO_UPLOAD_MB = 500;
const MAX_AUDIO_UPLOAD_BYTES = MAX_AUDIO_UPLOAD_MB * 1024 * 1024;

let mediaRecorder = null;
let audioChunks = [];
let recordingTimerInterval = null;
let wakeLock = null;
let silentAudio = null;

async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      console.log('VBAI Screen Wake Lock acquired.');
    }
  } catch (err) {
    console.warn('Không thể thiết lập Screen Wake Lock:', err);
  }
}

function releaseWakeLock() {
  try {
    if (wakeLock) {
      wakeLock.release().then(() => {
        wakeLock = null;
        console.log('VBAI Screen Wake Lock released.');
      });
    }
  } catch (e) {
    console.warn('Không thể giải phóng Screen Wake Lock:', e);
  }
}

function playSilentAudio() {
  try {
    if (!silentAudio) {
      // 1-second silent WAV base64
      const silentWav = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
      silentAudio = new Audio(silentWav);
      silentAudio.loop = true;
    }
    silentAudio.play().catch(e => console.warn('Silent audio play failed:', e));
  } catch (err) {
    console.warn('Silent audio error:', err);
  }
}

function stopSilentAudio() {
  try {
    if (silentAudio) {
      silentAudio.pause();
      silentAudio.currentTime = 0;
    }
  } catch (e) {}
}

// Khôi phục wake lock khi ứng dụng hiển thị lại và đang ghi âm
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible' && mediaRecorder && mediaRecorder.state === 'recording') {
    await requestWakeLock();
  }
});


let formState = {
  step: 1, audioFile: null, isProcessing: false,
  isRecording: false, isPaused: false, recordingTime: 0,
  chu_tri: '', thanh_phan: '', dia_diem: '', tom_tat: '',
  noi_dung_cuoc_hop: [],
  transcript: '',
  the_thuc: 'nd30', co_quan_chu_quan: '', co_quan_ban_hanh: '',
  so_ky_hieu: '', dia_danh: 'Lâm Đồng', ngay: '', thang: '', nam: '',
  nguoi_ky: '', noi_nhan: '',
  dong_chuc_danh_1: '', dong_chuc_danh_2: '', dong_chuc_danh_3: ''
};

function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export function renderMeetingMinutes(container) {
  const now = new Date();
  if (!formState.ngay) {
    formState.ngay = String(now.getDate()).padStart(2, '0');
    formState.thang = String(now.getMonth() + 1).padStart(2, '0');
    formState.nam = String(now.getFullYear());
  }
  if (!systemConfigCache) {
    ensureSystemConfig().then(() => {
      if (container?.isConnected) doRender(container);
    }).catch(() => {});
  }
  doRender(container);
}

function doRender(c) {
  c.innerHTML = `
    <div class="page-header">
      <div class="page-title">🎙️ Ghi Âm → Thông Báo Kết Luận</div>
      <div class="page-subtitle">Sử dụng AI phân tích file ghi âm cuộc họp và tự động tạo Thông báo kết luận (NĐ30/HD36)</div>
    </div>
    <div class="steps-bar" style="display:flex; align-items:center;">
      ${[1, 2, 3].map(i => `<button class="step-indicator ${formState.step === i ? 'active' : formState.step > i ? 'completed' : ''}" data-step="${i}"><span class="step-num">${formState.step > i ? '✓' : i}</span><span>${['Upload & Phân tích', 'Chỉnh sửa nội dung', 'Xuất văn bản'][i - 1]}</span></button>`).join('')}
      <button class="btn btn-secondary" onclick="window.location.reload();" style="margin-left:auto; display:flex; align-items:center; gap:6px; padding:6px 12px; font-size:12px; border-radius:6px;" title="Làm mới quy trình">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>
        Làm mới
      </button>
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
  const supportedFormats = 'MP3, WAV, M4A, OGG, AAC';

  sc.innerHTML = `
    <div class="section-title">📌 Bước 1: Tải lên hoặc ghi âm cuộc họp (Gemini)</div>
    
    <div class="panel-group" style="margin-bottom: 20px;">
      <div class="panel-header"><div class="panel-header-icon">🎙️</div>Ghi âm trực tiếp từ trình duyệt</div>
      <div class="panel-body" style="text-align: center;">
        <div style="font-size: 32px; font-family: monospace; margin-bottom: 15px; font-weight: bold; color: ${(formState.isRecording && !formState.isPaused) ? 'var(--danger)' : 'var(--text-main)'};" id="recording-timer">
          ${formatTime(formState.recordingTime)}
        </div>
        <div style="display: flex; gap: 10px; justify-content: center; margin-bottom: 15px;">
          ${!formState.isRecording && !formState.isPaused && formState.recordingTime === 0 ? `
            <button class="btn btn-primary" id="btn-record-start" style="background-color: var(--danger); border-color: var(--danger);">🔴 Bắt đầu ghi âm</button>
          ` : ''}
          ${formState.isRecording && !formState.isPaused ? `
            <button class="btn btn-secondary" id="btn-record-pause">⏸ Tạm dừng</button>
          ` : ''}
          ${formState.isPaused ? `
            <button class="btn btn-secondary" id="btn-record-resume">▶ Tiếp tục</button>
          ` : ''}
          ${(formState.isRecording || formState.isPaused) ? `
            <button class="btn btn-primary" id="btn-record-stop">⏹ Kết thúc & Lưu</button>
          ` : ''}
          ${(!formState.isRecording && !formState.isPaused && formState.recordingTime > 0) ? `
            <button class="btn btn-secondary" id="btn-record-reset">🔄 Ghi âm lại</button>
          ` : ''}
        </div>
        ${formState.isRecording && !formState.isPaused ? `<div style="color: var(--danger); font-weight: bold; animation: pulse 1.5s infinite;">Đang ghi âm...</div>` : ''}
        ${formState.isPaused ? `<div style="color: var(--warning); font-weight: bold;">Đã tạm dừng ghi âm</div>` : ''}
        ${formState.audioFile && formState.audioFile.isRecorded ? `<div style="margin-top: 10px; color: var(--success); font-weight: bold;">✓ Đã lưu bản ghi trực tiếp (${(formState.audioFile.size / 1024 / 1024).toFixed(2)}MB)</div>` : ''}
      </div>
    </div>

    <div class="panel-group">
      <div class="panel-header"><div class="panel-header-icon">📁</div>Hoặc tải file có sẵn</div>
      <div class="panel-body" style="text-align: center;">
        <input type="file" id="audio-upload" accept="audio/*" style="display: none;" />
        <div class="upload-zone" id="drop-zone" onclick="document.getElementById('audio-upload').click()">
          <div class="upload-icon">🎤</div>
          <div class="upload-text">Nhấp hoặc kéo thả file ghi âm vào đây</div>
          <div class="upload-hint">Hỗ trợ: <strong>${supportedFormats}</strong> — <strong>Tối đa ${MAX_AUDIO_UPLOAD_MB}MB</strong></div>
          ${formState.audioFile && !formState.audioFile.isRecorded ? `<div style="margin-top: 15px; color: var(--success); font-weight: bold;">Đã chọn: ${formState.audioFile.name} (${(formState.audioFile.size / 1024 / 1024).toFixed(1)}MB)</div>` : ''}
        </div>
      </div>
    </div>
    <div id="processing-indicator" style="display: none; text-align: center; padding: 20px;">
      <div class="spinner"></div>
      <div id="processing-text" style="margin-top: 10px; color: var(--daquy-400); font-weight: 600;">${PROCESSING_TEXT}</div>
    </div>
    <div class="btn-row">
      <button class="btn btn-primary" id="btn-process" ${!formState.audioFile ? 'disabled' : ''}>Phân tích bằng AI →</button>
    </div>
  `;
  const fileInput = sc.querySelector('#audio-upload');
  const dropZone = sc.querySelector('#drop-zone');
  const btnProcess = sc.querySelector('#btn-process');
  const indicator = sc.querySelector('#processing-indicator');

  const btnStart = sc.querySelector('#btn-record-start');
  const btnPause = sc.querySelector('#btn-record-pause');
  const btnResume = sc.querySelector('#btn-record-resume');
  const btnStop = sc.querySelector('#btn-record-stop');
  const btnReset = sc.querySelector('#btn-record-reset');

  if (btnStart) btnStart.addEventListener('click', startRecording);
  if (btnPause) btnPause.addEventListener('click', pauseRecording);
  if (btnResume) btnResume.addEventListener('click', resumeRecording);
  if (btnStop) btnStop.addEventListener('click', stopRecording);
  if (btnReset) btnReset.addEventListener('click', resetRecording);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];
      mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); };
      mediaRecorder.start(1000);
      formState.isRecording = true;
      formState.isPaused = false;
      formState.recordingTime = 0;
      formState.audioFile = null;

      // Giữ màn hình luôn sáng và giữ phiên chạy ngầm
      await requestWakeLock();
      playSilentAudio();

      startTimer();
      doRender(c);
    } catch (err) {
      console.error(err);
      showToast('Không thể truy cập Microphone. Vui lòng cấp quyền trong trình duyệt.', 'error');
    }
  }

  function pauseRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.pause();
      formState.isPaused = true;

      // Giải phóng wake lock và tắt silent audio khi tạm dừng để tiết kiệm pin
      releaseWakeLock();
      stopSilentAudio();

      stopTimer();
      doRender(c);
    }
  }

  async function resumeRecording() {
    if (mediaRecorder && mediaRecorder.state === 'paused') {
      mediaRecorder.resume();
      formState.isPaused = false;

      // Kích hoạt lại wake lock và silent audio
      await requestWakeLock();
      playSilentAudio();

      startTimer();
      doRender(c);
    }
  }

  function stopRecording() {
    if (mediaRecorder && (mediaRecorder.state === 'recording' || mediaRecorder.state === 'paused')) {
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType });
        mediaRecorder.stream.getTracks().forEach(t => t.stop());
        const timestampStr = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `VBAI_GhiAm_${timestampStr}.webm`;
        const file = new File([audioBlob], filename, { type: mediaRecorder.mimeType });
        file.isRecorded = true;
        formState.audioFile = file;

        // Giải phóng hoàn toàn các luồng chạy ngầm
        releaseWakeLock();
        stopSilentAudio();

        // Lưu trực tiếp tệp âm thanh về máy (PC/Mobile)
        try {
          const downloadUrl = URL.createObjectURL(audioBlob);
          const a = document.createElement('a');
          a.style.display = 'none';
          a.href = downloadUrl;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(downloadUrl);
          }, 150);
          showToast('Đã lưu bản sao file ghi âm về máy của bạn!', 'success');
        } catch (downloadErr) {
          console.error('Không thể tự động tải file xuống:', downloadErr);
        }

        doRender(c);
      };
      mediaRecorder.stop();
      formState.isRecording = false;
      formState.isPaused = false;
      stopTimer();
    }
  }

  function resetRecording() {
    formState.isRecording = false;
    formState.isPaused = false;
    formState.recordingTime = 0;
    formState.audioFile = null;
    doRender(c);
  }

  function startTimer() {
    if (recordingTimerInterval) clearInterval(recordingTimerInterval);
    recordingTimerInterval = setInterval(() => {
      formState.recordingTime++;
      const timerEl = document.getElementById('recording-timer');
      if (timerEl) timerEl.textContent = formatTime(formState.recordingTime);
    }, 1000);
  }

  function stopTimer() {
    if (recordingTimerInterval) clearInterval(recordingTimerInterval);
  }

  const selectAudioFile = (file) => {
    if (!file) return;
    if (file.size > MAX_AUDIO_UPLOAD_BYTES) {
      showToast(`File vuot qua gioi han ${MAX_AUDIO_UPLOAD_MB}MB. Vui long cat nho file hoac chia thanh nhieu phan.`, 'error');
      return;
    }
    formState.audioFile = file;
    doRender(c);
  };

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      selectAudioFile(e.target.files[0]);
    }
  });
  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.style.borderColor = 'var(--pine-500)'; });
  dropZone.addEventListener('dragleave', () => { dropZone.style.borderColor = 'var(--border-default)'; });
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault(); dropZone.style.borderColor = 'var(--border-default)';
    if (e.dataTransfer.files.length > 0) {
      selectAudioFile(e.dataTransfer.files[0]);
    }
  });
  btnProcess.addEventListener('click', async () => {
    if (!formState.audioFile) return;
    formState.isProcessing = true; btnProcess.disabled = true; indicator.style.display = 'block';
    try {
      await processAudioWithProxy(formState.audioFile, sc.querySelector('#processing-text'));
      formState.isProcessing = false; formState.step = 2; doRender(c);
    } catch (error) {
      console.error(error); showToast('Lỗi khi phân tích audio: ' + error.message, 'error');
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
    <div class="section-title">✍️ Bước 2: Chỉnh sửa nội dung phân tích</div>
    <div class="panel-group">
      <div class="panel-header"><div class="panel-header-icon">👥</div>Thông tin cuộc họp</div>
      <div class="panel-body form-grid">
        <div class="form-group span-2"><label class="form-label">Người chủ trì</label><input class="form-input" id="f-chutri" value="${escHtml(formState.chu_tri)}" placeholder="VD: Đồng chí Nguyễn Ngọc Phúc - Phó Chủ tịch UBND tỉnh"></div>
        <div class="form-group span-2"><label class="form-label">Thành phần tham dự</label><textarea class="form-textarea" id="f-thanhphan" rows="3">${escHtml(formState.thanh_phan)}</textarea></div>
        <div class="form-group span-2"><label class="form-label">Địa điểm</label><input class="form-input" id="f-diadiem" value="${escHtml(formState.dia_diem)}" placeholder="VD: Phòng họp số 1, UBND tỉnh"></div>
        <div class="form-group span-2"><label class="form-label">Tóm tắt nội dung cuộc họp</label><textarea class="form-textarea" id="f-tomtat" rows="3">${escHtml(formState.tom_tat)}</textarea></div>
      </div>
    </div>

    <div class="panel-group">
      <div class="panel-header"><div class="panel-header-icon">📋</div>Nội dung kết luận theo từng vấn đề</div>
      <div class="panel-body">
        <div id="topics-container" style="display: flex; flex-direction: column; gap: 20px;">
          ${nds.map((nd, ti) => `
            <div class="panel-group" style="border: 1px solid var(--daquy-400); margin-bottom: 0;">
              <div class="panel-header" style="justify-content: space-between;">
                <span>📌 Vấn đề ${ti + 1}</span>
                <button class="btn btn-secondary btn-del-topic" data-ti="${ti}" style="padding: 4px 10px; font-size: 0.75rem;">🗑️ Xóa</button>
              </div>
              <div class="panel-body">
                <div class="form-group" style="margin-bottom: 12px;">
                  <label class="form-label">Tiêu đề vấn đề</label>
                  <input class="form-input topic-title" data-ti="${ti}" value="${escHtml(nd.tieu_de)}" placeholder="VD: Về công tác cải cách hành chính">
                </div>
                <div class="form-group" style="margin-bottom: 12px;">
                  <label class="form-label">Đánh giá / Nhận định (phần mở đầu)</label>
                  <textarea class="form-textarea topic-eval" data-ti="${ti}" rows="3">${escHtml(nd.danh_gia)}</textarea>
                </div>
                <div class="form-group">
                  <label class="form-label">Các kết luận, chỉ đạo cụ thể</label>
                  <div class="kl-list" data-ti="${ti}" style="display: flex; flex-direction: column; gap: 8px;">
                    ${(nd.ket_luan || []).map((kl, ki) => `
                      <div style="display: flex; gap: 8px; align-items: flex-start;">
                        <span style="min-width: 24px; padding-top: 10px; font-weight: bold; color: var(--daquy-400);">${ki + 1}.</span>
                        <textarea class="form-textarea kl-item" data-ti="${ti}" data-ki="${ki}" rows="2" style="flex: 1;">${escHtml(kl)}</textarea>
                        <button class="btn btn-secondary btn-del-kl" data-ti="${ti}" data-ki="${ki}" style="padding: 8px;">🗑️</button>
                      </div>
                    `).join('')}
                  </div>
                  <button class="btn btn-secondary btn-add-kl" data-ti="${ti}" style="margin-top: 8px; font-size: 0.8rem;">+ Thêm kết luận</button>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
        <button class="btn btn-secondary" id="btn-add-topic" style="margin-top: 16px;">+ Thêm vấn đề mới</button>
      </div>
    </div>

    <div class="panel-group">
      <div class="panel-header"><div class="panel-header-icon">📝</div>Transcript toàn văn (Bóc băng) — <em>Có thể chỉnh sửa</em></div>
      <div class="panel-body">
        <textarea class="form-textarea" id="f-transcript" rows="8">${escHtml(formState.transcript)}</textarea>
        <button class="btn btn-secondary" id="btn-reanalyze" style="margin-top: 10px;">🔄 Phân tích lại từ transcript đã sửa</button>
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
    if (!formState.transcript.trim()) { showToast('Vui lòng nhập transcript!', 'error'); return; }
    try {
      showToast('Đang phân tích lại transcript...');
      await reanalyzeTranscript();
      renderStep2(sc, c); showToast('✓ Đã cập nhật!', 'success');
    } catch (e) { showToast('Lỗi: ' + e.message, 'error'); }
  });
}


function renderStep3(sc, c) {
  sc.innerHTML = `
    <div class="section-title">📄 Bước 3: Xuất Thông báo kết luận</div>
    <div class="panel-group">
      <div class="panel-header"><div class="panel-header-icon">⚙️</div>Cấu hình thể thức</div>
      <div class="panel-body form-grid">
        <div class="form-group span-2" style="display: flex; gap: 20px;">
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;"><input type="radio" name="the_thuc" value="nd30" ${formState.the_thuc === 'nd30' ? 'checked' : ''}> Hành chính (NĐ30)</label>
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;"><input type="radio" name="the_thuc" value="hd36" ${formState.the_thuc === 'hd36' ? 'checked' : ''}> Đảng (HD36)</label>
        </div>
      </div>
    </div>
    <div class="panel-group">
      <div class="panel-header"><div class="panel-header-icon">🏛️</div>Thông tin phát hành</div>
      <div class="panel-body form-grid">
        <div class="form-group"><label class="form-label">CQ chủ quản</label><input class="form-input" id="f-cqcq" value="${formState.co_quan_chu_quan}"></div>
        <div class="form-group"><label class="form-label">CQ ban hành <span class="required">*</span></label><input class="form-input" id="f-cqbh" value="${formState.co_quan_ban_hanh}"></div>
        <div class="form-group"><label class="form-label">Số, ký hiệu</label><input class="form-input" id="f-skh" value="${formState.so_ky_hieu}" placeholder="Số:    /TB-UBND"></div>
        <div class="form-group"><label class="form-label">Ngày ban hành</label><div style="display:flex;gap:8px"><input class="form-input" id="f-ng" value="${formState.ngay}" style="flex:1"><input class="form-input" id="f-th" value="${formState.thang}" style="flex:1"><input class="form-input" id="f-na" value="${formState.nam}" style="flex:1"></div></div>
        <div class="form-group span-2"><label class="form-label">Người ký <span class="required">*</span></label><input class="form-input" id="f-nk" value="${formState.nguoi_ky}"></div>
        <div class="span-2" style="margin-top: 10px; font-weight: bold; font-size: 0.8rem; color: var(--daquy-500);">Dòng chức danh</div>
        <div class="form-group span-2"><label class="form-label">Dòng 1</label><input class="form-input" id="f-cd1" value="${formState.dong_chuc_danh_1}" placeholder="TL. CHỦ TỊCH"></div>
        <div class="form-group span-2"><label class="form-label">Dòng 2</label><input class="form-input" id="f-cd2" value="${formState.dong_chuc_danh_2}" placeholder="KT. CHÁNH VĂN PHÒNG"></div>
        <div class="form-group span-2"><label class="form-label">Dòng 3</label><input class="form-input" id="f-cd3" value="${formState.dong_chuc_danh_3}"></div>
        <div class="form-group span-2"><label class="form-label">Nơi nhận</label><textarea class="form-textarea" id="f-nn" rows="4" placeholder="- Chủ tịch, các PCT UBND tỉnh;\n- Các sở, ban, ngành;\n- Lưu: VT, ...">${formState.noi_nhan}</textarea></div>
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
  sc.querySelectorAll('input[name="the_thuc"]').forEach(rad => rad.addEventListener('change', () => { saveState(); renderStep3(sc, c); }));
  sc.querySelector('#btn-back-2').addEventListener('click', () => { saveState(); formState.step = 2; doRender(c); });
  sc.querySelector('#btn-export').addEventListener('click', () => {
    saveState();
    if (!formState.co_quan_ban_hanh || !formState.nguoi_ky) { showToast('Vui lòng nhập cơ quan ban hành và người ký!', 'error'); return; }
    generateNotificationDocx();
  });
}

// ==============================================
// XỬ LÝ GHI ÂM QUA PROXY (GEMINI)
// ==============================================
function normalizeModelName(model = "") {
  return String(model || "")
    .trim()
    .replace(/(\d),(\d)/g, "$1.$2");
}

function parseModelPool(raw, fallbackModel) {
  const source = String(raw || "").trim();
  if (!source) return [fallbackModel];
  const normalizedSource = source.replace(/(\d),(\d)/g, "$1.$2");
  const items = normalizedSource
    .split(/[\n;|,]+/g)
    .map(normalizeModelName)
    .filter(Boolean);
  return items.length > 0 ? items : [fallbackModel];
}

function pickRandomModel(raw, fallbackModel) {
  const pool = parseModelPool(raw, fallbackModel);
  return pool[Math.floor(Math.random() * pool.length)] || fallbackModel;
}

function resolveMeetingChatModel() {
  return getMeetingModelFallbackOrder()[0];
}

function resolveMeetingTranscribeModel() {
  return getMeetingModelFallbackOrder()[0];
}

function resolveMeetingTranscribeContext() {
  return 'meeting';
}

function getTranscribeEndpointForError(context = 'meeting') {
  return getProxyEndpointForContext('meeting');
}

function isAudioCapableModelName(model = "") {
  const n = normalizeModelName(model).toLowerCase();
  if (!n) return false;
  return /(transcribe|whisper|audio|4o)/.test(n);
}

function buildTranscribeModelCandidates() {
  return [getMeetingModelFallbackOrder()[0]];
}

function buildAudioChatFallbackCandidates() {
  return [getMeetingModelFallbackOrder()[0]];
}

function dedupeModelIds(ids = []) {
  const seen = new Set();
  const out = [];
  for (const id of ids) {
    const raw = String(id || "").trim();
    if (!raw) continue;
    const key = raw.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(raw);
  }
  return out;
}

function pickBestAvailableModel(modelIds = [], target = "") {
  const ids = Array.isArray(modelIds) ? modelIds.filter(Boolean) : [];
  const t = String(target || "").toLowerCase().trim();
  if (!ids.length || !t) return "";
  const lowerMap = ids.map((id) => ({ raw: id, lower: String(id).toLowerCase() }));

  const exact = lowerMap.find((x) => x.lower === t);
  if (exact) return exact.raw;

  const providerExact = lowerMap.find((x) => x.lower === `google/${t}`);
  if (providerExact) return providerExact.raw;

  const contains = lowerMap.find((x) => x.lower.includes(t));
  if (contains) return contains.raw;

  return "";
}

async function resolveMeetingAudioModelCandidates(context = "meeting") {
  const ids = await getProxyModelIds(context).catch(() => []);
  const preferred = [];
  const fallbackOrder = getMeetingModelFallbackOrder();

  if (ids.length) {
    for (const target of fallbackOrder) {
      const hit = pickBestAvailableModel(ids, target);
      if (hit) preferred.push(hit);
    }
  }

  // Always append canonical fallback order so we still try when /models is incomplete.
  return dedupeModelIds([
    ...preferred,
    ...fallbackOrder,
  ]);
}

const MEETING_PROMPT = `Bạn là trợ lý thư ký cuộc họp chuyên nghiệp trong cơ quan hành chính nhà nước Việt Nam.
Hãy nghe KỸ file ghi âm cuộc họp này và trích xuất theo cấu trúc chuẩn Thông báo kết luận:

1. NGƯỜI CHỦ TRÌ (họ tên + chức vụ).
2. THÀNH PHẦN THAM DỰ (các đơn vị, cá nhân).
3. ĐỊA ĐIỂM cuộc họp (nếu xác định được).
4. TÓM TẮT nội dung chính — viết theo văn phong hành chính.
5. NỘI DUNG CUỘC HỌP — Phân tách theo cấu trúc phân cấp chuyên nghiệp:
   - Nếu cuộc họp phức tạp, hãy chia thành các phần lớn bằng số La Mã (I. Đánh giá chung, II. Nhiệm vụ và giải pháp...).
   - Bên trong các phần, chia thành các mục nhỏ đánh số 1, 2, 3...
   - Các kết luận/chỉ đạo cụ thể đánh số a, b, c...
   Mỗi vấn đề/mục gồm:
   - tieu_de: Tiêu đề vấn đề (VD: "1. Về xây dựng hệ thống phần mềm chuyên ngành" hoặc "I. ĐÁNH GIÁ CHUNG")
   - danh_gia: Đánh giá, nhận định tình hình hoặc bối cảnh (nếu có).
   - ket_luan: Mảng các kết luận/chỉ đạo CỤ THỂ. Mỗi kết luận nên bắt đầu bằng động từ mạnh (Giao, Yêu cầu, Đề nghị...) và xác định rõ đơn vị chủ trì, đơn vị phối hợp, thời hạn hoàn thành.
6. TRANSCRIPT toàn văn (bóc băng).

LƯU Ý: Dùng đúng thuật ngữ hành chính VN (ví dụ: "Sở, ban, ngành", "địa phương", "quy định hiện hành").

Trả về JSON:
{
  "chu_tri": "Đ/c Nguyễn Ngọc Phúc - Phó Chủ tịch UBND tỉnh",
  "thanh_phan": "Lãnh đạo các sở, ngành: Khoa học và Công nghệ, Tài chính, Nội vụ; Văn phòng UBND tỉnh.",
  "dia_diem": "Phòng họp số 1, UBND tỉnh",
  "tom_tat": "Ngày 16/4/2026, đồng chí Nguyễn Ngọc Phúc - Phó Chủ tịch UBND tỉnh đã chủ trì buổi làm việc để nghe Sở Khoa học và Công nghệ báo cáo về một số nhiệm vụ trọng tâm...",
  "noi_dung_cuoc_hop": [
    {
      "tieu_de": "I. ĐÁNH GIÁ CHUNG",
      "danh_gia": "Thời gian qua, công tác chuyển đổi số đã có nhiều chuyển biến tích cực, tuy nhiên tiến độ triển khai một số phần mềm chuyên ngành còn chậm...",
      "ket_luan": []
    },
    {
      "tieu_de": "II. NHIỆM VỤ CỤ THỂ",
      "danh_gia": "",
      "ket_luan": [
        "Giao Sở Khoa học và Công nghệ chủ trì, phối hợp với các đơn vị liên quan khẩn trương rà soát danh mục phần mềm, báo cáo UBND tỉnh trước ngày 10/5/2026.",
        "Yêu cầu các sở, ngành chủ động đề xuất nhu cầu xây dựng cơ sở dữ liệu dùng chung của ngành mình."
      ]
    }
  ],
  "transcript": "[Người nói 1]: ...\\n[Người nói 2]: ..."
}
CHỈ trả về JSON.`;

async function processAudioWithProxy(file, progressEl) {
  await ensureSystemConfig();
  const transcribeContext = 'meeting'; // always use proxy context
  const transcribeRouteLabel = 'Proxy';
  const provider = systemConfigCache?.active_provider || 'gemini';

  // Không chuyển đổi âm thanh sang WAV nữa, giữ định dạng nén nhỏ gọn (m4a, aac, ogg, mp3, webm...)
  // Gemini API chính thức hỗ trợ trực tiếp các định dạng này một cách tối ưu nhất.
  let activeFile = file;

  const analysisContext = transcribeContext;
  const modelCandidates = await resolveMeetingAudioModelCandidates(transcribeContext);
  if (!modelCandidates.length) {
    throw new Error("Khong tim duoc model transcription hop le.");
  }
  let chatModel = modelCandidates[0];
  progressEl.textContent = PROCESSING_TEXT;

  const transcriptEndpoint = getProxyEndpointForContext(transcribeContext);
  const useGeminiDirectChat = false;
  const transcriptModel = chatModel;
  let transcript = '';
  let usedTranscriptModel = chatModel;
  const transcribeTimeoutMs = Number(localStorage.getItem('vbai_transcribe_timeout_ms') || (activeFile.size > 30 * 1024 * 1024 ? '300000' : '120000'));
  const safeTranscribeTimeoutMs = Number.isFinite(transcribeTimeoutMs) && transcribeTimeoutMs >= 15000 ? transcribeTimeoutMs : (activeFile.size > 30 * 1024 * 1024 ? 300000 : 120000);
  const transcribeCandidates = modelCandidates;

  // Tạo hàm cập nhật tiến trình bóc băng song song chuyên nghiệp
  const createProgressBar = (label = "Đang xử lý") => {
    let completedCount = 0;
    return (info) => {
      if (!info || !info.part || !info.total) return;
      if (info.type === 'complete') {
        completedCount++;
      }
      if (info.total > 1) {
        progressEl.textContent = `${label} song song: Phần ${completedCount}/${info.total} hoàn thành...`;
      } else {
        progressEl.textContent = `${label}...`;
      }
    };
  };

  try {
    let lastErr = null;
    for (const modelCandidate of transcribeCandidates) {
      try {
        progressEl.textContent = PROCESSING_TEXT;
        const progressTracker = createProgressBar("Đang bóc băng");
        const text = await sendAudioTranscription(activeFile, modelCandidate, {
          temperature: 0,
          context: transcribeContext,
          timeoutMs: safeTranscribeTimeoutMs,
          chunkWhenLarge: true,
          maxBytes: 10 * 1024 * 1024, // 10MB (đảm bảo base64 dưới 20MB giới hạn của Gemini)
          onProgress: progressTracker
        });
        if (String(text || "").trim()) {
          transcript = text.trim();
          usedTranscriptModel = modelCandidate;
          chatModel = modelCandidate;
          break;
        }
      } catch (err) {
        lastErr = err;
      }
    }
    if (!String(transcript || '').trim()) {
      throw (lastErr || new Error('Khong nhan duoc /audio/transcriptions'));
    }
  } catch (e) {
    progressEl.textContent = PROCESSING_TEXT;
    try {
      const defaultChunkMb = 10;
      const minChunkMb = 4;
      const maxChunkMb = Number(localStorage.getItem('vbai_transcribe_chunk_mb') || String(defaultChunkMb));
      const safeChunkMb = Number.isFinite(maxChunkMb) && maxChunkMb >= minChunkMb ? maxChunkMb : defaultChunkMb;
      let lastFallbackErr = null;
      const chatCandidates = modelCandidates;
      for (const modelCandidate of chatCandidates) {
        try {
          progressEl.textContent = PROCESSING_TEXT;
          const progressTracker = createProgressBar("Đang bóc băng (fallback)");
          const text = await sendAudioTranscription(activeFile, modelCandidate, {
            temperature: 0,
            maxBytes: safeChunkMb * 1024 * 1024,
            chunkWhenLarge: true,
            context: transcribeContext,
            timeoutMs: safeTranscribeTimeoutMs,
            onProgress: progressTracker
          });
          if (String(text || "").trim()) {
            transcript = text.trim();
            usedTranscriptModel = modelCandidate;
            chatModel = modelCandidate;
            break;
          }
        } catch (fallbackErr) {
          lastFallbackErr = fallbackErr;
        }
      }
      if (!String(transcript || "").trim()) {
        throw (lastFallbackErr || new Error("Khong nhan duoc transcript tu fallback chat."));
      }
    } catch (fallbackErr) {
      const endpoint = getTranscribeEndpointForError(transcribeContext);
      const msg = String(fallbackErr?.message || fallbackErr || "");
      if (/khong the dung model/i.test(msg)) {
        const fallbackModel = getMeetingModelFallbackOrder()[0];
        throw new Error(`Khong the xu ly ghi am qua ${transcribeRouteLabel} (${endpoint}): Model bat buoc ${fallbackModel} chua duoc cap quyen tren proxy/API hien tai.`);
      }
      throw new Error(`Khong the xu ly ghi am qua ${transcribeRouteLabel} (${endpoint}): ${fallbackErr.message}`);
    }
  }

  if (!transcript || !transcript.trim()) {
    throw new Error(`Khong nhan duoc transcript tu ${transcribeRouteLabel}.`);
  }

  progressEl.textContent = PROCESSING_TEXT;
  const prompt = `${MEETING_PROMPT}\n\nTRANSCRIPT:\n${transcript}`;
  let text = await sendChatRequest([{ role: "user", content: prompt }], chatModel, { temperature: 0.1, context: analysisContext });
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
      formState.noi_dung_cuoc_hop = [{ tieu_de: 'Kết luận chung', danh_gia: '', ket_luan: data.ket_luan }];
    }
    formState.transcript = data.transcript || transcript;
  } catch (e) {
    console.error("Lỗi parse JSON:", e, text);
    formState.transcript = transcript;
    formState.tom_tat = "Không thể trích xuất cấu trúc JSON. Vui lòng xem transcript bên dưới.";
  }

  try {
    const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    const db = getFirestore(app);
    addDoc(collection(db, 'search_logs'), {
      query: `[Ghi Âm → TB] ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)`,
      model: `${usedTranscriptModel || transcriptModel} + ${chatModel} (via ${transcribeRouteLabel})`,
      userEmail: window.currentUser?.email || 'Unknown',
      timestamp: serverTimestamp()
    }).catch(() => {});
  } catch (e) {}
}

async function reanalyzeTranscript() {
  await ensureSystemConfig();
  const transcribeContext = 'meeting';
  const modelCandidates = await resolveMeetingAudioModelCandidates(transcribeContext);
  const defaultModel = 'gemini-2.5-pro';
  const strictModel = modelCandidates[0] || defaultModel;
  const prompt = `Đây là bản transcript cuộc họp hành chính đã chỉnh sửa. Phân tích lại và trả về JSON:
{
  "chu_tri": "...",
  "thanh_phan": "...",
  "dia_diem": "...",
  "tom_tat": "...",
  "noi_dung_cuoc_hop": [
    { "tieu_de": "...", "danh_gia": "...", "ket_luan": ["..."] }
  ]
}
CHỈ JSON, KHÔNG giải thích.

TRANSCRIPT:
${formState.transcript}`;

  const messages = [{ role: "user", content: prompt }];
  let text = await sendChatRequest(messages, strictModel, { temperature: 0.1, context: transcribeContext });

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
  } catch (e) { throw new Error("Không thể phân tích lại transcript."); }
}


// ==============================================
// XUẤT DOCX — Mẫu TBKL chuẩn NĐ30
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

    // ===== TITLE =====
    ch.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 360, after: 120 }, children: [new TextRun({ text: 'THÔNG BÁO', font: L.FONT, size: 28, bold: true })] }));

    // Trích yếu dựa trên tóm tắt
    const trichYeu = fs.tom_tat ? `Kết luận của ${fs.chu_tri || 'lãnh đạo'} tại buổi làm việc về ${extractTopicSummary(fs)}` : `Kết luận của ${fs.chu_tri || 'lãnh đạo'} tại cuộc họp`;
    ch.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 }, children: [new TextRun({ text: trichYeu, font: L.FONT, size: 28, bold: true })] }));
    ch.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 240 }, children: [new TextRun({ text: '_______________', font: L.FONT, size: 28 })] }));

    // ===== PHẦN MỞ ĐẦU =====
    const introText = fs.tom_tat || `Ngày ${fs.ngay || '...'} tháng ${fs.thang || '...'} năm ${fs.nam}, tại ${fs.dia_diem || '[địa điểm]'}, ${fs.chu_tri} đã chủ trì cuộc họp.`;
    ch.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: BS, indent: { firstLine: 567 }, children: [new TextRun({ text: introText, font: L.FONT, size: 28 })] }));

    if (fs.thanh_phan) {
      ch.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: BS, indent: { firstLine: 567 }, children: [
        new TextRun({ text: 'Tham dự buổi làm việc có ', font: L.FONT, size: 28 }),
        new TextRun({ text: `lãnh đạo các sở, ngành: ${fs.thanh_phan}.`, font: L.FONT, size: 28 })
      ] }));
    }

    // Câu chuyển tiếp
    const transitionText = `Sau khi nghe báo cáo và ý kiến của các đại biểu tại buổi làm việc, trên cơ sở trao đổi, thảo luận; ${fs.chu_tri || 'người chủ trì'} kết luận và chỉ đạo như sau:`;
    ch.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: BS, indent: { firstLine: 567 }, children: [new TextRun({ text: transitionText, font: L.FONT, size: 28 })] }));

    // ===== NỘI DUNG KẾT LUẬN THEO TỪNG VẤN ĐỀ =====
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
            text: `${stt}${nd.tieu_de || 'Nội dung'}`, 
            font: L.FONT, 
            size: 28, 
            bold: true,
            allCaps: isMainSection 
          })
        ] 
      }));

      // Đánh giá tình hình (nếu có)
      if (nd.danh_gia && nd.danh_gia.trim()) {
        nd.danh_gia.split('\n').filter(l => l.trim()).forEach(line => {
          ch.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: BS, indent: { firstLine: 567 }, children: [new TextRun({ text: line.trim(), font: L.FONT, size: 28 })] }));
        });
      }

      // Các kết luận chi tiết: a) b) c)...
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

    // ===== CÂU KẾT =====
    ch.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { ...BS, before: 200 }, indent: { firstLine: 567 }, children: [
      new TextRun({ text: `Trân trọng thông báo kết luận của ${fs.chu_tri || 'lãnh đạo'} để các sở, ngành, đơn vị liên quan biết, thực hiện./.`, font: L.FONT, size: 28 })
    ] }));

    // ===== NƠI NHẬN + CHỮ KÝ =====
    const nn = [new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: 'Nơi nhận:', font: L.FONT, size: 24, bold: true, italics: true })] })];
    (fs.noi_nhan || 'Như trên;\nLưu: VT.').split('\n').filter(l => l.trim()).forEach(n => {
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
    showToast('✓ Đã tải file Thông báo kết luận!');
  } catch (e) {
    console.error(e);
    showToast('Lỗi khi tạo file DOCX: ' + e.message, 'error');
  }
}

function extractTopicSummary(fs) {
  const topics = (fs.noi_dung_cuoc_hop || []).map(nd => nd.tieu_de).filter(t => t);
  if (topics.length === 0) return 'một số nhiệm vụ trọng tâm';
  if (topics.length <= 3) return topics.join('; ').toLowerCase();
  return topics.slice(0, 2).join('; ').toLowerCase() + ` và ${topics.length - 2} nội dung khác`;
}

