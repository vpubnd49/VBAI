/**
 * Chat Assistant Module — Legal & Administrative Consultant
 * Uses 9router (OpenAI-compatible) for legal lookup
 */
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { Document, Packer, Paragraph, TextRun, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';

import { firebaseConfig } from '../firebase-config.js';


import { sendChatRequest, check9routerStatus, getProxyModelIds } from './ai-proxy.js';

const DEFAULT_MODEL = "cx/gpt-5.5";
const DEFAULT_MEETING_TRANSCRIBE_API_KEY = "AIzaSyAa4rHozoUWV4BLJ0XIOKFlqQMalQXb0X4";
const STRICT_MEETING_AUDIO_MODEL = "gemini-2.5-pro";
const GOOGLE_GEMINI_OPENAI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/openai";

let aiClient = null;
let chatSession = null;
let currentModelName = DEFAULT_MODEL;
let use9router = localStorage.getItem('vbai_use_9router') !== 'false';

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
    localStorage.getItem('vbai_proxy_endpoint_chat')
    || localStorage.getItem('vbai_9router_endpoint')
    || ((window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
      ? "http://localhost:20128/v1"
      : "")
  ).trim();
  return endpoint;
}

function keepChatProxyEnabledWhenUsing9router() {
  if (localStorage.getItem('vbai_use_9router') !== 'false') {
    localStorage.setItem('vbai_proxy_enabled_chat', 'true');
  }
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

  if (googleKey && googleCx) {
    try {
      const url = `https://www.googleapis.com/customsearch/v1?key=${googleKey}&cx=${googleCx}&q=${encodeURIComponent(query)}`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        const items = data.items || [];
        if (items.length > 0) {
          return items.slice(0, 5).map(item => `- [${item.title}](${item.link}): ${item.snippet}`).join("\n\n");
        }
      }
    } catch (e) {
      console.warn("Google API failed, falling back to proxy:", e);
    }
  }

  const proxies = [
    (url) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
    (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`
  ];

  for (const proxyFn of proxies) {
    try {
      const q = encodeURIComponent(query);
      const url = `https://html.duckduckgo.com/html/?q=${q}`;
      const proxyUrl = proxyFn(url);
      
      const response = await fetch(proxyUrl);
      if (!response.ok) continue;
      
      let htmlStr = "";
      if (proxyUrl.includes("allorigins")) {
        const data = await response.json();
        htmlStr = data.contents;
      } else {
        htmlStr = await response.text();
      }
      
      if (!htmlStr) continue;
      
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlStr, "text/html");
      
      const results = [];
      const resultNodes = doc.querySelectorAll('.result__body');
      const nodes = resultNodes.length > 0 ? resultNodes : doc.querySelectorAll('.result');
      
      for (let i = 0; i < Math.min(nodes.length, 5); i++) {
        const node = nodes[i];
        const a = node.querySelector('.result__title a') || node.querySelector('.result__a');
        const s = node.querySelector('.result__snippet');
        if (a && s) {
          const title = a.textContent.replace(/\s+/g, ' ').trim();
          const snippet = s.textContent.replace(/\s+/g, ' ').trim();
          let link = a.getAttribute('href') || "";
          if (link.startsWith('//')) link = 'https:' + link;
          // Clean duckduckgo outgoing links if any
          if (link.includes('uddg=')) {
            try {
              const u = new URL('https://duckduckgo.com' + link);
              link = u.searchParams.get('uddg') || link;
            } catch(e){}
          }
          results.push(`- [${title}](${link}): ${snippet}`);
        }
      }
      if (results.length > 0) return results.join("\n\n");
    } catch (e) {
      console.warn("Search proxy attempt failed:", e);
    }
  }
  return "";
}

