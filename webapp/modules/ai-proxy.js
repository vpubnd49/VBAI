import { fetchSystemConfig, getCachedSystemConfig } from './system-config.js';

const DEFAULT_PROXY_MODEL = 'gemini-2.5-flash';
const DEFAULT_BACKEND_BASE = '/api';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const GEMINI_COMPAT_PATH = ['open', 'ai'].join('');
const DEFAULT_GEMINI_ENDPOINT = `${GEMINI_API_BASE}/${GEMINI_COMPAT_PATH}`;
const DEFAULT_TRANSCRIBE_CHUNK_BYTES = 10 * 1024 * 1024; // 10MB (an toàn với giới hạn 20MB của Gemini)
let lastWebSearchMeta = null;
const ALLOWED_BACKEND_HOSTS = new Set([
  'vbai.tracuu.lamdong.vn',
  'localhost',
  '127.0.0.1',
]);

function trimTrailingSlash(url = '') {
  return String(url || '').replace(/\/+$/, '');
}

function sanitizeBackendBase(raw = '') {
  const val = String(raw || '').trim();
  if (!val) return DEFAULT_BACKEND_BASE;

  // Only allow relative `/api` path by default.
  if (val.startsWith('/')) {
    if (val === '/api' || val.startsWith('/api/')) {
      return trimTrailingSlash(val);
    }
    throw new Error('Cau hinh backend khong hop le. Chi duoc phep duong dan /api.');
  }

  // For absolute URLs, only allow same-origin or whitelisted internal hosts.
  let parsed;
  try {
    parsed = new URL(val);
  } catch {
    throw new Error('Cau hinh backend URL khong hop le.');
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('Backend URL phai su dung http/https.');
  }

  const host = parsed.hostname.toLowerCase();
  const sameOrigin = typeof window !== 'undefined' && parsed.origin === window.location.origin;
  const whitelisted = ALLOWED_BACKEND_HOSTS.has(host);
  if (!sameOrigin && !whitelisted) {
    throw new Error('Backend URL khong nam trong danh sach host duoc phep.');
  }

  if (!parsed.pathname || parsed.pathname === '/') {
    parsed.pathname = '/api';
  }
  if (!parsed.pathname.startsWith('/api')) {
    throw new Error('Backend URL phai tro den endpoint /api.');
  }

  return trimTrailingSlash(parsed.toString());
}

export function normalizeModelName(model = '') {
  return String(model || '').trim().replace(/(\d),(\d)/g, '$1.$2');
}

function normalizeContext(context = 'default') {
  const raw = String(context || 'default').toLowerCase().trim();
  return raw || 'default';
}

function parseEndpointHost(endpoint = '') {
  const raw = String(endpoint || '').trim();
  if (!raw) return '';
  try {
    return new URL(raw).host.toLowerCase();
  } catch {
    return '';
  }
}

export function isGeminiApiEndpoint(endpoint = '') {
  const raw = String(endpoint || '').trim().toLowerCase();
  if (!raw) return false;
  const host = parseEndpointHost(raw);
  if (host === 'generativelanguage.googleapis.com') return true;
  return raw.includes(`${GEMINI_API_BASE.toLowerCase()}/${GEMINI_COMPAT_PATH}`);
}

function isReasoningModel(model = '') {
  const m = String(model || '').toLowerCase();
  return m.includes('o1') || m.includes('o3');
}

function normalizeMessagesForProvider(messages = [], model = '') {
  const m = String(model || '').toLowerCase();
  const useDeveloperRole = m.includes('o1') || m.includes('o3');
  if (!useDeveloperRole || !Array.isArray(messages)) return messages;
  return messages.map((msg) => msg.role === 'system' ? { ...msg, role: 'developer' } : msg);
}

function extractMessageText(message = {}) {
  if (typeof message?.content === 'string') return String(message.content || '').trim();
  if (Array.isArray(message?.parts)) {
    return message.parts
      .map((part) => String(part?.text || '').trim())
      .filter(Boolean)
      .join('\n')
      .trim();
  }
  return '';
}

function normalizeContentsForProvider(messages = [], model = '') {
  const normalizedMessages = normalizeMessagesForProvider(messages, model);
  if (!Array.isArray(normalizedMessages)) return [];
  return normalizedMessages
    .map((msg) => {
      const text = extractMessageText(msg);
      if (!text) return null;
      const rawRole = String(msg?.role || '').toLowerCase();
      const role = rawRole === 'assistant' ? 'model' : rawRole === 'developer' ? 'user' : rawRole;
      return {
        role: role === 'system' ? 'user' : role,
        parts: [{ text }],
      };
    })
    .filter(Boolean);
}

