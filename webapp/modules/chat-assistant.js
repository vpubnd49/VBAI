/**
 * Chat Assistant Module — Legal & Administrative Consultant
 * Uses @google/genai SDK with Google Search Grounding for real-time legal data
 */
import { GoogleGenAI } from "https://esm.run/@google/genai";
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import { firebaseConfig } from '../firebase-config.js';


import { sendChatRequest, check9routerStatus } from './ai-proxy.js';

const DEFAULT_GEMINI_MODEL = "gemini-2.5-pro";
const DEFAULT_TRANSCRIBE_MODEL = "gemini-2.5-pro";

let aiClient = null;
let chatSession = null;
let currentModelName = DEFAULT_GEMINI_MODEL;
let use9router = true;

const PROVIDER_PRESETS = {
  // Kept for backward compatibility with old saved profile values.
  google_direct: {
    useProxy: true,
    endpoint: 'http://localhost:8317/v1',
    model: DEFAULT_GEMINI_MODEL,
    transcribeModel: DEFAULT_TRANSCRIBE_MODEL
  },
  proxy_9router_local: {
    useProxy: true,
    endpoint: 'http://localhost:20128/v1',
    model: DEFAULT_GEMINI_MODEL,
    transcribeModel: DEFAULT_TRANSCRIBE_MODEL
  },
  proxy_cliproxy_local: {
    useProxy: true,
    endpoint: 'http://localhost:8317/v1',
    model: DEFAULT_GEMINI_MODEL,
    transcribeModel: DEFAULT_TRANSCRIBE_MODEL
  },
  proxy_custom: null
};

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

let allSkills = [];

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

export function initChat(apiKey, modelName = DEFAULT_GEMINI_MODEL) {
  currentModelName = DEFAULT_GEMINI_MODEL;
  use9router = true;
  
  try {
    aiClient = { proxy: true }; // Dummy client for 9router mode
    currentModelName = DEFAULT_GEMINI_MODEL;
    chatSession = null;
    loadSkills(); // Tải skills khi init
    return true;
  } catch (e) {
    console.error("Chat Init Error:", e);
    return false;
  }
}

