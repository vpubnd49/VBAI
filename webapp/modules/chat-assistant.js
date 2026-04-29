/**
 * Chat Assistant Module — Legal & Administrative Consultant
 * Uses @google/genai SDK with Google Search Grounding for real-time legal data
 */
import { GoogleGenAI } from "https://esm.run/@google/genai";
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


let aiClient = null;
let chatSession = null;
let currentModelName = "gemini-3.1-flash-lite-preview";

const SYSTEM_INSTRUCTION = `Bạn là Trợ Lý Pháp Lý VBAI — một chuyên gia tư vấn pháp luật Việt Nam hàng đầu. 

## NGUYÊN TẮC CỐT LÕI:
1. **LUÔN TRA CỨU GOOGLE SEARCH** để lấy thông tin mới nhất trước khi trả lời. KHÔNG BAO GIỜ trả lời từ kiến thức cũ nếu có thể tra cứu được.
2. **ƯU TIÊN NGUỒN CHÍNH THỐNG** theo thứ tự:
   - Các Cổng thông tin điện tử của Chính phủ, các Bộ, Ngành và UBND các tỉnh/thành phố (tên miền **.gov.vn**)
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

## LƯU Ý ĐẶC BIỆT:
- Luôn kiểm tra xem văn bản có bị sửa đổi, bổ sung bởi văn bản nào khác không
- Ưu tiên cung cấp thông tin từ năm 2024-2026
- Nếu chưa đủ thông tin, hãy đề xuất người dùng kiểm tra trực tiếp tại các trang web chính thống`;

export function initChat(apiKey, modelName = "gemini-3.1-flash-lite-preview") {
  if (!apiKey) return null;
  try {
    aiClient = new GoogleGenAI({ apiKey });
    currentModelName = modelName;
    // Reset chat session so it uses the new model
    chatSession = null;
    return true;
  } catch (e) {
    console.error("Chat Init Error:", e);
    return false;
  }
}

export async function sendMessage(text, onChunk) {
  if (!aiClient) throw new Error("Chưa cấu hình API Key");

  try {
    const response = await aiClient.models.generateContent({
      model: currentModelName,
      contents: text,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: [{ googleSearch: {} }],
      },
    });

    // Log query to Firestore (fire and forget)
    try {
      const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
      const db = getFirestore(app);
      addDoc(collection(db, 'search_logs'), {
        query: text,
        model: currentModelName,
        timestamp: serverTimestamp()
      }).catch(err => console.warn("Log Err:", err));
    } catch (e) {
      console.warn("Firebase Log Exception:", e);
    }

    const fullText = response.text || "";
    if (onChunk) onChunk(fullText);
    return fullText;
  } catch (e) {
    console.error("Send Error:", e);
    throw e;
  }
}

