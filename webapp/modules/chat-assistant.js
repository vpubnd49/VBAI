/**
 * Chat Assistant Module — Legal & Administrative Consultant
 */
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { Document, Packer, Paragraph, TextRun, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';

import { firebaseConfig } from '../firebase-config.js';

import {
  sendChatRequest,
  checkProxyStatus,
  sendAudioTranscriptionViaChat,
  isGeminiOpenAIEndpoint,
} from './ai-proxy.js';

const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_MEETING_TRANSCRIBE_API_KEY = "AIzaSyAa4rHozoUWV4BLJ0XIOKFlqQMalQXb0X4";
const STRICT_MEETING_AUDIO_MODEL = "gemini-2.5-pro";
const GOOGLE_GEMINI_OPENAI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/openai";

let aiClient = null;
let chatSession = null;
let currentModelName = DEFAULT_MODEL;
let useProxy = (localStorage.getItem('vbai_proxy_enabled_chat') ?? 'true') === 'true';

function isProxyUnavailableError(error) {
  const msg = String(error?.message || "").toLowerCase();
  return (
    msg.includes("failed to fetch")
    || msg.includes("networkerror")
    || msg.includes("load failed")
    || msg.includes("timeout")
    || msg.includes("khong ket noi")
    || msg.includes("cors")
  );
}

function isProxyToolUnsupportedError(error) {
  const msg = String(error?.message || "").toLowerCase();
  return (
    msg.includes("tool")
    || msg.includes("web_search")
    || msg.includes("unsupported")
    || msg.includes("invalid_request_error")
    || msg.includes("unknown field")
  );
}

function shouldUseProxyWebSearchTool() {
  return (localStorage.getItem('vbai_proxy_web_search') ?? 'true') === 'true';
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

function getCurrentProxyEndpoint() {
  const endpoint = (
    localStorage.getItem('vbai_openai_endpoint')
    || localStorage.getItem('vbai_proxy_endpoint_chat')
    || ""
  ).trim();
  return endpoint;
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

const SYSTEM_INSTRUCTION = `Bạn là Trợ Lý Pháp Lý VBAI — một chuyên gia tư vấn pháp luật Việt Nam hàng đầu. 

## NGUYÊN TẮC CỐT LÕI:
1. **LUÔN TRA CỨU GOOGLE SEARCH** để lấy thông tin mới nhất trước khi trả lời. KHÔNG BAO GIỜ trả lời từ kiến thức cũ nếu có thể tra cứu được.
2. **ƯU TIÊN NGUỒN CHÍNH THỐNG** theo thứ tự:
   - Các Cổng thông tin điện tử của Chính phủ, các Bộ, Ngành và UBND các tỉnh/thành phố (tên miền **.gov.vn**)
   - dangcongsan.vn (Báo điện tử Đảng Cộng sản Việt Nam), tulieuvankien.dangcongsan.vn
   - vanban.chinhphu.vn (Cổng thông tin Chính phủ)
   - vbpl.vn (Cơ sở dữ liệu Quốc gia về Văn bản Pháp luật)
   - thuvienphapluat.vn (Thư viện Pháp luật)
   - luatvietnam.vn (Luật Việt Nam)
3. **SO SÁNH CŨ - MỚI**: Khi trả lời, LUÔN nêu rõ:
   - Văn bản hiện hành (mới nhất) là gì, số hiệu, ngày ban hành
   - Văn bản cũ nào đã bị thay thế/sửa đổi/bổ sung
   - Điểm khác biệt chính giữa quy định cũ và mới
4. **TRÍCH DẪN CHÍNH XÁC**: Ghi rõ Điều, Khoản, Điểm cụ thể. Nếu không chắc chắn, phải nói rõ.
5. **CẢNH BÁO**: Nếu một văn bản đã hết hiệu lực hoặc bị sửa đổi, PHẢI cảnh báo người dùng ngay lập tức.

## ĐỊNH DẠNG TRẢ LỜI:
- Sử dụng tiếng Việt, chuyên nghiệp, rõ ràng
- Ghi nguồn tham khảo (link website) ở cuối câu trả lời
- Khi liệt kê văn bản, ghi theo format: [Loại VB] [Số hiệu]/[Năm] — [Tiêu đề] — Hiệu lực: [Còn/Hết]
- Nếu câu hỏi phức tạp, chia thành các mục rõ ràng

## SOẠN THẢO VĂN BẢN (QUAN TRỌNG):
Khi người dùng yêu cầu soạn thảo, dự thảo, hoặc tạo mẫu văn bản (quyết định, nghị quyết, báo cáo, tờ trình, thông báo, kế hoạch, công văn...), BẮT BUỘC phải tuân thủ cấu trúc sau:

1. **Phần tư vấn ngắn gọn** (nếu cần): Giải thích căn cứ pháp lý, lưu ý quan trọng.
2. **Phần dự thảo văn bản**: PHẢI bắt đầu bằng dòng tên CƠ QUAN BAN HÀNH viết IN HOA (ví dụ: "ỦY BAN NHÂN DÂN TỈNH LÂM ĐỒNG" hoặc "ĐẢNG BỘ TỈNH LÂM ĐỒNG"). Tiếp theo là cấu trúc đầy đủ:
   - Tên cơ quan (IN HOA, in đậm)
   - Số ký hiệu: Số: .../QĐ-UBND (hoặc tương ứng)
   - Quốc hiệu, tiêu ngữ (nếu là VB chính quyền)
   - Địa danh, ngày tháng năm
   - TÊN LOẠI VĂN BẢN (IN HOA, in đậm): QUYẾT ĐỊNH / NGHỊ QUYẾT / BÁO CÁO...
   - Trích yếu: Về việc...
   - Phần căn cứ (in nghiêng)
   - Nội dung: Điều 1, Điều 2...
   - Nơi nhận và chữ ký
3. **Phần lưu ý cuối** (nếu cần): Ghi chú thêm, nguồn tham khảo.

## LƯU Ý ĐẶC BIỆT:
- Luôn kiểm tra xem văn bản pháp luật hoặc quy định, hướng dẫn của Đảng có bị sửa đổi, bổ sung, thay thế không.
- Ưu tiên cung cấp thông tin mới nhất từ năm 2024-2026.
- Nếu người dùng hỏi về công tác Đảng (Đại hội, tổ chức, kiểm tra, văn phòng cấp ủy...), hãy tra cứu trên hệ thống dangcongsan.vn hoặc các trang thông tin Đảng bộ.
- Nếu chưa đủ thông tin, hãy đề xuất người dùng kiểm tra trực tiếp tại các trang web chính thống.`;

const FAST_SYSTEM_INSTRUCTION = `Ban la Tro ly phap ly VBAI.
- Tra loi bang tieng Viet ro rang, de hieu.
- Neu cau hoi lien quan quy dinh moi nhat/hieu luc, uu tien tra cuu web truoc khi ket luan.
- Uu tien nguon chinh thong: chinhphu.vn, vbpl.vn, .gov.vn, dangcongsan.vn.
- Phai bao quat gan nhu day du cac y trong yeu cau; neu cau hoi co nhieu y thi tra loi theo tung muc tuong ung, khong bo sot.
- Neu khong chac chan, noi ro muc do chac chan.
- Cau tra loi theo thu tu: ket luan chinh, can cu phap ly, diem can luu y, link tham khao.
- Khong noi ve han che ky thuat nhu "khong co cong cu web", "khong co realtime", "khong truy cap duoc internet".
- Cau hoi goi y tra cuu tiep phai tiep noi dung chu de vua tra loi, khong chuyen chu de.
- Ket thuc moi cau tra loi bang mot cau hoi goi y de nguoi dung tra cuu tiep.
`;

const CHAT_CACHE_STORAGE_KEY = 'vbai_chat_cache_v1';
const CHAT_CACHE_MAX_ITEMS = 40;
const CHAT_CACHE_TTL_MS = 5 * 60 * 1000;
const CHAT_CACHE_TTL_TIME_SENSITIVE_MS = 60 * 1000;
const CHAT_CONTEXT_MAX_TURNS = 6;

let allSkills = [];
let recentTurns = [];
let lastUserQuery = "";
let lastAssistantReply = "";

async function loadSkills() {
  try {
    const response = await fetch('./skills-manifest.json');
    allSkills = await response.json();
  } catch (e) {
    console.warn("Lỗi tải Skills cho Chat Assistant:", e);
  }
}

function normalizeVietnamese(text = '') {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0111/g, 'd');
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

function isTimeSensitiveQuery(text = '') {
  const t = normalizeVietnamese(text);
  return /(moi nhat|cap nhat|hom nay|hieu luc|sua doi|bo sung|thay the|van ban moi|nam 2026)/.test(t);
}

function shouldPreferWebSearch(text = '') {
  const t = normalizeVietnamese(text);
  if (isTimeSensitiveQuery(t)) return true;
  return /(luat|nghi dinh|thong tu|quyet dinh|quy dinh|van ban|chinh sach|huong dan)/.test(t);
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

function makeChatCacheKey(text, model, useProxy, useWebSearch) {
  return [
    normalizeVietnamese(text).replace(/\s+/g, ' ').trim(),
    String(model || '').trim().toLowerCase(),
    useProxy ? 'proxy' : 'direct',
    useWebSearch ? 'ws1' : 'ws0'
  ].join('||');
}

function getCachedChatAnswer(text, model, useProxy, useWebSearch) {
  const store = getChatCacheStore();
  const key = makeChatCacheKey(text, model, useProxy, useWebSearch);
  const hit = store[key];
  if (!hit || typeof hit !== 'object') return '';
  if (!hit.expiresAt || Date.now() > hit.expiresAt) {
    delete store[key];
    saveChatCacheStore(store);
    return '';
  }
  return typeof hit.text === 'string' ? hit.text : '';
}

function setCachedChatAnswer(text, model, useProxy, useWebSearch, answer) {
  const cleaned = String(answer || '').trim();
  if (!cleaned) return;

  const ttl = isTimeSensitiveQuery(text) ? CHAT_CACHE_TTL_TIME_SENSITIVE_MS : CHAT_CACHE_TTL_MS;
  const store = getChatCacheStore();
  const key = makeChatCacheKey(text, model, useProxy, useWebSearch);
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

function buildRecentContextBlock() {
  if (recentTurns.length === 0) return "";
  return recentTurns
    .slice(-4)
    .map((t) => `${t.role === "user" ? "Người dùng" : "Trợ lý"}: ${t.content}`)
    .join("\n");
}

function shouldTreatAsFollowUpQuery(query = "") {
  if (!lastUserQuery) return false;
  const t = normalizeVietnamese(query);
  if (!t) return false;

  const hasExplicitNewTopic = /(luat|nghi dinh|thong tu|quyet dinh|to trinh|thong bao|nghi quyet|bao cao|cong van|van ban|chinh sach|huong dan|ve viec)/.test(t);
  if (/(uy quyen|uy quyen la gi|co nghia la gi|co nghia|the nao|ra sao|noi ro|lam ro|ky hon|chi tiet hon|bo sung)/.test(t)) return true;
  if (/(cau hoi thu 2|cau thu 2|noi dung tren|y tren|van de nay|chu de nay|phan nay)/.test(t)) return true;
  if (!hasExplicitNewTopic && t.length <= 90) return true;
  return false;
}

function buildContextAwareUserPrompt(query = "") {
  const q = String(query || "").trim();
  if (!q) return q;
  if (!shouldTreatAsFollowUpQuery(q)) return q;

  const contextLines = [];
  if (lastUserQuery) contextLines.push(`- Câu trước của người dùng: "${lastUserQuery}"`);
  if (lastAssistantReply) {
    const shortReply = lastAssistantReply.length > 280 ? `${lastAssistantReply.slice(0, 277)}...` : lastAssistantReply;
    contextLines.push(`- Trợ lý vừa trả lời: "${shortReply}"`);
  }
  const recentContext = buildRecentContextBlock();
  if (recentContext) contextLines.push(`- Tóm tắt hội thoại gần nhất:\n${recentContext}`);

  return [
    "Đây là câu hỏi TIẾP NỐI cùng chủ đề, không phải chủ đề mới.",
    ...contextLines,
    `Câu hỏi tiếp theo của người dùng: "${q}"`,
    "Yêu cầu: trả lời đúng mạch nội dung trước đó, không hỏi lại chung chung, không chuyển sang chủ đề khác."
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
  if (!q) return "Bạn có muốn tôi làm rõ thêm điểm nào trong đúng nội dung vừa trả lời không?";

  const shortTopic = q.length > 120 ? `${q.slice(0, 117)}...` : q;
  if (isDraftRequest(q)) {
    if (isTemplateExportRequest(q)) {
      return `Bạn có muốn tôi xuất luôn file .docx cho nội dung "${shortTopic}" hay cần chỉnh thông tin cơ quan, số ký hiệu, ngày ký trước?`;
    }
    return `Bạn có muốn tôi chỉnh sâu thêm ngay trên nội dung "${shortTopic}" theo đúng thể thức văn bản không?`;
  }
  return `Bạn có muốn tôi làm rõ thêm điểm nào trong đúng nội dung "${shortTopic}" không?`;
}

function ensureFollowUpQuestion(answer = "", query = "") {
  const text = String(answer || "").trim();
  if (!text) return text;
  const cleaned = stripGenericClarificationLines(text)
    .replace(/tôi không gửi trực tiếp file\s*\.?docx[^.\n]*[.\n]?/gi, "")
    .replace(/luu y:\s*duoi dung la\s*\.?docx[^.\n]*[.\n]?/gi, "")
    .replace(/khong phai\s*\.?dox[^.\n]*[.\n]?/gi, "");
  const sanitized = stripTrailingFollowUpBlocks(
    cleaned.replace(/\n{1,2}Bạn có muốn tôi tra cứu[\s\S]*$/i, "").trim()
  );
  return `${sanitized}\n\n${buildContextualFollowUp(query)}`;
}

function inferDocumentType(query = "") {
  const t = normalizeVietnamese(query);
  if (t.includes('quyet dinh')) return 'QUYẾT ĐỊNH';
  if (t.includes('to trinh')) return 'TỜ TRÌNH';
  if (t.includes('thong bao')) return 'THÔNG BÁO';
  if (t.includes('bao cao')) return 'BÁO CÁO';
  if (t.includes('ke hoach')) return 'KẾ HOẠCH';
  if (t.includes('nghi quyet')) return 'NGHỊ QUYẾT';
  return 'VĂN BẢN';
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
  if (line.includes("ngày") && line.includes("tháng") && line.includes("năm")) {
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
      children: [new TextRun({ text: `MẪU ${docType}`, bold: true, size: 28, font: "Times New Roman" })]
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

function applyInlineMarkdown(text = "") {
  return String(text || "")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
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

  return `<div class="chat-compare-card"><div class="chat-compare-title">So sánh</div><div class="chat-table-wrap"><table class="chat-compare-table">${thead}${tbody}</table></div></div>`;
}

function renderAssistantRichText(rawText = "") {
  const src = String(rawText || "").replace(/\r/g, "");
  const lines = src.split("\n");
  const chunks = [];
  let i = 0;

  while (i < lines.length) {
    const ln = lines[i] || "";
    const trimmed = ln.trim();

    if (trimmed.startsWith("|") && i + 1 < lines.length && String(lines[i + 1] || "").trim().startsWith("|")) {
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

    chunks.push(applyInlineMarkdown(escapeHtml(ln)));
    i += 1;
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
      ? `${compactContent.slice(0, 4000)}\n...[Rút gọn nội dung tham chiếu]...`
      : compactContent;
    return `#### Tài liệu: ${fileName}\n${excerpt}`;
  }).join('\n\n');

  return `\n### Tài liệu tham chiếu\n${renderedReferences}\n`;
}

async function fetchWebSearchResults(query) {
  const googleKey = localStorage.getItem('vbai_google_search_key');
  const googleCx = localStorage.getItem('vbai_google_search_cx');

  if (!googleKey || !googleCx) return "";

  const domainClause = [
    'site:thuvienphapluat.vn',
    'site:vbpl.vn',
    'site:luatvietnam.vn',
    'site:vanban.chinhphu.vn',
  ].join(' OR ');
  const constrainedQuery = `${query} (${domainClause})`;

  try {
    const url = `https://www.googleapis.com/customsearch/v1?key=${googleKey}&cx=${googleCx}&q=${encodeURIComponent(constrainedQuery)}&num=5&sort=date`;
    const response = await fetch(url);
    if (!response.ok) return "";

    const data = await response.json();
    const items = (data.items || []).filter((item) => {
      const link = String(item?.link || '').toLowerCase();
      return (
        link.includes('thuvienphapluat.vn')
        || link.includes('vbpl.vn')
        || link.includes('luatvietnam.vn')
        || link.includes('vanban.chinhphu.vn')
      );
    });

    if (!items.length) return "";
    return items.slice(0, 5).map(item => `- [${item.title}](${item.link}): ${item.snippet}`).join("\n\n");
  } catch (e) {
    console.warn("Google API failed:", e);
    return "";
  }
}

async function resetAllConfigAndSetOpenAIKey(newKey) {
    Object.keys(localStorage).filter(k => k.startsWith('vbai_')).forEach(k => localStorage.removeItem(k));
    sessionStorage.removeItem('vbai_chat_cache_v1');

    const contexts = ['chat', 'spellcheck', 'pdf', 'meeting', 'meeting_transcribe'];
    contexts.forEach(ctx => {
      localStorage.setItem(`vbai_proxy_api_key_${ctx}`, newKey);
      localStorage.setItem(`vbai_proxy_enabled_${ctx}`, 'true');
      localStorage.setItem(`vbai_proxy_profile_${ctx}`, 'direct_openai');
    });

    localStorage.setItem('vbai_router_model', 'gpt-4o-mini');
    localStorage.setItem('vbai_transcribe_model', 'whisper-1');
    localStorage.setItem('vbai_router_model_meeting', 'gpt-4o-mini');

    try {
      const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
      const db = getFirestore(app);
      await setDoc(doc(db, 'config', 'system'), {
        openai_api_key: newKey,
        openai_endpoint: '',
        router_model: 'gpt-4o-mini',
        router_profile: 'direct_openai',
        router_proxy_enabled_chat: true,
        router_transcribe_api_key: newKey,
      }, { merge: true });
    } catch (e) {
      console.warn('Firestore save failed:', e);
    }

    if (window.initChat) {
      initChat(newKey, 'gpt-4o-mini');
    }

    alert('✅ Đã reset cấu hình và lưu API key thành công!\nHãy reload trang để áp dụng.');
  }

export function initChat(apiKey, modelName = DEFAULT_MODEL) {
  const normalizedModel = normalizeModelName(
    modelName
    || localStorage.getItem('vbai_router_model')
    || DEFAULT_MODEL
  );
  currentModelName = normalizedModel || DEFAULT_MODEL;
  
  try {
    aiClient = { proxy: true };
    chatSession = null;
    recentTurns = [];
    lastUserQuery = "";
    lastAssistantReply = "";
    loadSkills(); // Tải skills khi init
    return true;
  } catch (e) {
    console.error("Chat Init Error:", e);
    return false;
  }
}

export async function sendMessage(text, onChunk) {
  if (!aiClient) throw new Error("Chua cau hinh API Key");

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
  dynamicInstruction += "\n\nYEU CAU BAT BUOC:\n- Luon uu tien thong tin moi nhat qua web search khi kha dung.\n- Khong duoc noi rang ban khong co cong cu web/realtime.\n- Phai bao quat gan nhu day du cac y trong yeu cau cua nguoi dung, neu cau hoi co nhieu y thi tra loi theo tung muc tuong ung, khong bo sot y chinh.\n- Neu co phan goi y tra cuu tiep thi bat buoc bam sat dung chu de vua tra loi, khong duoc chuyen sang chu de khac.\n- Khong dat lai cau hoi tong quat kieu xin them chu de moi neu nguoi dung dang hoi tiep cung mot chu de.\n- Cuoi moi cau tra loi phai hoi nguoi dung co can tra cuu tiep hay khong.";

  try {
    let fullText = "";
    let useWebSearch = shouldUseProxyWebSearchTool();
    const cached = getCachedChatAnswer(rawUserText, currentModelName, true, useWebSearch);
    if (cached) {
      pushTurn("user", rawUserText);
      pushTurn("assistant", cached);
      lastUserQuery = rawUserText;
      lastAssistantReply = stripTrailingFollowUpBlocks(cached);
      if (onChunk) onChunk(cached);
      return cached;
    }

    let finalUserText = contextualUserText;
    if (useWebSearch && shouldPreferWebSearch(rawUserText)) {
      if (onChunk) onChunk("Đang tra cứu dữ liệu mới nhất từ Internet...\n");
      const searchResults = await fetchWebSearchResults(rawUserText);
      if (searchResults) {
        finalUserText = `${contextualUserText}\n\n[Dữ liệu trực tuyến cập nhật để tham khảo]:\n${searchResults}`;
      }
    }

    const messages = [
      { role: "system", content: dynamicInstruction },
      ...recentTurns.map(t => ({ role: t.role, content: t.content })),
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
        throw new Error("AI trả về phản hồi rỗng.");
      }
    } catch (proxyError) {
      throw new Error(`Lỗi AI: ${proxyError?.message || proxyError}. Vui lòng kiểm tra lại API Key hoặc Endpoint.`);
    }

    fullText = ensureFollowUpQuestion(fullText, rawUserText);

    setCachedChatAnswer(rawUserText, currentModelName, true, useWebSearch, fullText);
    pushTurn("user", rawUserText);
    pushTurn("assistant", fullText);
    lastUserQuery = rawUserText;
    lastAssistantReply = stripTrailingFollowUpBlocks(fullText);

    try {
      const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
      const db = getFirestore(app);
      addDoc(collection(db, "search_logs"), {
        query: rawUserText,
        model: `${currentModelName}`,
        userEmail: window.currentUser?.email || "Unknown",
        timestamp: serverTimestamp(),
        skillsApplied: matchedSkills.map(s => s.id)
      }).catch(err => console.warn("Log Err:", err));
    } catch (e) {}

    if (onChunk) onChunk(fullText);
    return fullText;
  } catch (e) {
    console.error("Send Error:", e);
    throw e;
  }
}

export async function renderChatUI(container) {
  const savedProvider = localStorage.getItem('vbai_active_provider') || 'openai';
  const savedModel = normalizeModelName(
    savedProvider === 'gemini' 
    ? (localStorage.getItem('vbai_gemini_model') || 'gemini-2.0-pro-exp-02-05')
    : (localStorage.getItem('vbai_router_model') || DEFAULT_MODEL)
  ) || DEFAULT_MODEL;
  
  const savedKey = localStorage.getItem('vbai_openai_api_key') || '';
  const savedEndpoint = localStorage.getItem('vbai_openai_endpoint') || 'https://api.openai.com/v1';
  
  const savedGeminiKey = localStorage.getItem('vbai_gemini_api_key') || '';
  const savedGeminiModel = localStorage.getItem('vbai_gemini_model') || 'gemini-2.0-pro-exp-02-05';

  const savedGoogleSearchKey = localStorage.getItem('vbai_google_search_key') || '';
  const savedGoogleSearchCx = localStorage.getItem('vbai_google_search_cx') || '';
  
  container.innerHTML = `
    <div class="chat-assistant-panel panel-group">
      <div class="panel-header">
        <div class="panel-header-icon">⚖️</div>
        Trợ Lý Tra Cứu Pháp Luật & Quy Định Đảng AI
        <div style="flex:1"></div>
        <button id="chat-settings-openai-btn" class="btn-icon" title="Cấu hình AI" style="width:28px; height:28px; font-size:0.72rem; margin-left:6px">🧩</button>
      </div>
      <div class="panel-body">
        <div id="chat-messages" class="chat-messages-area">
          <div class="chat-msg ai">
            <strong>Xin chào! Tôi là Trợ lý VBAI.</strong><br>
            Tôi hỗ trợ tra cứu các quy định pháp luật và các quy định, hướng dẫn của cơ quan Hành chính và cơ quan Đảng mới nhất.
          </div>
        </div>
        
        <div class="chat-input-wrapper">
          <input type="text" id="chat-input" placeholder="Nhập nội dung cần tra cứu..." class="form-input chat-input-field">
          <button id="chat-send-btn" class="btn btn-primary chat-send-btn">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M2.5 10l15-7.5L10 10l7.5 7.5L2.5 10z" fill="currentColor"/></svg>
          </button>
        </div>
        <div class="chat-disclaimer" style="margin-top: 12px; padding: 10px; background: rgba(239, 68, 68, 0.05); border-left: 3px solid #ef4444; border-radius: 4px; font-size: 0.75rem; color: var(--text-secondary);">
          <strong>⚠️ CẢNH BÁO RỦI RO:</strong> VBAI là công cụ hỗ trợ dựa trên AI, không thay thế trách nhiệm của cán bộ, công chức trong việc kiểm tra, đối chiếu với văn bản pháp luật chính thức. Kết quả do AI cung cấp chỉ mang tính chất gợi ý, người dùng cần kiểm tra hiệu lực văn bản trước khi đưa vào dự thảo.
        </div>
      </div>
    </div>

    <!-- AI Config Modal -->
    <div id="key-modal-openai" class="modal-overlay" style="display:none">
      <div class="modal-content panel-group config-ai-modal" style="max-width:500px">
        <div class="panel-header">Cấu hình AI & Tìm kiếm pháp luật</div>
        <div class="panel-body config-ai-modal-body" style="max-height:80vh; overflow-y:auto">
          
          <div class="form-group" style="margin-bottom:16px">
            <label class="form-label">Nhà cung cấp AI đang dùng</label>
            <div style="display:flex; gap:12px; margin-top:4px">
              <label style="display:flex; align-items:center; gap:6px; cursor:pointer">
                <input type="radio" name="ai-provider" value="openai" ${savedProvider === 'openai' ? 'checked' : ''}> OpenAI
              </label>
              <label style="display:flex; align-items:center; gap:6px; cursor:pointer">
                <input type="radio" name="ai-provider" value="gemini" ${savedProvider === 'gemini' ? 'checked' : ''}> Google Gemini
              </label>
            </div>
          </div>

          <div id="section-openai" style="display:${savedProvider === 'openai' ? 'block' : 'none'}; border:1px solid var(--border-subtle); padding:12px; border-radius:8px; margin-bottom:16px">
            <p style="font-weight:700; font-size:0.85rem; margin:0 0 10px; color:var(--daquy-600)">⚙️ Cấu hình OpenAI</p>
            <div class="form-group" style="margin-bottom:12px">
              <label class="form-label">OpenAI API Key</label>
              <input type="password" id="openai-api-key-input" class="form-input" value="${savedKey}" placeholder="sk-...">
            </div>
            <div class="form-group" style="margin-bottom:12px">
              <label class="form-label">OpenAI Endpoint</label>
              <input type="text" id="openai-endpoint-input" class="form-input" value="${savedEndpoint}" placeholder="https://api.openai.com/v1">
            </div>
            <div class="form-group">
              <label class="form-label">Model AI</label>
              <input type="text" id="openai-model-select" class="form-input" value="${savedModel}" placeholder="gpt-4o-mini">
            </div>
          </div>

          <div id="section-gemini" style="display:${savedProvider === 'gemini' ? 'block' : 'none'}; border:1px solid var(--border-subtle); padding:12px; border-radius:8px; margin-bottom:16px">
            <p style="font-weight:700; font-size:0.85rem; margin:0 0 10px; color:var(--pine-600)">⚙️ Cấu hình Google Gemini</p>
            <div class="form-group" style="margin-bottom:12px">
              <label class="form-label">Gemini API Key</label>
              <input type="password" id="gemini-api-key-input" class="form-input" value="${savedGeminiKey}" placeholder="AIza...">
            </div>
            <div class="form-group">
              <label class="form-label">Model Gemini</label>
              <input type="text" id="gemini-model-input" class="form-input" value="${savedGeminiModel}" placeholder="gemini-2.0-pro-exp-02-05">
            </div>
            <p style="font-size:0.75rem; color:var(--text-secondary); margin-top:8px">Gemini sẽ tự động kết nối qua OpenAI-compatible endpoint của Google.</p>
          </div>

          <div style="padding:10px; background:rgba(16,185,129,0.05); border-radius:8px; margin-bottom:12px; border:1px solid rgba(16,185,129,0.1);">
            <p style="font-size:0.8rem; color:var(--pine-600); font-weight:700; margin:0 0 4px">🔍 Tra cứu pháp luật (Google CSE)</p>
            <p style="font-size:0.74rem; color:var(--text-secondary); margin:0">Cấu hình để AI có thể tìm kiếm dữ liệu mới nhất trên Internet.</p>
          </div>

          <div class="form-group" style="margin-bottom:12px">
            <label class="form-label">Google CSE API Key</label>
            <input type="password" id="google-cse-key-input" class="form-input" value="${savedGoogleSearchKey}" placeholder="AIza...">
          </div>
          <div class="form-group" style="margin-bottom:12px">
            <label class="form-label">Google CSE Engine ID (CX)</label>
            <input type="text" id="google-cse-cx-input" class="form-input" value="${savedGoogleSearchCx}" placeholder="Ví dụ: 123abc:xyz...">
          </div>

          <div class="btn-row" style="margin-top:20px; border-top:1px solid var(--border-subtle); padding-top:16px">
            <button id="save-openai-config-btn" class="btn btn-primary" style="flex:1">Lưu cấu hình</button>
            <button id="close-openai-config-btn" class="btn btn-secondary">Đóng</button>
          </div>
        </div>
      </div>
    </div>
  `;

  const msgsArea = container.querySelector('#chat-messages');
  const input = container.querySelector('#chat-input');
  const sendBtn = container.querySelector('#chat-send-btn');

  const settingsBtn = container.querySelector('#chat-settings-openai-btn');
  const keyModalOpenAI = container.querySelector('#key-modal-openai');
  
  // Section toggle logic
  const providerRadios = container.querySelectorAll('input[name="ai-provider"]');
  const sectionOpenAI = container.querySelector('#section-openai');
  const sectionGemini = container.querySelector('#section-gemini');

  providerRadios.forEach(radio => {
    radio.onchange = () => {
      sectionOpenAI.style.display = radio.value === 'openai' ? 'block' : 'none';
      sectionGemini.style.display = radio.value === 'gemini' ? 'block' : 'none';
    };
  });

  const openaiKeyInput = container.querySelector('#openai-api-key-input');
  const openaiEndpointInput = container.querySelector('#openai-endpoint-input');
  const openaiModelSelect = container.querySelector('#openai-model-select');
  
  const geminiKeyInput = container.querySelector('#gemini-api-key-input');
  const geminiModelInput = container.querySelector('#gemini-model-input');

  const googleCseKeyInput = container.querySelector('#google-cse-key-input');
  const googleCseCxInput = container.querySelector('#google-cse-cx-input');
  const saveOpenAIConfigBtn = container.querySelector('#save-openai-config-btn');
  const closeOpenAIConfigBtn = container.querySelector('#close-openai-config-btn');

  if (settingsBtn) {
    settingsBtn.onclick = () => {
      if (keyModalOpenAI) keyModalOpenAI.style.display = 'flex';
    };
  }
  if (closeOpenAIConfigBtn) {
    closeOpenAIConfigBtn.onclick = () => {
      if (keyModalOpenAI) keyModalOpenAI.style.display = 'none';
    };
  }
  if (saveOpenAIConfigBtn) {
    saveOpenAIConfigBtn.onclick = async () => {
      const activeProvider = container.querySelector('input[name="ai-provider"]:checked')?.value || 'openai';
      
      const openaiKey = (openaiKeyInput?.value || '').trim();
      const openaiEndpoint = (openaiEndpointInput?.value || '').trim() || 'https://api.openai.com/v1';
      const openaiModel = normalizeModelName(openaiModelSelect?.value || '') || 'gpt-4o-mini';
      
      const geminiKey = (geminiKeyInput?.value || '').trim();
      const geminiModel = (geminiModelInput?.value || '').trim() || 'gemini-2.0-pro-exp-02-05';

      const googleKey = (googleCseKeyInput?.value || '').trim();
      const googleCx = (googleCseCxInput?.value || '').trim();

      // Basic validation
      if (activeProvider === 'openai' && !openaiKey) { alert('Vui lòng nhập OpenAI API key.'); return; }
      if (activeProvider === 'gemini' && !geminiKey) { alert('Vui lòng nhập Gemini API key.'); return; }

      // Save to localStorage
      localStorage.setItem('vbai_active_provider', activeProvider);
      localStorage.setItem('vbai_openai_api_key', openaiKey);
      localStorage.setItem('vbai_openai_endpoint', openaiEndpoint);
      localStorage.setItem('vbai_router_model', openaiModel);
      
      localStorage.setItem('vbai_gemini_api_key', geminiKey);
      localStorage.setItem('vbai_gemini_model', geminiModel);

      localStorage.setItem('vbai_google_search_key', googleKey);
      localStorage.setItem('vbai_google_search_cx', googleCx);

      try {
        const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
        const db = getFirestore(app);
        await setDoc(doc(db, 'config', 'system'), {
          active_provider: activeProvider,
          openai_api_key: openaiKey,
          openai_endpoint: openaiEndpoint,
          router_model: openaiModel,
          gemini_api_key: geminiKey,
          gemini_model: geminiModel,
          google_search_key: googleKey,
          google_search_cx: googleCx,
        }, { merge: true });
      } catch (e) {
        console.warn('Firestore save failed:', e);
      }

      alert('Đã lưu cấu hình thành công!');
      if (keyModalOpenAI) keyModalOpenAI.style.display = 'none';
      window.location.reload();
    };
  }

  initChat('', savedModel);

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
    btn.textContent = '⬇ Xuất file mẫu .docx';
    btn.onclick = async () => {
      try {
        btn.disabled = true;
        btn.textContent = 'Đang xuất file...';
        await exportDraftToDocx(query, answer);
        btn.textContent = '✓ Đã xuất .docx';
      } catch (e) {
        btn.textContent = 'Lỗi xuất file';
        console.error(e);
      } finally {
        setTimeout(() => {
          btn.disabled = false;
          btn.textContent = '⬇ Xuất file mẫu .docx';
        }, 1800);
      }
    };
    wrap.appendChild(btn);
    targetDiv.appendChild(wrap);
  };

  const appendInlineStatus = (targetDiv, message, type = "ok") => {
    const line = document.createElement("div");
    line.style.marginTop = "8px";
    line.style.fontSize = "0.78rem";
    line.style.fontWeight = "600";
    line.style.color = type === "ok" ? "#74c69d" : "#ff8fa3";
    line.textContent = message;
    targetDiv.appendChild(line);
  };

  const handleSend = async () => {
    const text = input.value.trim();
    if (!text) return;
    const currentKey = (localStorage.getItem('vbai_openai_api_key') || '').trim();
    if (!currentKey) {
      alert("Vui lòng cấu hình API Key trước (bấm vào icon ⚙️)");
      return;
    }

    input.value = '';
    sendBtn.disabled = true;
    addMsg(text, 'user');
    
    const aiMsgDiv = addMsg('🔍 Đang tra cứu...', 'ai');
    try {
      const finalAnswer = await sendMessage(text, (full) => {
        setAiMessageText(aiMsgDiv, full, true);
        msgsArea.scrollTop = msgsArea.scrollHeight;
      });
      setAiMessageText(aiMsgDiv, finalAnswer, false);
      if (shouldAutoExportDocx(text)) {
        try {
          await exportDraftToDocx(text, finalAnswer);
          appendInlineStatus(aiMsgDiv, "✅ Đã tự động xuất file .docx theo yêu cầu.");
        } catch (exportError) {
          console.error(exportError);
          appendInlineStatus(aiMsgDiv, "❌ Không thể tự động xuất .docx. Bạn bấm nút xuất bên dưới để thử lại.", "error");
        }
      }
      attachExportButtonIfNeeded(text, finalAnswer, aiMsgDiv);
      msgsArea.scrollTop = msgsArea.scrollHeight;
    } catch (e) {
      aiMsgDiv.innerText = "❌ Lỗi: " + e.message;
      aiMsgDiv.classList.add('error');
    } finally {
      sendBtn.disabled = false;
    }
  };

  if (sendBtn) sendBtn.onclick = handleSend;
  if (input) input.onkeypress = (e) => { if(e.key==='Enter') handleSend(); };
}