export async function sendMessage(text, onChunk) {
  if (!aiClient) throw new Error("Chưa cấu hình API Key hoặc 9router");

  // Tìm kiếm skill liên quan dựa trên triggers
  let dynamicInstruction = SYSTEM_INSTRUCTION;
  const lowerText = text.toLowerCase();
  const normalizedText = normalizeVietnamese(text);
  const matchedSkills = allSkills.filter((s) => detectSkillMatch(s, lowerText, normalizedText));

  if (matchedSkills.length > 0) {
    dynamicInstruction += `\n\n## KIẾN THỨC BỔ SUNG (Dựa trên context người dùng):\n`;
    matchedSkills.forEach(s => {
      dynamicInstruction += `\n### Kỹ năng: ${s.name}\n${s.instructions}\n`;
      dynamicInstruction += buildSkillReferenceContext(s);
    });
    console.log("Đã nạp thêm context từ các skills:", matchedSkills.map(s => s.name));
  }

  try {
    let fullText = "";
    
    if (use9router) {
      // Giao tiếp qua 9router (OpenAI format)
      const messages = [
        { role: "system", content: dynamicInstruction },
        { role: "user", content: text }
      ];
      fullText = await sendChatRequest(messages, currentModelName);
    } else {
      // Giao tiếp trực tiếp qua Gemini SDK
      const response = await aiClient.models.generateContent({
        model: currentModelName,
        contents: text,
        config: {
          systemInstruction: dynamicInstruction,
          tools: [{ googleSearch: {} }],
        },
      });
      fullText = response.text || "";
    }

    try {
      const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
      const db = getFirestore(app);
      addDoc(collection(db, 'search_logs'), {
        query: text,
        model: currentModelName + (use9router ? " (via 9router)" : ""),
        userEmail: window.currentUser?.email || 'Unknown',
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
  const profileForDefault = localStorage.getItem('vbai_router_profile') || '';
  const savedModel = DEFAULT_GEMINI_MODEL;
  localStorage.setItem('vbai_gemini_model', DEFAULT_GEMINI_MODEL);
  
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
            Tôi hỗ trợ tra cứu các quy định pháp luật và các quy định, hướng dẫn của Đảng mới nhất dựa trên dữ liệu thời gian thực từ Google Search Grounding.
            <br><br>
            <strong>Nguồn dữ liệu chính thống:</strong><br>
            • dangcongsan.vn (Tư liệu Văn kiện Đảng)<br>
            • vanban.chinhphu.vn (Cổng thông tin Chính phủ)<br>
            • thuvienphapluat.vn (Thư viện Pháp luật)<br>
            • Các cổng thông tin điện tử (.gov.vn)
            <br><br>
            <em>Bạn hãy đặt câu hỏi bằng ngôn ngữ tự nhiên (VD: "Quy định mới nhất về công tác văn thư của Đảng")</em>
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
      <div class="modal-content panel-group" style="max-width:420px; margin: 100px auto">
        <div class="panel-header">Cấu hình Trợ Lý AI</div>
          <div class="panel-body">
          <div class="form-group" style="margin-bottom:16px">
            <label class="form-label">Profile Proxy</label>
            <select id="provider-profile-select" class="form-input">
              <option value="proxy_9router_local">9router local (localhost:20128)</option>
              <option value="proxy_cliproxy_local">CLIProxy local (localhost:8317)</option>
              <option value="proxy_custom">Tuy chinh</option>
            </select>
            <p style="font-size:0.7rem; color:var(--text-secondary); margin-top:4px">Chon profile de tu dong dien endpoint va model.</p>
          </div>
          <div class="form-group" style="margin-bottom:16px">
            <label class="form-label">API Key (Google hoac 9router)</label>
            <input type="password" id="api-key-input" class="form-input" value="" placeholder="Dán API Key vào đây...">
            <p style="font-size:0.7rem; color:var(--text-secondary); margin-top:4px">Neu bat 9router thi nhap 9router key. Neu tat 9router thi nhap Google AI Studio key.</p>
          </div>
          <div class="form-group" style="margin-bottom:16px">
            <label class="form-label">9router Endpoint</label>
            <input type="text" id="router-endpoint-input" class="form-input" value="" placeholder="http://localhost:20128/v1">
            <p style="font-size:0.7rem; color:var(--text-secondary); margin-top:4px">Co the dung local hoac endpoint public OpenAI-compatible.</p>
          </div>
          <div class="form-group" style="margin-bottom:16px">
            <label class="form-label">Transcribe Model</label>
            <input type="text" id="transcribe-model-input" class="form-input" value="" placeholder="gemini-2.5-pro">
            <p style="font-size:0.7rem; color:var(--text-secondary); margin-top:4px">Dung cho Ghi am -> Thong bao (audio transcription).</p>
          </div>

          <div class="form-group" style="margin-bottom:16px">
            <label class="form-label">Model AI (tu dong theo provider)</label>
            <input type="text" class="form-input" value="Google/Proxy: gemini-2.5-pro" readonly style="background:var(--bg-secondary); cursor:default; opacity:0.8">
            <input type="hidden" id="model-select" value="gemini-2.5-pro">
          </div>

          <div style="padding:10px; background:rgba(230,162,0,0.1); border-radius:8px; margin-bottom:16px; border: 1px solid rgba(230,162,0,0.2)">
            <p style="font-size:0.75rem; color:var(--daquy-400); margin:0; font-weight:600">🔍 Google Search Grounding: BẬT</p>
            <p style="font-size:0.7rem; color:var(--text-secondary); margin:4px 0 0">Trợ lý sẽ tự động tìm kiếm Google để lấy thông tin pháp luật mới nhất.</p>
          </div>

          <div style="padding:12px; background:rgba(66,133,244,0.1); border-radius:8px; margin-bottom:16px; border: 1px solid rgba(66,133,244,0.2); display: flex; align-items: center; justify-content: space-between;">
            <div>
              <p style="font-size:0.75rem; color:var(--daquy-400); margin:0; font-weight:600">🚀 Sử dụng 9router Proxy</p>
              <p style="font-size:0.65rem; color:var(--text-secondary); margin:2px 0 0">Chạy yêu cầu AI qua 9router local (localhost:20128)</p>
            </div>
            <label class="switch-toggle">
              <input type="checkbox" id="use-9router-chk" checked disabled>
              <span class="slider-round"></span>
            </label>
          </div>
          <div class="btn-row" style="margin-bottom:10px">
            <button id="test-proxy-btn" class="btn btn-secondary">Kiem tra ket noi proxy</button>
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
  const providerProfileSelect = container.querySelector('#provider-profile-select');
  const apiKeyInput = container.querySelector('#api-key-input');
  const routerEndpointInput = container.querySelector('#router-endpoint-input');
  const transcribeModelInput = container.querySelector('#transcribe-model-input');
  const testProxyBtn = container.querySelector('#test-proxy-btn');
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
      const routerTranscribeModel = data.router_transcribe_model || '';
      const routerProfile = data.router_profile || '';
      apiKey = routerKey || localStorage.getItem('vbai_9router_api_key') || '';
      if (routerKey) localStorage.setItem('vbai_9router_api_key', routerKey);
      if (routerEndpoint) localStorage.setItem('vbai_9router_endpoint', routerEndpoint);
      if (routerTranscribeModel) localStorage.setItem('vbai_transcribe_model', routerTranscribeModel);
      if (routerProfile) localStorage.setItem('vbai_router_profile', routerProfile);
      localStorage.setItem('vbai_use_9router', 'true');
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
  if (transcribeModelInput) {
    transcribeModelInput.value = localStorage.getItem('vbai_transcribe_model') || DEFAULT_TRANSCRIBE_MODEL;
  }
  const applyProviderPreset = (profile, preserveKey = true) => {
    const preset = PROVIDER_PRESETS[profile];
    if (!preset) return;
    if (routerEndpointInput) routerEndpointInput.value = preset.endpoint || '';
    if (transcribeModelInput) transcribeModelInput.value = preset.transcribeModel || DEFAULT_TRANSCRIBE_MODEL;
    if (modelSelect) modelSelect.value = preset.model || DEFAULT_GEMINI_MODEL;
    const useProxyChk = container.querySelector('#use-9router-chk');
    if (useProxyChk) useProxyChk.checked = !!preset.useProxy;
    if (!preserveKey && apiKeyInput) apiKeyInput.value = '';
  };

  const currentProfile = localStorage.getItem('vbai_router_profile') || 'proxy_cliproxy_local';
  if (providerProfileSelect) {
    providerProfileSelect.value = PROVIDER_PRESETS[currentProfile] ? currentProfile : 'proxy_custom';
    providerProfileSelect.onchange = () => {
      const p = providerProfileSelect.value;
      localStorage.setItem('vbai_router_profile', p);
      if (p !== 'proxy_custom') applyProviderPreset(p, true);
    };
    if (providerProfileSelect.value !== 'proxy_custom') {
      applyProviderPreset(providerProfileSelect.value, true);
    }
  }

  // Init chat: with 9router, API key can be empty on local proxy
  initChat(apiKey, savedModel);

  const addMsg = (text, role) => {
    const div = document.createElement('div');
    div.className = `chat-msg ${role}`;
    div.style.whiteSpace = 'pre-wrap';
    div.innerText = text;
    msgsArea.appendChild(div);
    msgsArea.scrollTop = msgsArea.scrollHeight;
    return div;
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
    
    const aiMsgDiv = addMsg('🔍 Đang tra cứu từ Google Search...', 'ai');
    try {
      await sendMessage(text, (full) => {
        aiMsgDiv.innerText = full;
        msgsArea.scrollTop = msgsArea.scrollHeight;
      });
    } catch (e) {
      aiMsgDiv.innerText = "❌ Lỗi: " + e.message;
      aiMsgDiv.classList.add('error');
    } finally {
      sendBtn.disabled = false;
    }
  };

  sendBtn.onclick = handleSend;
  input.onkeypress = (e) => { if(e.key==='Enter') handleSend(); };
  settingsBtn.onclick = () => keyModal.style.display = 'block';
  container.querySelector('#close-modal-btn').onclick = () => keyModal.style.display = 'none';
  if (testProxyBtn) {
    testProxyBtn.onclick = async () => {
      const oldEndpoint = localStorage.getItem('vbai_9router_endpoint');
      const oldKey = localStorage.getItem('vbai_9router_api_key');
      const oldUseProxy = localStorage.getItem('vbai_use_9router');
      const endpoint = (routerEndpointInput?.value || '').trim();
      const key = (apiKeyInput?.value || '').trim();
      if (endpoint) localStorage.setItem('vbai_9router_endpoint', endpoint);
      if (key) localStorage.setItem('vbai_9router_api_key', key);
      localStorage.setItem('vbai_use_9router', 'true');
      testProxyBtn.disabled = true;
      const prevText = testProxyBtn.innerText;
      testProxyBtn.innerText = 'Dang kiem tra...';
      try {
        const ok = await check9routerStatus();
        alert(ok ? 'Ket noi proxy thanh cong.' : 'Khong ket noi duoc proxy.');
      } catch (e) {
        alert('Loi kiem tra proxy: ' + e.message);
      } finally {
        if (oldEndpoint === null) localStorage.removeItem('vbai_9router_endpoint'); else localStorage.setItem('vbai_9router_endpoint', oldEndpoint);
        if (oldKey === null) localStorage.removeItem('vbai_9router_api_key'); else localStorage.setItem('vbai_9router_api_key', oldKey);
        if (oldUseProxy === null) localStorage.removeItem('vbai_use_9router'); else localStorage.setItem('vbai_use_9router', oldUseProxy);
        testProxyBtn.disabled = false;
        testProxyBtn.innerText = prevText;
      }
    };
  }
  container.querySelector('#save-key-btn').onclick = async () => {
    const key = apiKeyInput.value.trim();
    const routerEndpoint = (routerEndpointInput?.value || '').trim();
    const transcribeModel = (transcribeModelInput?.value || '').trim() || DEFAULT_TRANSCRIBE_MODEL;
    const selectedProfile = providerProfileSelect?.value || 'proxy_custom';
    const isUsing9router = true;
    const model = DEFAULT_GEMINI_MODEL;
    
    localStorage.setItem('vbai_use_9router', isUsing9router ? 'true' : 'false');
    localStorage.setItem('vbai_gemini_model', model);
    localStorage.setItem('vbai_transcribe_model', transcribeModel);
    localStorage.setItem('vbai_router_profile', selectedProfile);
    if (routerEndpoint) {
      localStorage.setItem('vbai_9router_endpoint', routerEndpoint);
    }
    if (isUsing9router) {
      localStorage.setItem('vbai_9router_api_key', key);
    }
    
    try {
      const payload = {
        router_transcribe_model: transcribeModel,
        router_profile: selectedProfile
      };
      if (routerEndpoint) payload.router_endpoint = routerEndpoint;
      if (key) payload.router_api_key = key;
      await setDoc(doc(db, 'config', 'system'), payload, { merge: true });
      
      if(initChat(key, model)) {
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




