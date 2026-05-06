/**
 * AI Proxy Module for 9router (OpenAI-compatible)
 */

const FALLBACK_9ROUTER_ENDPOINT =
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:20128/v1"
    : "https://your-9router-public-url.com/v1";
const LOCKED_MODEL = "gemini-2.5-pro";
const PROXY_PRESETS = {
  proxy_9router_local: "http://localhost:20128/v1",
  proxy_cliproxy_local: "http://localhost:8317/v1",
};

function trimTrailingSlash(url = "") {
  return String(url || "").replace(/\/+$/, "");
}

function normalizeContext(context = "default") {
  const raw = String(context || "default").toLowerCase().trim();
  return raw || "default";
}

function getProxyConfig(context = "default") {
  const ctx = normalizeContext(context);
  const enabledRaw = localStorage.getItem(`vbai_proxy_enabled_${ctx}`);
  const enabled = (enabledRaw ?? localStorage.getItem("vbai_use_9router") ?? "true") === "true";
  const profile = localStorage.getItem(`vbai_proxy_profile_${ctx}`)
    || localStorage.getItem("vbai_router_profile")
    || "proxy_cliproxy_local";

  const endpointFromProfile = PROXY_PRESETS[profile] || "";
  const endpoint = trimTrailingSlash(
    localStorage.getItem(`vbai_proxy_endpoint_${ctx}`)
      || (profile === "proxy_custom" ? localStorage.getItem("vbai_9router_endpoint") : endpointFromProfile)
      || localStorage.getItem("vbai_9router_endpoint")
      || FALLBACK_9ROUTER_ENDPOINT
  );

  const apiKey = (
    localStorage.getItem(`vbai_proxy_api_key_${ctx}`)
    || localStorage.getItem("vbai_9router_api_key")
    || ""
  ).trim();
  return { endpoint, apiKey, enabled, profile, context: ctx };
}

function buildAuthHeaders(context = "default", extraHeaders = {}) {
  const { apiKey } = getProxyConfig(context);
  const headers = { ...extraHeaders };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  return headers;
}

/**
 * Send chat completion request via 9router.
 */
