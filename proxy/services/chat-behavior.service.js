'use strict';

const DEFAULT_TTL_MS = 30 * 60 * 1000;
const DEFAULT_MAX_TURNS = 12;
const DEFAULT_MAX_SESSIONS = 1000;
const MAX_TEXT_LENGTH = 4000;

const CATEGORY_RULES = [
  { category: 'legal', intent: 'legal_search', pattern: /luật|nghị định|thông tư|nghị quyết|quyết định|điều khoản|hiệu lực|bãi bỏ|sửa đổi|thay thế|\d+\/\d+\/[a-z0-9-]+/i },
  { category: 'document_drafting', intent: 'drafting', pattern: /soạn|dự thảo|công văn|quyết định|biên bản|tờ trình|hợp đồng/i },
  { category: 'document_review', intent: 'review', pattern: /rà soát|kiểm tra|đánh giá|lỗi|góp ý/i },
  { category: 'administrative', intent: 'administrative_guidance', pattern: /thủ tục|hành chính|cơ quan|phòng ban|địa giới|cải cách/i },
];

function clampText(value) {
  return String(value || '').trim().slice(0, MAX_TEXT_LENGTH);
}

function classifyIntent(text) {
  const query = clampText(text);
  const matched = CATEGORY_RULES.find((rule) => rule.pattern.test(query));
  return {
    category: matched?.category || 'general',
    intent: matched?.intent || 'general_chat',
    isFollowUp: /^(còn|vậy|thế|nó|việc này|trường hợp đó|tiếp theo|cụ thể hơn|giải thích thêm)\b/i.test(query),
    confidence: matched ? 0.9 : 0.5,
  };
}

function createConversationMemory(options = {}) {
  const ttlMs = Math.max(1000, Number(options.ttlMs) || DEFAULT_TTL_MS);
  const maxTurns = Math.max(2, Number(options.maxTurns) || DEFAULT_MAX_TURNS);
  const maxSessions = Math.max(1, Number(options.maxSessions) || DEFAULT_MAX_SESSIONS);
  const store = new Map();

  function keyFor(userId, sessionId) {
    const user = String(userId || '').trim();
    const session = String(sessionId || '').trim();
    return user && session ? `${user}:${session}` : null;
  }
  function purge(now = Date.now()) {
    for (const [key, value] of store) if (now - value.updatedAt > ttlMs) store.delete(key);
    while (store.size > maxSessions) store.delete(store.keys().next().value);
  }
  function get(userId, sessionId, now = Date.now()) {
    purge(now);
    const key = keyFor(userId, sessionId);
    const value = key ? store.get(key) : null;
    if (!value || now - value.updatedAt > ttlMs) return [];
    value.updatedAt = now;
    return value.turns.map((turn) => ({ ...turn }));
  }
  function append(userId, sessionId, turns, now = Date.now()) {
    const key = keyFor(userId, sessionId);
    if (!key) return;
    purge(now);
    const existing = store.get(key) || { turns: [], updatedAt: now };
    for (const turn of Array.isArray(turns) ? turns : [turns]) {
      const role = turn?.role === 'assistant' ? 'assistant' : turn?.role === 'user' ? 'user' : null;
      const content = clampText(turn?.content);
      if (role && content) existing.turns.push({ role, content });
    }
    existing.turns = existing.turns.slice(-maxTurns);
    existing.updatedAt = now;
    store.set(key, existing);
    purge(now);
  }
  return { get, append, clear: (userId, sessionId) => { const key = keyFor(userId, sessionId); if (key) store.delete(key); }, size: () => store.size };
}

function buildBehaviorContext(memory, userId, sessionId, userText) {
  const intent = classifyIntent(userText);
  const turns = memory?.get(userId, sessionId) || [];
  return {
    intent,
    turns,
    messages: turns.length ? [{ role: 'system', content: 'CONTEXT HỘI THOẠI TRƯỚC ĐÓ (chỉ dùng để hiểu follow-up; không phải căn cứ pháp lý):' }, ...turns] : [],
  };
}

function normalizeResponseMeta(meta = {}, behavior = {}) {
  return {
    ...meta,
    behavior: {
      category: behavior.intent?.category || 'general',
      intent: behavior.intent?.intent || 'general_chat',
      is_follow_up: behavior.intent?.isFollowUp === true,
      memory_turns: Array.isArray(behavior.turns) ? behavior.turns.length : 0,
      memory_enabled: Boolean(behavior.memoryEnabled),
    },
  };
}

module.exports = { createConversationMemory, classifyIntent, buildBehaviorContext, normalizeResponseMeta };
