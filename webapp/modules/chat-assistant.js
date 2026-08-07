/**
 * Chat Assistant Module - Legal & Administrative Consultant
 */
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { Document, Packer, Paragraph, TextRun, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';

import { firebaseConfig } from '../firebase-config.js';

import {
  sendChatRequest,
  checkProxyStatus,
  sendAudioTranscription,
  sendWebSearchRequest,
  getLastWebSearchMeta,
  sendWebExtractRequest,
  sendLegalAgentRequest,
} from './ai-proxy.js';

import { fetchSystemConfig, isCurrentUserAdmin, updateSystemConfig, validateGeminiApiKey } from './system-config.js';
import { enforceTwoTierTerminology as applyTwoTierPolicy } from './legal-two-tier-policy.js';
import { showToast } from './ui-utils.js';


const DEFAULT_MODEL = 'gemini-3.5-flash-lite';
const STRICT_MEETING_AUDIO_MODEL = 'gemini-3.5-flash-lite';
const DEFAULT_FALLBACK_SOURCES = {
  vbpl: true,
  chinhphu: true,
  quochoi: true,
  thuvienphapluat: true,
  luatvietnam: true,
};

let aiClient = null;
let chatSession = null;
let currentModelName = DEFAULT_MODEL;
let systemConfigCache = null;

function applyRuntimeSystemConfig(nextConfig = null) {
  if (!nextConfig || typeof nextConfig !== 'object') return;
  systemConfigCache = nextConfig;
  const nextModel = systemConfigCache?.gemini_model || 'gemini-3.5-flash-lite';
  currentModelName = normalizeModelName(nextModel) || DEFAULT_MODEL;
}

async function loadSystemConfig() {
  try {
    const config = await fetchSystemConfig({ forceRefresh: true });
    applyRuntimeSystemConfig(config);
    return config;
  } catch (e) {
    console.warn('Khong the tai cau hinh he thong:', e);
    return null;
  }
}

if (typeof window !== 'undefined' && !window.__vbaiChatConfigListenerBound) {
  window.addEventListener('vbai:system-config-updated', (event) => {
    const eventConfig = event?.detail?.config;
    if (eventConfig && typeof eventConfig === 'object') {
      applyRuntimeSystemConfig(eventConfig);
      return;
    }
    void loadSystemConfig();
  });
  window.__vbaiChatConfigListenerBound = true;
}

function isProxyUnavailableError(error) {
  const msg = String(error?.message || '').toLowerCase();
  return (
    msg.includes('failed to fetch')
    || msg.includes('networkerror')
    || msg.includes('load failed')
    || msg.includes('timeout')
    || msg.includes('khong ket noi')
    || msg.includes('cors')
  );
}

function isProxyToolUnsupportedError(error) {
  const msg = String(error?.message || '').toLowerCase();
  return (
    msg.includes('tool')
    || msg.includes('web_search')
    || msg.includes('unsupported')
    || msg.includes('invalid_request_error')
    || msg.includes('unknown field')
  );
}

function normalizeModelName(model = "") {
  return String(model || "")
    .trim()
    .replace(/(\d),(\d)/g, "$1.$2");
}

function isLikelyApiKey(value = "") {
  const v = String(value || "").trim();
  return /^sk-[a-z0-9\-]{10,}$/i.test(v);
}

function isLikelyGoogleApiKey(value = "") {
  const v = String(value || "").trim();
  return /^AIza[0-9A-Za-z\-_]{20,}$/.test(v);
}

function isValidHttpEndpoint(value = "") {
  const v = String(value || "").trim();
  if (!v) return false;
  if (isLikelyApiKey(v)) return false;
  return /^https?:\/\//i.test(v);
}

function createSilentWavTestFile() {
  const sampleRate = 8000;
  const durationSec = 0.25;
  const channels = 1;
  const bitsPerSample = 16;
  const numSamples = Math.max(1, Math.floor(sampleRate * durationSec));
  const bytesPerSample = bitsPerSample / 8;
  const dataSize = numSamples * channels * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeAscii = (offset, text) => {
    for (let i = 0; i < text.length; i += 1) {
      view.setUint8(offset + i, text.charCodeAt(i));
    }
  };

  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * bytesPerSample, true);
  view.setUint16(32, channels * bytesPerSample, true);
  view.setUint16(34, bitsPerSample, true);
  writeAscii(36, 'data');
  view.setUint32(40, dataSize, true);

  return new File([buffer], 'vbai_transcribe_test.wav', { type: 'audio/wav' });
}

const VBPL_PROMPT_SPEC = `Ban la "CHATBOT TRA CUU & TU VAN PHAP LUAT VIET NAM" - tro ly phap luat chuyen sau va soan thao van ban theo he thong van ban quy pham phap luat Viet Nam va quy dinh the thuc Hanh chinh / Dang.

[Objective]
- Cung cap cau tra loi phap luat Viet Nam co do chinh xac cao, lap luan chat che, truy nguoc duoc ve Source of Truth (SOT) trich dan nguyen van co toa do (VB - So hieu - Dieu - Khoan - Diem).
- Uu tien tra loi truc tiep, ro rang, de doc va chuyen nghiep.
- Khi nguoi dung hoi tong quat ve noi dung hoac chinh sach (vi du: "co gi", "co gi moi", "noi dung chinh", "tom tat"), ban phai BAT BUOC liet ke day du, chi tiet, do dai phong phu tuong tu nhu van ban luot goc. Su dung danh sach co thu tu va nhieu gach dau dong con chi tiet.
- Trich dan dung Luat/Nghi dinh/Thong tu theo so hieu, ngay ban hanh, dieu/khoan/diem khi cau hoi can doi chieu cu the.
- Luon neu tinh trang hieu luc tai THỜI ĐIỂM nguoi dung hoi hoac mốc thoi gian xay ra vu viec. Neu het hieu luc, neu ro van ban thay the va ngay hieu luc moi.

[TRIẾT LÝ CỐT LÕI & ĐỊNH DANH 5 TRỤC TỌA ĐỘ PHÁP LÝ (SKILL CORE)]
Khi tiếp nhận tình huống pháp lý hoặc tư vấn đường lối, bạn BẮT BUỘC định danh theo 5 trục tọa độ:
1. ĐỐI TƯỢNG: Ai? Cái gì? (chủ thể, khách thể - ví dụ: Người lao động; Hợp đồng thuê nhà).
2. HÀNH VI: Làm gì? (động từ pháp lý - ví dụ: Sa thải, đơn phương chấm dứt, khiếu nại).
3. TÁC ĐỘNG: Hệ quả gì? (quyền, nghĩa vụ, trách nhiệm bồi thường, truy cứu).
4. PHẠM VI: Ở đâu? Loại hình? (không gian, bối cảnh - ví dụ: TP.HCM, doanh nghiệp FDI, cơ quan cấp xã).
5. THỜI ĐIỂM: Khi nào? (TRỤC QUAN TRỌNG NHẤT - xác định chính xác văn bản nào đang/đã có hiệu lực tại mốc thời gian đó).

[ĐỘNG CƠ TRA CỨU CHÉO 3 DẦU HƯỚNG (PDCA CASCADE)]
Khi tra cứu thông tin văn bản, tự động rà soát 3 chiều:
- Chiều xuống (Dọc): Từ Bộ luật/Luật -> Nghị định quy định chi tiết -> Thông tư hướng dẫn thi hành.
- Chiều ngang: Rà soát quan hệ Sửa đổi / Bổ sung / Thay thế / Bãi bỏ giữa các văn bản cùng cấp hoặc cùng chủ đề.
- Chiều thời gian: Kiểm tra mốc hiệu lực thi hành, chuyển tiếp hiệu lực để không áp dụng điều khoản đã hết hiệu lực.

[QUY TẮC XỬ LÝ XUNG ĐỘT PHÁP LÝ (LEX RULES)]
Khi phát hiện mâu thuẫn hoặc vướng mắc giữa nhiều văn bản quy định cùng một vấn đề:
- Lex Superior: Văn bản có thứ bậc hiệu lực pháp lý cao hơn được áp dụng trước (Hiến pháp > Luật > Nghị định > Thông tư).
- Lex Posterior: Văn bản được ban hành sau áp dụng trước (nếu cùng cấp hành chính và cùng phạm vi).
- Lex Specialis: Quy định chuyên ngành áp dụng ưu tiên so với quy định chung (nếu cùng cấp và cùng mốc thời gian).

[PREMIUM LEGAL ANSWER LAYOUT SPECIFICATION]
Khi người dùng tra cứu thông tin văn bản pháp luật, bạn BẮT BUỘC tổ chức câu trả lời theo khung chuẩn hóa:
1. [Đoạn mở đầu]: 1-2 câu trả lời trực tiếp, khẳng định rõ ràng tình trạng hiệu lực và văn bản mới nhất áp dụng.
2. [Khung Tóm tắt]:
Tóm lại:
* Tên luật: [Tên chính thức của văn bản]
* Số hiệu: [Số hiệu đầy đủ]
* Ngày ban hành: [Ngày/Tháng/Năm ban hành]
* Ngày có hiệu lực: [BẮT BUỘC ghi chính xác ngày/tháng/năm luật có hiệu lực thi hành]
* Tình trạng hiệu lực: [Có hiệu lực / Hết hiệu lực / Ngưng hiệu lực]
* Thay thế cho: [Liệt kê số hiệu các văn bản bị thay thế, nếu có]
* Nội dung chính: [Tóm tắt ngắn gọn về nội dung chính của văn bản]
2b. [Khung Tóm tắt các điểm chính]: (Liệt kê đầy đủ, chi tiết, nhóm theo các chính sách lớn với nhiều gạch đầu dòng con).
3. [Đoạn giải thích bổ sung / Phân tích phương án]: Phân tích lộ trình áp dụng, sự thay đổi hoặc điều khoản cần lưu ý. Với tình huống vướng mắc, nêu rõ ưu/nhược điểm các phương án.
4. [Đoạn khuyến nghị & Disclaimer]: "Nội dung tư vấn mang tính tham khảo sơ bộ, không thay thế ý kiến pháp lý chính thức từ luật sư hoặc cơ quan có thẩm quyền."
5. [Khung Căn cứ pháp lý — Bảng SOT]:
Căn cứ pháp lý:
* [Số hiệu văn bản – Điều X, Khoản Y, Điểm Z](link nếu có): Trích dẫn nguyên văn có tọa độ.
6. [Khung Trích dẫn nguồn]: Trích dẫn link hoặc nguồn tài liệu tham khảo chính thống.

[SOẠN THẢO VĂN BẢN (NHÀ NƯỚC NĐ30 VS ĐẢNG HD05)]
Khi người dùng yêu cầu soạn thảo văn bản, BẮT BUỘC phân biệt loại văn bản và tuân thủ thể thức:

1. VĂN BẢN HÀNH CHÍNH NHÀ NƯỚC (Nghị định 30/2020/NĐ-CP):
- Áp dụng cho: UBND, HĐND, các Sở, Bộ, Ngành, Doanh nghiệp...
- Thể thức:
  + Quốc hiệu, Tiêu ngữ: CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM / Độc lập - Tự do - Hạnh phúc.
  + Số hiệu: Số: .../QĐ-UBND hoặc Số: .../CV-...
  + Quyền hạn ký: Dùng dấu chấm (VD: TL. CHỦ TỊCH, KT. GIÁM ĐỐC).
  + Kính gửi: Không in đậm, cỡ chữ 14.
  + Nơi nhận: Tên "Nơi nhận:" nghiêng đậm, các dòng nhận không gạch chân.

2. VĂN BẢN ĐẢNG (Hướng dẫn 05-HD/VPTW):
- Áp dụng cho: Cấp ủy, Ban Chấp hành, Chi bộ, Ban Tham mưu, BCSĐ, Đoàn Đảng các cấp.
- Thể thức:
  + Lề phải 15mm. Dấu sao (*) trong tiêu ngữ/cơ quan nếu có.
  + Số hiệu: Số ...-NQ/TU, Số ...-CV/VPTW (dấu gạch nối - và gạch chéo /).
  + Quyền hạn ký: Dùng dấu gạch chéo / (VD: T/M BAN THƯỜNG VỤ, K/T BÍ THƯ, T/L BÍ THƯ).
  + Nơi nhận: Tên "Nơi nhận:" có GẠCH CHÂN (không nghiêng), phân cách các cơ quan nhận bằng DẤU CHẤM PHẨY (;), kết thúc bằng dấu chấm (.).
  + Tờ trình Đảng: Dùng "Kính trình" thay vì "Kính gửi".
  + Các Khoản trong Điều: Dùng 1. 2. 3. (số in đậm), không dùng a), b), c).

3. YÊU CẦU NỘI DUNG SOẠN THẢO: Viết ĐẦY ĐỦ, CHI TIẾT NỘI DUNG VĂN BẢN THỰC TẾ (năm mặc định 2026), không dùng placeholder "[Nhập nội dung...]". Đặt trong khung Markdown để người dùng dễ copy vào Word.

[QUY TẮC TÌM KIẾM VÀ CHỐNG ẢO GIÁC (TỐI QUAN TRỌNG)]
4. ĐỐI VỚI SO SÁNH LUẬT TỔ CHỨC CHÍNH QUYỀN ĐỊA PHƯƠNG (LUẬT CŨ VS LUẬT MỚI 72/2025/QH15): Bạn BẮT BUỘC phải làm nổi bật 2 thay đổi mang tính cách mạng sau trong bảng so sánh và phần phân tích:
   - **Xóa bỏ cấp hành chính cấp huyện**: Luật mới 72/2025/QH15 chính thức xóa bỏ hoàn toàn chính quyền địa phương cấp huyện (HĐND & UBND cấp huyện), chỉ còn lại tổ chức chính quyền địa phương tinh gọn ở 2 cấp: cấp Tỉnh (Tỉnh/Thành phố trực thuộc Trung ương) và cấp Xã (Xã/Phường/Thị trấn).
   - **Đổi tên các Sở, Ban, Ngành ở địa phương**: Các cơ quan chuyên môn dưới UBND cấp tỉnh (Sở, Ban, Ngành) được đổi tên đồng nhất trực tiếp theo tên gọi của các cơ quan Bộ ở Trung ương (Ví dụ: Sở Tư pháp, Sở Tài chính, Sở Lao động - Thương binh và Xã hội... được đổi tên đồng bộ tương ứng trực tiếp theo các Bộ ở trung ương) để đồng bộ hóa chỉ đạo điều hành và tinh gọn bộ máy.
5. Luôn kết thúc bằng mục 'Căn cứ pháp lý:' và 'Trích dẫn:' theo đúng chuẩn đã quy định.`;
const SYSTEM_INSTRUCTION = VBPL_PROMPT_SPEC;
const FAST_SYSTEM_INSTRUCTION = `${VBPL_PROMPT_SPEC}

[Fast mode]
- Tra loi truc tiep truoc.
- Neu du lieu chua du thi neu ro ngan gon va chi hoi lam ro khi that su can.`;

const CHAT_CACHE_STORAGE_KEY = 'vbai_chat_cache_v1';
const CHAT_CACHE_MAX_ITEMS = 40;
const CHAT_CACHE_TTL_MS = 5 * 60 * 1000;
const CHAT_CACHE_TTL_TIME_SENSITIVE_MS = 60 * 1000;
const DAILY_SYNC_TIMESTAMP_KEY = 'vbai_daily_sync_timestamp';
const HOT_KNOWLEDGE_TTL_MS = 2 * 60 * 60 * 1000;
const CHAT_CONTEXT_MAX_TURNS = 6;

let allSkills = [];
let recentTurns = [];
let lastUserQuery = "";
let lastAssistantReply = "";
let lastResolvedDocNumber = "";
let attachedFile = null; // Đính kèm tệp tin hiện tại: { name, text, size, type }

if (typeof sessionStorage !== 'undefined') {
  try {
    const storedDocNo = sessionStorage.getItem('vbai_last_resolved_doc');
    if (storedDocNo) lastResolvedDocNumber = String(storedDocNo).trim().toUpperCase();
  } catch {}
}
const clarificationTracker = new Map();

