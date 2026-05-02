/**
 * AI Proxy Module for 9router
 * Cung cấp giao thức OpenAI-compatible để giao tiếp qua 9router local proxy
 */

const DEFAULT_9ROUTER_ENDPOINT = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" 
  ? "http://localhost:20128/v1" 
  : "https://your-9router-public-url.com/v1"; // Cần thay đổi nếu dùng trên Cloud Run

/**
 * Gửi yêu cầu Chat Completion đến 9router
 * @param {Array} messages - Danh sách tin nhắn [{role, content}]
 * @param {String} model - Tên model (ví dụ: gemini-3.1-flash-lite-preview)
 * @param {Object} options - Các cấu hình bổ sung (temperature, stream...)
 */
export async function sendChatRequest(messages, model, options = {}) {
  const endpoint = `${DEFAULT_9ROUTER_ENDPOINT}/chat/completions`;
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer 9router-local-proxy' // 9router không bắt buộc key nhưng nên có header
    },
    body: JSON.stringify({
      model: model,
      messages: messages,
      temperature: options.temperature || 0.7,
      stream: options.stream || false,
      ...options
    })
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || `HTTP Error ${response.status}`);
  }

  if (options.stream) {
    return response.body; // Trả về stream để xử lý chunk
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

/**
 * Kiểm tra xem 9router có đang hoạt động không
 */
export async function check9routerStatus() {
  try {
    const res = await fetch(`${DEFAULT_9ROUTER_ENDPOINT}/models`, { method: 'GET' });
    return res.ok;
  } catch (e) {
    return false;
  }
}
