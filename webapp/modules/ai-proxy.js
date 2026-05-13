import { fetchSystemConfig, getCachedSystemConfig } from './system-config.js';

const DEFAULT_PROXY_MODEL = 'gpt-4o-mini';
const DEFAULT_BACKEND_BASE = '/api';
const DEFAULT_GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/openai';

function trimTrailingSlash(url = '') {
  return String(url || '').replace(/\/+$/, '');
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

export function isGeminiOpenAIEndpoint(endpoint = '') {
  const raw = String(endpoint || '').trim().toLowerCase();
  if (!raw) return false;
  const host = parseEndpointHost(raw);
  if (host === 'generativelanguage.googleapis.com') return true;
  return raw.includes('generativelanguage.googleapis.com/v1beta/openai');
}

function isReasoningModel(model = '') {
  const m = String(model || '').toLowerCase();
  return m.includes('o1') || m.includes('o3');
}

function normalizeMessagesForOpenAI(messages = [], model = '') {
  const m = String(model || '').toLowerCase();
  const useDeveloperRole = m.includes('o1') || m.includes('o3') || m.includes('gpt-4o');
  if (!useDeveloperRole || !Array.isArray(messages)) return messages;
  return messages.map((msg) => msg.role === 'system' ? { ...msg, role: 'developer' } : msg);
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
  return trimTrailingSlash(raw || DEFAULT_BACKEND_BASE);
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
    active_provider: 'openai',
    router_model: 'gpt-4o-mini',
    gemini_model: 'gemini-1.5-flash',
    openai_endpoint: 'https://api.openai.com/v1',
    gemini_endpoint: DEFAULT_GEMINI_ENDPOINT,
    transcribe_model: 'whisper-1',
    has_openai_key: false,
    has_gemini_key: false,
  };
  
  // Normalize endpoints
  if (config.openai_endpoint) config.openai_endpoint = trimTrailingSlash(config.openai_endpoint);
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
    model || (systemConfig.active_provider === 'gemini' ? systemConfig.gemini_model : systemConfig.router_model) || DEFAULT_PROXY_MODEL
  );
  const payload = {
    model: resolvedModel,
    messages: normalizeMessagesForOpenAI(messages, resolvedModel),
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
  const base64 = await fileToBase64(file);
  const response = await backendFetch('/transcribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      audio_base64: base64,
      filename: file?.name || 'audio',
      model: normalizeModelName(model || DEFAULT_PROXY_MODEL),
      context: options.context || 'meeting',
    }),
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
  const response = await backendFetch('/web-search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: String(query || '').trim(),
      expectedDocNumber: expectedDocNumber || null,
    }),
    timeoutMs: options.timeoutMs ?? 30000,
  });

  if (!response.ok) {
    const rawMessage = await buildHttpErrorMessage(response, `HTTP Error ${response.status}`);
    throw new Error(rawMessage || 'Không thể tra cứu dữ liệu web qua hệ thống.');
  }

  const data = await response.json();
  return typeof data?.results === 'string' ? data.results : '';
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
    config.router_model,
    config.gemini_model,
    config.transcribe_model,
    DEFAULT_PROXY_MODEL,
    'whisper-1',
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

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
