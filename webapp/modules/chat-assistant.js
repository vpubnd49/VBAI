/**
 * Chat Assistant Module — Legal & Administrative Consultant
 */
import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai";

let chatModel = null;
let chatHistory = [];

export function initChat(apiKey, modelName = "gemini-1.5-flash-latest") {
  if (!apiKey) return null;
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    chatModel = genAI.getGenerativeModel({ 
      model: modelName,
      systemInstruction: "Bạn là Trợ Lý Pháp Lý VBAI, một chuyên gia về hệ thống văn bản quy phạm pháp luật Việt Nam (Luật, Nghị định, Thông tư) và các quy định của Đảng (HD36). Hãy trả lời chuyên nghiệp, chính xác, ngắn gọn nhưng đầy đủ. Trích dẫn rõ Điều, Khoản nếu có thể. Luôn sử dụng tiếng Việt.",
    });
    return true;
  } catch (e) {
    console.error("Chat Init Error:", e);
    return false;
  }
}

export async function sendMessage(text, onChunk) {
  if (!chatModel) throw new Error("Chưa cấu hình API Key");

  const chat = chatModel.startChat({
    history: chatHistory,
  });

  const result = await chat.sendMessageStream(text);
  let fullText = "";
  
  for await (const chunk of result.stream) {
    const chunkText = chunk.text();
    fullText += chunkText;
    if (onChunk) onChunk(fullText);
  }

  chatHistory.push(
    { role: "user", parts: [{ text }] },
    { role: "model", parts: [{ text: fullText }] }
  );

  return fullText;
}

export function renderChatUI(container) {
  const apiKey = localStorage.getItem('vbai_gemini_key') || '';
  const savedModel = localStorage.getItem('vbai_gemini_model') || 'gemini-3.0-flash';
  
  container.innerHTML = `
    <div class="chat-assistant-panel panel-group">
      <div class="panel-header">
        <div class="panel-header-icon">⚖️</div>
        Trợ Lý Tra Cứu Pháp Luật (AI Studio)
        <div style="flex:1"></div>
        <button id="chat-settings-btn" class="btn-icon" title="Cấu hình" style="width:28px; height:28px; font-size:0.8rem">⚙️</button>
      </div>
      <div class="panel-body">
        <div id="chat-messages" class="chat-messages-area">
          <div class="chat-msg ai">Xin chào! Tôi là Trợ lý VBAI. Bạn cần tra cứu Luật, Nghị định hay quy định nào hôm nay?</div>
        </div>
        
        <div class="chat-input-wrapper">
          <input type="text" id="chat-input" placeholder="Nhập câu hỏi tra cứu..." class="form-input chat-input-field">
          <button id="chat-send-btn" class="btn btn-primary chat-send-btn">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M2.5 10l15-7.5L10 10l7.5 7.5L2.5 10z" fill="currentColor"/></svg>
          </button>
        </div>
      </div>
    </div>

    <!-- API Key Modal (Updated) -->
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
            <label class="form-label">Chọn Model (Gemini)</label>
            <select id="model-select" class="form-input">
              <option value="gemini-3.0-flash" ${savedModel==='gemini-3.0-flash'?'selected':''}>Gemini 3 Flash (Mới nhất - Khuyên dùng)</option>
              <option value="gemini-2.0-flash" ${savedModel==='gemini-2.0-flash'?'selected':''}>Gemini 2.0 Flash</option>
              <option value="gemini-1.5-flash-latest" ${savedModel==='gemini-1.5-flash-latest'?'selected':''}>Gemini 1.5 Flash</option>
              <option value="gemini-1.5-pro-latest" ${savedModel==='gemini-1.5-pro-latest'?'selected':''}>Gemini 1.5 Pro</option>
            </select>
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
    div.innerText = text;
    msgsArea.appendChild(div);
    msgsArea.scrollTop = msgsArea.scrollHeight;
    return div;
  };

  const handleSend = async () => {
    const text = input.value.trim();
    if (!text) return;
    if (!chatModel) {
      alert("Vui lòng cấu hình API Key trước (bấm vào icon bánh răng)");
      return;
    }

    input.value = '';
    addMsg(text, 'user');
    
    const aiMsgDiv = addMsg('...', 'ai');
    try {
      await sendMessage(text, (full) => {
        aiMsgDiv.innerText = full;
        msgsArea.scrollTop = msgsArea.scrollHeight;
      });
    } catch (e) {
      aiMsgDiv.innerText = "Lỗi: " + e.message;
      aiMsgDiv.classList.add('error');
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
