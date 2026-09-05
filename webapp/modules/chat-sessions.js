/**
 * chat-sessions.js
 * Service quản lý lịch sử hội thoại lâu dài (ChatGPT-style)
 * Lưu vào MongoDB qua /api/chat/sessions
 */

const ANON_KEY = 'vbai_anon_id_v1';
const ACTIVE_SESSION_KEY = 'vbai_active_session_v1';

/** Sinh hoặc lấy anon UUID cho user chưa đăng nhập */
export function getAnonId() {
  let id = localStorage.getItem(ANON_KEY);
  if (!id || !/^[a-f0-9]{32}$/.test(id)) {
    id = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map(b => b.toString(16).padStart(2, '0')).join('');
    localStorage.setItem(ANON_KEY, id);
  }
  return id;
}

/** Header dùng cho tất cả request */
function buildHeaders() {
  return {
    'Content-Type': 'application/json',
    'X-Anon-Id': getAnonId(),
  };
}

/** Lưu active session id vào localStorage */
export function saveActiveSessionId(id) {
  if (id) localStorage.setItem(ACTIVE_SESSION_KEY, id);
  else localStorage.removeItem(ACTIVE_SESSION_KEY);
}

/** Lấy active session id */
export function getActiveSessionId() {
  return localStorage.getItem(ACTIVE_SESSION_KEY) || null;
}

// ─── API Calls ──────────────────────────────────────────────────────────────

/** Lấy danh sách sessions (tối đa 50, sắp xếp mới nhất trước) */
export async function listSessions() {
  const res = await fetch('/api/chat/sessions', { headers: buildHeaders() });
  if (!res.ok) throw new Error('Không thể tải danh sách hội thoại.');
  const data = await res.json();
  return data.sessions || [];
}

/** Tạo session mới */
export async function createSession(firstMessage = '') {
  const res = await fetch('/api/chat/sessions', {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({ firstMessage }),
  });
  if (!res.ok) throw new Error('Không thể tạo hội thoại mới.');
  return await res.json(); // { sessionId, title, ... }
}

/** Lấy toàn bộ messages của 1 session */
export async function getSession(sessionId) {
  const res = await fetch(`/api/chat/sessions/${sessionId}`, { headers: buildHeaders() });
  if (!res.ok) throw new Error('Không thể tải hội thoại.');
  const data = await res.json();
  return data.session;
}

/** Thêm cặp tin nhắn user+assistant vào session */
export async function appendMessages(sessionId, messages) {
  if (!sessionId || !messages?.length) return;
  const res = await fetch(`/api/chat/sessions/${sessionId}/messages`, {
    method: 'PUT',
    headers: buildHeaders(),
    body: JSON.stringify({ messages }),
  });
  if (!res.ok) console.warn('[ChatSessions] appendMessages failed:', await res.text());
}

/** Đổi tên session */
export async function renameSession(sessionId, title) {
  const res = await fetch(`/api/chat/sessions/${sessionId}/title`, {
    method: 'PATCH',
    headers: buildHeaders(),
    body: JSON.stringify({ title }),
  });
  return res.ok;
}

/** Xóa session */
export async function deleteSession(sessionId) {
  const res = await fetch(`/api/chat/sessions/${sessionId}`, {
    method: 'DELETE',
    headers: buildHeaders(),
  });
  return res.ok;
}

/** Xóa toàn bộ sessions */
export async function clearAllSessions() {
  const res = await fetch('/api/chat/sessions', {
    method: 'DELETE',
    headers: buildHeaders(),
  });
  return res.ok;
}

// ─── UI Helper ──────────────────────────────────────────────────────────────

/** Format thời gian ngắn gọn */
export function formatRelativeTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMs / 3600000);
  const diffD = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'Vừa xong';
  if (diffMin < 60) return `${diffMin} phút trước`;
  if (diffH < 24) return `${diffH} giờ trước`;
  if (diffD < 7) return `${diffD} ngày trước`;
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
}