export function initChat(apiKey, modelName = DEFAULT_MODEL) {
  keepChatProxyEnabledWhenUsing9router();
  localStorage.setItem('vbai_use_9router', 'true');
  localStorage.setItem('vbai_proxy_enabled_chat', 'true');
  const normalizedModel = normalizeModelName(
    modelName
    || localStorage.getItem('vbai_router_model')
    || DEFAULT_MODEL
  );
  currentModelName = normalizedModel || DEFAULT_MODEL;
  use9router = true;
  
  try {
    aiClient = { proxy: true };
    currentModelName = normalizedModel || DEFAULT_MODEL;
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
  if (!aiClient) throw new Error("Chua cau hinh API Key hoac 9router");

  // Prompt gon cho tra cuu thong thuong de tang toc; prompt day du cho bai toan soan thao
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
    console.log("Da nap them context tu cac skills:", matchedSkills.map(s => s.name));
  }
  dynamicInstruction += "\n\nYEU CAU BAT BUOC:\n- Luon uu tien thong tin moi nhat qua web search khi kha dung.\n- Khong duoc noi rang ban khong co cong cu web/realtime.\n- Phai bao quat gan nhu day du cac y trong yeu cau cua nguoi dung, neu cau hoi co nhieu y thi tra loi theo tung muc tuong ung, khong bo sot y chinh.\n- Neu co phan goi y tra cuu tiep thi bat buoc bam sat dung chu de vua tra loi, khong duoc chuyen sang chu de khac.\n- Khong dat lai cau hoi tong quat kieu xin them chu de moi neu nguoi dung dang hoi tiep cung mot chu de.\n- Cuoi moi cau tra loi phai hoi nguoi dung co can tra cuu tiep hay khong.";

  try {
    let fullText = "";
    let routeLabel = "9router";
    let useWebSearch = shouldUseProxyWebSearchTool();
    const cached = getCachedChatAnswer(rawUserText, currentModelName, use9router, useWebSearch);
    if (cached) {
      pushTurn("user", rawUserText);
      pushTurn("assistant", cached);
      lastUserQuery = rawUserText;
      lastAssistantReply = stripTrailingFollowUpBlocks(cached);
      if (onChunk) onChunk(cached);
      return cached;
    }

    let finalUserText = contextualUserText;
    routeLabel = "9router";

    useWebSearch = shouldUseProxyWebSearchTool();
    if (useWebSearch && shouldPreferWebSearch(rawUserText)) {
      if (onChunk) onChunk("Đang tra cứu dữ liệu mới nhất từ Internet...\n");
      const searchResults = await fetchWebSearchResults(rawUserText);
      if (searchResults) {
        finalUserText = `${contextualUserText}\n\n[Dữ liệu trực tuyến cập nhật để tham khảo]:\n${searchResults}`;
        routeLabel = "9router_web_search_injected";
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
        throw new Error("Proxy tra ve phan hoi rong. Vui long kiem tra model ho tro text output.");
      }

    } catch (proxyError) {
      const endpoint = getCurrentProxyEndpoint();
      if (isProxyUnavailableError(proxyError)) {
        const alive = await check9routerStatus('chat').catch(() => false);
        if (alive) {
          throw new Error(`9router dang chay (${endpoint || "chua cau hinh endpoint"}) nhung model/credential provider chua san sang. Vui long mo 9router va nap credential provider cho model dang dung.`);
        }
        throw new Error(`Khong ket noi duoc 9router (${endpoint || "chua cau hinh endpoint"}). He thong dang o che do 9router 100%, khong fallback.`);
      }
      throw new Error(`Loi 9router: ${proxyError?.message || proxyError}. He thong dang o che do 9router 100%, khong fallback.`);
    }

    if (!String(fullText || "").trim()) {
      throw new Error("Khong nhan duoc noi dung tra loi tu model. Vui long doi model khac hoac kiem tra cau hinh 9router.");
    }
    fullText = ensureFollowUpQuestion(fullText, rawUserText);

    setCachedChatAnswer(rawUserText, currentModelName, use9router, useWebSearch, fullText);
    pushTurn("user", rawUserText);
    pushTurn("assistant", fullText);
    lastUserQuery = rawUserText;
    lastAssistantReply = stripTrailingFollowUpBlocks(fullText);

    try {
      const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
      const db = getFirestore(app);
      addDoc(collection(db, "search_logs"), {
        query: rawUserText,
        model: `${currentModelName} (${routeLabel})`,
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
  keepChatProxyEnabledWhenUsing9router();
  const savedModel = normalizeModelName(
    localStorage.getItem('vbai_router_model')
    || DEFAULT_MODEL
  ) || DEFAULT_MODEL;
  
  container.innerHTML = `
    <div class="chat-assistant-panel panel-group">
      <div class="panel-header">
        <div class="panel-header-icon">⚖️</div>
        Trợ Lý Tra Cứu Pháp Luật & Quy Định Đảng AI
        <div style="flex:1"></div>
        <button id="chat-settings-btn" class="btn-icon" title="Cấu hình" style="display: ${localStorage.getItem('vbai_admin') === 'true' ? 'block' : 'none'}; width:28px; height:28px; font-size:0.8rem">⚙️</button>
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

    <!-- API Key Modal -->
    <div id="key-modal" class="modal-overlay" style="display:none">
      <div class="modal-content panel-group config-ai-modal">
        <div class="panel-header">Cau hinh Tro ly AI - 9router la chinh</div>
          <div class="panel-body config-ai-modal-body">
          <div class="config-ai-alert">
            <p style="font-size:0.86rem; margin:0; color:var(--text-primary); font-weight:700">Che do cau hinh toi gian</p>
            <p style="font-size:0.78rem; margin:6px 0 0; color:var(--text-secondary)">Tra cuu/soan thao dung 9router. Ghi am dung model co dinh gemini-2.5-pro voi endpoint/key rieng (neu khai bao).</p>
          </div>

          <div class="form-group" style="margin-bottom:16px">
            <label class="form-label">9router API Key (chinh)</label>
            <input type="password" id="api-key-input" class="form-input" value="" placeholder="Dan 9router API key chinh">
            <p style="font-size:0.76rem; color:var(--text-secondary); margin-top:4px">Bat buoc neu ban dung 9router cho toan app.</p>
          </div>
          <div class="form-group" style="margin-bottom:16px">
            <label class="form-label">9router Endpoint</label>
            <input type="text" id="router-endpoint-input" class="form-input" value="" placeholder="http://localhost:20128/v1">
            <p style="font-size:0.76rem; color:var(--text-secondary); margin-top:4px">Vi du: http://localhost:20128/v1 hoac endpoint public OpenAI-compatible.</p>
          </div>
          <div class="form-group" style="margin-bottom:16px">
            <label class="form-label">Model ghi am (co dinh)</label>
            <input type="text" class="form-input" value="${STRICT_MEETING_AUDIO_MODEL}" readonly>
            <p style="font-size:0.76rem; color:var(--text-secondary); margin-top:4px">Ghi am dang duoc siet chi dung ${STRICT_MEETING_AUDIO_MODEL}.</p>
          </div>
          <div class="form-group" style="margin-bottom:16px">
            <label class="form-label">API ghi am rieng - Endpoint (neu 9router khong ho tro)</label>
            <input type="text" id="transcribe-endpoint-input" class="form-input" value="" placeholder="Vi du: https://your-openai-compatible-endpoint/v1">
            <p style="font-size:0.76rem; color:var(--text-secondary); margin-top:4px">De trong neu muon ke thua endpoint chung. Neu nhap, module ghi am se uu tien endpoint nay.</p>
          </div>
          <div class="form-group" style="margin-bottom:16px">
            <label class="form-label">API ghi am rieng - Key</label>
            <input type="password" id="transcribe-api-key-input" class="form-input" value="" placeholder="Dan API key danh rieng cho transcription">
            <p style="font-size:0.76rem; color:var(--text-secondary); margin-top:4px">De trong neu muon dung chung key 9router. Neu nhap, chi ap dung cho xu ly ghi am.</p>
          </div>

          <div class="form-group" style="margin-bottom:16px">
            <label class="form-label">Model AI (nhap tay de luu chinh xac)</label>
            <input type="text" id="model-select" class="form-input" value="${savedModel}" placeholder="Vi du: gpt-5.5 hoac gpt-5.4-review">
            <p style="font-size:0.76rem; color:var(--text-secondary); margin-top:4px">Model nay se duoc dung xuyen suot khi goi qua 9router.</p>
          </div>

          <div style="padding:12px; background:rgba(230,162,0,0.1); border-radius:10px; margin-bottom:16px; border: 1px solid rgba(230,162,0,0.2); display:flex; align-items:center; justify-content:space-between; gap:12px;">
            <div>
              <p style="font-size:0.75rem; color:var(--daquy-400); margin:0; font-weight:600">🔍 Web Search (Google/DuckDuckGo)</p>
              <p style="font-size:0.7rem; color:var(--text-secondary); margin:4px 0 0">Tự động tra cứu thông tin mới từ Internet khi cần thiết.</p>
            </div>
            <label class="switch-toggle">
              <input type="checkbox" id="use-web-search-chk" ${(localStorage.getItem('vbai_proxy_web_search') ?? 'true') !== 'false' ? 'checked' : ''}>
              <span class="slider-round"></span>
            </label>
          </div>

          <div class="form-group" style="margin-bottom:16px">
            <label class="form-label">Google Search API Key (Ưu tiên)</label>
            <input type="password" id="google-search-key-input" class="form-input" value="${localStorage.getItem('vbai_google_search_key') || ''}" placeholder="AIza...">
            <p style="font-size:0.76rem; color:var(--text-secondary); margin-top:4px">Dùng Google API chính thống. Để trống để dùng DuckDuckGo miễn phí thông qua proxy.</p>
          </div>
          <div class="form-group" style="margin-bottom:16px">
            <label class="form-label">Google Search Engine ID (CX)</label>
            <input type="text" id="google-search-cx-input" class="form-input" value="${localStorage.getItem('vbai_google_search_cx') || ''}" placeholder="Ví dụ: 789...:abc...">
          </div>

          <div class="btn-row" style="margin-bottom:12px">
            <button id="test-proxy-btn" class="btn btn-secondary">Kiem tra ket noi proxy</button>
            <button id="test-transcribe-btn" class="btn btn-secondary">Kiem tra key ghi am</button>
          </div>
          <div class="btn-row" style="margin-top:20px">
            <button id="save-key-btn" class="btn btn-primary">Lưu cấu hình</button>
            <button id="close-modal-btn" class="btn btn-secondary">Đóng</button>
          </div>
        </div>
      </div>
    </div>
  `;

  const input = container.querySelector('#chat-input');
  const sendBtn = container.querySelector('#chat-send-btn');
  const msgsArea = container.querySelector('#chat-messages');
  const settingsBtn = container.querySelector('#chat-settings-btn');
  const keyModal = container.querySelector('#key-modal');
  const apiKeyInput = container.querySelector('#api-key-input');
  const routerEndpointInput = container.querySelector('#router-endpoint-input');
  const transcribeEndpointInput = container.querySelector('#transcribe-endpoint-input');
  const transcribeApiKeyInput = container.querySelector('#transcribe-api-key-input');
  const googleKeyInput = container.querySelector('#google-search-key-input');
  const googleCxInput = container.querySelector('#google-search-cx-input');
  const modelSelect = container.querySelector('#model-select');

  // Khởi tạo Firebase và tải API Key
  let apiKey = '';
  const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  const db = getFirestore(app);

  try {
    const configDoc = await getDoc(doc(db, 'config', 'system'));
    if (configDoc.exists()) {
      const data = configDoc.data();
      const routerKey = data.router_api_key || '';
      const routerEndpoint = data.router_endpoint || '';
      const routerTranscribeEndpoint = data.router_transcribe_endpoint || '';
      const routerTranscribeApiKey = data.router_transcribe_api_key || '';
      const routerModel = normalizeModelName(data.router_model || '');
      const routerWebSearchEnabled = data.router_web_search_enabled;
      const routerProxyEnabledChat = data.router_proxy_enabled_chat;
      apiKey = routerKey || localStorage.getItem('vbai_9router_api_key') || '';
      localStorage.setItem('vbai_use_9router', 'true');
      localStorage.setItem('vbai_proxy_enabled_chat', 'true');
      if (routerKey && !localStorage.getItem('vbai_9router_api_key')) localStorage.setItem('vbai_9router_api_key', routerKey);
      if (routerEndpoint) localStorage.setItem('vbai_9router_endpoint', routerEndpoint);
      localStorage.setItem('vbai_transcribe_model', STRICT_MEETING_AUDIO_MODEL);
      localStorage.setItem('vbai_transcribe_model_meeting', STRICT_MEETING_AUDIO_MODEL);
      if ('router_transcribe_endpoint' in data) {
        const cleanEndpoint = String(routerTranscribeEndpoint || '').trim();
        if (cleanEndpoint && isLikelyApiKey(cleanEndpoint)) {
          localStorage.setItem('vbai_transcribe_use_dedicated', 'true');
          localStorage.setItem('vbai_transcribe_api_key', cleanEndpoint);
          localStorage.setItem('vbai_proxy_api_key_meeting_transcribe', cleanEndpoint);
          localStorage.removeItem('vbai_transcribe_endpoint');
          localStorage.removeItem('vbai_proxy_endpoint_meeting_transcribe');
        } else if (cleanEndpoint) {
          localStorage.setItem('vbai_transcribe_use_dedicated', 'true');
          localStorage.setItem('vbai_transcribe_endpoint', cleanEndpoint);
          localStorage.setItem('vbai_proxy_endpoint_meeting_transcribe', cleanEndpoint);
          localStorage.setItem('vbai_proxy_profile_meeting_transcribe', 'proxy_custom');
        }
      }
      if ('router_transcribe_api_key' in data) {
        const cleanApiKey = String(routerTranscribeApiKey || '').trim();
        if (cleanApiKey) {
          localStorage.setItem('vbai_transcribe_use_dedicated', 'true');
          localStorage.setItem('vbai_transcribe_api_key', cleanApiKey);
          localStorage.setItem('vbai_proxy_api_key_meeting_transcribe', cleanApiKey);
          const currentEndpoint = (
            localStorage.getItem('vbai_proxy_endpoint_meeting_transcribe')
            || localStorage.getItem('vbai_transcribe_endpoint')
            || ''
          ).trim();
          if (!currentEndpoint && isLikelyGoogleApiKey(cleanApiKey)) {
            localStorage.setItem('vbai_transcribe_endpoint', GOOGLE_GEMINI_OPENAI_ENDPOINT);
            localStorage.setItem('vbai_proxy_endpoint_meeting_transcribe', GOOGLE_GEMINI_OPENAI_ENDPOINT);
            localStorage.setItem('vbai_proxy_profile_meeting_transcribe', 'proxy_custom');
          }
        }
      }
      const hasDedicatedEndpoint = !!(localStorage.getItem('vbai_proxy_endpoint_meeting_transcribe') || localStorage.getItem('vbai_transcribe_endpoint'));
      const hasDedicatedKey = !!(localStorage.getItem('vbai_proxy_api_key_meeting_transcribe') || localStorage.getItem('vbai_transcribe_api_key'));
      if (!hasDedicatedEndpoint && !hasDedicatedKey) {
        localStorage.setItem('vbai_transcribe_use_dedicated', 'false');
      }
      if (routerModel) {
        localStorage.setItem('vbai_router_model', routerModel);
      }
      if (typeof routerWebSearchEnabled === 'boolean') {
        localStorage.setItem('vbai_proxy_web_search', routerWebSearchEnabled ? 'true' : 'false');
      }
      localStorage.setItem('vbai_router_profile', 'proxy_custom');
      localStorage.setItem('vbai_proxy_profile_chat', 'proxy_custom');
      localStorage.setItem('vbai_proxy_profile_spellcheck', 'proxy_custom');
      localStorage.setItem('vbai_proxy_profile_pdf', 'proxy_custom');
      localStorage.setItem('vbai_proxy_profile_meeting', 'proxy_custom');
      if (typeof routerProxyEnabledChat === 'boolean') {
        localStorage.setItem('vbai_proxy_enabled_chat', 'true');
      }
      keepChatProxyEnabledWhenUsing9router();
      if(apiKeyInput) apiKeyInput.value = apiKey;
    }
  } catch (e) {
    console.warn("Lỗi tải API Key:", e);
  }
  const fallbackEndpoint = (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
    ? "http://localhost:20128/v1"
    : "https://your-9router-public-url.com/v1";
  if (routerEndpointInput) {
    routerEndpointInput.value = localStorage.getItem('vbai_9router_endpoint') || fallbackEndpoint;
  }
  localStorage.setItem('vbai_transcribe_model', STRICT_MEETING_AUDIO_MODEL);
  localStorage.setItem('vbai_transcribe_model_meeting', STRICT_MEETING_AUDIO_MODEL);
  if (transcribeEndpointInput) {
    transcribeEndpointInput.value =
      localStorage.getItem('vbai_proxy_endpoint_meeting_transcribe')
      || localStorage.getItem('vbai_transcribe_endpoint')
      || (isLikelyGoogleApiKey(localStorage.getItem('vbai_proxy_api_key_meeting_transcribe') || localStorage.getItem('vbai_transcribe_api_key') || '')
        ? GOOGLE_GEMINI_OPENAI_ENDPOINT
        : '')
      || '';
  }
  if (transcribeApiKeyInput) {
    transcribeApiKeyInput.value =
      localStorage.getItem('vbai_proxy_api_key_meeting_transcribe')
      || localStorage.getItem('vbai_transcribe_api_key')
      || DEFAULT_MEETING_TRANSCRIBE_API_KEY
      || '';
  }
  if (modelSelect) {
    modelSelect.value = normalizeModelName(
      localStorage.getItem('vbai_router_model')
      || savedModel
    );
  }
  if (useWebSearchChk) {
    useWebSearchChk.checked = (localStorage.getItem('vbai_proxy_web_search') ?? 'true') !== 'false';
  }
  localStorage.setItem('vbai_router_profile', 'proxy_custom');
  localStorage.setItem('vbai_proxy_profile_chat', 'proxy_custom');
  localStorage.setItem('vbai_proxy_profile_spellcheck', 'proxy_custom');
  localStorage.setItem('vbai_proxy_profile_pdf', 'proxy_custom');
  localStorage.setItem('vbai_proxy_profile_meeting', 'proxy_custom');
  if (localStorage.getItem('vbai_proxy_enabled_chat') === null) {
    localStorage.setItem('vbai_proxy_enabled_chat', localStorage.getItem('vbai_use_9router') !== 'false' ? 'true' : 'false');
  }
  keepChatProxyEnabledWhenUsing9router();
  if (localStorage.getItem('vbai_proxy_enabled_spellcheck') === null) localStorage.setItem('vbai_proxy_enabled_spellcheck', 'true');
  if (localStorage.getItem('vbai_proxy_enabled_pdf') === null) localStorage.setItem('vbai_proxy_enabled_pdf', 'true');
  if (localStorage.getItem('vbai_proxy_enabled_meeting') === null) localStorage.setItem('vbai_proxy_enabled_meeting', 'true');
  if (localStorage.getItem('vbai_proxy_enabled_meeting_transcribe') === null) localStorage.setItem('vbai_proxy_enabled_meeting_transcribe', 'true');

  // Init chat: with 9router, API key can be empty on local proxy
  initChat(
    '',
    (
      modelSelect?.value
      || localStorage.getItem('vbai_router_model')
      || savedModel
    ).trim()
  );

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
    if (!aiClient) {
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

  sendBtn.onclick = handleSend;
  input.onkeypress = (e) => { if(e.key==='Enter') handleSend(); };
  settingsBtn.onclick = () => keyModal.style.display = 'flex';
  container.querySelector('#close-modal-btn').onclick = () => keyModal.style.display = 'none';
  if (testProxyBtn) {
    testProxyBtn.onclick = async () => {
      const oldEndpoint = localStorage.getItem('vbai_9router_endpoint');
      const oldKey = localStorage.getItem('vbai_9router_api_key');
      const endpoint = (routerEndpointInput?.value || '').trim();
      const key = (apiKeyInput?.value || '').trim();
      if (endpoint) localStorage.setItem('vbai_9router_endpoint', endpoint);
      if (key) localStorage.setItem('vbai_9router_api_key', key);
      localStorage.setItem('vbai_use_9router', 'true');
      localStorage.setItem('vbai_proxy_enabled_chat', 'true');
      testProxyBtn.disabled = true;
      const prevText = testProxyBtn.innerText;
      testProxyBtn.innerText = 'Dang kiem tra...';
      try {
        const ok = await check9routerStatus('chat');
        alert(ok ? 'Ket noi proxy thanh cong.' : 'Khong ket noi duoc proxy.');
      } catch (e) {
        alert('Loi kiem tra proxy: ' + e.message);
      } finally {
        if (oldEndpoint === null) localStorage.removeItem('vbai_9router_endpoint'); else localStorage.setItem('vbai_9router_endpoint', oldEndpoint);
        if (oldKey === null) localStorage.removeItem('vbai_9router_api_key'); else localStorage.setItem('vbai_9router_api_key', oldKey);
        localStorage.setItem('vbai_use_9router', 'true');
        localStorage.setItem('vbai_proxy_enabled_chat', 'true');
        testProxyBtn.disabled = false;
        testProxyBtn.innerText = prevText;
      }
    };
  }
  if (testTranscribeBtn) {
    testTranscribeBtn.onclick = async () => {
      let endpoint = (transcribeEndpointInput?.value || '').trim();
      let key = (transcribeApiKeyInput?.value || '').trim();

      if (endpoint && isLikelyApiKey(endpoint) && !key) {
        key = endpoint;
        endpoint = '';
      }
      if (!endpoint && isLikelyGoogleApiKey(key)) {
        endpoint = GOOGLE_GEMINI_OPENAI_ENDPOINT;
      }
      if (!endpoint) {
        endpoint = (routerEndpointInput?.value || '').trim();
      }
      if (!endpoint || !isValidHttpEndpoint(endpoint)) {
        alert('Endpoint ghi am khong hop le. Vui long nhap URL bat dau bang http(s)://');
        return;
      }
      if (!key) {
        alert('Chua co API key ghi am. Vui long nhap key tai o "API ghi am rieng - Key".');
        return;
      }

      const backup = {
        endpoint: localStorage.getItem('vbai_proxy_endpoint_meeting_transcribe'),
        endpoint2: localStorage.getItem('vbai_transcribe_endpoint'),
        key: localStorage.getItem('vbai_proxy_api_key_meeting_transcribe'),
        key2: localStorage.getItem('vbai_transcribe_api_key'),
        profile: localStorage.getItem('vbai_proxy_profile_meeting_transcribe'),
        useDedicated: localStorage.getItem('vbai_transcribe_use_dedicated'),
        enabled: localStorage.getItem('vbai_proxy_enabled_meeting_transcribe'),
      };

      localStorage.setItem('vbai_proxy_endpoint_meeting_transcribe', endpoint);
      localStorage.setItem('vbai_transcribe_endpoint', endpoint);
      localStorage.setItem('vbai_proxy_api_key_meeting_transcribe', key);
      localStorage.setItem('vbai_transcribe_api_key', key);
      localStorage.setItem('vbai_proxy_profile_meeting_transcribe', 'proxy_custom');
      localStorage.setItem('vbai_transcribe_use_dedicated', 'true');
      localStorage.setItem('vbai_proxy_enabled_meeting_transcribe', 'true');

      testTranscribeBtn.disabled = true;
      const prevText = testTranscribeBtn.innerText;
      testTranscribeBtn.innerText = 'Dang kiem tra...';
      try {
        const ids = await getProxyModelIds('meeting_transcribe');
        if (!ids.length) {
          alert(`Khong lay duoc danh sach model tu endpoint ghi am: ${endpoint}`);
          return;
        }
        const gemini = ids.find((id) => String(id).toLowerCase().includes('gemini-2.5-pro'));
        if (gemini) {
          alert(`Ket noi ghi am OK. Tim thay model: ${gemini}`);
        } else {
          alert(`Ket noi duoc nhung khong co gemini-2.5-pro. Model hien co: ${ids.slice(0, 12).join(', ')}`);
        }
      } catch (e) {
        alert('Loi kiem tra key ghi am: ' + (e?.message || e));
      } finally {
        if (backup.endpoint === null) localStorage.removeItem('vbai_proxy_endpoint_meeting_transcribe'); else localStorage.setItem('vbai_proxy_endpoint_meeting_transcribe', backup.endpoint);
        if (backup.endpoint2 === null) localStorage.removeItem('vbai_transcribe_endpoint'); else localStorage.setItem('vbai_transcribe_endpoint', backup.endpoint2);
        if (backup.key === null) localStorage.removeItem('vbai_proxy_api_key_meeting_transcribe'); else localStorage.setItem('vbai_proxy_api_key_meeting_transcribe', backup.key);
        if (backup.key2 === null) localStorage.removeItem('vbai_transcribe_api_key'); else localStorage.setItem('vbai_transcribe_api_key', backup.key2);
        if (backup.profile === null) localStorage.removeItem('vbai_proxy_profile_meeting_transcribe'); else localStorage.setItem('vbai_proxy_profile_meeting_transcribe', backup.profile);
        if (backup.useDedicated === null) localStorage.removeItem('vbai_transcribe_use_dedicated'); else localStorage.setItem('vbai_transcribe_use_dedicated', backup.useDedicated);
        if (backup.enabled === null) localStorage.removeItem('vbai_proxy_enabled_meeting_transcribe'); else localStorage.setItem('vbai_proxy_enabled_meeting_transcribe', backup.enabled);
        testTranscribeBtn.disabled = false;
        testTranscribeBtn.innerText = prevText;
      }
    };
  }
  container.querySelector('#save-key-btn').onclick = async () => {
    const routerKey = apiKeyInput.value.trim();
    const routerEndpoint = (routerEndpointInput?.value || '').trim();
    const transcribeModel = STRICT_MEETING_AUDIO_MODEL;
    const transcribeEndpointInputValue = (transcribeEndpointInput?.value || '').trim();
    const transcribeApiKeyInputValue = (transcribeApiKeyInput?.value || '').trim();
    let transcribeEndpoint = transcribeEndpointInputValue
      || localStorage.getItem('vbai_proxy_endpoint_meeting_transcribe')
      || localStorage.getItem('vbai_transcribe_endpoint')
      || '';
    let transcribeApiKey = transcribeApiKeyInputValue
      || localStorage.getItem('vbai_proxy_api_key_meeting_transcribe')
      || localStorage.getItem('vbai_transcribe_api_key')
      || DEFAULT_MEETING_TRANSCRIBE_API_KEY
      || '';
    const selectedProfile = 'proxy_custom';
    const useProxyWebSearch = useWebSearchChk?.checked !== false;
    const googleSearchKey = googleKeyInput?.value.trim() || '';
    const googleSearchCx = googleCxInput?.value.trim() || '';
    const model = normalizeModelName(modelSelect?.value || '') || DEFAULT_MODEL;
    const profileChat = 'proxy_custom';
    const profileSpell = 'proxy_custom';
    const profilePdf = 'proxy_custom';
    const profileMeeting = 'proxy_custom';

    if (routerEndpoint && !isValidHttpEndpoint(routerEndpoint)) {
      alert('9router Endpoint khong hop le. Vui long nhap URL bat dau bang http(s)://');
      return;
    }
    if (transcribeEndpoint && !isValidHttpEndpoint(transcribeEndpoint)) {
      if (isLikelyApiKey(transcribeEndpoint)) {
        transcribeApiKey = transcribeApiKeyInputValue || transcribeEndpoint;
        transcribeEndpoint = '';
      } else {
        alert('API ghi am rieng - Endpoint khong hop le. Vui long nhap URL bat dau bang http(s)://');
        return;
      }
    }
    if (!transcribeEndpoint && isLikelyGoogleApiKey(transcribeApiKey)) {
      transcribeEndpoint = GOOGLE_GEMINI_OPENAI_ENDPOINT;
    }
    
    localStorage.setItem('vbai_use_9router', 'true');
    localStorage.setItem('vbai_proxy_enabled_chat', 'true');
    localStorage.setItem('vbai_proxy_enabled_spellcheck', 'true');
    localStorage.setItem('vbai_proxy_enabled_pdf', 'true');
    localStorage.setItem('vbai_proxy_enabled_meeting', 'true');
    localStorage.setItem('vbai_proxy_enabled_meeting_transcribe', 'true');
    localStorage.setItem('vbai_router_model', model);
    localStorage.setItem('vbai_transcribe_model', transcribeModel);
    localStorage.setItem('vbai_transcribe_model_meeting', transcribeModel);
    localStorage.setItem('vbai_router_profile', selectedProfile);
    localStorage.setItem('vbai_proxy_web_search', useProxyWebSearch ? 'true' : 'false');
    localStorage.setItem('vbai_google_search_key', googleSearchKey);
    localStorage.setItem('vbai_google_search_cx', googleSearchCx);
    localStorage.setItem('vbai_proxy_profile_chat', profileChat);
    localStorage.setItem('vbai_proxy_profile_spellcheck', profileSpell);
    localStorage.setItem('vbai_proxy_profile_pdf', profilePdf);
    localStorage.setItem('vbai_proxy_profile_meeting', profileMeeting);
    if (routerEndpoint) {
      localStorage.setItem('vbai_proxy_endpoint_chat', routerEndpoint);
      localStorage.setItem('vbai_proxy_endpoint_spellcheck', routerEndpoint);
      localStorage.setItem('vbai_proxy_endpoint_pdf', routerEndpoint);
      localStorage.setItem('vbai_proxy_endpoint_meeting', routerEndpoint);
    }
    if (routerEndpoint) {
      localStorage.setItem('vbai_9router_endpoint', routerEndpoint);
    }
    if (routerKey) {
      localStorage.setItem('vbai_9router_api_key', routerKey);
      localStorage.setItem('vbai_proxy_api_key_chat', routerKey);
      localStorage.setItem('vbai_proxy_api_key_spellcheck', routerKey);
      localStorage.setItem('vbai_proxy_api_key_pdf', routerKey);
      localStorage.setItem('vbai_proxy_api_key_meeting', routerKey);
    }
    if (transcribeEndpoint) {
      localStorage.setItem('vbai_transcribe_use_dedicated', 'true');
      localStorage.setItem('vbai_transcribe_endpoint', transcribeEndpoint);
      localStorage.setItem('vbai_proxy_endpoint_meeting_transcribe', transcribeEndpoint);
      localStorage.setItem('vbai_proxy_profile_meeting_transcribe', 'proxy_custom');
    }
    if (transcribeApiKey) {
      localStorage.setItem('vbai_transcribe_use_dedicated', 'true');
      localStorage.setItem('vbai_transcribe_api_key', transcribeApiKey);
      localStorage.setItem('vbai_proxy_api_key_meeting_transcribe', transcribeApiKey);
    }
    
    try {
      const payload = {
        router_model: model,
        router_web_search_enabled: useProxyWebSearch,
        router_transcribe_model: transcribeModel,
        router_transcribe_endpoint: transcribeEndpoint,
        router_transcribe_api_key: transcribeApiKey,
        router_profile: 'proxy_custom',
        router_profile_chat: 'proxy_custom',
        router_profile_spellcheck: 'proxy_custom',
        router_profile_pdf: 'proxy_custom',
        router_profile_meeting: 'proxy_custom',
        router_proxy_enabled_chat: true,
        router_proxy_enabled_meeting_transcribe: true
      };
      if (routerEndpoint) payload.router_endpoint = routerEndpoint;
      if (routerKey) payload.router_api_key = routerKey;
      if (googleSearchKey) payload.google_search_key = googleSearchKey;
      if (googleSearchCx) payload.google_search_cx = googleSearchCx;
      
      try {
        await setDoc(doc(db, 'config', 'system'), payload, { merge: true });
      } catch (firestoreError) {
        console.warn("Lỗi lưu cấu hình lên server (Firestore), nhưng đã lưu cục bộ trên máy bạn:", firestoreError);
      }
      
      if(initChat('', model)) {
        alert("Đã lưu cấu hình thành công!");
        keyModal.style.display = 'none';
      } else {
        alert("Lỗi khi khởi tạo Model!");
      }
    } catch (e) {
      console.error("Lưu cấu hình lỗi:", e);
      alert("Lỗi lưu cấu hình: " + e.message);
    }
  };
}