export function renderChatUI(container) {
  const apiKey = localStorage.getItem('vbai_gemini_key') || '';
  const savedModel = localStorage.getItem('vbai_gemini_model') || 'gemini-3.1-flash-lite-preview';
  
  container.innerHTML = `
    <div class="chat-assistant-panel panel-group">
      <div class="panel-header">
        <div class="panel-header-icon">⚖️</div>
        Trợ Lý Tra Cứu Pháp Luật (AI + Google Search)
        <div style="flex:1"></div>
        <button id="chat-settings-btn" class="btn-icon" title="Cấu hình" style="display: ${localStorage.getItem('vbai_admin') === 'true' ? 'block' : 'none'}; width:28px; height:28px; font-size:0.8rem">⚙️</button>
      </div>
      <div class="panel-body">
        <div id="chat-messages" class="chat-messages-area">
          <div class="chat-msg ai">Xin chào! Tôi là Trợ lý VBAI — Hỗ trợ tra cứu Luật, Nghị định, Thông tư mới nhất từ các nguồn chính thống (thuvienphapluat.vn, vanban.chinhphu.vn, luatvietnam.vn). Hãy đặt câu hỏi!</div>
        </div>
        
        <div class="chat-input-wrapper">
          <input type="text" id="chat-input" placeholder="VD: Nghị định mới nhất về quản lý cán bộ công chức..." class="form-input chat-input-field">
          <button id="chat-send-btn" class="btn btn-primary chat-send-btn">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M2.5 10l15-7.5L10 10l7.5 7.5L2.5 10z" fill="currentColor"/></svg>
          </button>
        </div>
      </div>
    </div>

    <!-- API Key Modal -->
    <div id="key-modal" class="modal-overlay" style="display:none">
      <div class="modal-content panel-group" style="max-width:420px; margin: 100px auto">
        <div class="panel-header">Cấu hình Trợ Lý AI</div>
        <div class="panel-body">
          <div class="form-group" style="margin-bottom:16px">
            <label class="form-label">Google AI Studio API Key</label>
            <input type="password" id="api-key-input" class="form-input" value="${apiKey}" placeholder="Dán API Key vào đây...">
            <p style="font-size:0.7rem; color:var(--text-secondary); margin-top:4px">Lấy Key miễn phí tại <a href="https://aistudio.google.com/app/apikey" target="_blank" style="color:var(--daquy-400)">Google AI Studio</a></p>
          </div>

          <div class="form-group" style="margin-bottom:16px">
            <label class="form-label">Chọn Model</label>
            <select id="model-select" class="form-input">
              <option value="gemini-3.1-flash-lite-preview" ${savedModel==='gemini-3.1-flash-lite-preview'?'selected':''}>Gemini 3.1 Flash Lite (Mới nhất)</option>
              <option value="gemini-2.5-flash" ${savedModel==='gemini-2.5-flash'?'selected':''}>Gemini 2.5 Flash (Ổn định)</option>
              <option value="gemini-2.5-pro" ${savedModel==='gemini-2.5-pro'?'selected':''}>Gemini 2.5 Pro (Thông minh nhất)</option>
              <option value="gemini-2.0-flash" ${savedModel==='gemini-2.0-flash'?'selected':''}>Gemini 2.0 Flash</option>
            </select>
          </div>

          <div style="padding:10px; background:rgba(230,162,0,0.1); border-radius:8px; margin-bottom:16px; border: 1px solid rgba(230,162,0,0.2)">
            <p style="font-size:0.75rem; color:var(--daquy-400); margin:0; font-weight:600">🔍 Google Search Grounding: BẬT</p>
            <p style="font-size:0.7rem; color:var(--text-secondary); margin:4px 0 0">Trợ lý sẽ tự động tìm kiếm Google để lấy thông tin pháp luật mới nhất từ thuvienphapluat.vn, vanban.chinhphu.vn, luatvietnam.vn</p>
          </div>
          
          <div class="btn-row" style="margin-top:20px">
            <button id="save-key-btn" class="btn btn-primary">Lưu cấu hình</button>
            <button id="close-modal-btn" class="btn btn-secondary">Đóng</button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Init if key exists
  if (apiKey) initChat(apiKey, savedModel);

  const input = container.querySelector('#chat-input');
  const sendBtn = container.querySelector('#chat-send-btn');
  const msgsArea = container.querySelector('#chat-messages');
  const settingsBtn = container.querySelector('#chat-settings-btn');
  const keyModal = container.querySelector('#key-modal');
  const apiKeyInput = container.querySelector('#api-key-input');
  const modelSelect = container.querySelector('#model-select');

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
  container.querySelector('#save-key-btn').onclick = () => {
    const key = apiKeyInput.value.trim();
    const model = modelSelect.value;
    localStorage.setItem('vbai_gemini_key', key);
    localStorage.setItem('vbai_gemini_model', model);
    if(initChat(key, model)) {
      alert("Đã lưu cấu hình thành công!");
      keyModal.style.display = 'none';
    } else {
      alert("Lỗi khi khởi tạo Model!");
    }
  };
}