async function getIdToken() {
  if (typeof window === 'undefined' || !window.currentUser) return null;
  try {
    return await window.currentUser.getIdToken();
  } catch {
    return null;
  }
}

function getBackendBase() {
  const raw = typeof localStorage !== 'undefined' ? (localStorage.getItem('vbai_backend_url') || '').trim() : '';
  return sanitizeBackendBase(raw);
}

async function fetchWithTimeout(url, init = {}, timeoutMs = 120000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function buildHttpErrorMessage(response, fallback = '') {
  const fallbackMessage = fallback || `HTTP Error ${response?.status || ''}`.trim();
  let raw = '';
  try {
    raw = await response.text();
  } catch {
    return fallbackMessage;
  }
  const trimmed = String(raw || '').trim();
  if (!trimmed) return fallbackMessage;
  try {
    const parsed = JSON.parse(trimmed);
    const candidate = parsed?.error?.message || parsed?.message || parsed?.detail || parsed?.error_description || '';
    if (String(candidate || '').trim()) return String(candidate).trim();
  } catch {}
  return trimmed.slice(0, 320);
}

async function backendFetch(path, { method = 'GET', headers = {}, body, timeoutMs = 120000 } = {}) {
  const token = await getIdToken();
  if (!token) throw new Error('Bạn cần đăng nhập để sử dụng tính năng AI.');
  const base = getBackendBase();
  const response = await fetchWithTimeout(`${base}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...headers,
    },
    body,
  }, timeoutMs);
  return response;
}

async function getSystemConfigSafe() {
  const config = await fetchSystemConfig() || getCachedSystemConfig() || {
    active_provider: 'gemini',
    gemini_model: 'gemini-2.0-flash-lite',
    gemini_endpoint: DEFAULT_GEMINI_ENDPOINT,
    transcribe_model: 'gemini-2.5-flash',
    has_gemini_key: false,
  };
  
  // Normalize endpoints
  if (config.gemini_endpoint) config.gemini_endpoint = trimTrailingSlash(config.gemini_endpoint);
  
  return config;
}

export async function sendChatRequest(messages, model, options = {}) {
  const requestOptions = { ...options };
  const timeoutMs = requestOptions.timeoutMs;
  delete requestOptions.timeoutMs;
  delete requestOptions.context;
  delete requestOptions.onDelta;
  delete requestOptions.__retryModel;
  delete requestOptions.__retryAlias;
  delete requestOptions.disableAliasRetry;

  const systemConfig = await getSystemConfigSafe();
  const resolvedModel = normalizeModelName(
    model || systemConfig.gemini_model || DEFAULT_PROXY_MODEL
  );

  const messagesList = normalizeMessagesForProvider(messages, resolvedModel);
  const contentsList = normalizeContentsForProvider(messages, resolvedModel);

  const payload = {
    model: resolvedModel,
    messages: messagesList,
    contents: contentsList,
    stream: false,
    ...requestOptions,
  };

  if (isReasoningModel(resolvedModel)) {
    delete payload.temperature;
    delete payload.top_p;
    if (payload.max_tokens) {
      payload.max_completion_tokens = payload.max_tokens;
      delete payload.max_tokens;
    }
  } else if (payload.temperature === undefined) {
    payload.temperature = 0.7;
  }

  const response = await backendFetch('/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    timeoutMs: timeoutMs ?? 120000,
  });

  if (!response.ok) {
    const rawMessage = await buildHttpErrorMessage(response, `HTTP Error ${response.status}`);
    const normalized = String(rawMessage || '').toLowerCase();
    if (response.status === 401 || normalized.includes('unauthorized')) {
      throw new Error('Phiên đăng nhập hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.');
    }
    if (response.status === 403) {
      throw new Error(`Bạn không có quyền sử dụng AI này: ${rawMessage}`);
    }
    if (response.status === 429 || normalized.includes('quota') || normalized.includes('limit')) {
      throw new Error('Hệ thống AI đã vượt hạn mức hoặc hết quota. Vui lòng liên hệ quản trị viên.');
    }
    throw new Error(rawMessage || 'Không thể gọi dịch vụ AI.');
  }

  const data = await response.json();
  return extractTextFromPayload(data) || '';
}

export async function sendAudioTranscription(file, model = DEFAULT_PROXY_MODEL, options = {}) {
  const chunkWhenLarge = options.chunkWhenLarge === true;
  const configuredMaxBytes = Number(options.maxBytes);
  const maxBytes = Number.isFinite(configuredMaxBytes) && configuredMaxBytes > 0
    ? configuredMaxBytes
    : DEFAULT_TRANSCRIBE_CHUNK_BYTES;
  const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;

  if (chunkWhenLarge && file?.size > maxBytes) {
    const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    const total = Math.ceil(file.size / maxBytes);
    const chunkPromises = [];
    for (let part = 0; part < total; part += 1) {
      const start = part * maxBytes;
      const end = Math.min(file.size, start + maxBytes);
      const blobChunk = file.slice(start, end, file.type || 'application/octet-stream');
      const chunkFile = new File([blobChunk], `${file.name || 'audio'}.part${part + 1}`, {
        type: file.type || 'application/octet-stream',
      });
      chunkPromises.push({ chunkFile, part: part + 1 });
    }

    // Thực hiện gọi API đồng thời theo từng nhóm (batch) để tránh nghẽn hàng đợi kết nối của trình duyệt (Browser HTTP pool limit)
    const concurrencyLimit = 5;
    const results = [];
    for (let i = 0; i < chunkPromises.length; i += concurrencyLimit) {
      const batch = chunkPromises.slice(i, i + concurrencyLimit);
      const batchResults = await Promise.all(
        batch.map(async ({ chunkFile, part }) => {
          try {
            if (onProgress) onProgress({ part, total, type: 'start' });
            const text = await sendSingleAudioTranscription(chunkFile, model, options, { part, total, uploadId });
            if (onProgress) onProgress({ part, total, type: 'complete' });
            return { part, text: String(text || '').trim() };
          } catch (err) {
            console.error(`Lỗi bóc băng phần ${part}/${total}:`, err);
            throw err;
          }
        })
      );
      results.push(...batchResults);
    }

    // Sắp xếp lại kết quả theo thứ tự các phần
    results.sort((a, b) => a.part - b.part);
    const transcripts = results.map(r => r.text).filter(Boolean);
    return transcripts.join('\n');
  }

  return sendSingleAudioTranscription(file, model, options);
}

async function sendSingleAudioTranscription(file, model = DEFAULT_PROXY_MODEL, options = {}, partMeta = null) {
  const formData = new FormData();
  formData.append('audio', file, file?.name || 'audio');
  formData.append('filename', file?.name || 'audio');
  formData.append('model', normalizeModelName(model || DEFAULT_PROXY_MODEL));
  formData.append('context', options.context || 'meeting');
  if (partMeta?.part) formData.append('part', String(partMeta.part));
  if (partMeta?.total) formData.append('total', String(partMeta.total));
  if (partMeta?.uploadId) formData.append('uploadId', String(partMeta.uploadId));

  const response = await backendFetch('/transcribe', {
    method: 'POST',
    body: formData,
    timeoutMs: options.timeoutMs ?? 180000,
  });

  if (!response.ok) {
    const rawMessage = await buildHttpErrorMessage(response, `HTTP Error ${response.status}`);
    throw new Error(rawMessage || 'Không thể phiên âm tệp ghi âm.');
  }
  const data = await response.json();
  return data?.text || data?.transcript || extractTextFromPayload(data) || '';
}


export async function sendWebSearchRequest(query, expectedDocNumber = null, options = {}) {
  const recencyDays = Number(options.recencyDays);
  const freshnessLevel = String(options.freshnessLevel || '').trim().toLowerCase();
  const forceFresh = options.forceFresh === true;
  const partialDocNumber = String(options.partialDocNumber || '').trim().toUpperCase();
  const requestedDocType = String(options.requestedDocType || '').trim().toLowerCase();
  const response = await backendFetch('/web-search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
    },
    cache: 'no-store',
    body: JSON.stringify({
      query: String(query || '').trim(),
      expectedDocNumber: expectedDocNumber || null,
      partialDocNumber: partialDocNumber || undefined,
      requestedDocType: requestedDocType || undefined,
      forceFresh,
      freshnessLevel: freshnessLevel || undefined,
      recencyDays: Number.isFinite(recencyDays) && recencyDays > 0 ? recencyDays : undefined,
    }),
    timeoutMs: options.timeoutMs ?? 45000,
  });

  if (!response.ok) {
    const rawMessage = await buildHttpErrorMessage(response, `HTTP Error ${response.status}`);
    throw new Error(rawMessage || 'Không thể tra cứu dữ liệu web qua hệ thống.');
  }

  const data = await response.json();
  lastWebSearchMeta = data?.meta && typeof data.meta === 'object' ? data.meta : null;
  return typeof data?.results === 'string' ? data.results : '';
}

export function getLastWebSearchMeta() {
  return lastWebSearchMeta;
}

export async function fetchWebSearchHealth() {
  const response = await backendFetch('/admin/web-search-health', {
    method: 'GET',
    timeoutMs: 15000,
  });
  if (!response.ok) {
    const rawMessage = await buildHttpErrorMessage(response, `HTTP Error ${response.status}`);
    throw new Error(rawMessage || 'Khong the lay trang thai web search.');
  }
  return await response.json();
}

export async function runWebSearchIngest() {
  const response = await backendFetch('/admin/web-search-ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trigger: 'manual' }),
    timeoutMs: 90000,
  });
  if (!response.ok) {
    const rawMessage = await buildHttpErrorMessage(response, `HTTP Error ${response.status}`);
    throw new Error(rawMessage || 'Khong the chay ingest web search.');
  }
  return await response.json();
}

export async function sendWebExtractRequest(url, keywords = [], options = {}) {
  const targetArticle = Number(options.targetArticle);
  const targetClause = Number(options.targetClause);
  const targetPoint = String(options.targetPoint || '').trim();
  const response = await backendFetch('/web-extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: String(url || '').trim(),
      keywords: Array.isArray(keywords) ? keywords.slice(0, 10) : [],
      strict: options.strict === true,
      target_article: Number.isFinite(targetArticle) && targetArticle > 0 ? Math.floor(targetArticle) : undefined,
      target_clause: Number.isFinite(targetClause) && targetClause > 0 ? Math.floor(targetClause) : undefined,
      target_point: targetPoint || undefined,
    }),
    timeoutMs: 20000,
  });
  if (!response.ok) {
    const rawMessage = await buildHttpErrorMessage(response, `HTTP Error ${response.status}`);
    throw new Error(rawMessage || 'Khong the trich xuat noi dung web.');
  }
  return await response.json();
}

export async function sendLegalAgentRequest(url, keywords = [], options = {}) {
  const targetArticle = Number(options.targetArticle);
  const targetClause = Number(options.targetClause);
  const targetPoint = String(options.targetPoint || '').trim();
  const maxChars = Number(options.maxChars);
  const response = await backendFetch('/legal-agent-retrieve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: String(url || '').trim(),
      keywords: Array.isArray(keywords) ? keywords.slice(0, 12) : [],
      strict: options.strict === true,
      target_article: Number.isFinite(targetArticle) && targetArticle > 0 ? Math.floor(targetArticle) : undefined,
      target_clause: Number.isFinite(targetClause) && targetClause > 0 ? Math.floor(targetClause) : undefined,
      target_point: targetPoint || undefined,
      max_chars: Number.isFinite(maxChars) && maxChars > 0 ? Math.floor(maxChars) : undefined,
    }),
    timeoutMs: options.timeoutMs ?? 25000,
  });
  if (!response.ok) {
    const rawMessage = await buildHttpErrorMessage(response, `HTTP Error ${response.status}`);
    throw new Error(rawMessage || 'Khong the lay noi dung legal agent.');
  }
  return await response.json();
}

export async function checkProxyStatus(context = 'default') {
  const ctx = normalizeContext(context);
  try {
    const response = await backendFetch('/health', { method: 'GET', timeoutMs: 15000 });
    if (!response.ok) return { ok: false, context: ctx, endpoint: getBackendBase(), error: `HTTP ${response.status}` };
    return { ok: true, context: ctx, endpoint: getBackendBase() };
  } catch (error) {
    return { ok: false, context: ctx, endpoint: getBackendBase(), error: error?.message || String(error) };
  }
}

export async function getProxyModelIds(context = 'default') {
  const config = await getSystemConfigSafe();
  const models = [
    config.gemini_model,
    config.transcribe_model,
    DEFAULT_PROXY_MODEL,
    'gemini-2.5-flash',
  ].filter(Boolean);
  return Array.from(new Set(models.map((x) => String(x).trim()).filter(Boolean)));
}

export function getProxyEndpointForContext(context = 'default') {
  return getBackendBase();
}

function extractTextFromPayload(data = {}) {
  if (typeof data === 'string') return data;
  if (Array.isArray(data?.choices) && data.choices[0]) {
    return data.choices[0]?.message?.content || data.choices[0]?.text || '';
  }
  if (typeof data?.output_text === 'string') return data.output_text;
  if (Array.isArray(data?.content)) {
    return data.content.map((x) => x?.text || '').join('').trim();
  }
  if (typeof data?.text === 'string') return data.text;
  return '';
}