async function loadSkills() {
  try {
    const response = await fetch('./skills-manifest.json');
    allSkills = await response.json();
  } catch (e) {
    console.warn("L\u1ed7i t\u1ea3i Skills cho Chat Assistant:", e);
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

async function processAttachedFile(file, statusCallback) {
  const ext = '.' + file.name.split('.').pop().toLowerCase();
  
  if (ext === '.pdf') {
    statusCallback('Đang đọc file PDF...');
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
    
    const textLen = fullText.trim().replace(/--- Trang \d+ ---/g, '').trim().length;
    if (textLen < 50) {
      statusCallback('Đang nhận dạng chữ (OCR AI)...');
      const ocrPrompt = `Bạn là chuyên gia OCR tiếng Việt. Hãy đọc và trích xuất NGUYÊN VĂN TOÀN BỘ nội dung chữ tiếng Việt có trong các hình ảnh tài liệu này. Không bình luận hay giải thích.`;
      const content = [{ type: "text", text: ocrPrompt }];
      const limitPages = Math.min(pdf.numPages, 10);
      
      for (let i = 1; i <= limitPages; i++) {
        statusCallback(`Đang quét ảnh trang ${i}/${limitPages}...`);
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        await page.render({ canvasContext: context, viewport }).promise;
        const base64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
        content.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64}` } });
      }
      
      statusCallback('Đang nhận diện ký tự bằng AI...');
      const config = await fetchSystemConfig();
      const model = config?.gemini_model || 'gemini-3.5-flash-lite';
      const ocrText = await sendChatRequest([{ role: "user", content }], model, { temperature: 0, context: 'ocr', provider: 'gemini' });
      if (!ocrText) throw new Error('Không thể nhận diện được nội dung chữ từ file quét scan.');
      fullText = ocrText;
    }
    
    return fullText;
  }
  
  else if (ext === '.docx') {
    statusCallback('Đang đọc file Word (.docx)...');
    const JSZip = (await import('https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm')).default;
    const zip = await JSZip.loadAsync(file);
    const docXml = await zip.file('word/document.xml')?.async('text');
    if (!docXml) throw new Error('Không tìm thấy nội dung document.xml trong file Word.');
    
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(docXml, "application/xml");
    const body = xmlDoc.getElementsByTagName('w:body')[0] || xmlDoc.getElementsByTagName('body')[0];
    if (!body) throw new Error('Không thể phân tích cấu trúc file Word.');
    
    let resultText = "";
    function traverse(node) {
      const name = node.nodeName.replace(/^.*:/, '');
      if (name === 'p') {
        let pText = "";
        const tNodes = Array.from(node.querySelectorAll('*')).filter(n => n.nodeName.replace(/^.*:/, '') === 't');
        for (let t of tNodes) {
          pText += t.textContent;
        }
        resultText += pText + "\n";
      } else if (name === 'tbl') {
        const rows = Array.from(node.querySelectorAll('*')).filter(n => n.nodeName.replace(/^.*:/, '') === 'tr');
        for (let r of rows) {
          let rowText = [];
          const cells = Array.from(r.childNodes).filter(n => n.nodeName.replace(/^.*:/, '') === 'tc');
          for (let c of cells) {
            const tNodes = Array.from(c.querySelectorAll('*')).filter(n => n.nodeName.replace(/^.*:/, '') === 't');
            let cellText = tNodes.map(t => t.textContent).join('');
            rowText.push(cellText.trim());
          }
          resultText += "| " + rowText.join(" | ") + " |\n";
        }
        resultText += "\n";
      } else {
        for (let child of node.childNodes) {
          traverse(child);
        }
      }
    }
    
    for (let child of body.childNodes) {
      traverse(child);
    }
    return resultText.trim();
  }
  
  else if (ext === '.xlsx') {
    statusCallback('Đang đọc file Excel (.xlsx)...');
    if (!window.XLSX) {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      document.head.appendChild(script);
      await new Promise((resolve, reject) => { script.onload = resolve; script.onerror = reject; });
    }
    
    const arrayBuffer = await file.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    const workbook = window.XLSX.read(data, { type: 'array' });
    let fullText = '';
    
    workbook.SheetNames.forEach(sheetName => {
      const worksheet = workbook.Sheets[sheetName];
      const csv = window.XLSX.utils.sheet_to_csv(worksheet);
      if (csv.trim()) {
        fullText += `--- Sheet: ${sheetName} ---\n${csv}\n\n`;
      }
    });
    
    if (!fullText.trim()) throw new Error('File Excel trống hoặc không đọc được nội dung.');
    return fullText.trim();
  }
  
  else {
    throw new Error('Định dạng file không hỗ trợ. Vui lòng chọn PDF, Word (.docx) hoặc Excel (.xlsx).');
  }
}


function normalizeVietnamese(text = '') {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0111/g, 'd');
}

const LEGAL_DOC_TYPE_PATTERNS = Object.freeze({
  thong_tu_lien_tich: /\bthong\s*tu\s*lien\s*tich\b|\bthongtulientich\b|\bttlt\b/,
  nghi_quyet: /\bnghi\s*quyet\b|\bnghiquyet\b|\bnq\b/,
  phap_lenh: /\bphap\s*lenh\b|\bphaplenh\b|\bpl\b/,
  nghi_dinh: /\bnghi\s*dinh\b|\bnghidinh\b|\bnd(?:-cp)?\b/,
  thong_tu: /\bthong\s*tu\b|\bthongtu\b|\btt(?:-[a-z0-9]+)?\b/,
  quyet_dinh: /\bquyet\s*dinh\b|\bquyetdinh\b|\bqd\b/,
  chi_thi: /\bchi\s*thi\b|\bchithi\b|\bct\b/,
  luat: /\bluat\b|\bbo\s*luat\b/,
  giay_moi: /\bgiay\s*moi\b|\bgiaymoi\b|\bgm\b|\bmoi\s*hop\b|\bmoihop\b/,
});

const LEGAL_DOMAIN_TAXONOMY = Object.freeze({
  lao_dong_tien_luong: Object.freeze([
    'hop dong lao dong',
    'thoi viec',
    'tro cap that nghiep',
    'bhxh 1 lan',
    'bao hiem xa hoi 1 lan',
    'luong toi thieu',
    'tien luong',
  ]),
  thue_doanh_nghiep: Object.freeze([
    'thue tncn',
    'thue tndn',
    'hoa don dien tu',
    'chi phi hop ly',
    'quyet toan thue',
    'ke khai thue',
  ]),
  dat_dai_nha_o: Object.freeze([
    'boi thuong dat',
    'tach thua',
    'so do',
    'chuyen muc dich su dung dat',
    'quyen su dung dat',
    'nha o',
  ]),
  hon_nhan_gia_dinh: Object.freeze([
    'ly hon don phuong',
    'chia tai san',
    'quyen nuoi con',
    'hon nhan gia dinh',
    'cap duong',
    'ly hon',
  ]),
});

function inferDomainFromQuery(text = '') {
  const n = normalizeVietnamese(String(text || ''));
  if (!n) return { domain_id: null, domain_confidence: 0, domain_keywords_hit: [] };

  const ranked = Object.entries(LEGAL_DOMAIN_TAXONOMY).map(([domainId, keywords]) => {
    const hits = [];
    for (const keyword of keywords) {
      const k = normalizeVietnamese(String(keyword || '').trim());
      if (k && n.includes(k)) hits.push(k);
    }
    return { domainId, hits };
  }).sort((a, b) => b.hits.length - a.hits.length);

  const best = ranked[0];
  if (!best || best.hits.length === 0) return { domain_id: null, domain_confidence: 0, domain_keywords_hit: [] };
  return {
    domain_id: best.domainId,
    domain_confidence: Math.max(0, Math.min(1, Number((best.hits.length / 3).toFixed(2)))),
    domain_keywords_hit: best.hits.slice(0, 4),
  };
}

function hasBroadComparisonIntent(text = '') {
  const n = normalizeVietnamese(text);
  if (!/(so sanh|doi chieu|khac nhau giua)/.test(n)) return false;
  return /(luat|bo luat|nghi dinh|nghi quyet|thong tu|quyet dinh|phap lenh|chi thi|dieu|khoan|diem|van ban)/.test(n);
}

function isDraftRequest(text = '') {
  const t = normalizeVietnamese(text);
  return /(soan|du thao|mau van ban|quyet dinh|to trinh|thong bao|cong van|bao cao|nghi quyet|ke hoach)/.test(t);
}

function isTemplateExportRequest(text = '') {
  const t = normalizeVietnamese(text);
  return /(xuat|tai|tao).*(file|mau|docx|dox|fox|word|van ban)|xuat cho toi|cho toi mau|in mau/.test(t);
}

function shouldAutoExportDocx(text = "") {
  const t = normalizeVietnamese(text);
  if (!isTemplateExportRequest(t)) return false;
  return /(\\.docx|\\.dox|\\.fox|\\bdocx\\b|\\bdox\\b|\\bfox\\b|word)/.test(t);
}

function getCurrentYearContext() {
  const now = new Date();
  const current = now.getFullYear();
  const next = current + 1;
  const prev = current - 1;
  return { current, next, prev };
}

function isTimeSensitiveQuery(text = '') {
  const t = normalizeVietnamese(text);
  const { current, next, prev } = getCurrentYearContext();
  const yearPattern = new RegExp(`nam (${current}|${next}|${prev}|202\\d|203\\d)`);
  return /(moi nhat|co gi moi|diem moi|cap nhat|hom nay|hieu luc|ngay hieu luc|ban hanh ngay|ngay ban hanh|sua doi|bo sung|thay the|van ban moi|vua ban hanh|hien hanh|ngay nay)/.test(t) || yearPattern.test(t);
}

function buildFreshnessGuardMessage(query = '', reason = '') {
  const topic = String(query || '').trim() || 'noi dung nay';
  const reasonText = reason ? ` ${reason}` : '';
  return `Tôi chưa thể xác minh dữ liệu mới nhất từ Internet cho yêu cầu: "${topic}".${reasonText} Vui lòng nêu rõ hơn số hiệu văn bản, năm ban hành/hiệu lực hoặc kiểm tra thêm từ nguồn chính thức như vbpl.vn, chinhphu.vn, quochoi.vn.`;
}

function buildBestAlternativeLatestAnswer(query = '', bestAlternative = null) {
  if (!bestAlternative || typeof bestAlternative !== 'object') return '';
  const docType = String(bestAlternative.loai_van_ban || 'Văn bản').trim();
  const docNo = String(bestAlternative.so_hieu || '').trim();
  const title = String(bestAlternative.trich_yeu_hoac_ten_van_ban || '').trim();
  const source = String(bestAlternative.nguon || '').trim();
  const sourceLabel = bestAlternative.is_official_source === true ? 'Chính thức' : 'Tham khảo';
  const headline = docNo
    ? `${docType} mới nhất tôi tìm được cho yêu cầu này là số ${docNo}.`
    : `${docType} mới nhất tôi tìm được cho yêu cầu này hiện chưa thấy rõ số hiệu trong dữ liệu tra cứu.`;
  const detail = title ? `Tên văn bản phù hợp nhất: ${title}.` : '';
  const sourceLine = source ? `Nguồn: ${source} (${sourceLabel}).` : '';
  return [headline, detail, sourceLine].filter(Boolean).join(' ');
}

function shouldPreferWebSearch(text = '') {
  const t = normalizeVietnamese(text);
  if (isTimeSensitiveQuery(t)) return true;
  if (/\b\d{1,4}\/\d{4}\/[a-z0-9-]+\b/i.test(t)) return true;
  if (/\b\d{1,4}\/\d{4}\b/i.test(t)) return true;
  return /(so hieu|ban hanh|hieu luc|toan van|trich|dieu\s*\d+|khoan\s*\d+|diem\s*[a-z]|uy quyen|phan cap|phan quyen|van ban nao|co ton tai khong|huong dan|to trinh|quy dinh ve|dieu kien|trinh tu|thu tuc|xu phat|bieu mau|so sanh|doi chieu|luat|nghi dinh|thong tu|nghi quyet|quyet dinh|phap lenh|chi thi|ttlt|nq|pl|qd|ct)/.test(t);
}

function buildFreshWebSearchOptions(rawText = '') {
  const t = normalizeVietnamese(rawText);
  const isTimeSensitive = isTimeSensitiveQuery(rawText);

  if (!isTimeSensitive) {
    return { forceFresh: false, freshnessLevel: 'month', recencyDays: 365, timeoutMs: 10000 };
  }

  if (/(hom nay|hien tai|ngay nay)/.test(t)) {
    return { forceFresh: true, freshnessLevel: 'day', recencyDays: 7, timeoutMs: 15000 };
  }
  if (/(tuan nay|7 ngay|7ngay)/.test(t)) {
    return { forceFresh: true, freshnessLevel: 'week', recencyDays: 30, timeoutMs: 15000 };
  }
  if (/(thang nay|30 ngay|30ngay)/.test(t)) {
    return { forceFresh: true, freshnessLevel: 'month', recencyDays: 90, timeoutMs: 15000 };
  }
  // Default time-sensitive legal query
  return { forceFresh: true, freshnessLevel: 'month', recencyDays: 365, timeoutMs: 20000 };
}

function getChatCacheStore() {
  try {
    const raw = sessionStorage.getItem(CHAT_CACHE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveChatCacheStore(store) {
  try {
    sessionStorage.setItem(CHAT_CACHE_STORAGE_KEY, JSON.stringify(store));
  } catch {}
}

function makeChatCacheKey(text, model, useWebSearch) {
  return [
    normalizeVietnamese(text).replace(/\s+/g, ' ').trim(),
    String(model || '').trim().toLowerCase(),
    'proxy',
    useWebSearch ? 'ws1' : 'ws0'
  ].join('||');
}

function getCachedChatAnswer(text, model, useWebSearch) {
  const store = getChatCacheStore();
  const key = makeChatCacheKey(text, model, useWebSearch);
  const hit = store[key];
  if (!hit || typeof hit !== 'object') return '';
  if (!hit.expiresAt || Date.now() > hit.expiresAt) {
    delete store[key];
    saveChatCacheStore(store);
    return '';
  }
  return typeof hit.text === 'string' ? hit.text : '';
}

function setCachedChatAnswer(text, model, useWebSearch, answer) {
  const cleaned = String(answer || '').trim();
  if (!cleaned) return;

  const ttl = isTimeSensitiveQuery(text) ? CHAT_CACHE_TTL_TIME_SENSITIVE_MS : CHAT_CACHE_TTL_MS;
  const store = getChatCacheStore();
  const key = makeChatCacheKey(text, model, useWebSearch);
  store[key] = {
    text: cleaned,
    updatedAt: Date.now(),
    expiresAt: Date.now() + ttl,
  };

  const entries = Object.entries(store).sort((a, b) => (b[1]?.updatedAt || 0) - (a[1]?.updatedAt || 0));
  const next = {};
  entries.slice(0, CHAT_CACHE_MAX_ITEMS).forEach(([k, v]) => { next[k] = v; });
  saveChatCacheStore(next);
}

function pushTurn(role, content) {
  const clean = String(content || "").replace(/\s+/g, " ").trim();
  if (!clean) return;
  recentTurns.push({ role, content: clean });
  if (recentTurns.length > CHAT_CONTEXT_MAX_TURNS) {
    recentTurns = recentTurns.slice(-CHAT_CONTEXT_MAX_TURNS);
  }
}

function getConversationalMemory() {
  const toContents = (turns = []) => turns
    .slice(-6)
    .map((t) => {
      const role = t.role === 'assistant' ? 'assistant' : 'user';
      const text = String(t.content || '').trim();
      if (!text) return null;
      return {
        role,
        parts: [{ text }],
      };
    })
    .filter(Boolean);

  if (Array.isArray(recentTurns) && recentTurns.length > 0) {
    return toContents(recentTurns);
  }
  if (typeof document !== 'undefined') {
    try {
      const bubbles = document.querySelectorAll('.chat-message-bubble, .message-bubble, .chat-bubble, .message-content');
      const turns = [];
      bubbles.forEach(el => {
        const isUser = el.classList.contains('user') || el.closest('.user') || el.closest('[data-role="user"]') || el.closest('.message-right');
        const role = isUser ? 'user' : 'assistant';
        const text = String(el.textContent || '').trim();
        if (text) {
          turns.push({ role, content: text });
        }
      });
      if (turns.length > 0) {
        return toContents(turns);
      }
    } catch {}
  }
  return [];
}

function buildRecentContextBlock() {
  if (recentTurns.length === 0) return "";
  return recentTurns
    .slice(-4)
 .map((t) => `${t.role === "user" ? "Nguoi dung" : "Tro ly"}: ${t.content}`)
    .join("\n");
}

function shouldTreatAsFollowUpQuery(query = "") {
  if (!lastUserQuery) return false;
  const t = normalizeVietnamese(query);
  if (!t) return false;

  const hasExplicitNewTopic = /(luat|bo luat|nghi dinh|thong tu|thong tu lien tich|ttlt|quyet dinh|to trinh|thong bao|nghi quyet|phap lenh|chi thi|bao cao|cong van|van ban|chinh sach|huong dan|ve viec)/.test(t);
  if (/(uy quyen|uy quyen la gi|co nghia la gi|co nghia|the nao|ra sao|noi ro|lam ro|ky hon|chi tiet hon|bo sung)/.test(t)) return true;
  if (/(cau hoi thu 2|cau thu 2|noi dung tren|y tren|van de nay|chu de nay|phan nay)/.test(t)) return true;
  if (!hasExplicitNewTopic && t.length <= 90) return true;
  return false;
}

function normalizeLegalQuery(userMessage = '', searchContext = {}) {
  const raw = String(userMessage || '').trim();
  const normalized = normalizeVietnamese(raw);
  const comparison = parseComparisonTargets(raw);
  const broadComparison = hasBroadComparisonIntent(raw);
  const citationIntent = hasCitationIntent(raw);
  const delegationIntent = isDelegationFocusQuery(raw);
  const updateIntent = isSubstantiveUpdateQuery(raw, searchContext);
  const detailedIntent = isDetailedLegalIntent(raw, searchContext);

  let intent = 'general_lookup';
  if (comparison || broadComparison) intent = 'comparison';
  else if (citationIntent) intent = 'citation';
  else if (delegationIntent) intent = 'delegation_focus';
  else if (updateIntent) intent = 'substantive_update';
  else if (detailedIntent) intent = 'detailed_lookup';
  else if (/(con hieu luc|het hieu luc|hieu luc khong|hieu luc hay khong|ngay hieu luc|hieu luc tu ngay nao)/.test(normalized)) intent = 'effectiveness_check';
  else if (/(moi nhat|co gi moi|moi nhat so bao nhieu|so bao nhieu|la so bao nhieu|ban hanh ngay nao|ngay ban hanh nao|ngay nao ban hanh)/.test(normalized)) intent = 'latest_doc_lookup';
  const domainInfo = inferDomainFromQuery(raw);

  return {
    originalText: raw,
    normalizedText: normalized,
    docType: searchContext?.requestedDocType || null,
    fullDocNumber: searchContext?.effectiveDocNumber || searchContext?.fullDocNumber || null,
    partialDocNumber: searchContext?.partialDocNumber || null,
    docNumberMatchLevel: searchContext?.docNumberMatchLevel || 'none',
    intent,
    asksForWebFreshness: isTimeSensitiveQuery(raw),
    asksForComparison: Boolean(comparison || broadComparison),
    asksForCitation: citationIntent,
    asksForDelegationFocus: delegationIntent,
    asksForDetailedAnswer: detailedIntent,
    asksForSubstantiveUpdate: updateIntent,
    domain_id: domainInfo.domain_id,
    domain_confidence: domainInfo.domain_confidence,
    domain_keywords_hit: domainInfo.domain_keywords_hit,
  };
}


function buildContextAwareUserPrompt(query = "") {
  const q = String(query || "").trim();
  if (!q) return q;
  if (!shouldTreatAsFollowUpQuery(q)) return q;

  const contextLines = [];
  if (lastUserQuery) contextLines.push(`- Cau truoc cua nguoi dung: "${lastUserQuery}"`);
  if (lastAssistantReply) {
    const shortReply = lastAssistantReply.length > 280 ? `${lastAssistantReply.slice(0, 277)}...` : lastAssistantReply;
    contextLines.push(`- Tro ly vua tra loi: "${shortReply}"`);
  }
  const recentContext = buildRecentContextBlock();
  if (recentContext) contextLines.push(`- Tom tat hoi thoai gan nhat:\n${recentContext}`);

  return [
    "Day la cau hoi TIEP NOI cung chu de, khong phai chu de moi.",
    ...contextLines,
    `Cau hoi tiep theo cua nguoi dung: "${q}"`,
    "Yeu cau: tra loi dung mach noi dung truoc do, khong hoi lai chung chung, khong chuyen sang chu de khac."
  ].join("\n");
}

function isLikelyFollowUpLine(line = "") {
  const n = normalizeVietnamese(String(line || "").trim());
  if (!n) return false;
  if (/(ban (co muon|muon|can)|vui long gui them|tra cuu tiep|tra cuu sau hon|huong nao|van de phap ly nao|ban can minh)/.test(n)) {
    return true;
  }
  return n.endsWith("?") && /(tra cuu|noi dung|chu de|huong|bo sung|lam ro)/.test(n);
}

function stripTrailingFollowUpBlocks(text = "") {
  const lines = String(text || "").split('\n');
  while (lines.length > 0) {
    const last = (lines[lines.length - 1] || '').trim();
    if (!last) {
      lines.pop();
      continue;
    }
    if (isLikelyFollowUpLine(last)) {
      lines.pop();
      continue;
    }
    break;
  }
  return lines.join('\n').trim();
}

function stripGenericClarificationLines(text = "") {
  const lines = String(text || "").split("\n");
  const kept = [];
  let skipping = false;

  for (const line of lines) {
    const raw = String(line || "");
    const n = normalizeVietnamese(raw.trim());

    const trigger = /(ban muon tra cuu ky hon ve|vui long gui them|minh se tra theo thu tu|ban can minh tra cuu tiep noi dung cu the nao)/.test(n);
    if (!skipping && trigger) {
      skipping = true;
      continue;
    }

    if (skipping) {
      if (!raw.trim()) {
        skipping = false;
      }
      continue;
    }

    kept.push(raw);
  }

  return kept.join("\n").trim();
}

function buildContextualFollowUp(query = "") {
  const q = String(query || "").replace(/\s+/g, " ").trim();
  if (!q) return "Vui long cung cap them so hieu day du hoac dieu/khoan can trich dan de toi doi chieu chinh xac.";
  const shortTopic = q.length > 120 ? `${q.slice(0, 117)}...` : q;
  return `De lam ro yeu cau "${shortTopic}", ban vui long cung cap them so hieu day du, ten van ban hoac dieu/khoan can doi chieu.`;
}

function makeClarificationKey(query = '') {
  const normalized = normalizeVietnamese(String(query || '').replace(/\s+/g, ' ').trim());
  if (!normalized) return '__default__';
  return normalized.slice(0, 220);
}

function shouldAskClarification(answer = '', query = '', forceAsk = false, meta = null) {
  if (forceAsk) return true;

  // Don't ask if backend has high confidence
  if (meta && typeof meta.confidence === 'number' && meta.confidence >= 0.85) {
    return false;
  }

  const hay = normalizeVietnamese(`${answer}\n${query}`);
  return /(vui long cung cap|chua du can cu|chua tim thay|khong tim thay|thieu du lieu|can lam ro|partial_doc_number)/.test(hay);
}

function shouldApplyLegalEnvelope(answer = '', query = '') {
  const hay = normalizeVietnamese(`${answer}\n${query}`);
  return /(luat|nghi dinh|thong tu|nghi quyet|quyet dinh|van ban|hieu luc|dieu|khoan|diem|tra cuu)/.test(hay);
}

function extractSummaryText(answer = '', fallback = '') {
  const plain = String(answer || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\[[^\]]+\]\([^)]+\)/g, '$1')
    .replace(/[#>*`|_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const base = plain || String(fallback || '').trim() || 'Da hoan thanh doi chieu theo du lieu tra cuu.';
  const words = base.split(' ').filter(Boolean);
  if (words.length <= 120) return base;
  return `${words.slice(0, 120).join(' ')}...`;
}

function shouldUseCompactLegalAnswer(answer = '', query = '', meta = null) {
  const text = normalizeVietnamese(`${answer}
${query}`);
  if (!text) return false;
  if (meta?.rawIntent === 'full') return false;
  if (isSubstantiveUpdateQuery(query, { effectiveDocNumber: extractPotentialDocNumber(query) || lastResolvedDocNumber || null })) return false;
  const hasStructuredRequest = /(dieu\s*\d+|khoan\s*\d+|diem\s*[a-z]|so sanh|doi chieu|trich|toan van|phan tich|chi tiet|theo so|so hieu|nguyen van|liet ke day du|day du)/.test(text);
  if (hasStructuredRequest) return false;
  if (meta && typeof meta.confidence === 'number' && meta.confidence < 0.75) return false;
  return /(luat|nghi dinh|thong tu|nghi quyet|quyet dinh|van ban|tra cuu|hieu luc|co gi moi|moi nhat|la gi|khac gi)/.test(text);
}

function compactLegalAnswer(answer = '', query = '', meta = null) {
  const text = String(answer || '').trim();
  if (!text) return text;
  if (!shouldUseCompactLegalAnswer(text, query, meta)) return text;

  return text
    .replace(/^##\s*T[oó]m t[aá]t\s*$/gim, '')
    .replace(/^###\s*Th[oô]ng tin chi ti[eế]t\s*\/\s*Ph[aâ]n t[ií]ch\s*$/gim, '')
    .replace(/^###\s*Gi[aả]i th[ií]ch\s*\/\s*H[uư][oớ]ng d[aẫ]n th[eê]m n[eế]u c[aầ]n\s*$/gim, '')
    .replace(/^\*\*Thong tin tra cuu\*\*:\s*$/gim, '')
    .replace(/^\*\*Thông tin tra cứu\*\*:\s*$/gim, '')
    .replace(/^\s*[-*]\s*Ngu[oồ]n:[^\n]*$/gim, '')
    .replace(/^\s*[-*]\s*T[iì]nh tr[aạ]ng hi[eệ]u l[uự]c:[^\n]*$/gim, '')
    .replace(/^\s*[-*]\s*M[uứ]c đ[oộ] ch[aắ]c ch[aắ]n:[^\n]*$/gim, '')
    .replace(/^\s*[-*]\s*Kh[oớ]p ch[ií]nh x[aá]c s[oố] hi[eệ]u v[aă]n b[aả]n\s*$/gim, '')
    .replace(/^\s*[-*]\s*Nếu cần kết luận chính thức, vui lòng đối chiếu thêm trên nguồn chính thức\.\s*$/gim, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractPrimarySourceLine(meta = null) {
  const bestAlternative = meta?.best_alternative && typeof meta.best_alternative === 'object'
    ? meta.best_alternative
    : null;
  const rawUrl = String(bestAlternative?.nguon || '').trim();
  if (!rawUrl) return '';
  return `Nguồn: ${rawUrl}`;
}

function enforceLegalMarkdownEnvelope(answer = '', query = '', meta = null) {
  // Strip accidental JS/module leakage
  let cleaned = String(answer || '').trim();
  cleaned = cleaned.replace(/```(?:js|javascript|typescript|node)[\s\S]*?```/g, '');
  cleaned = cleaned.replace(/(?:import|export|const|let|var)\s+[\s\S]{0,500}?from\s+['"][^'"]+['"]/g, '');
  cleaned = cleaned.replace(/(?:export\s+default|module\.exports)[\s\S]{0,200}?;/g, '');
  cleaned = cleaned.replace(/\/\/# sourceMappingURL=[^\s\n]*/gi, '');
  cleaned = cleaned.replace(/(?:firebaseConfig|fbconfig|initApp|getApps|initializeApp)[\s\S]{0,800}?[\}\]]/gi, '');
  cleaned = cleaned.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  cleaned = cleaned.replace(/(?:\/\/|<!--).*?(?:sourceMappingURL|generated by)[\s\S]{0,100}?/gi, '');
  cleaned = cleaned.replace(/\b(?:window\.currentUser|getIdToken|auth\.signIn)[\s\S]{0,200}?[\)\}]/gi, '');
  cleaned = cleaned.replace(/(?:function|async function)\s+[\w]+[\s\S]{0,500}?\{[\s\S]{0,500}?\}/gi, (m) => {
    if (/console\.log|alert|prompt|fetch\s*\(/.test(m)) return m;
    return '';
  });
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();
  return cleaned;
}

function ensureFollowUpQuestion(answer = "", query = "", options = {}, meta = null) {
  const text = String(answer || "").trim();
  if (!text) return text;
  const cleaned = stripGenericClarificationLines(text)
    .replace(/toi khong gui truc tiep file\s*\.?docx[^.\n]*[.\n]?/gi, "")
    .replace(/luu y:\s*duoi dung la\s*\.?docx[^.\n]*[.\n]?/gi, "")
    .replace(/khong phai\s*\.?dox[^.\n]*[.\n]?/gi, "");
  const sanitized = stripTrailingFollowUpBlocks(
    cleaned.replace(/\n{1,2}Ban co muon toi tra cuu[\s\S]*$/i, "").trim()
  );
  const withEnvelope = enforceLegalMarkdownEnvelope(sanitized, query, meta);
  if (!shouldAskClarification(withEnvelope, query, options.forceAsk === true, meta)) {
    return withEnvelope;
  }
  const key = makeClarificationKey(query);
  const current = Number(clarificationTracker.get(key) || 0);
  if (current >= 3) return withEnvelope;
  clarificationTracker.set(key, current + 1);
  return `${withEnvelope}\n\n${buildContextualFollowUp(query)}`;
}

function enforceTwoTierTerminology(answer = '', query = '') {
  return applyTwoTierPolicy({
    answer,
    query,
    normalizeFn: normalizeVietnamese,
    isCitation: hasCitationIntent(query),
    isComparison: !!parseComparisonTargets(query),
  });
}

function inferDocumentType(query = "") {
  const t = normalizeVietnamese(query);
  if (t.includes('quyet dinh')) return 'QUYET DINH';
  if (t.includes('to trinh')) return 'TO TRINH';
  if (t.includes('thong bao')) return 'THONG BAO';
  if (t.includes('bao cao')) return 'BAO CAO';
  if (t.includes('ke hoach')) return 'KE HOACH';
  if (t.includes('nghi quyet')) return 'NGHI QUYET';
  return 'VAN BAN';
}

function buildExportFilename(query = "") {
  const t = normalizeVietnamese(query);
  if (t.includes('quyet dinh')) return 'Mau_Quyet_Dinh.docx';
  if (t.includes('to trinh')) return 'Mau_To_Trinh.docx';
  if (t.includes('thong bao')) return 'Mau_Thong_Bao.docx';
  if (t.includes('bao cao')) return 'Mau_Bao_Cao.docx';
  return 'Mau_Van_Ban.docx';
}

function buildDocumentBodyFromAnswer(answer = "") {
  const clean = String(answer || "").replace(/\r/g, '').trim();
  return clean.split('\n').map(line => line.trim()).filter(Boolean);
}

function extractPrimaryDraftText(answer = "") {
  const cleaned = stripTrailingFollowUpBlocks(stripGenericClarificationLines(String(answer || ""))).replace(/\r/g, "");
  const codeBlocks = [...cleaned.matchAll(/```(?:[a-zA-Z0-9_-]+)?\n([\s\S]*?)```/g)].map((m) => (m[1] || "").trim()).filter(Boolean);
  const source = codeBlocks.length > 0
    ? codeBlocks.sort((a, b) => b.length - a.length)[0]
    : cleaned;

  const lines = source.split("\n");
  const startIdx = lines.findIndex((line) => {
    const n = normalizeVietnamese(line);
    return /(ten co quan|uy ban nhan dan|so:|cong hoa xa hoi chu nghia viet nam|quyet dinh|ve viec bo nhiem|noi nhan)/.test(n);
  });

  const sliced = (startIdx >= 0 ? lines.slice(startIdx) : lines);
  const result = [];
  for (const rawLine of sliced) {
    const line = String(rawLine || "");
    const n = normalizeVietnamese(line.trim());
    if (/(can cu phap ly ->|cach luu|link tham khao|nguon tham khao|anh chi co can|ban co muon toi|can toi xuat tiep|xuat tiep thanh file word|word \.?docx)/.test(n)) break;
    result.push(line);
  }

  return result.join("\n").trim();
}

function parseDraftLineStyle(rawLine = "") {
  let line = String(rawLine || "").trim();
  if (!line) return { text: "", blank: true, bold: false, italics: false, alignment: AlignmentType.LEFT };
  if (/^[-_]{3,}$/.test(line)) return { text: "", blank: true, bold: false, italics: false, alignment: AlignmentType.LEFT };

  let bold = false;
  let italics = false;

  if (line.startsWith("#")) {
    line = line.replace(/^#+\s*/, "");
    bold = true;
  }

  if (/^\*\*\*.+\*\*\*$/.test(line)) {
    line = line.replace(/^\*\*\*|\*\*\*$/g, "");
    bold = true;
    italics = true;
  } else if (/^\*\*.+\*\*$/.test(line)) {
    line = line.replace(/^\*\*|\*\*$/g, "");
    bold = true;
  } else if (/^\*.+\*$/.test(line)) {
    line = line.replace(/^\*|\*$/g, "");
    italics = true;
  }

  line = line.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1").trim();

  const normalized = normalizeVietnamese(line);
  let alignment = AlignmentType.LEFT;
  if (/^cong hoa xa hoi chu nghia viet nam$/.test(normalized) || /^doc lap - tu do - hanh phuc$/.test(normalized) || /^quyet dinh$/.test(normalized) || normalized.startsWith("ve viec")) {
    alignment = AlignmentType.CENTER;
    bold = true;
  }
 if (line.includes("ngay") && line.includes("thang") && line.includes("nEm")) {
    alignment = AlignmentType.CENTER;
  }

  if (/^noi nhan:?$/i.test(normalized)) {
    bold = true;
  }

  return { text: line, blank: false, bold, italics, alignment };
}

function buildSimpleAdministrativeDocContent(query = "", answer = "") {
  const primary = extractPrimaryDraftText(answer);
  const candidate = primary || stripTrailingFollowUpBlocks(answer);
  const lines = candidate.split("\n").map((line) => line.trimEnd());

  const paragraphs = [];
  for (const raw of lines) {
    const style = parseDraftLineStyle(raw);
    if (style.blank) {
      paragraphs.push(new Paragraph({ children: [new TextRun({ text: "" })] }));
      continue;
    }
    if (!style.text) continue;

    paragraphs.push(new Paragraph({
      alignment: style.alignment,
      spacing: { after: 80, line: 320 },
      children: [
        new TextRun({
          text: style.text,
          bold: style.bold,
          italics: style.italics,
          size: 26,
          font: "Times New Roman"
        })
      ]
    }));
  }

  if (paragraphs.length === 0) {
    const docType = inferDocumentType(query);
    paragraphs.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: `MU ${docType}`, bold: true, size: 28, font: "Times New Roman" })]
    }));
  }

  return paragraphs;
}

function escapeHtml(raw = "") {
  return String(raw || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function decodeNumericHtmlEntities(raw = '') {
  let text = String(raw || '');
  for (let i = 0; i < 2; i += 1) {
    text = text
      .replace(/&amp;#x([0-9a-f]+);/gi, (_, hex) => `&#x${hex};`)
      .replace(/&amp;#([0-9]+);/gi, (_, dec) => `&#${dec};`)
      .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
        const code = parseInt(hex, 16);
        return Number.isFinite(code) ? String.fromCodePoint(code) : '';
      })
      .replace(/&#([0-9]+);/g, (_, dec) => {
        const code = parseInt(dec, 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : '';
      });
  }
  return text;
}

function applyInlineMarkdown(text = "") {
  let html = String(text || "");
  html = html.replace(/&lt;br\s*\/?&gt;/gi, '<br>');

  // 1. Matches citation cards starting at the beginning of a line (e.g. [1] [Title](url) or [1] (url))
  html = html.replace(/^\[(\d+)\]\s+\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (match, num, title, url) => {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="chat-quote-card"><span class="chat-quote-index">${num}</span><span class="chat-quote-text">${title}</span></a>`;
  });
  html = html.replace(/^\[(\d+)\]\s+\((https?:\/\/[^\s)]+)\)/g, (match, num, url) => {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="chat-quote-card"><span class="chat-quote-index">${num}</span><span class="chat-quote-text">Nguồn trích</span></a>`;
  });

  // 2. Matches citation cards starting at the beginning of a line without links: [1] Title
  html = html.replace(/^\[(\d+)\]\s+([^<\n]+)/g, (match, num, title) => {
    return `<span class="chat-quote-card"><span class="chat-quote-index">${num}</span><span class="chat-quote-text">${title.trim()}</span></span>`;
  });

  // 3. Matches standard links (which will be styled as gorgeous blue link pills!): [Text](url)
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="chat-inline-link">$1</a>');

  // 4. Matches bold, italics, code
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
             .replace(/\*([^*]+)\*/g, '<em>$1</em>')
             .replace(/`([^`]+)`/g, '<code>$1</code>');

  return html;
}

function splitTableRow(line = "") {
  let row = String(line || "").trim();
  if (row.startsWith("|")) row = row.slice(1);
  if (row.endsWith("|")) row = row.slice(0, -1);
  return row.split("|").map((cell) => cell.trim());
}

function isSeparatorRow(cells = []) {
  if (!Array.isArray(cells) || cells.length === 0) return false;
  return cells.every((c) => /^:?-{3,}:?$/.test(c.replace(/\s+/g, "")));
}

function renderComparisonTable(blockLines = []) {
  if (!Array.isArray(blockLines) || blockLines.length < 2) return "";
  const headerCells = splitTableRow(blockLines[0]);
  const sepCells = splitTableRow(blockLines[1]);
  if (!isSeparatorRow(sepCells) || headerCells.length === 0) return "";

  const bodyRows = blockLines.slice(2).map(splitTableRow).filter((r) => r.length > 0);
  const normalizedBody = bodyRows.map((row) => {
    if (row.length < headerCells.length) {
      return row.concat(new Array(headerCells.length - row.length).fill(""));
    }
    return row.slice(0, headerCells.length);
  });

  const thead = `<thead><tr>${headerCells.map((c) => `<th>${applyInlineMarkdown(escapeHtml(c))}</th>`).join("")}</tr></thead>`;
  const tbody = `<tbody>${normalizedBody.map((row) => `<tr>${row.map((c) => `<td>${applyInlineMarkdown(escapeHtml(c))}</td>`).join("")}</tr>`).join("")}</tbody>`;

  const isDocInfo = headerCells.some(c => /thông tin|thuộc tính|văn bản|số hiệu/i.test(c));
  const cardTitle = isDocInfo ? "Thông tin văn bản" : "So sánh";

  return `<div class="chat-compare-card"><div class="chat-compare-title">${cardTitle}</div><div class="chat-table-wrap"><table class="chat-compare-table">${thead}${tbody}</table></div></div>`;
}

function renderAssistantRichText(rawText = "") {
  const src = decodeNumericHtmlEntities(String(rawText || "")).replace(/\r/g, "");
  const lines = src.split("\n");
  const chunks = [];
  let i = 0;
  let inList = false;

  while (i < lines.length) {
    const ln = lines[i] || "";
    const trimmed = ln.trim();

    if (trimmed.startsWith("|") && i + 1 < lines.length && String(lines[i + 1] || "").trim().startsWith("|")) {
      if (inList) {
        chunks.push("</ul>");
        inList = false;
      }
      const block = [];
      let j = i;
      while (j < lines.length) {
        const t = String(lines[j] || "").trim();
        if (!t.startsWith("|")) break;
        block.push(t);
        j += 1;
      }
      const tableHtml = renderComparisonTable(block);
      if (tableHtml) {
        chunks.push(tableHtml);
        i = j;
        continue;
      }
    }

    // High-fidelity Markdown list parsing
    if (trimmed.startsWith("* ") || trimmed.startsWith("- ") || trimmed.startsWith("• ")) {
      const content = trimmed.substring(2).trim();
      if (!inList) {
        chunks.push('<ul class="chat-rich-list">');
        inList = true;
      }
      chunks.push(`<li>${applyInlineMarkdown(escapeHtml(content))}</li>`);
      i += 1;
      continue;
    } else {
      if (inList) {
        chunks.push("</ul>");
        inList = false;
      }
    }

    chunks.push(applyInlineMarkdown(escapeHtml(ln)));
    i += 1;
  }

  if (inList) {
    chunks.push("</ul>");
  }

  return chunks.join("<br>");
}

async function exportDraftToDocx(query = "", answer = "") {
  const filename = buildExportFilename(query);
  const children = buildSimpleAdministrativeDocContent(query, answer);

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: 1440,
            right: 1134,
            bottom: 1134,
            left: 1800
          }
        }
      },
      children
    }]
  });
  const blob = await Packer.toBlob(doc);
  saveAs(blob, filename);
}

function detectSkillMatch(skill, rawText, normalizedText) {
  if (!skill?.triggers || !Array.isArray(skill.triggers) || skill.triggers.length === 0) {
    return false;
  }

  return skill.triggers.some((trigger) => {
    const token = String(trigger || '').toLowerCase().trim();
    if (!token) return false;
    return rawText.includes(token) || normalizedText.includes(normalizeVietnamese(token));
  });
}

function buildSkillReferenceContext(skill) {
  if (!skill?.references || typeof skill.references !== 'object') {
    return '';
  }

  const referenceEntries = Object.entries(skill.references)
    .filter(([, content]) => typeof content === 'string' && content.trim().length > 0)
    .slice(0, 5);

  if (referenceEntries.length === 0) {
    return '';
  }

  const renderedReferences = referenceEntries.map(([fileName, content]) => {
    const compactContent = content.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();
    const excerpt = compactContent.length > 4000
 ? `${compactContent.slice(0, 4000)}\n...[Rut gon n"i dung tham chieu]...`
      : compactContent;
 return `#### Tai lieu: ${fileName}\n${excerpt}`;
  }).join('\n\n');

 return `\n### Tai lieu tham chieu\n${renderedReferences}\n`;
}

function extractPotentialDocNumber(text = '') {
  // Match patterns like: 117/2025/QH15, 30/2024/ND-CP, 15/2024/Q-BTC
  const match = String(text || '').match(/\b\d+\/\d{4}\/[A-Z0-9-]+\b/i);
  return match ? match[0].toUpperCase() : null;
}

function extractPartialDocNumber(text = '') {
  const match = String(text || '').match(/\b\d{1,4}\/\d{4}\b/i);
  return match ? String(match[0] || '').toUpperCase() : null;
}

function inferRequestedDocType(text = '') {
  const n = normalizeVietnamese(text);
  if (LEGAL_DOC_TYPE_PATTERNS.thong_tu_lien_tich.test(n)) return 'thong_tu_lien_tich';
  if (LEGAL_DOC_TYPE_PATTERNS.nghi_quyet.test(n)) return 'nghi_quyet';
  if (LEGAL_DOC_TYPE_PATTERNS.phap_lenh.test(n)) return 'phap_lenh';
  if (LEGAL_DOC_TYPE_PATTERNS.nghi_dinh.test(n)) return 'nghi_dinh';
  if (LEGAL_DOC_TYPE_PATTERNS.thong_tu.test(n)) return 'thong_tu';
  if (LEGAL_DOC_TYPE_PATTERNS.quyet_dinh.test(n)) return 'quyet_dinh';
  if (LEGAL_DOC_TYPE_PATTERNS.chi_thi.test(n)) return 'chi_thi';
  if (LEGAL_DOC_TYPE_PATTERNS.luat.test(n)) return 'luat';
  if (LEGAL_DOC_TYPE_PATTERNS.giay_moi.test(n)) return 'giay_moi';
  return null;
}

function buildNeedFullDocNumberMessage(rawUserText = '', requestedDocType = '', partialDocNumber = '') {
  const topic = String(rawUserText || '').trim() || 'yeu cau nay';
  const docTypeLabel = ({
    luat: 'luật',
    nghi_dinh: 'nghị định',
    thong_tu: 'thông tư',
    nghi_quyet: 'nghị quyết',
    thong_tu_lien_tich: 'thông tư liên tịch',
    phap_lenh: 'pháp lệnh',
    quyet_dinh: 'quyết định',
    chi_thi: 'chỉ thị',
    giay_moi: 'giấy mời',
  }[requestedDocType] || 'văn bản');
  const shortNo = String(partialDocNumber || '').trim();
  const hint = shortNo ? ` "${shortNo}"` : '';
  return `Tôi chưa thể kết luận chính xác cho yêu cầu "${topic}" vì số hiệu${hint} chưa đủ để xác định đúng ${docTypeLabel}. Vui lòng cung cấp số hiệu đầy đủ hoặc năm ban hành để tôi tra cứu đúng văn bản.`;
}

function buildDocTypeMismatchMessage(rawUserText = '', requestedDocType = '', fullDocNumber = '') {
  const topic = String(rawUserText || '').trim() || 'yeu cau nay';
  const docTypeLabel = ({
    luat: 'Luat',
    nghi_dinh: 'Nghi dinh',
    thong_tu: 'Thong tu',
    thong_tu_lien_tich: 'Thong tu lien tich',
    phap_lenh: 'Phap lenh',
    nghi_quyet: 'Nghi quyet',
    chi_thi: 'Chi thi',
    quyet_dinh: 'Quyet dinh',
    giay_moi: 'Giay moi',
  }[requestedDocType] || 'van ban');
  const docLabel = fullDocNumber ? ` co so hieu ${fullDocNumber}` : '';
  return `Không tìm thấy kết quả khớp đúng loại ${docTypeLabel}${docLabel} cho yêu cầu "${topic}" trong dữ liệu tra cứu hiện tại. Tôi không thể kết luận bằng văn bản khác loại.`;
}

function shouldUseStrictRejection(rawUserText = '', searchContext = {}) {
  // Best-effort mode: never hard-reject search answers.
  return false;
}

function shouldRequireFullDocNumber(query = '', searchContext = {}) {
  const n = normalizeVietnamese(query);
  const hasStatusKeyword = /(thay the|hieu luc|con hieu luc|moi nhat|co gi moi|ban hanh|ngay ban hanh|ngay hieu luc)/i.test(n);
  if (hasStatusKeyword) {
    return false;
  }
  return !!(
    searchContext?.requestedDocType
    && searchContext?.docNumberMatchLevel === 'partial'
    && !searchContext?.effectiveDocNumber
  );
}

function resolveWebSearchContext(rawUserText = '', expectedDocNumber = null) {
  const fullDocNumber = expectedDocNumber || extractPotentialDocNumber(rawUserText);
  const partialDocNumber = extractPartialDocNumber(rawUserText);
  const requestedDocType = inferRequestedDocType(rawUserText);
  const docNumberMatchLevel = fullDocNumber ? 'full' : (partialDocNumber ? 'partial' : 'none');
  const baseContext = {
    requestedDocType,
    partialDocNumber: partialDocNumber || null,
    fullDocNumber: fullDocNumber || null,
    docNumberMatchLevel,
  };

  const directDocNumber = fullDocNumber;
  if (directDocNumber) {
    return {
      ...baseContext,
      effectiveQuery: rawUserText,
      effectiveDocNumber: directDocNumber,
    };
  }

  const normalized = normalizeVietnamese(rawUserText);
  const isFollowupRef = /(luat tren|van ban tren|luat nay|van ban nay|noi dung uy quyen cua luat tren|cua luat tren|tren la gi|chi tiet|uy quyen|phan cap|phan quyen|dieu\s*\d+|hieu luc|ngay ban hanh|liet ke|toan bo cac dieu|toan bo dieu|cac dieu|dieu khoan|noi dung day du|toan van|nguyen van)/.test(normalized);
  const hasNewExplicitDoc = requestedDocType && partialDocNumber;
  if (!isFollowupRef || hasNewExplicitDoc) {
    return {
      ...baseContext,
      effectiveQuery: rawUserText,
      effectiveDocNumber: null,
    };
  }

  const contextDocNumber = extractPotentialDocNumber(`${lastUserQuery || ''} ${lastAssistantReply || ''}`) || String(lastResolvedDocNumber || '').toUpperCase() || null;
  if (!contextDocNumber) {
    return {
      ...baseContext,
      effectiveQuery: rawUserText,
      effectiveDocNumber: null,
    };
  }
  return {
    ...baseContext,
    effectiveQuery: `${rawUserText} ${contextDocNumber}`,
    effectiveDocNumber: contextDocNumber,
  };
}

function buildKnownDocumentHeader(knownDoc) {
  if (!knownDoc || !knownDoc.documentNumber) return '';

  const docNo = knownDoc.documentNumber;
  const title = knownDoc.titleHint || knownDoc.trich_yeu || 'Thông tin văn bản';
  const issuer = knownDoc.issuer || knownDoc.co_quan_ban_hanh || 'Đang cập nhật';
  const ngayBanHanh = knownDoc.ngay_ban_hanh || 'Đang cập nhật';
  const ngayHieuLuc = knownDoc.ngay_hieu_luc || 'Đang cập nhật';

  let tinhTrang = knownDoc.tinh_trang_hieu_luc || 'Đang cập nhật';
  if (tinhTrang === 'co_hieu_luc' || tinhTrang === 'Có hiệu lực') {
    tinhTrang = '🟢 Có hiệu lực';
  } else if (tinhTrang === 'het_hieu_luc' || tinhTrang === 'Hết hiệu lực') {
    tinhTrang = '🔴 Hết hiệu lực';
  } else if (tinhTrang === 'ngung_hieu_luc' || tinhTrang === 'Ngưng hiệu lực') {
    tinhTrang = '🟡 Ngưng hiệu lực/Tạm hoãn';
  }

  const thayThe = Array.isArray(knownDoc.thay_the_cho)
    ? knownDoc.thay_the_cho.join(', ')
    : (knownDoc.thay_the_cho || '');

  const lines = [
    `| Thuộc tính | Chi tiết văn bản |`,
    `|---|---|`,
    `| **Số hiệu** | ${docNo} |`,
    `| **Tên văn bản / Trích yếu** | ${title} |`,
    `| **Cơ quan ban hành** | ${issuer} |`,
    `| **Ngày ban hành** | ${ngayBanHanh} |`,
    `| **Ngày có hiệu lực** | ${ngayHieuLuc} |`,
    `| **Tình trạng hiệu lực** | ${tinhTrang} |`
  ];

  if (thayThe) {
    lines.push(`| **Thay thế cho** | ${thayThe} |`);
  }
  if (knownDoc.tom_tat_chinh_sach) {
    let tomTat = '';
    if (Array.isArray(knownDoc.tom_tat_chinh_sach)) {
      tomTat = knownDoc.tom_tat_chinh_sach.map((item, idx) => `${idx + 1}. ${item}`).join('<br>');
    } else {
      const rawTomTat = String(knownDoc.tom_tat_chinh_sach || '');
      tomTat = rawTomTat.replace(/\s+(\d+\.\s+)/g, '<br>$1');
    }
    lines.push(`| **Tóm tắt chính sách** | ${tomTat} |`);
  }

  return lines.join('\n') + '\n\n';
}

function prependHeaderIfAvailable(answer, meta) {
  if (!meta || !meta.known_document) return answer;
  const docNo = meta.known_document.documentNumber;
  if (!docNo) return answer;
  
  // Prevent duplicate prepending
  if (answer.includes(docNo) && answer.includes('Thuộc tính') && answer.includes('Chi tiết văn bản')) {
    return answer;
  }
  const header = buildKnownDocumentHeader(meta.known_document);
  return header + answer;
}

function shouldForceContextualWebSearch(rawUserText = '', searchContext = {}) {
  if (!searchContext?.effectiveDocNumber) return false;
  const n = normalizeVietnamese(rawUserText);
  return /(uy quyen|phan cap|phan quyen|chi tiet|noi dung|dieu\s*\d+|hieu luc|ngay ban hanh|diem moi|co gi moi|toan van|luat tren|van ban tren|luat nay|van ban nay|liet ke|toan bo cac dieu|toan bo dieu|cac dieu|dieu khoan|noi dung day du|nguyen van|so sanh|doi chieu|quy dinh ve|dieu kien|trinh tu|thu tuc|xu phat|bieu mau)/.test(n);
}

function rememberResolvedDocNumber(searchContext = {}, text = '') {
  const fromContext = String(searchContext?.effectiveDocNumber || '').trim().toUpperCase();
  if (fromContext) {
    lastResolvedDocNumber = fromContext;
    try {
      sessionStorage.setItem('vbai_last_resolved_doc', lastResolvedDocNumber);
    } catch {}
    return;
  }
  const extracted = extractPotentialDocNumber(text);
  if (extracted) {
    lastResolvedDocNumber = extracted;
    try {
      sessionStorage.setItem('vbai_last_resolved_doc', lastResolvedDocNumber);
    } catch {}
  }
}

function parseWebSearchMarkdownItems(searchResults = '') {
  const lines = String(searchResults || '').split('\n');
  const items = [];
  for (const line of lines) {
    const m = line.match(/^\s*-\s*\[(.*?)\]\((.*?)\)\s*:\s*(.*)$/);
    if (!m) continue;
    items.push({
      title: String(m[1] || '').trim(),
      link: String(m[2] || '').trim(),
      snippet: String(m[3] || '').trim(),
    });
  }
  return items;
}

function isDelegationFocusQuery(text = '') {
  const n = normalizeVietnamese(text);
  return /(uy quyen|phan cap|phan quyen)/.test(n);
}

function shouldUseEvidenceResponse(rawUserText = '', searchContext = {}, searchResults = '', webSearchMeta = null) {
  if (!searchContext?.effectiveDocNumber) return false;
  if (!String(searchResults || '').trim()) return false;
  if (isSubstantiveUpdateQuery(rawUserText, searchContext)) return false;
  
  // Prevent dry evidence bypass for detailed analytical or delegation queries
  if (isDelegationFocusQuery(rawUserText) || isDetailedLegalIntent(rawUserText, searchContext) || parseComparisonTargets(rawUserText)) {
    return false;
  }

  const docNo = String(searchContext.effectiveDocNumber || '').toUpperCase();
  const hasDocNoInResults = String(searchResults || '').toUpperCase().includes(docNo);
  if (webSearchMeta?.exact_match !== true && !hasDocNoInResults) return false;
  if (searchContext?.requestedDocType && webSearchMeta?.type_match === false) return false;
  if (typeof webSearchMeta?.confidence === 'number' && webSearchMeta.confidence < 0.85) return false;
  const n = normalizeVietnamese(rawUserText);
  return /(luat|van ban|so hieu|uy quyen|phan cap|phan quyen|ngay ban hanh|hieu luc|toan van)/.test(n);
}

function buildEvidenceResponse(rawUserText = '', searchContext = {}, searchResults = '') {
  const docNo = searchContext?.effectiveDocNumber || '';
  const items = parseWebSearchMarkdownItems(searchResults).slice(0, 5);
  const normalizedQuery = normalizeVietnamese(rawUserText);
  const wantsDelegation = /(uy quyen|phan cap|phan quyen)/.test(normalizedQuery);

  const lines = [];
  lines.push(`Đã xác nhận có văn bản ${docNo} trong dữ liệu tra cứu mới nhất từ Internet.`);

  if (wantsDelegation) {
    const related = items.filter((it) => /(uy quyen|phan cap|phan quyen)/i.test(`${it.title} ${it.snippet}`));
    if (related.length > 0) {
      lines.push('Nội dung liên quan đến ủy quyền/phân cấp tìm thấy:');
      related.slice(0, 3).forEach((it) => {
        lines.push(`- ${it.title}: ${it.snippet}`);
      });
    } else {
      lines.push('Các kết quả đã xác nhận văn bản tồn tại, nhưng đoạn trích hiện tại chưa trả về trực tiếp cụm "ủy quyền".');
      lines.push('Bạn có thể mở các nguồn toàn văn bên dưới, tôi sẽ tiếp tục trích đúng điều/khoản ủy quyền ngay sau khi bạn xác nhận nguồn ưu tiên.');
    }
  }

  if (items.length > 0) {
    lines.push('Nguồn xác nhận:');
    items.forEach((it) => {
      lines.push(`- ${it.link}`);
    });
  }

  return lines.join('\n');
}

function isDetailedLegalIntent(rawUserText = '', searchContext = {}) {
  const n = normalizeVietnamese(rawUserText);
  if (parseComparisonTargets(rawUserText) || hasBroadComparisonIntent(rawUserText)) return false;
  if (hasCitationIntent(rawUserText)) return false;
  if (/(toan van|nguyen van|chi tiet|day du noi dung|toan bo noi dung|nguyen ban)/.test(n)) return true;
  if (/(liet ke|danh sach|dan ra|ke ra|toan bo cac dieu|toan bo dieu|cac dieu|dieu khoan|chuong dieu)/.test(n)) return true;
  if (/(neu ro|neu cu the|noi dung cu the|noi dung gi|noi dung chinh|quy dinh gi|quy dinh nhu the nao|trinh bay noi dung|mo ta noi dung|dieu kien|trinh tu|thu tuc|xu phat|bieu mau|huong dan)/.test(n)) return true;
  if (
    searchContext?.effectiveDocNumber
    && /(co gi moi|diem moi|noi dung moi|moi gi|thay doi gi|quy dinh moi|diem sua doi|diem bo sung)/.test(n)
  ) {
    return true;
  }
  if (searchContext?.effectiveDocNumber && /(dieu\s*\d+|khoan\s*\d+|diem\s*[a-z])/.test(n)) return false;
  return false;
}

async function extractLegalAgentContextFromLinks(links = [], keywords = [], options = {}) {
  for (const link of links) {
    try {
      const extracted = await sendLegalAgentRequest(link, keywords, options);
      const text = String(extracted?.text || '').trim();
      if (!text) continue;
      return {
        text,
        link,
        extract_mode: String(extracted?.extract_mode || '').trim(),
      };
    } catch (err) {
      console.warn('Legal agent extraction skipped:', err?.message || err);
    }
  }
  return null;
}

async function buildDetailedLegalAgentAnswer(rawUserText = '', searchContext = {}, searchResults = '', webSearchMeta = null) {
  if (!isDetailedLegalIntent(rawUserText, searchContext)) return '';
  const items = parseWebSearchMarkdownItems(searchResults);
  if (items.length === 0) return '';

  const docNo = String(searchContext?.effectiveDocNumber || '').trim().toUpperCase();
  const prioritizedItems = items
    .filter((it) => !docNo || `${it.title} ${it.snippet} ${it.link}`.toUpperCase().includes(docNo))
    .sort((a, b) => {
      const aHost = (() => { try { return new URL(String(a?.link || ''), 'https://vbpl.vn').hostname.replace(/^www\./, ''); } catch { return ''; } })();
      const bHost = (() => { try { return new URL(String(b?.link || ''), 'https://vbpl.vn').hostname.replace(/^www\./, ''); } catch { return ''; } })();
      const aOfficial = getSourceTierLabelFromHost(aHost) === 'Chinh thuc';
      const bOfficial = getSourceTierLabelFromHost(bHost) === 'Chinh thuc';
      if (aOfficial !== bOfficial) return aOfficial ? -1 : 1;
      const priorityDiff = getCanonicalLegalSourcePriority(aHost) - getCanonicalLegalSourcePriority(bHost);
      if (priorityDiff !== 0) return priorityDiff;
      return 0;
    })
    .slice(0, 5);
  const workingItems = prioritizedItems.length > 0 ? prioritizedItems : items.slice(0, 5);
  const links = Array.from(new Set(workingItems.map((it) => String(it.link || '').trim()).filter(Boolean)));
  if (links.length === 0) return '';

  const bestTitle = String(workingItems[0]?.title || '').trim();
  const keywords = [
    docNo,
    bestTitle,
    rawUserText,
  ].filter(Boolean);

  const retrieval = await extractLegalAgentContextFromLinks(links, keywords, {
    strict: false,
    maxChars: 24000,
  });
  if (!retrieval || !String(retrieval.text || '').trim()) return '';

  const sourceLine = extractPrimarySourceLine(webSearchMeta) || `Nguồn: ${retrieval.link}`;
  const guidanceLines = [
    'Ban la “CHATBOT TRA CUU VBPL” — tro ly phap luat chuyen sau ve he thong VBPL Viet Nam.',
    'Nhiem vu: dua tren noi dung phap ly da trich xuat tu nguon web, tra loi day du, chinh xac, uu tien phien ban moi nhat va nguon chinh thuc.',
    'Khong duoc lam mat noi dung quan trong khi rut gon cach trinh bay.',
    'Neu cau hoi yeu cau noi dung chi tiet/nguyen van, uu tien giu du noi dung trong pham vi du lieu da co.',
    'Neu du lieu chua du de ket luan mot y quan trong, noi ro chua du can cu va khong suy doan.',
    'Bat buoc ghi ro tinh trang hieu luc neu du lieu trich xuat cho phep xac dinh.',
    'Bat buoc tra loi bang markdown voi cau truc sau:',
    '## Tóm tắt',
    '- Tối đa 120 từ.',
    '',
    '### Thông tin chi tiết / Phân tích',
    '- Trinh bay ro theo y chinh; neu co the thi dan chieu dieu/khoan/diem.',
    '- Neu trich dan duoc, dung dang: **Theo Số [x], Điều [y], Khoản [z]**: [Nội dung trích dẫn].',
    '- Nêu rõ nguồn văn bản và đường dẫn đã dùng.',
    '',
    '### Giải thích / Hướng dẫn thêm nếu cần',
    '- Chi them muc nay khi thuc su can de lam ro cach hieu/ap dung.',
    '',
    '---',
    'Checklist (5 mục): Trích dẫn đầy đủ; hiệu lực đúng; nguồn chính thức; tóm tắt chuẩn; không suy đoán.',
    'Khong chen ma nguon, khong chen noi dung ngoai pham vi cau hoi, khong lap lai cau hoi nguyen van.'
  ];

  const isArticleListingRequest = /(liet ke|danh sach|toan bo cac dieu|toan bo dieu|cac dieu|dieu khoan)/.test(normalizeVietnamese(rawUserText));
  if (isArticleListingRequest) {
    const articleListingAnswer = buildArticleListingAnswer(rawUserText, retrieval.text, sourceLine);
    logLegalArticleDebug('detailed-answer:article-listing-attempt', {
      requested: true,
      success: Boolean(articleListingAnswer),
      retrievalLink: retrieval.link,
      extractMode: retrieval.extract_mode || 'legal_agent',
      textLength: String(retrieval.text || '').length,
    });
    if (articleListingAnswer) return articleListingAnswer;
  }

  const synthesisMessages = [
    {
      role: 'system',
      content: [
        ...guidanceLines,
        searchContext?.effectiveDocNumber ? `So hieu dang uu tien doi chieu: ${searchContext.effectiveDocNumber}` : '',
        bestTitle ? `Tieu de uu tien doi chieu: ${bestTitle}` : '',
        retrieval.link ? `Nguon uu tien: ${retrieval.link}` : '',
      ].filter(Boolean).join('\n')
    },
    ...getConversationalMemory(),
    {
      role: 'user',
      content: [
        `Yeu cau nguoi dung: ${rawUserText}`,
        docNo ? `So hieu van ban: ${docNo}` : '',
        bestTitle ? `Tieu de uu tien: ${bestTitle}` : '',
        `Nguon trich xuat: ${retrieval.link}`,
        `Che do trich xuat: ${retrieval.extract_mode || 'legal_agent'}`,
        'Noi dung trich xuat:',
        retrieval.text,
      ].filter(Boolean).join('\n\n')
    }
  ];

  let answer = '';
  try {
    answer = await sendChatRequest(synthesisMessages, currentModelName, {
      context: 'chat',
      stream: false,
      temperature: 0.1,
    });
  } catch (err) {
    console.warn('Detailed legal agent synthesis failed:', err?.message || err);
    answer = '';
  }

  const cleaned = String(answer || '').trim();
  if (!cleaned) {
    return `${retrieval.text}\n\n${sourceLine}`;
  }
  return `${cleaned}\n\n${sourceLine}`;
}

function isSubstantiveUpdateQuery(rawUserText = '', searchContext = {}) {
  const n = normalizeVietnamese(rawUserText);
  if (!searchContext?.effectiveDocNumber) return false;
  if (hasCitationIntent(rawUserText)) return false;
  if (parseComparisonTargets(rawUserText) || hasBroadComparisonIntent(rawUserText)) return false;
  if (/(toan van|nguyen van|trich dan|dieu\s*\d+|khoan\s*\d+|diem\s*[a-z])/.test(n)) return false;
  return /(co gi moi|co gi moi hay khong|diem moi|noi dung moi|moi gi|thay doi gi|quy dinh moi|diem sua doi|diem bo sung)/.test(n);
}

async function extractBroadLegalContextFromLinks(links = [], keywords = []) {
  for (const link of links) {
    try {
      const extracted = await sendWebExtractRequest(link, keywords, { strict: false });
      const text = String(extracted?.text || '').replace(/\s+/g, ' ').trim();
      if (text.length >= 400) {
        return { text, link, extracted: extracted?.extracted === true };
      }
    } catch (err) {
      console.warn('Broad legal extraction skipped:', err?.message || err);
    }
  }
  return null;
}

async function buildSubstantiveUpdateAnswer(rawUserText = '', searchContext = {}, searchResults = '', webSearchMeta = null) {
  if (!isSubstantiveUpdateQuery(rawUserText, searchContext)) return '';
  const items = parseWebSearchMarkdownItems(searchResults);
  if (items.length === 0) return '';

  const docNo = String(searchContext?.effectiveDocNumber || '').trim().toUpperCase();
  const prioritizedItems = items
    .filter((it) => !docNo || `${it.title} ${it.snippet} ${it.link}`.toUpperCase().includes(docNo))
    .sort((a, b) => {
      const aHost = (function() { try { return new URL(String(a?.link || ''), 'https://vbpl.vn').hostname.replace(/^www\./, ''); } catch { return ''; }})();
      const bHost = (function() { try { return new URL(String(b?.link || ''), 'https://vbpl.vn').hostname.replace(/^www\./, ''); } catch { return ''; }})();
      const aOfficial = getSourceTierLabelFromHost(aHost) === 'Chinh thuc';
      const bOfficial = getSourceTierLabelFromHost(bHost) === 'Chinh thuc';
      if (aOfficial !== bOfficial) return aOfficial ? -1 : 1;
      return 0;
    })
    .slice(0, 5);
  const workingItems = prioritizedItems.length > 0 ? prioritizedItems : items.slice(0, 5);
  const links = Array.from(new Set(workingItems.map((it) => String(it.link || '').trim()).filter(Boolean)));
  if (links.length === 0) return '';

  const bestTitle = String(workingItems[0]?.title || '').trim();
  const broadHit = await extractBroadLegalContextFromLinks(links, [
    docNo,
    bestTitle,
    'noi dung moi',
    'quy dinh moi',
    'sua doi',
    'bo sung',
    'hieu luc',
  ].filter(Boolean));

  if (!broadHit || !String(broadHit.text || '').trim()) {
    const sourceLine = extractPrimarySourceLine(webSearchMeta) || (links[0] ? `Nguồn: ${links[0]}` : '');
    const fallbackSnippet = workingItems
      .filter((it) => {
        try {
          const host = new URL(String(it?.link || ''), 'https://vbpl.vn').hostname.replace(/^www\./, '');
          return getSourceTierLabelFromHost(host) === 'Chinh thuc';
        } catch {
          return false;
        }
      })
      .slice(0, 5)
      .map((it) => `- [${it.title}](${it.link})`)
      .join('\n');
    return [
      `Tôi đã tìm thấy đúng văn bản ${docNo || 'bạn hỏi'}, nhưng chưa trích xuất đủ nội dung toàn văn để kết luận trọn vẹn các điểm mới.`,
      fallbackSnippet ? `Các nguồn chính thống nên xem trước:\n${fallbackSnippet}` : '',
      sourceLine,
    ].filter(Boolean).join('\n\n');
  }

  const summarizationMessages = [
    {
      role: 'system',
      content: [
        'Ban la tro ly tra cuu VBPL Viet Nam.',
        'Nhiem vu: dua tren van ban/ngu canh da extract tu nguon chinh thong, tra loi dung cau hoi "co gi moi" bang cac diem noi dung thuc chat.',
        'Chi duoc dua vao du lieu duoc cung cap. Khong duoc chi noi rang co ton tai van ban.',
        'Hay liet ke 3-7 y moi/noi dung chinh ro rang, ngan gon, uu tien dang gach dau dong.',
        'Neu du lieu chua du de ket luan tat ca diem moi, noi ro "Chua trich xuat du du lieu de ket luan day du" o cuoi, nhung van phai neu nhung diem da thay ro trong doan trich.',
        'Khong chen heading, khong chen checklist, khong lap lai cau hoi.'
      ].join('\n')
    },
    ...getConversationalMemory(),
    {
      role: 'user',
      content: [
        `Yeu cau nguoi dung: ${rawUserText}`,
        searchContext?.effectiveDocNumber ? `So hieu van ban: ${searchContext.effectiveDocNumber}` : '',
        bestTitle ? `Tieu de ket qua uu tien: ${bestTitle}` : '',
        `Nguon trich xuat: ${broadHit.link}`,
        'Noi dung trich xuat tu nguon:',
        broadHit.text.slice(0, 6000),
      ].filter(Boolean).join('\n\n')
    }
  ];

  let summary = '';
  try {
    summary = await sendChatRequest(summarizationMessages, currentModelName, {
      context: 'chat',
      stream: false,
      temperature: 0.1,
    });
  } catch (err) {
    console.warn('Substantive update summarization failed:', err?.message || err);
    summary = '';
  }

  const cleanedSummary = String(summary || '').trim();
  if (!cleanedSummary) {
    const excerpt = broadHit.text.slice(0, 1200).trim();
    return [
      `Tôi đã tìm được nội dung liên quan của văn bản ${docNo || ''} nhưng chưa tổng hợp tự động ổn định các điểm mới.`,
      excerpt ? `Đoạn trích gần nhất:\n- ${excerpt}` : '',
      `Nguồn: ${broadHit.link}`,
    ].filter(Boolean).join('\n\n');
  }

  return `${cleanedSummary}\n\nNguồn: ${broadHit.link}`;
}

function parseLegalCitationTarget(text = '') {
  const n = normalizeVietnamese(text);
  const articleMatch = n.match(/\bdieu\s+(\d+)\b/);
  const clauseMatch = n.match(/\bkhoan\s+(\d+)\b/);
  const pointMatch = n.match(/\bdiem\s+([a-z])(?:\)|\b)/);
  return {
    article: articleMatch ? Number(articleMatch[1]) : null,
    clause: clauseMatch ? Number(clauseMatch[1]) : null,
    point: pointMatch ? pointMatch[1] : null,
  };
}

function hasCitationIntent(text = '') {
  const n = normalizeVietnamese(text);
  return /\b(trich|trich dan|trich dung|noi dung|chi tiet)\b/.test(n) && /\b(dieu|khoan|diem)\b/.test(n);
}

function extractUniqueLinksFromSearchResults(searchResults = '', limit = 5) {
  const items = parseWebSearchMarkdownItems(searchResults);
  return Array.from(new Set(items.map((it) => String(it.link || '').trim()).filter(Boolean))).slice(0, limit);
}

function sanitizeTableCell(text = '') {
  return String(text || '')
    .replace(/\r?\n+/g, '<br>')
    .replace(/\|/g, '\\|')
    .trim();
}

function parseComparisonTargets(text = '') {
  const n = normalizeVietnamese(text);
  if (!/(so sanh|doi chieu)/.test(n)) return null;

  const clausePattern = /\bkhoan\s+(\d+)\s+dieu\s+(\d+)\s+(?:voi|va|vs)\s+khoan\s+(\d+)\s+dieu\s+(\d+)\b/;
  const clauseMatch = n.match(clausePattern);
  if (clauseMatch) {
    return {
 left: { article: Number(clauseMatch[2]), clause: Number(clauseMatch[1]), point: null, label: `Khoan ${clauseMatch[1]} Dieu ${clauseMatch[2]}` },
 right: { article: Number(clauseMatch[4]), clause: Number(clauseMatch[3]), point: null, label: `Khoan ${clauseMatch[3]} Dieu ${clauseMatch[4]}` },
    };
  }

  const articlePattern = /\bdieu\s+(\d+)\s+(?:voi|va|vs)\s+dieu\s+(\d+)\b/;
  const articleMatch = n.match(articlePattern);
  if (articleMatch) {
    return {
 left: { article: Number(articleMatch[1]), clause: null, point: null, label: `Dieu ${articleMatch[1]}` },
 right: { article: Number(articleMatch[2]), clause: null, point: null, label: `Dieu ${articleMatch[2]}` },
    };
  }
  return null;
}

async function extractStrictCitationFromLinks(links = [], target = {}, docNumber = '') {
  for (const link of links) {
    try {
      const extracted = await sendWebExtractRequest(
        link,
        [
          `Dieu ${target.article || ''}`.trim(),
          `Khoan ${target.clause || ''}`.trim(),
          `Diem ${target.point || ''}`.trim(),
          String(docNumber || '').trim(),
        ].filter(Boolean),
        {
          strict: true,
          targetArticle: target.article,
          targetClause: target.clause,
          targetPoint: target.point,
        },
      );
      if (extracted?.strict_match === true && String(extracted?.text || '').trim()) {
        return {
          text: String(extracted.text || '').trim(),
          link,
        };
      }
    } catch (err) {
      console.warn('Strict citation extraction skipped:', err?.message || err);
    }
  }
  return null;
}

async function buildStrictCitationResponse(rawUserText = '', searchContext = {}, searchResults = '') {
  if (!hasCitationIntent(rawUserText)) return '';
  const target = parseLegalCitationTarget(rawUserText);
  if (!target.article && !target.clause && !target.point) return '';
  const targetLabel = [
    target.point ? `diem ${target.point}` : null,
    target.clause ? `khoan ${target.clause}` : null,
    target.article ? `dieu ${target.article}` : null,
  ].filter(Boolean).join(' ');
  const docLabel = searchContext?.effectiveDocNumber ? ` cua van ban ${searchContext.effectiveDocNumber}` : '';

  const links = extractUniqueLinksFromSearchResults(searchResults, 6);
  if (links.length === 0) {
    return `Chưa tìm thấy trích dẫn chính xác cho ${targetLabel}${docLabel} trong dữ liệu tra cứu hiện tại. Vui lòng cung cấp rõ số hiệu văn bản hoặc nguồn toàn văn chính thức để tôi trích đúng nguyên văn.`;
  }

  const strictHit = await extractStrictCitationFromLinks(links, target, searchContext?.effectiveDocNumber || '');
  if (!strictHit) {
    return `Chưa tìm thấy trích dẫn chính xác cho ${targetLabel}${docLabel} trong dữ liệu tra cứu hiện tại. Vui lòng cung cấp rõ số hiệu văn bản hoặc nguồn toàn văn chính thức để tôi trích đúng nguyên văn.`;
  }

  const targetTitle = [
    target.point ? `Diem ${target.point}` : null,
    target.clause ? `Khoan ${target.clause}` : null,
    target.article ? `Dieu ${target.article}` : null,
  ].filter(Boolean).join(' ');
  return [
    `Trích dẫn chính xác ${targetTitle}${searchContext?.effectiveDocNumber ? ` (${searchContext.effectiveDocNumber})` : ''}:`,
    `- ${strictHit.text}`,
    `Nguồn trích: ${strictHit.link}`,
  ].join('\n');
}

async function buildComparisonTableResponse(rawUserText = '', searchContext = {}, searchResults = '') {
  const comparison = parseComparisonTargets(rawUserText);
  if (!comparison) return '';

  const links = extractUniqueLinksFromSearchResults(searchResults, 6);
  if (links.length === 0) {
    return `Chưa đủ dữ liệu để so sánh chính xác ${comparison.left.label} và ${comparison.right.label}. Vui lòng cung cấp số hiệu văn bản rõ hơn hoặc đường dẫn toàn văn chính thức.`;
  }

  const leftHit = await extractStrictCitationFromLinks(links, comparison.left, searchContext?.effectiveDocNumber || '');
  const rightHit = await extractStrictCitationFromLinks(links, comparison.right, searchContext?.effectiveDocNumber || '');
  if (!leftHit || !rightHit) {
    return `Chưa đủ dữ liệu để so sánh chính xác ${comparison.left.label} và ${comparison.right.label}. Vui lòng cung cấp số hiệu văn bản rõ hơn hoặc đường dẫn toàn văn chính thức.`;
  }

  const header = `| ${sanitizeTableCell(comparison.left.label)} | ${sanitizeTableCell(comparison.right.label)} |\n|---|---|`;
  const row = `| ${sanitizeTableCell(leftHit.text)} | ${sanitizeTableCell(rightHit.text)} |`;
  return [
    `So sánh chính xác theo dữ liệu tra cứu${searchContext?.effectiveDocNumber ? ` (${searchContext.effectiveDocNumber})` : ''}:`,
    header,
    row,
    `Nguồn A: ${leftHit.link}`,
    `Nguồn B: ${rightHit.link}`,
  ].join('\n');
}

async function buildDelegationFocusedEvidenceResponse(rawUserText = '', searchContext = {}, searchResults = '') {
  const base = buildEvidenceResponse(rawUserText, searchContext, searchResults);
  if (!isDelegationFocusQuery(rawUserText)) return base;

  const items = parseWebSearchMarkdownItems(searchResults);
  const links = Array.from(new Set(items.map((it) => String(it.link || '').trim()).filter(Boolean))).slice(0, 3);
  if (links.length === 0) return base;

  for (const link of links) {
    try {
      const extracted = await sendWebExtractRequest(link, [
        'dieu 14',
        'uy quyen',
        'phan cap',
        'phan quyen',
        String(searchContext?.effectiveDocNumber || ''),
      ], {
        strict: true,
        targetArticle: 14,
      });
      const text = String(extracted?.text || '').trim();
      if (!text) continue;
      const cleaned = text.replace(/\s+/g, ' ').trim();
      if (cleaned.length < 80) continue;
      return [
        `Đã xác nhận có văn bản ${searchContext?.effectiveDocNumber || ''} trong dữ liệu tra cứu mới nhất từ Internet.`,
        'Trích đoạn liên quan đến ủy quyền (từ nguồn chính thống):',
        `- ${cleaned}`,
        `Nguồn trích: ${link}`,
      ].join('\n');
    } catch (err) {
      console.warn('Delegation extraction skipped:', err?.message || err);
    }
  }

  return base;
}

function extractDocNumbersFromText(text = '') {
  const matches = String(text || '').toUpperCase().match(/\b\d+\/\d{4}\/[A-Z0-9-]+\b/g);
  return Array.isArray(matches) ? matches : [];
}

function shouldLogLegalArticleDebug() {
  try {
    return String(localStorage.getItem('vbai_legal_crawl_debug') || '').trim().toLowerCase() === 'true';
  } catch {
    return false;
  }
}

function logLegalArticleDebug(event = '', details = {}) {
  if (!shouldLogLegalArticleDebug()) return;
  try {
    console.debug('[legal-article]', event, details);
  } catch {}
}

function extractArticleBlocksFromLegalText(text = '', limit = 20) {
  const src = String(text || '').replace(/\r/g, '\n');
  if (!src.trim()) {
    logLegalArticleDebug('extract-articles:empty-text', { limit });
    return [];
  }
  const pattern = /(?:^|\n)\s*(Điều|Dieu)\s+(\d+)\b[\s\S]{0,12000}?(?=(?:\n\s*(?:Điều|Dieu)\s+\d+\b)|(?:\n\s*(?:Chương|Chuong)\s+[IVXLCDM]+\b)|$)/giu;
  const blocks = [];
  let match;
  while ((match = pattern.exec(src)) !== null) {
    const block = String(match[0] || '').trim().replace(/\s+/g, ' ');
    if (!block) continue;
    blocks.push(block);
    if (blocks.length >= Math.max(1, limit)) break;
  }
  logLegalArticleDebug('extract-articles:done', {
    limit,
    articleCount: blocks.length,
    sourceLength: src.length,
    firstArticle: String(blocks[0] || '').slice(0, 120),
  });
  return blocks;
}

function buildArticleListingAnswer(rawUserText = '', extractedText = '', sourceLine = '') {
  const n = normalizeVietnamese(rawUserText);
  if (!/(liet ke|danh sach|toan bo cac dieu|toan bo dieu|cac dieu|dieu khoan|chuong dieu)/.test(n)) {
    logLegalArticleDebug('build-article-list:skip-intent', { rawUserText: String(rawUserText || '').slice(0, 160) });
    return '';
  }
  const articleBlocks = extractArticleBlocksFromLegalText(extractedText, 60);
  if (articleBlocks.length === 0) {
    logLegalArticleDebug('build-article-list:no-articles', {
      rawUserText: String(rawUserText || '').slice(0, 160),
      extractedLength: String(extractedText || '').length,
    });
    return '';
  }
  const lines = ['## Tóm tắt', `Tôi đã trích được ${articleBlocks.length} điều từ toàn văn nguồn chính thống.` , '', '### Thông tin chi tiết / Phân tích'];
  for (const block of articleBlocks) {
    lines.push(`- ${block}`);
  }
  logLegalArticleDebug('build-article-list:success', {
    articleCount: articleBlocks.length,
    sourceLine: String(sourceLine || '').slice(0, 160),
  });
  if (sourceLine) lines.push('', sourceLine);
  return lines.join('\n');
}

function inferDocTypeFromText(text = '') {
  const n = normalizeVietnamese(text);
  if (/\bnghi\s*quyet\b/.test(n)) return 'nghi_quyet';
  if (/\bnghi\s*dinh\b/.test(n)) return 'nghi_dinh';
  if (/\bthong\s*tu\b/.test(n)) return 'thong_tu';
  if (/\bquyet\s*dinh\b/.test(n)) return 'quyet_dinh';
  if (/\bluat\b/.test(n)) return 'luat';
  if (/\bgiay\s*moi\b|\bgiaymoi\b|\bgm\b|\bmoi\s*hop\b|\bmoihop\b/.test(n)) return 'giay_moi';
  return null;
}

function extractFirstDocNumberFromText(text = '') {
  const m = String(text || '').toUpperCase().match(/\b\d{1,4}\/\d{4}\/[A-Z0-9-]+\b/);
  return m ? String(m[0] || '').toUpperCase() : '';
}

function inferIssuerFromText(text = '') {
  const n = normalizeVietnamese(text);
  if (/\bquoc hoi\b/.test(n) || /\bqh\d{2}\b/.test(n)) return 'Quoc hoi';
  if (/\bchinh phu\b/.test(n) || /\bnd-cp\b/.test(String(text || '').toUpperCase())) return 'Chinh phu';
  if (/\bbo\b/.test(n) || /\btt-b[a-z0-9-]+\b/.test(String(text || '').toUpperCase())) return 'Bo, nganh';
  if (/\bubnd\b/.test(n)) return 'UBND';
  return '';
}

function getCanonicalLegalSourcePriority(host = '') {
  const h = String(host || '').toLowerCase().replace(/^www\./, '');
  if (!h) return 99;
  if (h === 'vbpl.vn') return 0;
  if (h === 'quochoi.vn') return 1;
  if (h === 'vanban.chinhphu.vn') return 2;
  if (h === 'congbao.chinhphu.vn') return 3;
  if (h === 'chinhphu.vn') return 4;
  if (h.endsWith('.gov.vn')) return 5;
  if (h === 'thuvienphapluat.vn') return 12;
  if (h === 'luatvietnam.vn') return 14;
  return 20;
}

function getSourceTierLabelFromHost(host = '') {
  const h = String(host || '').toLowerCase().replace(/^www\./, '');
  if (!h) return 'Khac';
  if (
    h.endsWith('.gov.vn')
    || h === 'vbpl.vn'
    || h === 'vanban.chinhphu.vn'
    || h === 'congbao.chinhphu.vn'
    || h === 'chinhphu.vn'
    || h === 'quochoi.vn'
  ) return 'Chinh thuc';
  if (h === 'luatvietnam.vn' || h === 'vanbanphapluat.com' || h === 'thuvienphapluat.vn') return 'Tham khao';
  return 'Khac';
}

function extractDateFromText(text = '') {
  const m = String(text || '').match(/\b(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{4})\b/);
  return m ? String(m[1] || '') : '';
}

function inferLegalStatusFromText(text = '') {
  const n = normalizeVietnamese(text);
  if (/\bhet hieu luc|bi thay the|bi bai bo\b/.test(n)) return 'Het hieu luc/bi thay the';
  if (/\bcon hieu luc|dang hieu luc|hieu luc\b/.test(n)) return 'Con hieu luc (can doi chieu nguon chinh thuc)';
  return 'Chua du du lieu xac dinh';
}

function filterItemsByDocType(items = [], requestedDocType = null) {
  if (!requestedDocType) return Array.isArray(items) ? items : [];
  return (Array.isArray(items) ? items : []).filter((it) => {
    const inferred = inferDocTypeFromText(`${it?.title || ''} ${it?.snippet || ''} ${it?.link || ''}`);
    return inferred === requestedDocType;
  });
}

function pickDominantDocNumberFromItems(items = []) {
  const score = new Map();
  for (const it of (Array.isArray(items) ? items : [])) {
    const hay = `${it?.title || ''} ${it?.snippet || ''} ${it?.link || ''}`;
    const docs = extractDocNumbersFromText(hay);
    for (const doc of docs) {
      score.set(doc, Number(score.get(doc) || 0) + 1);
    }
  }
  let bestDoc = '';
  let bestScore = 0;
  for (const [doc, s] of score.entries()) {
    if (s > bestScore) {
      bestScore = s;
      bestDoc = doc;
    }
  }
  return bestDoc || '';
}

function shouldUseGroundedAnswer(rawUserText = '', searchResults = '', webSearchMeta = null) {
  // Always fall through to live Gemini synthesis to construct premium, fluent, Pro-style responses
  return false;
}

function buildGroundedAnswer(rawUserText = '', searchResults = '', webSearchMeta = null) {
  const parsedItems = parseWebSearchMarkdownItems(searchResults);
  const strictTypedItems = filterItemsByDocType(parsedItems, webSearchMeta?.requested_doc_type || null);
  const workingItems = strictTypedItems.length > 0 ? strictTypedItems : parsedItems;
  const dominantDoc = pickDominantDocNumberFromItems(workingItems);
  const items = (dominantDoc
    ? workingItems.filter((it) => `${it.title} ${it.snippet} ${it.link}`.toUpperCase().includes(dominantDoc))
    : workingItems
  ).slice(0, 6);
  if (items.length === 0) return '';
  const best = items[0];
  const host = (() => {
    try { return new URL(best.link).hostname.replace(/^www\./, ''); } catch { return ''; }
  })();
  const docTypeRaw = inferDocTypeFromText(`${best.title} ${best.snippet} ${best.link}`);
  const docTypeLabel = ({
    luat: 'Luat',
    nghi_dinh: 'Nghi dinh',
    thong_tu: 'Thong tu',
    thong_tu_lien_tich: 'Thong tu lien tich',
    nghi_quyet: 'Nghi quyet',
    phap_lenh: 'Phap lenh',
    quyet_dinh: 'Quyet dinh',
    chi_thi: 'Chi thi',
    giay_moi: 'Giay moi',
  }[docTypeRaw] || 'Van ban');
  const docNo = dominantDoc || extractFirstDocNumberFromText(`${best.title} ${best.snippet} ${best.link}`);
  const issuer = inferIssuerFromText(`${best.title} ${best.snippet}`);
  const ngayBanHanh = extractDateFromText(best.snippet || '');
  const hieuLuc = inferLegalStatusFromText(best.snippet || '');
  const sourceLabel = getSourceTierLabelFromHost(host);
  const summarySeed = `${best.title}. ${String(best.snippet || '').replace(/\[[^\]]+\]/g, '').trim()}`.replace(/\s+/g, ' ').trim();
  const summary = summarySeed.length > 120 ? `${summarySeed.slice(0, 117)}...` : summarySeed;
  const directAnswer = docNo
    ? `${docTypeLabel} mới nhất tôi tìm được cho yêu cầu này là số ${docNo}.`
    : `${docTypeLabel} mới nhất tôi tìm được cho yêu cầu này là văn bản: ${best.title || 'Chưa đủ dữ liệu tên văn bản'}.`;

  const lines = [];
  lines.push('Tom tat');
  lines.push(`${directAnswer} ${summary || ''}`.trim());
  lines.push('');
  lines.push('Ket qua tra cuu van ban');
  lines.push('| Truong thong tin | Noi dung |');
  lines.push('|---|---|');
  lines.push(`| Ten van ban | ${best.title || ''} |`);
  lines.push(`| So hieu | ${docNo || 'Chua du du lieu'} |`);
  lines.push(`| Loai van ban | ${docTypeLabel} |`);
  lines.push(`| Co quan ban hanh | ${issuer || 'Chua du du lieu'} |`);
  lines.push(`| Ngay ban hanh | ${ngayBanHanh || 'Chua du du lieu'} |`);
  lines.push(`| Ngay co hieu luc | Chua du du lieu |`);
  lines.push(`| Tinh trang hieu luc | ${hieuLuc} |`);
  lines.push(`| Van ban thay the/sua doi | Chua du du lieu |`);
  lines.push(`| Nguon kiem tra | ${host || 'Khong ro'} (${sourceLabel}) - ${best.link} |`);
  lines.push('');
  lines.push('Noi dung lien quan');
  lines.push(`- ${String(best.snippet || '').trim() || 'Chua co trich doan du manh de trich dan.'}`);
  lines.push('');
  lines.push('Luu y');
  lines.push('- Neu can ket luan chinh thuc ve hieu luc, vui long doi chieu them tren nguon chinh thuc.');
  return lines.join('\n');
}

/**
 * Automatically fetch the latest laws at the start of the day.
 */
export async function runDailyLegalSync() {
  const now = Date.now();
  const lastSyncTs = Number(localStorage.getItem(DAILY_SYNC_TIMESTAMP_KEY) || '0');
  if (Number.isFinite(lastSyncTs) && now - lastSyncTs < HOT_KNOWLEDGE_TTL_MS) {
    console.log("[VBAI] Hot knowledge sync already completed in the last 2 hours.");
    return;
  }

  try {
    // Check if system has web search configured (may need to load config)
    const config = systemConfigCache || await fetchSystemConfig();
    const webSearchConfigured = !!(config?.web_search_configured || config?.google_search_configured || config?.vertex_search_configured);
    if (!webSearchConfigured) {
      console.log("[VBAI] Daily sync skipped: web search not configured in system.");
      return;
    }

    const query = "van ban phap luat moi ban hanh hom nay";
    const results = await sendWebSearchRequest(query, null, { forceFresh: true, freshnessLevel: 'day', recencyDays: 7, timeoutMs: 30000 });
    if (results) {
      localStorage.setItem(DAILY_SYNC_TIMESTAMP_KEY, String(now));
      console.log("[VBAI] Daily legal sync successful.");
    }
  } catch (err) {
    // Not critical; log warning but don't spam errors
    console.warn("[VBAI] Daily sync skipped or failed:", err.message);
  }
}


export function initChat(apiKey, modelName = DEFAULT_MODEL) {
  const normalizedModel = normalizeModelName(
    modelName || DEFAULT_MODEL
  );
  currentModelName = normalizedModel || DEFAULT_MODEL;
  
  try {
    aiClient = { proxy: true };
    chatSession = null;
    recentTurns = [];
    lastUserQuery = "";
    lastAssistantReply = "";
    lastResolvedDocNumber = "";
    loadSkills(); // Ti skills khi init
    return true;
  } catch (e) {
    console.error("Chat Init Error:", e);
    return false;
  }
}

function fixChatCommonTypos(text = "") {
  if (!text) return "";
  return text
    .replace(/\bthi hàng\b/gi, "thi hành")
    .replace(/\bthì hành\b/gi, "thi hành")
    .replace(/\bthi hàng\./gi, "thi hành.")
    .replace(/\bthi hàng,/gi, "thi hành,");
}

export async function sendMessage(text, onChunk) {
  if (!aiClient) throw new Error("Chua cau hinh API Key");

  // Capture attachedFile into local variable to prevent race condition
  // (user may click remove button while AI is processing)
  const currentAttachedFile = attachedFile;

  const rawUserText = String(text || "").trim();
  const drafting = isDraftRequest(rawUserText);
  const contextualUserText = buildContextAwareUserPrompt(rawUserText);
  let dynamicInstruction = drafting ? SYSTEM_INSTRUCTION : FAST_SYSTEM_INSTRUCTION;
  const lowerText = rawUserText.toLowerCase();
  const normalizedText = normalizeVietnamese(rawUserText);
  const matchedSkills = allSkills.filter((s) => detectSkillMatch(s, lowerText, normalizedText));

  if (matchedSkills.length > 0) {
    dynamicInstruction += "\n\n## KIEN THUC BO SUNG (dua tren context nguoi dung):\n";
    matchedSkills.forEach(s => {
      dynamicInstruction += `\n### Ky nang: ${s.name}\n${s.instructions}\n`;
      dynamicInstruction += buildSkillReferenceContext(s);
    });
  }
  dynamicInstruction += "\n\nYEU CAU BAT BUOC BO SUNG:\n- Chi hoi lam ro khi thieu du lieu quan trong, toi da 3 cau.\n- Khong tom tat raw search khi chua dat nguong doi chieu.\n- Bat buoc theo dung markdown format da quy dinh trong system prompt.";

  const sanitizeWebSearchMetaForLog = (meta = null) => {
    if (!meta || typeof meta !== 'object') return null;
    const cleaned = { ...meta };
    delete cleaned.strategy;
    delete cleaned.focused_strategy;
    return cleaned;
  };

  const sanitizeSearchLogExtra = (extra = {}) => {
    if (!extra || typeof extra !== 'object') return {};
    const cleaned = { ...extra };
    if ('webSearchMeta' in cleaned) {
      cleaned.webSearchMeta = sanitizeWebSearchMetaForLog(cleaned.webSearchMeta);
    }
    return cleaned;
  };

  const logSearchEvent = (assistantText, extra = {}) => {
    // Backend centralized trace logging is active in /api/chat. Client-side duplicate write disabled.
    return;
  };


  try {
    if (currentAttachedFile) {
      const filePrompt = `[DƯỚI ĐÂY LÀ NỘI DUNG TÀI LIỆU ĐƯỢC NGƯỜI DÙNG ĐÍNH KÈM (Tên file: ${currentAttachedFile.name})]\n` +
                         `========================================\n` +
                         `${currentAttachedFile.text}\n` +
                         `========================================\n\n` +
                         `YÊU CẦU NGƯỜI DÙNG: ${rawUserText || 'Hãy tóm tắt và phân tích tài liệu này.'}`;

      const messages = [
        { role: "system", content: dynamicInstruction + "\n\nLưu ý quan trọng: Người dùng đang đính kèm tài liệu và hỏi về tài liệu này. Hãy đọc kỹ văn bản được đính kèm ở trên và trả lời câu hỏi dựa trên nội dung đó. Định dạng câu trả lời chuẩn markdown đẹp mắt." },
        ...getConversationalMemory(),
        { role: "user", content: filePrompt }
      ];

      const streamOptions = {
        context: "chat",
        stream: true,
        temperature: drafting ? 0.35 : 0.2,
        onDelta: (partial) => {
          if (onChunk) onChunk(partial);
        }
      };

      let fileReply = "";
      try {
        fileReply = await sendChatRequest(messages, currentModelName, streamOptions);
        if (!String(fileReply || "").trim()) {
          throw new Error("AI trả về phản hồi rỗng.");
        }
      } catch (proxyError) {
        throw new Error(`Lỗi AI: ${proxyError?.message || proxyError}. Vui lòng kiểm tra lại API Key hoặc Endpoint.`);
      }

      fileReply = enforceTwoTierTerminology(
        ensureFollowUpQuestion(fileReply, rawUserText, {}, null),
        rawUserText
      );

      pushTurn("user", rawUserText || `[Tài liệu: ${currentAttachedFile.name}]`);
      pushTurn("assistant", fileReply);
      lastUserQuery = rawUserText;
      lastAssistantReply = stripTrailingFollowUpBlocks(fileReply);

      logSearchEvent(fileReply, {
        webSearchUsed: false,
        webSearchMeta: { attached_file: currentAttachedFile.name, attached_file_size: currentAttachedFile.size }
      });

      if (onChunk) onChunk(fileReply);
      return fileReply;
    }

    let fullText = "";
    let useWebSearch = !!(
      systemConfigCache?.web_search_configured
      || systemConfigCache?.google_search_configured
      || systemConfigCache?.vertex_search_configured
    );
    let webSearchMeta = null;
    let webSearchResultsText = '';
    const isTimeSensitive = isTimeSensitiveQuery(rawUserText);
    const expectedDocNumber = extractPotentialDocNumber(rawUserText);
    const searchContext = resolveWebSearchContext(rawUserText, expectedDocNumber);
    const normalizedLegalQuery = normalizeLegalQuery(rawUserText, searchContext);
    const allowBestAlternativeForLatestLookup = normalizedLegalQuery.intent === 'latest_doc_lookup';
    if (shouldRequireFullDocNumber(rawUserText, searchContext)) {
      const guardText = ensureFollowUpQuestion(
        buildNeedFullDocNumberMessage(
          rawUserText,
          searchContext.requestedDocType,
          searchContext.partialDocNumber,
        ),
        rawUserText,
      );
      pushTurn("user", rawUserText);
      pushTurn("assistant", guardText);
      lastUserQuery = rawUserText;
      lastAssistantReply = guardText;
      rememberResolvedDocNumber(searchContext, guardText);
      logSearchEvent(guardText, {
        webSearchUsed: false,
        webSearchMeta: {
          requested_doc_type: searchContext.requestedDocType,
          doc_number_match_level: searchContext.docNumberMatchLevel,
          type_match: null,
          strict_reject_reason: 'partial_doc_number_requires_full',
        },
      });
      if (onChunk) onChunk(guardText);
      return guardText;
    }
    const shouldSearchWebForFreshness = shouldPreferWebSearch(rawUserText) || shouldForceContextualWebSearch(rawUserText, searchContext);
    const shouldBypassCache = isTimeSensitive;
    const cached = shouldBypassCache ? '' : getCachedChatAnswer(rawUserText, currentModelName, useWebSearch);
    if (cached) {
      pushTurn("user", rawUserText);
      pushTurn("assistant", cached);
      lastUserQuery = rawUserText;
      lastAssistantReply = stripTrailingFollowUpBlocks(cached);
      rememberResolvedDocNumber(searchContext, cached);
      if (onChunk) onChunk(cached);
      return cached;
    }

    let finalUserText = `${contextualUserText}\n\n[Thong tin chuan hoa tu he thong]\n${JSON.stringify(normalizedLegalQuery, null, 2)}\n\nYeu cau:\n- Dung thong tin chuan hoa nay nhu tin hieu goi y ban dau.\n- Khong duoc coi do la ket luan cuoi cung.\n- Phai doi chieu lai voi nguon tra cuu thuc te truoc khi ket luan.\n- Neu nguon khong du chac chan hoac khong khop hoan toan, phai noi ro chua du can cu.`;
    if (shouldSearchWebForFreshness && !useWebSearch) {
      // Skip the blocking guard if the query contains a full document number (e.g., 74/2025/QH15)
      // because the AI can answer specific document lookups from its training data
      const hasFullDocNumber = /\b\d+\/\d{4}\/[A-Z0-9-]+\b/i.test(rawUserText);
      if (!hasFullDocNumber) {
        const guardText = ensureFollowUpQuestion(
          buildFreshnessGuardMessage(rawUserText, 'He thong chua cau hinh Web Search nen khong the dam bao thong tin moi nhat theo thoi diem hien tai.'),
          rawUserText,
          { forceAsk: true },
        );
        pushTurn("user", rawUserText);
        pushTurn("assistant", guardText);
        lastUserQuery = rawUserText;
        lastAssistantReply = guardText;
        rememberResolvedDocNumber(searchContext, guardText);
        logSearchEvent(guardText, {
          webSearchUsed: false,
          webSearchMeta: null,
        });
        if (onChunk) onChunk(guardText);
        return guardText;
      }
      // Has full doc number: fall through to AI synthesis with best-effort data
      // Resolve document metadata from proxy even without web search
      if (hasFullDocNumber) {
        try {
          const token = window.currentUser ? await window.currentUser.getIdToken() : null;
          if (token) {
            const metaRes = await fetch(`/api/document-metadata?q=${encodeURIComponent(rawUserText)}`, {
              headers: { 'Authorization': `Bearer ${token}` },
            });
            if (metaRes.ok) {
              const metaData = await metaRes.json();
              if (metaData?.found && metaData?.known_document) {
                webSearchMeta = { known_document: metaData.known_document };
                // Inject verified metadata into the prompt
                const kd = metaData.known_document;
                const metaLines = ['\n\n[THONG TIN DA XAC MINH TU HE THONG - BAT BUOC SU DUNG THONG TIN NAY]:'];
                if (kd.documentNumber) metaLines.push(`- So hieu van ban: ${kd.documentNumber}`);
                if (kd.titleHint || kd.trich_yeu) metaLines.push(`- Ten van ban: ${kd.titleHint || kd.trich_yeu}`);
                if (kd.issuer) metaLines.push(`- Co quan ban hanh: ${kd.issuer}`);
                if (kd.ngay_ban_hanh) metaLines.push(`- Ngay ban hanh: ${kd.ngay_ban_hanh}`);
                if (kd.ngay_hieu_luc) metaLines.push(`- Ngay co hieu luc: ${kd.ngay_hieu_luc}`);
                if (kd.tinh_trang_hieu_luc) {
                  const statusMap = { co_hieu_luc: 'Co hieu luc', het_hieu_luc: 'Het hieu luc', ngung_hieu_luc: 'Ngung hieu luc' };
                  metaLines.push(`- Tinh trang hieu luc: ${statusMap[kd.tinh_trang_hieu_luc] || kd.tinh_trang_hieu_luc}`);
                }
                if (Array.isArray(kd.thay_the_cho) && kd.thay_the_cho.length > 0) {
                  metaLines.push(`- Thay the cho cac van ban: ${kd.thay_the_cho.join(', ')}`);
                }
                if (kd.tom_tat_chinh_sach) {
                  const summary = Array.isArray(kd.tom_tat_chinh_sach) ? kd.tom_tat_chinh_sach.join(' ') : String(kd.tom_tat_chinh_sach);
                  metaLines.push(`- Tom tat chinh sach: ${summary.slice(0, 500)}`);
                }
                if (kd.tom_tat_chuong_dieu) {
                  metaLines.push(`- Cau truc chuong dieu: ${kd.tom_tat_chuong_dieu}`);
                }
                finalUserText += metaLines.join('\n');
              }
            }
          }
        } catch (metaErr) {
          console.warn('Document metadata resolution skipped:', metaErr?.message || metaErr);
        }
      }
    }

    if (useWebSearch && shouldSearchWebForFreshness) {
      if (onChunk) onChunk("Đang tra cứu dữ liệu mới nhất từ Internet...\n");
      let searchResults = '';
      let webSearchFailure = null;
      try {
        searchResults = await sendWebSearchRequest(
          searchContext.effectiveQuery,
          searchContext.effectiveDocNumber,
          {
            ...buildFreshWebSearchOptions(rawUserText),
            requestedDocType: searchContext.requestedDocType || undefined,
            partialDocNumber: searchContext.partialDocNumber || undefined,
          },
        );
      } catch (webErr) {
        webSearchFailure = webErr;
        console.warn('Fresh web-search failed, continuing in best-effort mode:', webErr?.message || webErr);
        webSearchMeta = {
          ...(getLastWebSearchMeta() || {}),
          fallback_used: true,
          web_search_error: String(webErr?.message || webErr || 'web_search_error').slice(0, 400),
        };
        if (onChunk) onChunk("Kênh tra cứu Internet đang gián đoạn, tôi chuyển sang chế độ dự phòng để vẫn trả kết quả...\n");
      }
      webSearchResultsText = String(searchResults || '');
      webSearchMeta = webSearchMeta || getLastWebSearchMeta();
      const earlyStrictReason = String(webSearchMeta?.strict_reject_reason || '').trim().toLowerCase();
      const earlyLowConfidence = typeof webSearchMeta?.confidence === 'number' && webSearchMeta.confidence < 0.85;
      const strictBoundQuery = shouldUseStrictRejection(rawUserText, searchContext);
      const contextualExtractionIntent = Boolean(
        searchContext?.effectiveDocNumber
        && (
          isDelegationFocusQuery(rawUserText)
          || hasCitationIntent(rawUserText)
          || Boolean(parseComparisonTargets(rawUserText))
        ),
      );
      if (false && webSearchResultsText && (earlyStrictReason || earlyLowConfidence) && strictBoundQuery && !contextualExtractionIntent && !allowBestAlternativeForLatestLookup) {
        const bestAlternative = webSearchMeta?.best_alternative && typeof webSearchMeta.best_alternative === 'object'
          ? webSearchMeta.best_alternative
          : null;
        const bestAlternativeLatestAnswerEarly = allowBestAlternativeForLatestLookup
          ? buildBestAlternativeLatestAnswer(rawUserText, bestAlternative)
          : '';
        const rejectMessage = bestAlternativeLatestAnswerEarly || (earlyStrictReason === 'partial_doc_number_requires_full'
          ? buildNeedFullDocNumberMessage(
            rawUserText,
            searchContext.requestedDocType || webSearchMeta?.requested_doc_type || '',
            searchContext.partialDocNumber || '',
          )
          : earlyStrictReason === 'no_type_match'
            ? buildDocTypeMismatchMessage(
              rawUserText,
              searchContext.requestedDocType || webSearchMeta?.requested_doc_type || '',
              searchContext.effectiveDocNumber || '',
            )
            : (() => {
              const base = 'Chua du can cu xac dinh van ban dung theo tieu chi doi chieu bat buoc (loai, so hieu, ten/trich yeu, co quan, nam/ngay ban hanh).';
              if (!bestAlternative) return base;
              const altLabel = `${bestAlternative.loai_van_ban || 'van ban'} ${bestAlternative.so_hieu || ''}`.trim();
              const altTitle = String(bestAlternative.trich_yeu_hoac_ten_van_ban || '').trim();
              return `${base} Co the ban dang nham so hieu. Phuong an phu hop nhat hien tim thay: ${altLabel}${altTitle ? ` - ${altTitle}` : ''}${bestAlternative.nguon ? ` (nguon: ${bestAlternative.nguon}${bestAlternative.is_official_source === true ? ' - Chinh thuc' : ' - Tham khao'})` : ''}.`;
            })());
      const guardText = ensureFollowUpQuestion(
        rejectMessage,
        rawUserText,
        { forceAsk: !bestAlternativeLatestAnswerEarly },
        webSearchMeta,
      );
        pushTurn("user", rawUserText);
        pushTurn("assistant", guardText);
        lastUserQuery = rawUserText;
        lastAssistantReply = guardText;
        rememberResolvedDocNumber(searchContext, guardText);
        logSearchEvent(guardText, {
          webSearchUsed: true,
          webSearchMeta: webSearchMeta || null,
        });
        if (onChunk) onChunk(guardText);
        return guardText;
      }
      if (false && searchResults === "__NO_EXACT_MATCH__" && searchContext.effectiveDocNumber) {
 const guardText = ensureFollowUpQuestion(
          searchResults === "__NO_EXACT_MATCH__" && searchContext.effectiveDocNumber
            ? buildFreshnessGuardMessage(rawUserText, `Khong tim thay van ban co so hieu ${searchContext.effectiveDocNumber} trong du lieu tra cuu moi nhat.`)
            : buildFreshnessGuardMessage(rawUserText, 'Khong co ket qua tra cuu phu hop tu Internet.'),
          rawUserText,
          { forceAsk: true },
          webSearchMeta,
        );
        pushTurn("user", rawUserText);
        pushTurn("assistant", guardText);
        lastUserQuery = rawUserText;
        lastAssistantReply = guardText;
        rememberResolvedDocNumber(searchContext, guardText);
        logSearchEvent(guardText, {
          webSearchUsed: true,
          webSearchMeta: webSearchMeta || null,
        });
        if (onChunk) onChunk(guardText);
        return guardText;
      } else if (searchResults) {
        if (searchContext.effectiveDocNumber && isDelegationFocusQuery(rawUserText)) {
          try {
            const focusedQuery = `${searchContext.effectiveDocNumber} dieu 14 uy quyen phan cap phan quyen`;
            const focusedResults = await sendWebSearchRequest(
              focusedQuery,
              searchContext.effectiveDocNumber,
              {
                ...buildFreshWebSearchOptions(rawUserText),
                timeoutMs: 15000,
                requestedDocType: searchContext.requestedDocType || undefined,
                partialDocNumber: searchContext.partialDocNumber || undefined,
              },
            );
            if (focusedResults) {
              webSearchResultsText = `${webSearchResultsText}\n\n${String(focusedResults)}`;
              const focusedMeta = getLastWebSearchMeta();
              if (focusedMeta && typeof focusedMeta === 'object') {
                webSearchMeta = {
                  ...(webSearchMeta || {}),
                  focused_strategy: focusedMeta.strategy || null,
                };
              }
            }
          } catch (focusedErr) {
            console.warn('Focused delegation web-search skipped:', focusedErr?.message || focusedErr);
          }
        }
        finalUserText = `${contextualUserText}\n\n[Du lieu truc tuyen cap nhat, tra cuu luc ${new Date().toLocaleTimeString('vi-VN')}]:\n${webSearchResultsText}`;
        // Inject known_document metadata so AI has verified effective dates
        const knownDoc = webSearchMeta?.known_document;
        if (knownDoc && (knownDoc.ngay_hieu_luc || knownDoc.ngay_ban_hanh || knownDoc.tinh_trang_hieu_luc)) {
          const metaLines = ['\n\n[THONG TIN DA XAC MINH TU HE THONG - BAT BUOC SU DUNG THONG TIN NAY THAY VI TRA LOI "chua xac dinh"]:'];
          if (knownDoc.documentNumber) metaLines.push(`- So hieu van ban: ${knownDoc.documentNumber}`);
          if (knownDoc.titleHint || knownDoc.trich_yeu) metaLines.push(`- Ten van ban: ${knownDoc.titleHint || knownDoc.trich_yeu}`);
          if (knownDoc.issuer) metaLines.push(`- Co quan ban hanh: ${knownDoc.issuer}`);
          if (knownDoc.ngay_ban_hanh) metaLines.push(`- Ngay ban hanh: ${knownDoc.ngay_ban_hanh}`);
          if (knownDoc.ngay_hieu_luc) metaLines.push(`- Ngay co hieu luc: ${knownDoc.ngay_hieu_luc}`);
          if (knownDoc.tinh_trang_hieu_luc) {
            const statusMap = { co_hieu_luc: 'Co hieu luc', het_hieu_luc: 'Het hieu luc', ngung_hieu_luc: 'Ngung hieu luc' };
            metaLines.push(`- Tinh trang hieu luc: ${statusMap[knownDoc.tinh_trang_hieu_luc] || knownDoc.tinh_trang_hieu_luc}`);
          }
          if (Array.isArray(knownDoc.thay_the_cho) && knownDoc.thay_the_cho.length > 0) {
            metaLines.push(`- Thay the cho cac van ban: ${knownDoc.thay_the_cho.join(', ')}`);
          }
          if (knownDoc.tom_tat_chinh_sach) {
            const summary = Array.isArray(knownDoc.tom_tat_chinh_sach) ? knownDoc.tom_tat_chinh_sach.join(' ') : String(knownDoc.tom_tat_chinh_sach);
            metaLines.push(`- Tom tat chinh sach: ${summary.slice(0, 500)}`);
          }
          finalUserText += metaLines.join('\n');
        }
      } else {
        if (webSearchFailure) {
          finalUserText = `${contextualUserText}\n\n[Luu y he thong]: Kenh tra cuu Internet tam thoi gian doan. Hay tiep tuc tra loi theo che do du phong, uu tien noi ro muc do chac chan va khuyen nghi doi chieu nguon chinh thuc.`;
          if (webSearchMeta?.strict_reject_reason) {
            webSearchMeta = { ...(webSearchMeta || {}), strict_reject_reason: null };
          }
        } else {
          if (webSearchMeta?.strict_reject_reason) {
            // Continue with best-effort synthesis even when backend marks strict reject.
            webSearchMeta = { ...(webSearchMeta || {}), strict_reject_reason: null };
          }
          const cseDenied = Number(webSearchMeta?.cse_status) === 403
            && /custom search|permission|access/i.test(String(webSearchMeta?.cse_error_reason || ''));
          const fallbackUsed = webSearchMeta?.fallback_used === true;
          const strictRejectReason = String(webSearchMeta?.strict_reject_reason || '').trim().toLowerCase();
          const bestAlternative = webSearchMeta?.best_alternative && typeof webSearchMeta.best_alternative === 'object'
            ? webSearchMeta.best_alternative
            : null;
          const shouldStrictReject = strictBoundQuery && Boolean(strictRejectReason) && !allowBestAlternativeForLatestLookup;
          const guardReason = strictRejectReason === 'partial_doc_number_requires_full'
            ? buildNeedFullDocNumberMessage(
                rawUserText,
                searchContext.requestedDocType || webSearchMeta?.requested_doc_type || '',
              searchContext.partialDocNumber || '',
            )
            : strictRejectReason === 'no_type_match'
              ? buildDocTypeMismatchMessage(
                rawUserText,
                searchContext.requestedDocType || webSearchMeta?.requested_doc_type || '',
                searchContext.effectiveDocNumber || '',
              )
              : strictRejectReason === 'low_confidence' || strictRejectReason === 'metadata_incomplete' || strictRejectReason === 'no_exact_match'
                ? (() => {
                  const base = 'Chua du can cu xac dinh van ban dung theo tieu chi doi chieu bat buoc (loai, so hieu, ten/trich yeu, co quan, nam/ngay ban hanh).';
                  if (!bestAlternative) return base;
                  const altLabel = `${bestAlternative.loai_van_ban || 'van ban'} ${bestAlternative.so_hieu || ''}`.trim();
                  const altTitle = String(bestAlternative.trich_yeu_hoac_ten_van_ban || '').trim();
                  return `${base} Co the ban dang nham so hieu. Phuong an phu hop nhat hien tim thay: ${altLabel}${altTitle ? ` - ${altTitle}` : ''}${bestAlternative.nguon ? ` (nguon: ${bestAlternative.nguon}${bestAlternative.is_official_source === true ? ' - Chinh thuc' : ' - Tham khao'})` : ''}.`;
                })()
              : cseDenied
            ? (fallbackUsed
              ? 'Web Search dang loi quyen truy cap. He thong da chuyen sang nguon chinh thong truc tiep nhung chua tim thay ket qua phu hop.'
              : 'Web Search dang loi quyen truy cap nen he thong khong lay duoc ket qua Internet.')
            : 'Khong co ket qua tra cuu phu hop tu Internet.';
          const bestAlternativeLatestAnswer = allowBestAlternativeForLatestLookup
            ? buildBestAlternativeLatestAnswer(rawUserText, bestAlternative)
            : '';
          const guardText = ensureFollowUpQuestion(
            bestAlternativeLatestAnswer || (shouldStrictReject ? guardReason : buildFreshnessGuardMessage(rawUserText, guardReason)),
            rawUserText,
            { forceAsk: !bestAlternativeLatestAnswer },
            webSearchMeta,
          );
          pushTurn("user", rawUserText);
          pushTurn("assistant", guardText);
          lastUserQuery = rawUserText;
          lastAssistantReply = guardText;
          rememberResolvedDocNumber(searchContext, guardText);
          logSearchEvent(guardText, {
            webSearchUsed: true,
            webSearchMeta: webSearchMeta || null,
          });
          if (onChunk) onChunk(guardText);
          return guardText;
        }
      }

    }

  const detailedAnswerRaw = await buildDetailedLegalAgentAnswer(rawUserText, searchContext, webSearchResultsText, webSearchMeta);
  if (String(detailedAnswerRaw || '').trim()) {
    const detailedMeta = { ...(webSearchMeta || {}), rawIntent: 'full' };
    let detailedAnswer = enforceTwoTierTerminology(
      ensureFollowUpQuestion(detailedAnswerRaw, rawUserText, {}, detailedMeta),
      rawUserText,
    );
    detailedAnswer = prependHeaderIfAvailable(detailedAnswer, detailedMeta);
    pushTurn("user", rawUserText);
    pushTurn("assistant", detailedAnswer);
    lastUserQuery = rawUserText;
    lastAssistantReply = stripTrailingFollowUpBlocks(detailedAnswer);
    rememberResolvedDocNumber(searchContext, detailedAnswer);
    logSearchEvent(detailedAnswer, {
      webSearchUsed: true,
      webSearchMeta: detailedMeta,
    });
    if (onChunk) onChunk(detailedAnswer);
    return detailedAnswer;
  }

    const comparisonAnswerRaw = await buildComparisonTableResponse(rawUserText, searchContext, webSearchResultsText);
    if (String(comparisonAnswerRaw || '').trim()) {
      let comparisonAnswer = enforceTwoTierTerminology(
        ensureFollowUpQuestion(comparisonAnswerRaw, rawUserText, {}, webSearchMeta),
        rawUserText,
      );
      comparisonAnswer = prependHeaderIfAvailable(comparisonAnswer, webSearchMeta);
      pushTurn("user", rawUserText);
      pushTurn("assistant", comparisonAnswer);
      lastUserQuery = rawUserText;
      lastAssistantReply = stripTrailingFollowUpBlocks(comparisonAnswer);
      rememberResolvedDocNumber(searchContext, comparisonAnswer);
      logSearchEvent(comparisonAnswer, {
        webSearchUsed: true,
        webSearchMeta: webSearchMeta || null,
      });
      if (onChunk) onChunk(comparisonAnswer);
      return comparisonAnswer;
    }

    const strictCitationAnswerRaw = await buildStrictCitationResponse(rawUserText, searchContext, webSearchResultsText);
    if (String(strictCitationAnswerRaw || '').trim()) {
      let strictCitationAnswer = enforceTwoTierTerminology(
        ensureFollowUpQuestion(strictCitationAnswerRaw, rawUserText, {}, webSearchMeta),
        rawUserText,
      );
      strictCitationAnswer = prependHeaderIfAvailable(strictCitationAnswer, webSearchMeta);
      pushTurn("user", rawUserText);
      pushTurn("assistant", strictCitationAnswer);
      lastUserQuery = rawUserText;
      lastAssistantReply = stripTrailingFollowUpBlocks(strictCitationAnswer);
      rememberResolvedDocNumber(searchContext, strictCitationAnswer);
      logSearchEvent(strictCitationAnswer, {
        webSearchUsed: true,
        webSearchMeta: webSearchMeta || null,
      });
      if (onChunk) onChunk(strictCitationAnswer);
      return strictCitationAnswer;
    }

    if (shouldUseEvidenceResponse(rawUserText, searchContext, webSearchResultsText, webSearchMeta)) {
      let evidenceAnswer = enforceTwoTierTerminology(ensureFollowUpQuestion(
        await buildDelegationFocusedEvidenceResponse(rawUserText, searchContext, webSearchResultsText),
        rawUserText,
        {},
        webSearchMeta,
      ), rawUserText);
      evidenceAnswer = prependHeaderIfAvailable(evidenceAnswer, webSearchMeta);
      pushTurn("user", rawUserText);
      pushTurn("assistant", evidenceAnswer);
      lastUserQuery = rawUserText;
      lastAssistantReply = stripTrailingFollowUpBlocks(evidenceAnswer);
      rememberResolvedDocNumber(searchContext, evidenceAnswer);
      logSearchEvent(evidenceAnswer, {
        webSearchUsed: true,
        webSearchMeta: webSearchMeta || null,
      });
      if (onChunk) onChunk(evidenceAnswer);
      return evidenceAnswer;
    }
    const substantiveUpdateAnswerRaw = await buildSubstantiveUpdateAnswer(rawUserText, searchContext, webSearchResultsText, webSearchMeta);
    if (String(substantiveUpdateAnswerRaw || '').trim()) {
      let substantiveUpdateAnswer = enforceTwoTierTerminology(
        ensureFollowUpQuestion(substantiveUpdateAnswerRaw, rawUserText, {}, webSearchMeta),
        rawUserText,
      );
      substantiveUpdateAnswer = prependHeaderIfAvailable(substantiveUpdateAnswer, webSearchMeta);
      pushTurn("user", rawUserText);
      pushTurn("assistant", substantiveUpdateAnswer);
      lastUserQuery = rawUserText;
      lastAssistantReply = stripTrailingFollowUpBlocks(substantiveUpdateAnswer);
      rememberResolvedDocNumber(searchContext, substantiveUpdateAnswer);
      logSearchEvent(substantiveUpdateAnswer, {
        webSearchUsed: true,
        webSearchMeta: webSearchMeta || null,
      });
      if (onChunk) onChunk(substantiveUpdateAnswer);
      return substantiveUpdateAnswer;
    }

    if (shouldUseGroundedAnswer(rawUserText, webSearchResultsText, webSearchMeta)) {
      let groundedAnswer = enforceTwoTierTerminology(ensureFollowUpQuestion(
        buildGroundedAnswer(rawUserText, webSearchResultsText, webSearchMeta),
        rawUserText,
        {},
        webSearchMeta,
      ), rawUserText);
      groundedAnswer = prependHeaderIfAvailable(groundedAnswer, webSearchMeta);
      pushTurn("user", rawUserText);
      pushTurn("assistant", groundedAnswer);
      lastUserQuery = rawUserText;
      lastAssistantReply = stripTrailingFollowUpBlocks(groundedAnswer);
      rememberResolvedDocNumber(searchContext, groundedAnswer);
      logSearchEvent(groundedAnswer, {
        webSearchUsed: true,
        webSearchMeta: webSearchMeta || null,
      });
      if (onChunk) onChunk(groundedAnswer);
      return groundedAnswer;
    }

    const messages = [
      { role: "system", content: dynamicInstruction },
      ...getConversationalMemory(),
      { role: "user", content: finalUserText }
    ];

    const streamOptions = {
      context: "chat",
      stream: true,
      temperature: drafting ? 0.35 : 0.2,
      onDelta: (partial) => {
        if (onChunk) {
          onChunk(partial);
        }
      }
    };

    try {
      fullText = await sendChatRequest(messages, currentModelName, streamOptions);
      if (!String(fullText || "").trim()) {
        throw new Error("AI tra ve phan hoi rong.");
      }
    } catch (proxyError) {
      throw new Error(`Loi AI: ${proxyError?.message || proxyError}. Vui long kiem tra lai API Key hoac Endpoint.`);
    }

    fullText = enforceTwoTierTerminology(
      ensureFollowUpQuestion(fullText, rawUserText, {}, webSearchMeta),
      rawUserText,
    );
    fullText = fixChatCommonTypos(fullText);
    fullText = prependHeaderIfAvailable(fullText, webSearchMeta);

    // Cache only when query is not freshness-sensitive and web search is not required.
    if (!shouldBypassCache) {
      setCachedChatAnswer(rawUserText, currentModelName, useWebSearch, fullText);
    }
    pushTurn("user", rawUserText);
    pushTurn("assistant", fullText);
    lastUserQuery = rawUserText;
    lastAssistantReply = stripTrailingFollowUpBlocks(fullText);
    rememberResolvedDocNumber(searchContext, fullText);

    logSearchEvent(fullText, {
      webSearchUsed: useWebSearch && shouldSearchWebForFreshness,
      webSearchMeta: webSearchMeta || null,
    });

    if (onChunk) onChunk(fullText);
    return fullText;
  } catch (e) {
    console.error("Send Error:", e);
    throw e;
  }
}

export async function renderChatUI(container) {
  const fallbackConfig = {
    provider: 'gemini',
    gemini_model: 'gemini-3.5-flash-lite',
    transcribe_model: 'gemini-3.5-flash-lite',
    has_gemini_key: false,
    web_search_provider: 'vertex_search',
    web_search_mode: 'cse_with_fallback',
    web_search_fallback_sources: { ...DEFAULT_FALLBACK_SOURCES },
  };

  const isAdmin = isCurrentUserAdmin();
  const configSnapshot = { ...fallbackConfig, ...(systemConfigCache || {}) };
  const savedModel = normalizeModelName(configSnapshot.gemini_model || 'gemini-3.5-flash-lite') || 'gemini-3.5-flash-lite';

  container.innerHTML = `
    <div class="chat-assistant-panel panel-group">
      <div class="panel-header">
        <div class="panel-header-icon">&#9878;</div>
        Tr\u1ee3 l\u00fd tra c\u1ee9u h\u00e0nh ch\u00ednh v\u00e0 ph\u00e1p lu\u1eadt
        <div style="flex:1"></div>
        <button id="chat-settings-ai-btn" class="btn-icon" title="Th\u00f4ng tin c\u1ea5u h\u00ecnh AI" style="width:28px; height:28px; font-size:0.72rem; margin-left:6px">&#9881;</button>
      </div>
      <div class="panel-body">
        <div id="chat-messages" class="chat-messages-area">
          <div class="chat-msg ai">
            <strong>Xin ch\u00e0o! T\u00f4i l\u00e0 Tr\u1ee3 l\u00fd h\u00e0nh ch\u00ednh.</strong><br>
            T\u00f4i h\u1ed7 tr\u1ee3 tra c\u1ee9u c\u00e1c quy \u0111\u1ecbnh ph\u00e1p lu\u1eadt, x\u1eed l\u00fd nghi\u1ec7p v\u1ee5 h\u00e0nh ch\u00ednh v\u00e0 t\u1ed5ng h\u1ee3p th\u00f4ng tin ph\u1ee5c v\u1ee5 c\u00f4ng vi\u1ec7c h\u1eb1ng ng\u00e0y.
          </div>
        </div>

        <!-- Preview area for file attachments -->
        <div id="chat-attachment-preview" class="chat-attachment-preview-area" style="display:none;"></div>

        <div class="chat-input-wrapper" style="display:flex; gap:8px; align-items:center;">
          <input type="file" id="chat-file-input" accept=".pdf,.docx,.xlsx" style="display:none">
          <button id="chat-attach-btn" class="btn btn-secondary" style="padding: 12px 14px; display:flex; align-items:center; justify-content:center; border-radius: 8px;" title="Đính kèm file (PDF, Word, Excel)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
            </svg>
          </button>
          <input type="text" id="chat-input" placeholder="Nh\u1eadp n\u1ed9i dung c\u1ea7n tra c\u1ee9u..." class="form-input chat-input-field">
          <button id="chat-send-btn" class="btn btn-primary chat-send-btn">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M2.5 10l15-7.5L10 10l7.5 7.5L2.5 10z" fill="currentColor"/></svg>
          </button>
          <button class="btn btn-secondary" onclick="sessionStorage.removeItem('vbai_chat_cache_v1'); window.location.reload();" style="padding: 12px 14px; display:flex; align-items:center; justify-content:center; border-radius: 8px;" title="Làm mới khung chat">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>
          </button>
        </div>
        <div class="chat-disclaimer" style="margin-top: 12px; padding: 10px; background: linear-gradient(135deg, rgba(37, 99, 235, 0.10), rgba(30, 64, 175, 0.08)); border-left: 3px solid #60a5fa; border-radius: 4px; font-size: 0.75rem; color: var(--text-secondary);">
          <strong>&#9888; C\u1ea2NH B\u00c1O R\u1ee6I RO:</strong> Tr\u1ee3 l\u00fd h\u00e0nh ch\u00ednh l\u00e0 c\u00f4ng c\u1ee5 h\u1ed7 tr\u1ee3 d\u1ef1a tr\u00ean AI, kh\u00f4ng thay th\u1ebf tr\u00e1ch nhi\u1ec7m c\u1ee7a c\u00e1n b\u1ed9, c\u00f4ng ch\u1ee9c trong vi\u1ec7c ki\u1ec3m tra, \u0111\u1ed1i chi\u1ebfu v\u1edbi v\u0103n b\u1ea3n ph\u00e1p lu\u1eadt ch\u00ednh th\u1ee9c. K\u1ebft qu\u1ea3 do AI cung c\u1ea5p ch\u1ec9 mang t\u00ednh ch\u1ea5t g\u1ee3i \u00fd, ng\u01b0\u1eddi d\u00f9ng c\u1ea7n ki\u1ec3m tra hi\u1ec7u l\u1ef1c v\u0103n b\u1ea3n tr\u01b0\u1edbc khi \u0111\u01b0a v\u00e0o d\u1ef1 th\u1ea3o.
        </div>
      </div>
    </div>

    <div id="key-modal-ai" class="modal-overlay" style="display:none">
      <div class="modal-content panel-group config-ai-modal" style="max-width:860px">
        <div class="panel-header">Th\u00f4ng tin c\u1ea5u h\u00ecnh AI h\u1ec7 th\u1ed1ng</div>
        <div class="panel-body config-ai-modal-body" style="max-height:80vh; overflow-y:auto">
          <form id="modal-config-form">
            ${isAdmin ? `
              <div class="config-modal-two-col">
                <section class="config-section-card">
                  <div class="config-modal-section-title">Gemini</div>
                  <div class="form-group">
                    <label class="form-label">Nh\u00e0 cung c\u1ea5p AI m\u1eb7c \u0111\u1ecbnh</label>
                    <input type="text" class="form-input" value="Gemini" readonly>
                  </div>
                  <div class="form-group">
                    <label class="form-label">Model Gemini</label>
                    <input type="text" id="modal-gemini-model" class="form-input" value="${escapeHtml(configSnapshot.gemini_model || 'gemini-2.5-pro')}">
                    <small id="modal-gemini-runtime-warning" class="config-hint" style="display:none; color:#fbbf24;"></small>
                  </div>
                  <div class="form-group">
                    <label class="form-label">Gemini API Key</label>
                    <div class="config-inline-row">
                      <input type="password" id="modal-gemini-key" class="form-input config-inline-grow" placeholder="AIza..." value="${escapeHtml(configSnapshot.gemini_api_key || '')}">
                      <button type="button" id="modal-toggle-gemini-key-btn" class="btn btn-secondary btn-sm config-inline-add-btn">Hiện key</button>
                      <button type="button" id="modal-verify-gemini-key-btn" class="btn btn-primary btn-sm config-inline-add-btn">Xác nhận key</button>
                    </div>
                    <label class="config-radio-option" style="margin-top:8px">
                      <input type="checkbox" id="modal-verify-gemini-on-save" checked> Xác nhận key khi lưu cấu hình
                    </label>
                    <small id="modal-gemini-key-status" class="config-hint"></small>
                  </div>
                </section>

                <section class="config-section-card">
                  <div class="config-modal-section-title">Web Search</div>
                  <div class="form-group">
                    <label class="form-label">Ch\u1ebf \u0111\u1ed9 tra c\u1ee9u web</label>
                    <div class="config-radio-col">
                      <label class="config-radio-option"><input type="radio" name="modal_web_search_mode" value="cse_with_fallback"> Vertex AI Search + fallback ngu\u1ed3n tr\u1ef1c ti\u1ebfp</label>
                    </div>
                  </div>
                  <div class="form-group">
                    <label class="form-label">Fallback sources</label>
                    <div class="config-fallback-grid">
                      <label class="config-radio-option"><input type="checkbox" id="modal-fallback-vbpl"> vbpl.vn</label>
                      <label class="config-radio-option"><input type="checkbox" id="modal-fallback-chinhphu"> chinhphu.vn</label>
                      <label class="config-radio-option"><input type="checkbox" id="modal-fallback-quochoi"> quochoi.vn</label>
                      <label class="config-radio-option"><input type="checkbox" id="modal-fallback-thuvienphapluat"> thuvienphapluat.vn</label>
                      <label class="config-radio-option"><input type="checkbox" id="modal-fallback-luatvietnam"> luatvietnam.vn</label>
                    </div>
                  </div>
                </section>
              </div>
            ` : `
              <div class="form-group">
                <label class="form-label">Nh\u00e0 cung c\u1ea5p AI</label>
                <input type="text" class="form-input" value="Gemini" readonly>
              </div>
              <div class="form-group">
                <label class="form-label">Model chat hi\u1ec7n t\u1ea1i</label>
                <input type="text" class="form-input" value="${escapeHtml(savedModel)}" readonly>
              </div>
              <div class="form-group">
                <label class="form-label">Tr\u1ea1ng th\u00e1i tra c\u1ee9u web</label>
                <input type="text" class="form-input" value="Web Search" readonly>
              </div>
            `}

            <div class="config-modal-note">
              ${isAdmin
                ? "B\u1ea1n l\u00e0 qu\u1ea3n tr\u1ecb vi\u00ean. C\u1ea5u h\u00ecnh l\u01b0u xong s\u1ebd \u00e1p d\u1ee5ng ngay cho truy v\u1ea5n k\u1ebf ti\u1ebfp."
                : "C\u1ea5u h\u00ecnh AI do qu\u1ea3n tr\u1ecb vi\u00ean h\u1ec7 th\u1ed1ng qu\u1ea3n l\u00fd."}
            </div>

            <div id="modal-save-status" class="config-save-status"></div>

            <div class="btn-row config-modal-actions">
              ${isAdmin ? `
                <button type="button" id="modal-save-config-btn" class="btn btn-primary config-save-btn">L\u01b0u v\u00e0 \u00e1p d\u1ee5ng</button>
                <button type="button" id="go-admin-config-btn" class="btn btn-secondary" title="C\u1ea5u h\u00ecnh n\u00e2ng cao">&#9881;</button>
              ` : ''}
              <button type="button" id="close-ai-config-btn" class="btn btn-secondary">\u0110\u00f3ng</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;

  const msgsArea = container.querySelector('#chat-messages');
  const input = container.querySelector('#chat-input');
  const sendBtn = container.querySelector('#chat-send-btn');

  const fileInput = container.querySelector('#chat-file-input');
  const attachBtn = container.querySelector('#chat-attach-btn');
  const previewArea = container.querySelector('#chat-attachment-preview');

  attachedFile = null; // Clear previous attachment when rendering new Chat UI
  
  // Helper to escape HTML characters
  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;")
              .replace(/'/g, "&#039;");
  }

  if (attachBtn && fileInput && previewArea) {
    attachBtn.onclick = () => fileInput.click();
    fileInput.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      // Limit file size to 25MB
      if (file.size > 25 * 1024 * 1024) {
        showToast('File quá lớn. Vui lòng chọn file nhỏ hơn 25MB.', 'error');
        fileInput.value = '';
        return;
      }
      
      // Show preview area and loading state
      previewArea.style.display = 'flex';
      previewArea.innerHTML = `
        <div class="file-icon">⏳</div>
        <div class="file-info">
          <div class="file-name">${escapeHtml(file.name)}</div>
          <div class="file-status">Đang chuẩn bị...</div>
        </div>
      `;
      
      try {
        const text = await processAttachedFile(file, (status) => {
          const statusEl = previewArea.querySelector('.file-status');
          if (statusEl) statusEl.textContent = status;
        });
        
        attachedFile = {
          name: file.name,
          text: text,
          size: file.size,
          type: file.type
        };
        
        // Show completion preview
        const kbSize = (file.size / 1024).toFixed(1);
        const fileIcon = file.name.toLowerCase().endsWith('.pdf') ? '📄' : 
                         (file.name.toLowerCase().endsWith('.docx') ? '📝' : '📊');
        
        previewArea.innerHTML = `
          <div class="file-icon">${fileIcon}</div>
          <div class="file-info">
            <div class="file-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</div>
            <div class="file-status" style="color: #34d399;">Sẵn sàng • ${kbSize} KB (${text.length.toLocaleString()} ký tự)</div>
          </div>
          <button class="btn-remove" title="Xóa đính kèm">×</button>
        `;
        
        previewArea.querySelector('.btn-remove').onclick = () => {
          attachedFile = null;
          previewArea.style.display = 'none';
          previewArea.innerHTML = '';
          fileInput.value = '';
          showToast('Đã gỡ bỏ file đính kèm');
        };
        
        showToast('Đã đính kèm file thành công!');
        
      } catch (err) {
        console.error(err);
        attachedFile = null;
        previewArea.innerHTML = `
          <div class="file-icon">❌</div>
          <div class="file-info">
            <div class="file-name">${escapeHtml(file.name)}</div>
            <div class="file-status" style="color: var(--danger);">${escapeHtml(err.message)}</div>
          </div>
          <button class="btn-remove" title="Đóng">×</button>
        `;
        previewArea.querySelector('.btn-remove').onclick = () => {
          previewArea.style.display = 'none';
          previewArea.innerHTML = '';
          fileInput.value = '';
        };
        showToast(err.message, 'error');
      }
    };
  }

  const settingsBtn = container.querySelector('#chat-settings-ai-btn');
  const keyModalAI = container.querySelector('#key-modal-ai');
  const closeAIConfigBtn = container.querySelector('#close-ai-config-btn');
  const goAdminConfigBtn = container.querySelector('#go-admin-config-btn');

  function selectRadio(name, value, root = container) {
    root.querySelectorAll(`input[name="${name}"]`).forEach((radio) => {
      radio.checked = radio.value === value;
    });
  }

  function getRadioValue(name, fallback, root = container) {
    return root.querySelector(`input[name="${name}"]:checked`)?.value || fallback;
  }

  function fillFallbackCheckboxes(sources = DEFAULT_FALLBACK_SOURCES) {
    const merged = { ...DEFAULT_FALLBACK_SOURCES, ...(sources || {}) };
    const map = {
      vbpl: container.querySelector('#modal-fallback-vbpl'),
      chinhphu: container.querySelector('#modal-fallback-chinhphu'),
      quochoi: container.querySelector('#modal-fallback-quochoi'),
      thuvienphapluat: container.querySelector('#modal-fallback-thuvienphapluat'),
      luatvietnam: container.querySelector('#modal-fallback-luatvietnam'),
    };
    Object.entries(map).forEach(([key, el]) => {
      if (!el) return;
      el.checked = merged[key] !== false;
    });
  }

  function collectFallbackCheckboxes() {
    return {
      vbpl: container.querySelector('#modal-fallback-vbpl')?.checked !== false,
      chinhphu: container.querySelector('#modal-fallback-chinhphu')?.checked !== false,
      quochoi: container.querySelector('#modal-fallback-quochoi')?.checked !== false,
      thuvienphapluat: container.querySelector('#modal-fallback-thuvienphapluat')?.checked !== false,
      luatvietnam: container.querySelector('#modal-fallback-luatvietnam')?.checked !== false,
    };
  }

  function syncModalFromConfig(config = null) {
    if (!isAdmin) return;
    const live = { ...fallbackConfig, ...(config || systemConfigCache || {}) };
    const geminiModelInput = container.querySelector('#modal-gemini-model');
    const geminiKeyInput = container.querySelector('#modal-gemini-key');
    const geminiKeyToggleBtn = container.querySelector('#modal-toggle-gemini-key-btn');
    const geminiKeyStatus = container.querySelector('#modal-gemini-key-status');
    const geminiRuntimeWarning = container.querySelector('#modal-gemini-runtime-warning');

    if (geminiModelInput) geminiModelInput.value = live.gemini_model || 'gemini-3.5-flash-lite';
    if (geminiKeyInput) {
      geminiKeyInput.value = live.gemini_api_key || '';
      geminiKeyInput.type = 'password';
    }
    if (geminiKeyToggleBtn) geminiKeyToggleBtn.textContent = 'Hiện key';
    if (geminiKeyStatus) {
      geminiKeyStatus.textContent = live.has_gemini_key
        ? 'Đã lưu Gemini API key. Bạn có thể xác nhận lại bất cứ lúc nào.'
        : 'Chưa có Gemini API key.';
      geminiKeyStatus.style.color = 'var(--text-muted)';
    }
    if (geminiRuntimeWarning) {
      const normalizedModel = String(live.gemini_model || '').trim().toLowerCase();
      const useProLikeModel = normalizedModel.includes('pro');
      if (live.has_gemini_key && useProLikeModel) {
        geminiRuntimeWarning.style.display = 'block';
        geminiRuntimeWarning.textContent = "Model Pro c\u00f3 th\u1ec3 b\u1ecb 404 theo quy\u1ec1n d\u1ef1 \u00e1n. H\u1ec7 th\u1ed1ng s\u1ebd t\u1ef1 fallback 1 l\u1ea7n sang gemini-3.5-flash-lite khi c\u1ea7n.";
      } else {
        geminiRuntimeWarning.style.display = 'none';
        geminiRuntimeWarning.textContent = '';
      }
    }

    selectRadio('modal_web_search_mode', live.web_search_mode || 'cse_with_fallback');
    fillFallbackCheckboxes(live.web_search_fallback_sources || DEFAULT_FALLBACK_SOURCES);
  }

  if (settingsBtn) {
    settingsBtn.onclick = async () => {
      await loadSystemConfig();
      syncModalFromConfig();
      if (keyModalAI) keyModalAI.style.display = 'flex';
    };
  }
  if (closeAIConfigBtn) {
    closeAIConfigBtn.onclick = () => {
      if (keyModalAI) keyModalAI.style.display = 'none';
    };
  }
  if (goAdminConfigBtn) {
    goAdminConfigBtn.onclick = () => {
      if (keyModalAI) keyModalAI.style.display = 'none';
      document.getElementById('nav-admin-panel')?.click();
    };
  }

  if (isAdmin) {
    syncModalFromConfig(configSnapshot);

    const modalSaveBtn = container.querySelector('#modal-save-config-btn');
    const modalStatus = container.querySelector('#modal-save-status');
    const modalGeminiModelInput = container.querySelector('#modal-gemini-model');
    const modalGeminiKey = container.querySelector('#modal-gemini-key');
    const modalToggleGeminiKeyBtn = container.querySelector('#modal-toggle-gemini-key-btn');
    const modalVerifyGeminiKeyBtn = container.querySelector('#modal-verify-gemini-key-btn');
    const modalVerifyGeminiOnSave = container.querySelector('#modal-verify-gemini-on-save');
    const modalGeminiKeyStatus = container.querySelector('#modal-gemini-key-status');

    const setModalKeyStatus = (message = '', kind = 'info') => {
      if (!modalGeminiKeyStatus) return;
      modalGeminiKeyStatus.textContent = message;
      if (kind === 'success') {
        modalGeminiKeyStatus.style.color = '#34d399';
        return;
      }
      if (kind === 'error') {
        modalGeminiKeyStatus.style.color = '#f87171';
        return;
      }
      modalGeminiKeyStatus.style.color = 'var(--text-muted)';
    };

    const runModalKeyValidation = async ({ useStoredKey = true } = {}) => {
      if (modalVerifyGeminiKeyBtn) {
        modalVerifyGeminiKeyBtn.disabled = true;
        modalVerifyGeminiKeyBtn.textContent = 'Đang kiểm tra...';
      }
      setModalKeyStatus('Đang xác nhận Gemini API key...');
      try {
        const result = await validateGeminiApiKey({
          apiKey: modalGeminiKey?.value?.trim() || '',
          useStoredKey,
          model: modalGeminiModelInput?.value?.trim() || 'gemini-3.5-flash-lite',
        });
        if (result?.valid !== true) {
          throw new Error(result?.message || 'Xác nhận key thất bại.');
        }
        setModalKeyStatus('✅ Gemini API key hợp lệ.', 'success');
        return true;
      } catch (err) {
        setModalKeyStatus(`❌ ${err.message}`, 'error');
        return false;
      } finally {
        if (modalVerifyGeminiKeyBtn) {
          modalVerifyGeminiKeyBtn.disabled = false;
          modalVerifyGeminiKeyBtn.textContent = 'Xác nhận key';
        }
      }
    };

    modalToggleGeminiKeyBtn?.addEventListener('click', () => {
      const showing = modalGeminiKey?.type === 'text';
      if (modalGeminiKey) modalGeminiKey.type = showing ? 'password' : 'text';
      modalToggleGeminiKeyBtn.textContent = showing ? 'Hiện key' : 'Ẩn key';
    });

    modalVerifyGeminiKeyBtn?.addEventListener('click', () => {
      const useStoredKey = !modalGeminiKey?.value?.trim();
      void runModalKeyValidation({ useStoredKey });
    });

    if (modalSaveBtn) {
      modalSaveBtn.onclick = async () => {
        modalSaveBtn.disabled = true;
        modalSaveBtn.textContent = '\u0110ang l\u01b0u...';
        modalStatus.textContent = '';
        modalStatus.style.color = 'var(--text-muted)';

        try {
          const configUpdate = {
            gemini_model: modalGeminiModelInput.value.trim() || 'gemini-3.5-flash-lite',
            web_search_provider: 'vertex_search',
            web_search_mode: getRadioValue('modal_web_search_mode', 'cse_with_fallback'),
            web_search_fallback_sources: collectFallbackCheckboxes(),
          };

          configUpdate.gemini_api_key = modalGeminiKey.value.trim();

          if (modalVerifyGeminiOnSave?.checked) {
            const useStoredKey = !configUpdate.gemini_api_key;
            const keyOk = await runModalKeyValidation({ useStoredKey });
            if (!keyOk) {
              modalStatus.textContent = '❌ Key chưa hợp lệ nên chưa lưu cấu hình.';
              modalStatus.style.color = '#dc2626';
              return;
            }
          }

          await updateSystemConfig(configUpdate);
          await loadSystemConfig();
          syncModalFromConfig(systemConfigCache);

          currentModelName = normalizeModelName(
            systemConfigCache?.gemini_model || 'gemini-3.5-flash-lite'
          ) || 'gemini-3.5-flash-lite';

          modalStatus.textContent = '\u2705 \u0110\u00e3 l\u01b0u v\u00e0 \u00e1p d\u1ee5ng ngay!';
          modalStatus.style.color = '#16a34a';
          setTimeout(() => {
            modalStatus.textContent = '';
          }, 2500);
        } catch (err) {
          modalStatus.textContent = '\u274c L\u1ed7i: ' + err.message;
          modalStatus.style.color = '#dc2626';
        } finally {
          modalSaveBtn.disabled = false;
          modalSaveBtn.textContent = 'L\u01b0u v\u00e0 \u00e1p d\u1ee5ng';
        }
      };
    }
  }

  initChat('', savedModel);

  void loadSystemConfig().then(() => {
    const nextModel = normalizeModelName(
      systemConfigCache?.gemini_model || savedModel
    ) || savedModel;
    if (nextModel !== currentModelName) {
      currentModelName = nextModel;
    }
  });

  const addMsg = (text, role) => {
    const div = document.createElement('div');
    div.className = `chat-msg ${role}`;
    if (role === 'ai') {
      div.classList.add('chat-msg-rich');
      div.innerHTML = renderAssistantRichText(text);
    } else {
      div.style.whiteSpace = 'pre-wrap';
      div.innerText = text;
    }
    msgsArea.appendChild(div);
    msgsArea.scrollTop = msgsArea.scrollHeight;
    return div;
  };

  const setAiMessageText = (targetDiv, text, isStreaming = false) => {
    if (!targetDiv) return;
    if (isStreaming) {
      targetDiv.style.whiteSpace = 'pre-wrap';
      targetDiv.textContent = text;
      return;
    }
    targetDiv.style.whiteSpace = 'normal';
    targetDiv.innerHTML = renderAssistantRichText(text);
  };

  const attachExportButtonIfNeeded = (query, answer, targetDiv) => {
    if (!isDraftRequest(query) || !isTemplateExportRequest(query)) return;
    const wrap = document.createElement('div');
    wrap.style.marginTop = '10px';
    const btn = document.createElement('button');
    btn.className = 'btn btn-secondary';
    btn.style.fontSize = '0.78rem';
    btn.textContent = '\ud83d\udcc4 Xu\u1ea5t file m\u1eabu .docx';
    btn.onclick = async () => {
      try {
        btn.disabled = true;
        btn.textContent = '\u0110ang xu\u1ea5t file...';
        await exportDraftToDocx(query, answer);
        btn.textContent = '\u2705 \u0110\u00e3 xu\u1ea5t .docx';
      } catch (e) {
        btn.textContent = 'L\u1ed7i xu\u1ea5t file';
        console.error(e);
      } finally {
        setTimeout(() => {
          btn.disabled = false;
          btn.textContent = '\ud83d\udcc4 Xu\u1ea5t file m\u1eabu .docx';
        }, 1800);
      }
    };
    wrap.appendChild(btn);
    targetDiv.appendChild(wrap);
  };

  const appendInlineStatus = (targetDiv, message, type = 'ok') => {
    const line = document.createElement('div');
    line.style.marginTop = '8px';
    line.style.fontSize = '0.78rem';
    line.style.fontWeight = '600';
    line.style.color = type === 'ok' ? '#74c69d' : '#ff8fa3';
    line.textContent = message;
    targetDiv.appendChild(line);
  };

  const handleSend = async () => {
    const text = input.value.trim();
    if (!text && !attachedFile) return;

    input.value = '';
    sendBtn.disabled = true;

    let displayUserText = text;
    const queryText = text || 'Hãy tóm tắt và phân tích tài liệu đính kèm.';
    const hadAttachment = !!attachedFile;
    
    if (attachedFile) {
      displayUserText = `📄 [Đính kèm: ${attachedFile.name}]\n${text || 'Hãy tóm tắt và phân tích tài liệu đính kèm.'}`;
    }
    
    addMsg(displayUserText, 'user');

    const loaderMsg = hadAttachment ? '🔍 Đang phân tích tài liệu...' : '🔍 Đang tra cứu...';
    const aiMsgDiv = addMsg(loaderMsg, 'ai');

    // Clear attachment after capturing info (prevent re-sending stale file)
    if (hadAttachment) {
      attachedFile = null;
      if (previewArea) {
        previewArea.style.display = 'none';
        previewArea.innerHTML = '';
      }
      if (fileInput) fileInput.value = '';
    }

    try {
      const finalAnswer = await sendMessage(queryText, (full) => {
        setAiMessageText(aiMsgDiv, full, true);
        msgsArea.scrollTop = msgsArea.scrollHeight;
      });
      setAiMessageText(aiMsgDiv, finalAnswer, false);
      if (shouldAutoExportDocx(queryText)) {
        try {
          await exportDraftToDocx(queryText, finalAnswer);
          appendInlineStatus(aiMsgDiv, '\u2705 \u0110\u00e3 t\u1ef1 \u0111\u1ed9ng xu\u1ea5t file .docx theo y\u00eau c\u1ea7u.');
        } catch (exportError) {
          console.error(exportError);
          appendInlineStatus(aiMsgDiv, '\u274c Kh\u00f4ng th\u1ec3 t\u1ef1 \u0111\u1ed9ng xu\u1ea5t .docx. B\u1ea1n b\u1ea5m n\u00fat xu\u1ea5t b\u00ean d\u01b0\u1edbi \u0111\u1ec3 th\u1eed l\u1ea1i.', 'error');
        }
      }
      attachExportButtonIfNeeded(queryText, finalAnswer, aiMsgDiv);
      msgsArea.scrollTop = msgsArea.scrollHeight;
    } catch (e) {
      aiMsgDiv.innerText = '\u274c L\u1ed7i: ' + e.message;
      aiMsgDiv.classList.add('error');
    } finally {
      sendBtn.disabled = false;
    }
  };

  if (sendBtn) sendBtn.onclick = handleSend;
  if (input) input.onkeypress = (e) => { if (e.key === 'Enter') handleSend(); };
}

