/**
 * Chat Assistant Module — Legal & Administrative Consultant
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
} from './ai-proxy.js';

import { fetchSystemConfig, isCurrentUserAdmin, updateSystemConfig } from './system-config.js';
import { enforceTwoTierTerminology as applyTwoTierPolicy } from './legal-two-tier-policy.js';

const DEFAULT_MODEL = 'gpt-4.4';
const STRICT_MEETING_AUDIO_MODEL = 'gemini-2.5-pro';

let aiClient = null;
let chatSession = null;
let currentModelName = DEFAULT_MODEL;
let systemConfigCache = null;

async function loadSystemConfig() {
  try {
    systemConfigCache = await fetchSystemConfig();
  } catch (e) {
    console.warn('Không thể tải cấu hình hệ thống:', e);
  }
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

const SYSTEM_INSTRUCTION = `Bạn là Trợ lý hành chính pháp lý — một chuyên gia tư vấn pháp luật và nghiệp vụ hành chính Việt Nam.

## QUY TẮC BẮT BUỘC (KHÔNG ĐƯỢC PHÁT HIỆN):

1. Khi có kết quả tra cứu từ Internet (web search), BẠN CHỈ ĐƯỢC TRẢ LỜI DỰA TRÊN DỮ LIỆU ĐÓ. KHÔNG ĐƯỢC sử dụng bất kỳ kiến thức nội tộc nào (training data, knowledge cutoff) nếu web data chứa thông tin về cùng một văn bản/quy định.
2. Nếu web data chỉ đề cập đến văn bản năm 2024, 2025, 2026 hoặc có ngày ban hành/hiệu lực mới hơn so với kiến thức của bạn, BẠN PHẢI dùng web data và bỏ qua kiến thức cũ. KHÔNG ĐƯỢC nói "theo kiến thức của tôi..." khi web data tồn tại.
3. LUÔN trích dẫn rõ ràng: số hiệu văn bản, ngày ban hành, ngày hiệu lực, và nguồn URL. Nếu web data không có đầy đủ, ghi rõ "Dữ liệu web chưa cung cấp đủ thông tin về...".
4. Nếu người dùng hỏi về một văn bản cụ thể (có số hiệu), chỉ trả lời dựa trên web data tìm được về số hiệu đó. Nếu không tìm thấy, nói rõ "Không tìm thấy văn bản [số hiệu] trong dữ liệu tra cứu mới nhất" và không thêm thông tin từ kiến thức cũ. KHÔNG ĐƯỢC đề cập đến các số hiệu gần giống hoặc liên quan.
5. KHÔNG ĐƯỢC chuyển chủ đề, KHÔNG ĐƯỢC trả lời lan man, KHÔNG ĐƯỢC đưa ra thông tin không được hỏi.
6. KHÔNG ĐƯỢC tự ý mở rộng câu hỏi. Trả lời đúng và đủ những gì người dùng hỏi.
7. Cuối câu trả lời, LUÔN hỏi: "Bạn có muốn tôi tra cứu chi tiết hơn về [nội dung vừa trả lời] không?" Đây là câu hỏi duy nhất bạn được phép đặt thêm.

## ĐỊNH DẠNG TRẢ LỜI:
- Bắt đầu bằng: "Dựa trên dữ liệu tra cứu mới nhất [thời gian] từ Internet:"
- Liệt kê từng điểm theo yêu cầu của người dùng, mỗi điểm kèm: [số hiệu] [ngày] [nguồn].
- Nếu có nhiều nguồn, ưu tiên nguồn chính thức (quochoi.vn, chinhphu.vn, vbpl.vn).
- Không thêm bất kỳ thông tin nào không có trong web data.
- Không kết luận, không khẳng định nếu web data mâu thuẫn hoặc thiếu. Chỉ báo cáo đầy đủ những gì tìm được.

## CHỈ SỐ ƯU TIÊN:
- Năm 2024, 2025, 2026: ƯU TIÊN TUYỆT ĐỐI.
- Văn bản có ngày ban hành/hiệu lực mới hơn: LUÔN thay thế văn bản cũ.
- Web data mới hơn knowledge cutoff: LUÔN dùng web data.

## TỐI ƯU TRÁCH NHIỆM:
- Nếu web data rỗng hoặc không liên quan, nói rõ: "Không tìm thấy dữ liệu phù hợp từ Internet." và dừng lại, không tự ý trả lời bằng kiến thức cũ.
- Không được phép nói "Tôi không có truy cập Internet" hoặc "Tôi không có công cụ tra cứu".`;

const FAST_SYSTEM_INSTRUCTION = `Bạn là Trợ lý hành chính pháp lý.

## QUY TẮC CỨNG:
1. Chỉ trả lời dựa trên dữ liệu tra cứu mới nhất từ Google. KHÔNG ĐƯỢC dùng kiến thức cũ khi có web data.
2. Mọi thông tin phải có: số hiệu văn bản, ngày có hiệu lực, nguồn URL. Nếu thiếu, báo rõ.
3. Không chuyển chủ đề, không trả lời lan man, không thêm ý không được hỏi.
4. Năm 2024–2026 là ưu tiên cao nhất. Văn bản mới thay thế văn bản cũ.
5. Nếu không tìm thấy thông tin phù hợp, nói: "Không tìm thấy dữ liệu phù hợp từ Internet." và dừng lại.
6. Câu trả lời phải ngắn gọn, chính xác, chỉ gồm những gì tìm được.
7. Luôn kết thúc bằng: "Bạn có muốn tôi tra cứu chi tiết hơn về [nội dung vừa trả lời] không?"`;

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
  const isLegal = /(luat|nghi dinh|thong tu|quyet dinh|quy dinh|van ban|chinh sach|huong dan|so hieu|ngay ban hanh|hieu luc)/.test(t);
  return /(moi nhat|cap nhat|hom nay|hieu luc|sua doi|bo sung|thay the|van ban moi)/.test(t) || yearPattern.test(t) || isLegal;
}

function buildFreshnessGuardMessage(query = '', reason = '') {
  const topic = String(query || '').trim() || 'nội dung này';
  const reasonText = reason ? ` ${reason}` : '';
  return `Tôi chưa thể xác minh dữ liệu mới nhất từ Internet cho yêu cầu: "${topic}".${reasonText} Vui lòng nêu rõ hơn số hiệu văn bản, năm ban hành/hiệu lực hoặc kiểm tra thêm từ nguồn chính thức như vbpl.vn, chinhphu.vn, quochoi.vn.`;
}

function shouldPreferWebSearch(text = '') {
  const t = normalizeVietnamese(text);
  if (isTimeSensitiveQuery(t)) return true;
  return /(luat|nghi dinh|thong tu|quyet dinh|quy dinh|van ban|chinh sach|huong dan|tien luong|huu tri|bao hiem|thue|dat dai|xay dung|dau thau|doanh nghiep|can bo|cong chuc|uy quyen|phan cap|phan quyen|dieu\s*\d+|hieu luc)/.test(t);
}

function buildFreshWebSearchOptions(rawText = '') {
  const t = normalizeVietnamese(rawText);
  if (/(hom nay|hien tai|ngay nay)/.test(t)) {
    return { forceFresh: true, freshnessLevel: 'day', recencyDays: 7, timeoutMs: 20000 };
  }
  if (/(tuan nay|7 ngay|7ngay)/.test(t)) {
    return { forceFresh: true, freshnessLevel: 'week', recencyDays: 30, timeoutMs: 20000 };
  }
  if (/(thang nay|30 ngay|30ngay)/.test(t)) {
    return { forceFresh: true, freshnessLevel: 'month', recencyDays: 90, timeoutMs: 20000 };
  }
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

function extractPotentialDocNumber(text = '') {
  // Match patterns like: 117/2025/QH15, 30/2024/ND-CP, 15/2024/QĐ-BTC
  const match = String(text || '').match(/\b\d+\/\d{4}\/[A-Z0-9-]+\b/i);
  return match ? match[0].toUpperCase() : null;
}
function resolveWebSearchContext(rawUserText = '', expectedDocNumber = null) {
  const directDocNumber = expectedDocNumber || extractPotentialDocNumber(rawUserText);
  if (directDocNumber) {
    return {
      effectiveQuery: rawUserText,
      effectiveDocNumber: directDocNumber,
    };
  }

  const normalized = normalizeVietnamese(rawUserText);
  const isFollowupRef = /(luat tren|van ban tren|luat nay|van ban nay|noi dung uy quyen cua luat tren|cua luat tren|tren la gi|chi tiet|uy quyen|phan cap|phan quyen|dieu\s*\d+|hieu luc|ngay ban hanh)/.test(normalized);
  if (!isFollowupRef) {
    return {
      effectiveQuery: rawUserText,
      effectiveDocNumber: null,
    };
  }

  const contextDocNumber = extractPotentialDocNumber(`${lastUserQuery || ''} ${lastAssistantReply || ''}`) || String(lastResolvedDocNumber || '').toUpperCase() || null;
  if (!contextDocNumber) {
    return {
      effectiveQuery: rawUserText,
      effectiveDocNumber: null,
    };
  }

  return {
    effectiveQuery: `${rawUserText} ${contextDocNumber}`,
    effectiveDocNumber: contextDocNumber,
  };
}

function shouldForceContextualWebSearch(rawUserText = '', searchContext = {}) {
  if (!searchContext?.effectiveDocNumber) return false;
  const n = normalizeVietnamese(rawUserText);
  return /(uy quyen|phan cap|phan quyen|chi tiet|noi dung|dieu\s*\d+|hieu luc|ngay ban hanh|diem moi|toan van|luat tren|van ban tren|luat nay|van ban nay)/.test(n);
}

function rememberResolvedDocNumber(searchContext = {}, text = '') {
  const fromContext = String(searchContext?.effectiveDocNumber || '').trim().toUpperCase();
  if (fromContext) {
    lastResolvedDocNumber = fromContext;
    return;
  }
  const extracted = extractPotentialDocNumber(text);
  if (extracted) {
    lastResolvedDocNumber = extracted;
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
  const docNo = String(searchContext.effectiveDocNumber || '').toUpperCase();
  const hasDocNoInResults = String(searchResults || '').toUpperCase().includes(docNo);
  if (webSearchMeta?.exact_match !== true && !hasDocNoInResults) return false;
  const n = normalizeVietnamese(rawUserText);
  return /(luat|van ban|so hieu|uy quyen|phan cap|phan quyen|ngay ban hanh|hieu luc|toan van)/.test(n);
}

function buildEvidenceResponse(rawUserText = '', searchContext = {}, searchResults = '') {
  const docNo = searchContext?.effectiveDocNumber || '';
  const items = parseWebSearchMarkdownItems(searchResults).slice(0, 5);
  const normalizedQuery = normalizeVietnamese(rawUserText);
  const wantsDelegation = /(uy quyen|phan cap|phan quyen)/.test(normalizedQuery);

  const lines = [];
  lines.push(`Da xac nhan co van ban ${docNo} trong du lieu tra cuu moi nhat tu Internet.`);

  if (wantsDelegation) {
    const related = items.filter((it) => /(uy quyen|phan cap|phan quyen)/i.test(`${it.title} ${it.snippet}`));
    if (related.length > 0) {
      lines.push('Noi dung lien quan den uy quyen/phan cap tim thay:');
      related.slice(0, 3).forEach((it) => {
        lines.push(`- ${it.title}: ${it.snippet}`);
      });
    } else {
      lines.push('Cac ket qua da xac nhan van ban ton tai, nhung doan trich hien tai chua tra ve truc tiep cum \"uy quyen\".');
      lines.push('Ban co the mo cac nguon toan van ben duoi, toi se tiep tuc trich dung dieu/khoan uy quyen ngay sau khi ban xac nhan nguon uu tien.');
    }
  }

  if (items.length > 0) {
    lines.push('Nguon xac nhan:');
    items.forEach((it) => {
      lines.push(`- ${it.link}`);
    });
  }

  return lines.join('\n');
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
  if (!/\bso sanh\b/.test(n)) return null;

  const clausePattern = /\bkhoan\s+(\d+)\s+dieu\s+(\d+)\s+(?:voi|va|vs)\s+khoan\s+(\d+)\s+dieu\s+(\d+)\b/;
  const clauseMatch = n.match(clausePattern);
  if (clauseMatch) {
    return {
      left: { article: Number(clauseMatch[2]), clause: Number(clauseMatch[1]), point: null, label: `Khoản ${clauseMatch[1]} Điều ${clauseMatch[2]}` },
      right: { article: Number(clauseMatch[4]), clause: Number(clauseMatch[3]), point: null, label: `Khoản ${clauseMatch[3]} Điều ${clauseMatch[4]}` },
    };
  }

  const articlePattern = /\bdieu\s+(\d+)\s+(?:voi|va|vs)\s+dieu\s+(\d+)\b/;
  const articleMatch = n.match(articlePattern);
  if (articleMatch) {
    return {
      left: { article: Number(articleMatch[1]), clause: null, point: null, label: `Điều ${articleMatch[1]}` },
      right: { article: Number(articleMatch[2]), clause: null, point: null, label: `Điều ${articleMatch[2]}` },
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
          `Điều ${target.article || ''}`.trim(),
          `Khoản ${target.clause || ''}`.trim(),
          `Điểm ${target.point || ''}`.trim(),
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
    return `Chua tim thay trich dan chinh xac cho ${targetLabel}${docLabel} trong du lieu tra cuu hien tai. Vui long cung cap ro so hieu van ban hoac nguon toan van chinh thuc de toi trich dung nguyen van.`;
  }

  const strictHit = await extractStrictCitationFromLinks(links, target, searchContext?.effectiveDocNumber || '');
  if (!strictHit) {
    return `Chua tim thay trich dan chinh xac cho ${targetLabel}${docLabel} trong du lieu tra cuu hien tai. Vui long cung cap ro so hieu van ban hoac nguon toan van chinh thuc de toi trich dung nguyen van.`;
  }

  const targetTitle = [
    target.point ? `Diem ${target.point}` : null,
    target.clause ? `Khoan ${target.clause}` : null,
    target.article ? `Dieu ${target.article}` : null,
  ].filter(Boolean).join(' ');
  return [
    `Trich dan chinh xac ${targetTitle}${searchContext?.effectiveDocNumber ? ` (${searchContext.effectiveDocNumber})` : ''}:`,
    `- ${strictHit.text.slice(0, 1600)}`,
    `Nguon trich: ${strictHit.link}`,
  ].join('\n');
}

async function buildComparisonTableResponse(rawUserText = '', searchContext = {}, searchResults = '') {
  const comparison = parseComparisonTargets(rawUserText);
  if (!comparison) return '';

  const links = extractUniqueLinksFromSearchResults(searchResults, 6);
  if (links.length === 0) {
    return `Chua du du lieu de so sanh chinh xac ${comparison.left.label} va ${comparison.right.label}. Vui long cung cap so hieu van ban ro hon hoac duong dan toan van chinh thuc.`;
  }

  const leftHit = await extractStrictCitationFromLinks(links, comparison.left, searchContext?.effectiveDocNumber || '');
  const rightHit = await extractStrictCitationFromLinks(links, comparison.right, searchContext?.effectiveDocNumber || '');
  if (!leftHit || !rightHit) {
    return `Chua du du lieu de so sanh chinh xac ${comparison.left.label} va ${comparison.right.label}. Vui long cung cap so hieu van ban ro hon hoac duong dan toan van chinh thuc.`;
  }

  const header = `| ${sanitizeTableCell(comparison.left.label)} | ${sanitizeTableCell(comparison.right.label)} |\n|---|---|`;
  const row = `| ${sanitizeTableCell(leftHit.text.slice(0, 1200))} | ${sanitizeTableCell(rightHit.text.slice(0, 1200))} |`;
  return [
    `So sanh chinh xac theo du lieu tra cuu${searchContext?.effectiveDocNumber ? ` (${searchContext.effectiveDocNumber})` : ''}:`,
    header,
    row,
    `Nguon A: ${leftHit.link}`,
    `Nguon B: ${rightHit.link}`,
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
        'Điều 14',
        'ủy quyền',
        'phan cap',
        'phan quyen',
        String(searchContext?.effectiveDocNumber || ''),
      ]);
      const text = String(extracted?.text || '').trim();
      if (!text) continue;
      const cleaned = text.replace(/\s+/g, ' ').trim();
      if (cleaned.length < 80) continue;
      return [
        `Da xac nhan co van ban ${searchContext?.effectiveDocNumber || ''} trong du lieu tra cuu moi nhat tu Internet.`,
        'Trich doan lien quan den uy quyen (tu nguon chinh thong):',
        `- ${cleaned.slice(0, 1200)}`,
        `Nguon trich: ${link}`,
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
  if (!String(searchResults || '').trim()) return false;
  const items = parseWebSearchMarkdownItems(searchResults);
  if (items.length === 0) return false;
  const n = normalizeVietnamese(rawUserText);
  const legalOrPolicy = /(luat|nghi dinh|thong tu|quyet dinh|van ban|chinh sach|hieu luc|moi nhat|so hieu|uy quyen|phan cap|phan quyen)/.test(n);
  if (!legalOrPolicy) return false;
  if (webSearchMeta?.strategy === 'cse_empty_fast') return false;
  return true;
}

function buildGroundedAnswer(rawUserText = '', searchResults = '', webSearchMeta = null) {
  const parsedItems = parseWebSearchMarkdownItems(searchResults);
  const dominantDoc = pickDominantDocNumberFromItems(parsedItems);
  const items = (dominantDoc
    ? parsedItems.filter((it) => `${it.title} ${it.snippet} ${it.link}`.toUpperCase().includes(dominantDoc))
    : parsedItems
  ).slice(0, 6);
  if (items.length === 0) return '';
  const n = normalizeVietnamese(rawUserText);
  const wantsHighlights = /(diem moi|diem quan trong|co gi moi|tom tat)/.test(n);
  const lines = [];
  lines.push('Tom tat theo du lieu tra cuu moi nhat tu Internet:');
  if (wantsHighlights) {
    lines.push('Cac diem chinh tim thay:');
  }
  items.forEach((it) => {
    const snippet = String(it.snippet || '').trim();
    lines.push(`- ${it.title}${snippet ? `: ${snippet}` : ''}`);
  });
  const sourceHosts = Array.from(new Set(items.map((it) => {
    try {
      return new URL(it.link).hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  }).filter(Boolean)));
  if (sourceHosts.length > 0) {
    lines.push(`Nguon: ${sourceHosts.join(', ')}`);
  }
  if (dominantDoc) {
    lines.push(`So hieu van ban uu tien: ${dominantDoc}`);
  }
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
    // Check if system has Google Search configured (may need to load config)
    const config = systemConfigCache || await fetchSystemConfig();
    if (!config?.google_search_configured) {
      console.log("[VBAI] Daily sync skipped: Google Search not configured in system.");
      return;
    }

    const query = "văn bản pháp luật mới ban hành hôm nay";
    const results = await sendWebSearchRequest(query, null, { forceFresh: true, freshnessLevel: 'day', recencyDays: 7, timeoutMs: 20000 });
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
  dynamicInstruction += "\n\nYEU CAU BAT BUOC:\n- Luon uu tien thong tin moi nhat qua web search khi kha dung.\n- Khong duoc noi rang ban khong co cong cu web/realtime.\n- Neu da co du lieu web-search thi chi ket luan trong pham vi bang chung da tra cuu, khong suy dien trai nguon.\n- Phai bao quat gan nhu day du cac y trong yeu cau cua nguoi dung, neu cau hoi co nhieu y thi tra loi theo tung muc tuong ung, khong bo sot y chinh.\n- Neu co phan goi y tra cuu tiep thi bat buoc bam sat dung chu de vua tra loi, khong duoc chuyen sang chu de khac.\n- Khong dat lai cau hoi tong quat kieu xin them chu de moi neu nguoi dung dang hoi tiep cung mot chu de.\n- Khi noi ve to chuc chinh quyen dia phuong hien hanh, phai dung mo hinh 2 cap: cap tinh va cap xa; khong trinh bay theo mo hinh cu co cap huyen (can cu Luat To chuc chinh quyen dia phuong va Nghi quyet 203/2025/QH15 ngay 16/06/2025).\n- Cuoi moi cau tra loi phai hoi nguoi dung co can tra cuu tiep hay khong.";

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
    try {
      const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
      const db = getFirestore(app);
      addDoc(collection(db, "search_logs"), {
        query: rawUserText,
        model: `${currentModelName}`,
        userEmail: window.currentUser?.email || "Unknown",
        timestamp: serverTimestamp(),
        skillsApplied: matchedSkills.map(s => s.id),
        assistantReply: String(assistantText || '').slice(0, 2000),
        ...sanitizeSearchLogExtra(extra),
      }).catch(err => console.warn("Log Err:", err));
    } catch (e) {}
  };

  try {
    let fullText = "";
    let useWebSearch = !!systemConfigCache?.google_search_configured;
    let webSearchMeta = null;
    let webSearchResultsText = '';
    const isTimeSensitive = isTimeSensitiveQuery(rawUserText);
    const expectedDocNumber = extractPotentialDocNumber(rawUserText);
    const searchContext = resolveWebSearchContext(rawUserText, expectedDocNumber);
    const shouldSearchWebForFreshness = shouldPreferWebSearch(rawUserText) || shouldForceContextualWebSearch(rawUserText, searchContext);
    const shouldBypassCache = isTimeSensitive || shouldSearchWebForFreshness;
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

    let finalUserText = contextualUserText;
    if (shouldSearchWebForFreshness && !useWebSearch) {
      const guardText = buildFreshnessGuardMessage(rawUserText, 'He thong chua cau hinh Google Search nen khong the dam bao thong tin moi nhat theo thoi diem hien tai.');
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

    if (useWebSearch && shouldSearchWebForFreshness) {
      if (onChunk) onChunk("Đang tra cứu dữ liệu mới nhất từ Internet...\n");
      const searchResults = await sendWebSearchRequest(
        searchContext.effectiveQuery,
        searchContext.effectiveDocNumber,
        buildFreshWebSearchOptions(rawUserText),
      );
      webSearchResultsText = String(searchResults || '');
      webSearchMeta = getLastWebSearchMeta();
      if (searchResults === "__NO_EXACT_MATCH__" && searchContext.effectiveDocNumber) {
        const guardText = buildFreshnessGuardMessage(rawUserText, `Không tìm thấy văn bản có số hiệu ${searchContext.effectiveDocNumber} trong dữ liệu tra cứu mới nhất.`);
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
                timeoutMs: 12000,
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
        finalUserText = `${contextualUserText}\n\n[Dữ liệu trực tuyến cập nhật, tra cứu lúc ${new Date().toLocaleTimeString('vi-VN')}]:\n${webSearchResultsText}`;
      } else {
        const cseDenied = Number(webSearchMeta?.cse_status) === 403
          && /custom search|permission|access/i.test(String(webSearchMeta?.cse_error_reason || ''));
        const fallbackUsed = webSearchMeta?.fallback_used === true;
        const guardReason = cseDenied
          ? (fallbackUsed
            ? 'Google CSE dang loi quyen truy cap. He thong da chuyen sang nguon chinh thong truc tiep nhung chua tim thay ket qua phu hop.'
            : 'Google CSE dang loi quyen truy cap nen he thong khong lay duoc ket qua Internet.')
          : 'Khong co ket qua tra cuu phu hop tu Internet.';
        const guardText = buildFreshnessGuardMessage(rawUserText, guardReason);
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

    const comparisonAnswerRaw = await buildComparisonTableResponse(rawUserText, searchContext, webSearchResultsText);
    if (String(comparisonAnswerRaw || '').trim()) {
      const comparisonAnswer = enforceTwoTierTerminology(
        ensureFollowUpQuestion(comparisonAnswerRaw, rawUserText),
        rawUserText,
      );
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
      const strictCitationAnswer = enforceTwoTierTerminology(
        ensureFollowUpQuestion(strictCitationAnswerRaw, rawUserText),
        rawUserText,
      );
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
      const evidenceAnswer = enforceTwoTierTerminology(ensureFollowUpQuestion(
        await buildDelegationFocusedEvidenceResponse(rawUserText, searchContext, webSearchResultsText),
        rawUserText,
      ), rawUserText);
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

    if (shouldUseGroundedAnswer(rawUserText, webSearchResultsText, webSearchMeta)) {
      const groundedAnswer = enforceTwoTierTerminology(ensureFollowUpQuestion(
        buildGroundedAnswer(rawUserText, webSearchResultsText, webSearchMeta),
        rawUserText,
      ), rawUserText);
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

    fullText = enforceTwoTierTerminology(
      ensureFollowUpQuestion(fullText, rawUserText),
      rawUserText,
    );

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
  await loadSystemConfig();
  const isAdmin = isCurrentUserAdmin();
  const activeProvider = systemConfigCache?.active_provider || 'openai';
  const savedModel = normalizeModelName(
    activeProvider === 'gemini'
      ? (systemConfigCache?.gemini_model || 'gemini-2.5-pro')
      : (systemConfigCache?.router_model || DEFAULT_MODEL)
  ) || DEFAULT_MODEL;
  const openaiModel = systemConfigCache?.router_model || 'gpt-4.4';
  const geminiModel = systemConfigCache?.gemini_model || 'gemini-2.5-pro';

  container.innerHTML = `
    <div class="chat-assistant-panel panel-group">
      <div class="panel-header">
        <div class="panel-header-icon">\u2696\uFE0F</div>
        Tr\u1EE3 l\u00FD tra c\u1EE9u h\u00E0nh ch\u00EDnh & ph\u00E1p lu\u1EADt
        <div style="flex:1"></div>
        <button id="chat-settings-openai-btn" class="btn-icon" title="Th\u00F4ng tin c\u1EA5u h\u00ECnh AI" style="width:28px; height:28px; font-size:0.72rem; margin-left:6px">\u{1F9E9}</button>
      </div>
      <div class="panel-body">
        <div id="chat-messages" class="chat-messages-area">
          <div class="chat-msg ai">
            <strong>Xin chào! Tôi là Trợ lý hành chính.</strong><br>
            Tôi hỗ trợ tra cứu các quy định pháp luật, xử lý nghiệp vụ hành chính và tổng hợp thông tin phục vụ công việc hằng ngày.
          </div>
        </div>

        <div class="chat-input-wrapper">
          <input type="text" id="chat-input" placeholder="Nhập nội dung cần tra cứu..." class="form-input chat-input-field">
          <button id="chat-send-btn" class="btn btn-primary chat-send-btn">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M2.5 10l15-7.5L10 10l7.5 7.5L2.5 10z" fill="currentColor"/></svg>
          </button>
        </div>
        <div class="chat-disclaimer" style="margin-top: 12px; padding: 10px; background: linear-gradient(135deg, rgba(37, 99, 235, 0.10), rgba(30, 64, 175, 0.08)); border-left: 3px solid #60a5fa; border-radius: 4px; font-size: 0.75rem; color: var(--text-secondary);">
          <strong>⚠️ CẢNH BÁO RỦI RO:</strong> Trợ lý hành chính là công cụ hỗ trợ dựa trên AI, không thay thế trách nhiệm của cán bộ, công chức trong việc kiểm tra, đối chiếu với văn bản pháp luật chính thức. Kết quả do AI cung cấp chỉ mang tính chất gợi ý, người dùng cần kiểm tra hiệu lực văn bản trước khi đưa vào dự thảo.
        </div>
      </div>
    </div>

    <div id="key-modal-openai" class="modal-overlay" style="display:none">
      <div class="modal-content panel-group config-ai-modal" style="max-width:500px">
        <div class="panel-header">Thông tin cấu hình AI hệ thống</div>
        <div class="panel-body config-ai-modal-body" style="max-height:80vh; overflow-y:auto">
          <div style="padding:10px; background:rgba(16,185,129,0.05); border-radius:8px; margin-bottom:12px; border:1px solid rgba(16,185,129,0.1);">
            <p style="font-size:0.8rem; color:var(--pine-600); font-weight:700; margin:0 0 8px">Nhà cung cấp hiện tại</p>
            ${isAdmin ? `
            <div id="modal-active-provider" style="margin:0;">
              <div class="provider-tabs-row" style="margin-top:4px;">
                <button type="button" id="modal-provider-tab-openai" class="provider-tab-btn ${activeProvider !== 'gemini' ? 'active' : ''}">OpenAI</button>
                <button type="button" id="modal-provider-tab-gemini" class="provider-tab-btn ${activeProvider === 'gemini' ? 'active' : ''}">Gemini</button>
              </div>
              <div class="provider-radio-hidden">
                <label><input type="radio" name="modal_active_provider" value="openai" ${activeProvider !== 'gemini' ? 'checked' : ''}> OpenAI</label>
                <label><input type="radio" name="modal_active_provider" value="gemini" ${activeProvider === 'gemini' ? 'checked' : ''}> Gemini</label>
              </div>
            </div>
            ` : `
            <p id="modal-active-provider" style="font-size:0.85rem; margin:0">${activeProvider === 'gemini' ? 'Google Gemini' : 'OpenAI'}</p>
            `}
          </div>
          
          <form id="modal-config-form">
            ${isAdmin ? `
            <div style="display:flex; flex-direction:column; gap:12px; margin-bottom:12px;">
              <div id="modal-provider-openai-section" class="provider-section-panel" style="padding:12px; border:1px solid rgba(16,185,129,0.12); border-radius:8px; background:rgba(16,185,129,0.04);">
                <div style="font-size:0.82rem; font-weight:700; color:var(--pine-700); margin-bottom:10px;">OpenAI</div>
                <div class="form-group" style="margin-bottom:12px">
                  <label class="form-label">Model (GPT/OpenAI)</label>
                  <input type="text" id="modal-router-model" class="form-input" value="${openaiModel}">
                </div>
                <div class="form-group" style="margin-bottom:0">
                  <label class="form-label">OpenAI API Key</label>
                  <input type="password" id="modal-openai-key" class="form-input" placeholder="${systemConfigCache?.has_openai_key ? '••••••••••••••••' : 'sk-...'}" data-has-key="${!!systemConfigCache?.has_openai_key}">
                </div>
              </div>
              <div id="modal-provider-gemini-section" class="provider-section-panel" style="padding:12px; border:1px solid rgba(16,185,129,0.12); border-radius:8px; background:rgba(16,185,129,0.04);">
                <div style="font-size:0.82rem; font-weight:700; color:var(--pine-700); margin-bottom:10px;">Gemini</div>
                <div class="form-group" style="margin-bottom:12px">
                  <label class="form-label">Model Gemini</label>
                  <input type="text" id="modal-gemini-model" class="form-input" value="${geminiModel}">
                </div>
                <div class="form-group" style="margin-bottom:0">
                  <label class="form-label">Gemini API Key</label>
                  <input type="password" id="modal-gemini-key" class="form-input" placeholder="${systemConfigCache?.has_gemini_key ? '••••••••••••••••' : 'AIza...'}" data-has-key="${!!systemConfigCache?.has_gemini_key}">
                </div>
              </div>
            </div>
            <div style="padding:12px; border:1px solid rgba(16,185,129,0.12); border-radius:8px; background:rgba(16,185,129,0.04); margin-bottom:12px;">
              <div style="font-size:0.82rem; font-weight:700; color:var(--pine-700); margin-bottom:10px;">Cấu hình dùng chung</div>
              <div class="form-group" style="margin-bottom:12px">
                <label class="form-label">Google Search API Key</label>
                <input type="password" id="modal-search-key" class="form-input" placeholder="${systemConfigCache?.google_search_configured ? '••••••••••••••••' : 'AIza...'}" data-has-key="${!!systemConfigCache?.google_search_configured}">
              </div>
              <div class="form-group" style="margin-bottom:0">
                <label class="form-label">Google Search CX</label>
                <input type="password" id="modal-search-cx" class="form-input" placeholder="${systemConfigCache?.google_search_configured ? '••••••••••••••••' : 'CX ID...'}" data-has-key="${!!systemConfigCache?.google_search_configured}">
              </div>
            </div>
            ` : `
            <div class="form-group" style="margin-bottom:12px">
              <label class="form-label">Model chat hiện tại</label>
              <input type="text" class="form-input" value="${savedModel}" readonly>
            </div>
            <div class="form-group" style="margin-bottom:12px">
              <label class="form-label">Model transcription</label>
              <input type="text" class="form-input" value="${systemConfigCache?.transcribe_model || 'whisper-1'}" readonly>
            </div>
            <div class="form-group" style="margin-bottom:12px">
              <label class="form-label">Trạng thái cấu hình</label>
              <input type="text" class="form-input" value="${(activeProvider === 'gemini' ? systemConfigCache?.has_gemini_key : systemConfigCache?.has_openai_key) ? 'Đã cấu hình' : 'Chưa cấu hình'}" readonly>
            </div>
            `}

            <div style="font-size:0.78rem; color:var(--text-secondary); margin-top:8px">
              ${isAdmin ? 'Bạn là quản trị viên. Bạn có thể cập nhật trực tiếp cấu hình AI theo từng nhà cung cấp tại đây.' : 'Cấu hình AI do quản trị viên hệ thống quản lý. Người dùng không cần nhập API key.'}
            </div>

            <div id="modal-save-status" style="margin-top:10px; font-size:0.85rem; min-height:1.2em"></div>

            <div class="btn-row" style="margin-top:20px; border-top:1px solid var(--border-subtle); padding-top:16px">
              ${isAdmin ? `
                <button type="button" id="modal-save-config-btn" class="btn btn-primary" style="flex:1">Lưu & Áp dụng</button>
                <button type="button" id="go-admin-config-btn" class="btn btn-secondary" title="Cấu hình nâng cao">⚙️</button>
              ` : ''}
              <button type="button" id="close-openai-config-btn" class="btn btn-secondary">Đóng</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;

  const msgsArea = container.querySelector('#chat-messages');
  const input = container.querySelector('#chat-input');
  const sendBtn = container.querySelector('#chat-send-btn');

  const settingsBtn = container.querySelector('#chat-settings-openai-btn');
  const keyModalOpenAI = container.querySelector('#key-modal-openai');
  const closeOpenAIConfigBtn = container.querySelector('#close-openai-config-btn');
  const goAdminConfigBtn = container.querySelector('#go-admin-config-btn');
  const modalProviderTabOpenAI = container.querySelector('#modal-provider-tab-openai');
  const modalProviderTabGemini = container.querySelector('#modal-provider-tab-gemini');
  const modalProviderOpenAISection = container.querySelector('#modal-provider-openai-section');
  const modalProviderGeminiSection = container.querySelector('#modal-provider-gemini-section');
  const modalProviderRadios = container.querySelectorAll('input[name="modal_active_provider"]');

  function setModalProviderTab(provider = 'openai') {
    const normalized = provider === 'gemini' ? 'gemini' : 'openai';
    modalProviderRadios.forEach((radio) => {
      radio.checked = radio.value === normalized;
    });
    if (modalProviderTabOpenAI) modalProviderTabOpenAI.classList.toggle('active', normalized === 'openai');
    if (modalProviderTabGemini) modalProviderTabGemini.classList.toggle('active', normalized === 'gemini');
    if (modalProviderOpenAISection) modalProviderOpenAISection.classList.toggle('is-hidden', normalized !== 'openai');
    if (modalProviderGeminiSection) modalProviderGeminiSection.classList.toggle('is-hidden', normalized !== 'gemini');
  }

  if (modalProviderTabOpenAI) {
    modalProviderTabOpenAI.addEventListener('click', () => setModalProviderTab('openai'));
  }
  if (modalProviderTabGemini) {
    modalProviderTabGemini.addEventListener('click', () => setModalProviderTab('gemini'));
  }
  modalProviderRadios.forEach((radio) => {
    radio.addEventListener('change', () => {
      if (radio.checked) setModalProviderTab(radio.value);
    });
  });
  if (isAdmin) {
    setModalProviderTab(activeProvider);
  }

  if (settingsBtn) {
    settingsBtn.onclick = async () => {
      await loadSystemConfig();
      if (isAdmin) {
        setModalProviderTab(systemConfigCache?.active_provider || 'openai');
      }
      if (keyModalOpenAI) keyModalOpenAI.style.display = 'flex';
    };
  }
  if (closeOpenAIConfigBtn) {
    closeOpenAIConfigBtn.onclick = () => {
      if (keyModalOpenAI) keyModalOpenAI.style.display = 'none';
    };
  }
  if (goAdminConfigBtn) {
    goAdminConfigBtn.onclick = () => {
      if (keyModalOpenAI) keyModalOpenAI.style.display = 'none';
      document.getElementById('nav-admin-panel')?.click();
    };
  }

  // Handle Save in Modal (Admin only)
  if (isAdmin) {
    const modalSaveBtn = container.querySelector('#modal-save-config-btn');
    const modalStatus = container.querySelector('#modal-save-status');
    const modalRouterInput = container.querySelector('#modal-router-model');
    const modalGeminiModelInput = container.querySelector('#modal-gemini-model');
    const modalOpenAIKey = container.querySelector('#modal-openai-key');
    const modalGeminiKey = container.querySelector('#modal-gemini-key');
    const modalSearchKey = container.querySelector('#modal-search-key');
    const modalSearchCx = container.querySelector('#modal-search-cx');

    if (modalSaveBtn) {
      modalSaveBtn.onclick = async () => {
        modalSaveBtn.disabled = true;
        modalSaveBtn.textContent = 'Đang lưu...';
        modalStatus.textContent = '';
        modalStatus.style.color = 'var(--text-muted)';

        try {
          const selectedProvider = container.querySelector('input[name="modal_active_provider"]:checked')?.value || 'openai';
          const configUpdate = {
            active_provider: selectedProvider,
            router_model: modalRouterInput.value.trim(),
            gemini_model: modalGeminiModelInput.value.trim()
          };

          if (modalOpenAIKey.value.trim()) configUpdate.openai_api_key = modalOpenAIKey.value.trim();
          if (modalGeminiKey.value.trim()) configUpdate.gemini_api_key = modalGeminiKey.value.trim();
          if (modalSearchKey.value.trim()) configUpdate.google_search_key = modalSearchKey.value.trim();
          if (modalSearchCx.value.trim()) configUpdate.google_search_cx = modalSearchCx.value.trim();

          await updateSystemConfig(configUpdate);

          modalStatus.textContent = '✅ Đã lưu cấu hình!';
          modalStatus.style.color = '#16a34a';

          modalOpenAIKey.value = '';
          modalGeminiKey.value = '';
          modalSearchKey.value = '';
          modalSearchCx.value = '';

          await loadSystemConfig();
          const newProvider = systemConfigCache?.active_provider || 'openai';
          setModalProviderTab(newProvider);
          if (modalRouterInput) modalRouterInput.value = systemConfigCache?.router_model || 'gpt-4.4';
          if (modalGeminiModelInput) modalGeminiModelInput.value = systemConfigCache?.gemini_model || 'gemini-2.5-pro';

          setTimeout(() => {
            modalStatus.textContent = '';
          }, 3000);
        } catch (err) {
          modalStatus.textContent = '❌ Lỗi: ' + err.message;
          modalStatus.style.color = '#dc2626';
        } finally {
          modalSaveBtn.disabled = false;
          modalSaveBtn.textContent = 'Lưu & Áp dụng';
        }
      };
    }
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