export async function sendChatRequest(messages, _model, options = {}) {
  const context = options.context || "default";
  const { endpoint, enabled } = getProxyConfig(context);
  if (!enabled) {
    throw new Error(`Proxy dang tat cho chuc nang "${normalizeContext(context)}". Hay bat proxy trong cau hinh.`);
  }

  const requestOptions = { ...options };
  delete requestOptions.context;
  const response = await fetch(`${endpoint}/chat/completions`, {
    method: "POST",
    headers: buildAuthHeaders(context, { "Content-Type": "application/json" }),
    body: JSON.stringify({
      model: LOCKED_MODEL,
      messages,
      temperature: requestOptions.temperature ?? 0.7,
      stream: requestOptions.stream ?? false,
      ...requestOptions,
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    const rawMessage = errData.error?.message || `HTTP Error ${response.status}`;
    const normalized = String(rawMessage || "").toLowerCase();
    if (
      response.status === 401
      || normalized.includes("no active credentials")
      || normalized.includes("unauthorized")
      || normalized.includes("model_not_found")
      || normalized.includes("not found")
    ) {
      throw new Error(
        "Khong the dung gemini-2.5-pro tren proxy hien tai. Can ket noi/nap credential Google Gemini 2.5 Pro trong 9router (provider gc) hoac cap quyen model cho API key."
      );
    }
    throw new Error(rawMessage);
  }

  if (requestOptions.stream) return response.body;
  const contentType = response.headers.get("content-type") || "";

  // Some 9router setups return SSE chunks even with stream=false.
  if (contentType.includes("text/event-stream")) {
    const raw = await response.text();
    return extractContentFromSse(raw);
  }

  const rawText = await response.text();
  if (rawText.trim().startsWith("data:")) {
    return extractContentFromSse(rawText);
  }

  let data = {};
  try {
    data = JSON.parse(rawText);
  } catch {
    return rawText || "";
  }
  return data?.choices?.[0]?.message?.content || data?.choices?.[0]?.delta?.content || "";
}

/**
 * Send audio transcription request via 9router (OpenAI-compatible).
 */
export async function sendAudioTranscription(file, model = LOCKED_MODEL, options = {}) {
  const context = options.context || "default";
  const { endpoint, enabled } = getProxyConfig(context);
  if (!enabled) {
    throw new Error(`Proxy dang tat cho chuc nang "${normalizeContext(context)}". Hay bat proxy trong cau hinh.`);
  }

  const requestOptions = { ...options };
  delete requestOptions.context;
  const form = new FormData();
  form.append("file", file);
  form.append("model", model);
  if (requestOptions.language) form.append("language", requestOptions.language);
  if (requestOptions.prompt) form.append("prompt", requestOptions.prompt);
  if (requestOptions.temperature !== undefined) form.append("temperature", String(requestOptions.temperature));

  const response = await fetch(`${endpoint}/audio/transcriptions`, {
    method: "POST",
    headers: buildAuthHeaders(context),
    body: form,
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || `HTTP Error ${response.status}`);
  }

  const data = await response.json();
  return data?.text || "";
}

/**
 * Fallback transcription by sending audio as input_audio to chat/completions.
 * Useful when /audio/transcriptions is unavailable on the 9router instance.
 */
export async function sendAudioTranscriptionViaChat(file, model = LOCKED_MODEL, options = {}) {
  const context = options.context || "default";
  const maxBytes = options.maxBytes ?? 12 * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error(`File audio qua lon cho fallback chat (${(file.size / 1024 / 1024).toFixed(1)}MB > ${(maxBytes / 1024 / 1024).toFixed(1)}MB).`);
  }

  const prompt = options.prompt
    || "Hay chuyen toan bo audio nay thanh van ban tieng Viet. Chi tra ve transcript thuần text, khong giai thich.";

  const base64 = await fileToBase64(file);
  const format = detectAudioFormat(file);

  const messages = [{
    role: "user",
    content: [
      { type: "text", text: prompt },
      { type: "input_audio", input_audio: { data: base64, format } },
    ],
  }];

  const text = await sendChatRequest(messages, LOCKED_MODEL, { temperature: options.temperature ?? 0, context });
  return text || "";
}

/**
 * Check whether 9router endpoint is reachable.
 */
export async function check9routerStatus(context = "default") {
  const { endpoint, enabled } = getProxyConfig(context);
  if (!enabled) return false;
  try {
    const res = await fetch(`${endpoint}/models`, {
      method: "GET",
      headers: buildAuthHeaders(context),
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

function extractContentFromSse(raw = "") {
  let aggregated = "";
  const lines = String(raw).split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) continue;
    const payload = trimmed.slice(5).trim();
    if (!payload || payload === "[DONE]") continue;
    try {
      const chunk = JSON.parse(payload);
      const delta = chunk?.choices?.[0]?.delta;
      if (typeof delta?.content === "string") aggregated += delta.content;
      const full = chunk?.choices?.[0]?.message?.content;
      if (!aggregated && typeof full === "string") aggregated = full;
    } catch {
      // Ignore malformed chunk and continue.
    }
  }
  return aggregated;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      resolve(dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function detectAudioFormat(file) {
  const mime = String(file?.type || "").toLowerCase();
  const name = String(file?.name || "").toLowerCase();

  if (mime.includes("wav") || name.endsWith(".wav")) return "wav";
  if (mime.includes("mpeg") || mime.includes("mp3") || name.endsWith(".mp3")) return "mp3";
  if (mime.includes("ogg") || name.endsWith(".ogg")) return "ogg";
  if (mime.includes("webm") || name.endsWith(".webm")) return "webm";
  if (mime.includes("m4a") || mime.includes("mp4") || name.endsWith(".m4a")) return "m4a";
  if (mime.includes("aac") || name.endsWith(".aac")) return "aac";
  return "mp3";
}
