/**
 * AI Proxy Module (OpenAI-compatible)
 */

const DEFAULT_PROXY_MODEL = "gpt-4o-mini";
const DEFAULT_OPENAI_ENDPOINT = "https://api.openai.com/v1";
const PROXY_PRESETS = {
  direct_openai: DEFAULT_OPENAI_ENDPOINT,
};

function trimTrailingSlash(url = "") {
  return String(url || "").replace(/\/+$/, "");
}

function normalizeModelName(model = "") {
  return String(model || "")
    .trim()
    .replace(/(\d),(\d)/g, "$1.$2");
}

function isReasoningModel(model = "") {
  const m = String(model || "").toLowerCase();
  return m.includes("o1") || m.includes("o3");
}

function normalizeMessagesForOpenAI(messages = [], model = "") {
  const m = String(model || "").toLowerCase();
  const useDeveloperRole = m.includes("o1") || m.includes("o3") || m.includes("gpt-4o");
  
  if (!useDeveloperRole || !Array.isArray(messages)) return messages;

  return messages.map(msg => {
    if (msg.role === "system") {
      return { ...msg, role: "developer" };
    }
    return msg;
  });
}

function normalizeContext(context = "default") {
  const raw = String(context || "default").toLowerCase().trim();
  return raw || "default";
}

function parseEndpointHost(endpoint = "") {
  const raw = String(endpoint || "").trim();
  if (!raw) return "";
  try {
    return new URL(raw).host.toLowerCase();
  } catch {
    return "";
  }
}

export function isGeminiOpenAIEndpoint(endpoint = "") {
  const raw = String(endpoint || "").trim().toLowerCase();
  if (!raw) return false;
  const host = parseEndpointHost(raw);
  if (host === "generativelanguage.googleapis.com") return true;
  return raw.includes("generativelanguage.googleapis.com/v1beta/openai");
}

const DEFAULT_GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/openai";

function getProxyConfig(context = "default") {
  const ctx = normalizeContext(context);
  const activeProvider = localStorage.getItem('vbai_active_provider') || 'openai';

  let apiKey = "";
  let endpoint = "";

  if (activeProvider === 'gemini') {
    apiKey = (localStorage.getItem('vbai_gemini_api_key') || "").trim();
    endpoint = DEFAULT_GEMINI_ENDPOINT;
  } else {
    // Default to OpenAI
    apiKey = (localStorage.getItem('vbai_openai_api_key') || "").trim();
    endpoint = trimTrailingSlash(
      localStorage.getItem('vbai_openai_endpoint') 
      || localStorage.getItem(`vbai_proxy_endpoint_${ctx}`)
      || DEFAULT_OPENAI_ENDPOINT
    );
  }
  
  const enabled = (localStorage.getItem(`vbai_proxy_enabled_${ctx}`) || 'true') === 'true';
  const profile = localStorage.getItem(`vbai_proxy_profile_${ctx}`) || 'direct_openai';

  return { endpoint, apiKey, enabled, profile, context: ctx, provider: activeProvider };
}


export function getProxyEndpointForContext(context = "default") {
  return getProxyConfig(context).endpoint;
}

function buildAuthHeaders(context = "default", extraHeaders = {}) {
  const { apiKey, endpoint, provider } = getProxyConfig(context);
  const headers = { ...extraHeaders };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
    if (provider === 'gemini') {
      headers["x-goog-api-key"] = apiKey;
    }
  }
  return headers;
}

function shouldAttachAuthorization(endpoint = "", apiKey = "") {
  const key = String(apiKey || "").trim();
  if (!key) return false;
  return true;
}

async function fetchWithTimeout(url, init = {}, timeoutMs = 120000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("timeout")), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function stripHtmlTags(text = "") {
  return String(text || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

async function buildHttpErrorMessage(response, fallback = "") {
  const fallbackMessage = fallback || `HTTP Error ${response?.status || ""}`.trim();
  let raw = "";
  try {
    raw = await response.text();
  } catch {
    return fallbackMessage;
  }

  const trimmed = String(raw || "").trim();
  if (!trimmed) return fallbackMessage;

  try {
    const parsed = JSON.parse(trimmed);
    const candidate =
      parsed?.error?.message
      || parsed?.message
      || parsed?.detail
      || parsed?.error_description
      || "";
    if (String(candidate || "").trim()) return String(candidate).trim();
  } catch {
    // continue to plain text/html fallback
  }

  if (trimmed.startsWith("<")) {
    const plain = stripHtmlTags(trimmed);
    if (plain) return `${fallbackMessage}: ${plain.slice(0, 320)}`;
    return fallbackMessage;
  }
  return trimmed.slice(0, 320);
}

function describeTranscribeEndpoint(endpoint = "") {
  const raw = String(endpoint || "").trim();
  if (!raw) return "(khong ro endpoint)";
  return raw;
}

function buildTranscribeError(routeKind, endpoint, model, detail) {
  const err = String(detail || "").trim() || "Khong ro nguyen nhan";
  const modelId = String(model || "").trim() || DEFAULT_PROXY_MODEL;
  return `Loi transcription (${routeKind}) tai ${describeTranscribeEndpoint(endpoint)} voi model "${modelId}": ${err}`;
}

/**
 * Send chat completion request via Proxy.
 */
export async function sendChatRequest(messages, model, options = {}) {
  const context = options.context || "default";
  const { endpoint, enabled } = getProxyConfig(context);
  if (!enabled) {
    throw new Error(`Proxy dang tat cho chuc nang "${normalizeContext(context)}". Hay bat proxy trong cau hinh.`);
  }

  const requestOptions = { ...options };
  delete requestOptions.context;
  const retryModel = !!requestOptions.__retryModel;
  delete requestOptions.__retryModel;
  const retryAlias = !!requestOptions.__retryAlias;
  delete requestOptions.__retryAlias;
  const disableAliasRetry = !!requestOptions.disableAliasRetry;
  delete requestOptions.disableAliasRetry;
  const timeoutMs = requestOptions.timeoutMs;
  delete requestOptions.timeoutMs;
  const onDelta = typeof requestOptions.onDelta === "function" ? requestOptions.onDelta : null;
  delete requestOptions.onDelta;
  const resolvedModel = resolveChatModel(model);
  const isReasoning = isReasoningModel(resolvedModel);

  const payload = {
    model: resolvedModel,
    messages: normalizeMessagesForOpenAI(messages, resolvedModel),
    stream: requestOptions.stream ?? false,
    ...requestOptions,
  };

  if (isReasoning) {
    delete payload.temperature;
    delete payload.top_p;
    if (payload.max_tokens) {
      payload.max_completion_tokens = payload.max_tokens;
      delete payload.max_tokens;
    }
  } else {
    if (payload.temperature === undefined) {
      payload.temperature = 0.7;
    }
  }
  if (Array.isArray(payload.tools) && payload.tools.length > 0 && payload.tool_choice === undefined) {
    payload.tool_choice = "auto";
  }
  let response;
  try {
    response = await fetchWithTimeout(`${endpoint}/chat/completions`, {
      method: "POST",
      headers: buildAuthHeaders(context, { "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }, timeoutMs ?? 120000);
  } catch (e) {
    if (String(e?.message || "").toLowerCase().includes("timeout")) {
      throw new Error("Ket noi Proxy bi timeout. Vui long kiem tra endpoint/mang va thu lai.");
    }
    throw e;
  }

  if (!response.ok) {
    const rawMessage = await buildHttpErrorMessage(response, `HTTP Error ${response.status}`);
    const normalized = String(rawMessage || "").toLowerCase();
    const isModelMissing = normalized.includes("model_not_found") || normalized.includes("not found");
    if (!retryModel && isModelMissing) {
      const fallbackModel = await findFallbackChatModel(context, resolvedModel);
      if (fallbackModel && fallbackModel !== resolvedModel) {
        localStorage.setItem("vbai_router_model", fallbackModel);
        return sendChatRequest(messages, fallbackModel, { ...options, context, __retryModel: true });
      }
    }
    if (
      response.status === 401
      || normalized.includes("no active credentials")
      || normalized.includes("unauthorized")
      || normalized.includes("invalid_api_key")
    ) {
      throw new Error(
        `Lỗi xác thực: API Key không hợp lệ hoặc đã hết hạn. Vui lòng kiểm tra lại cấu hình AI.`
      );
    }
    if (response.status === 429 || normalized.includes("quota") || normalized.includes("limit")) {
      throw new Error(
        `Lỗi hạn mức (Quota): Tài khoản AI của bạn đã hết tiền hoặc vượt quá giới hạn lượt gọi. Vui lòng nạp thêm tiền hoặc đổi API Key khác.`
      );
    }
    if (isModelMissing) {
      throw new Error(
        `Model "${resolvedModel}" khong ton tai hoac khong duoc ho tro boi Endpoint nay. Vui long chon model khac.`
      );
    }
    throw new Error(rawMessage);
  }

  if (requestOptions.stream) {
    const streamedText = await consumeSseResponse(response, onDelta);
    if (streamedText && String(streamedText).trim()) return streamedText;

    const responsesText = await tryResponsesFallback(messages, resolvedModel, {
      context,
      timeoutMs: timeoutMs ?? 120000,
      temperature: requestOptions.temperature ?? 0.7,
    });
    if (responsesText) {
      if (onDelta) onDelta(responsesText);
      return responsesText;
    }

    if (!retryModel) {
      const fallbackModel = await findFallbackChatModel(context, resolvedModel);
      if (fallbackModel && fallbackModel !== resolvedModel) {
        localStorage.setItem("vbai_router_model", fallbackModel);
        return sendChatRequest(messages, fallbackModel, { ...options, context, __retryModel: true });
      }
    }
    return "";
  }
  const contentType = response.headers.get("content-type") || "";

  // Some Proxy setups return SSE chunks even with stream=false.
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
  const extractedText = extractTextFromPayload(data);
  if (extractedText) return extractedText;

  const responsesText = await tryResponsesFallback(messages, resolvedModel, {
    context,
    timeoutMs: timeoutMs ?? 120000,
    temperature: requestOptions.temperature ?? 0.7,
  });
  if (responsesText) return responsesText;

  if (!retryModel) {
    const fallbackModel = await findFallbackChatModel(context, resolvedModel);
    if (fallbackModel && fallbackModel !== resolvedModel) {
      localStorage.setItem("vbai_router_model", fallbackModel);
      return sendChatRequest(messages, fallbackModel, { ...options, context, __retryModel: true });
    }
  }

  console.warn("[ai-proxy] Empty text response", {
    model: resolvedModel,
    context,
    payloadKeys: Object.keys(data || {}),
    firstChoice: data?.choices?.[0] || null,
  });
  return "";
}

async function consumeSseResponse(response, onDelta) {
  const contentType = response.headers.get("content-type") || "";
  if (!response.body || !contentType.includes("text/event-stream")) {
    const raw = await response.text();
    const text = raw.trim().startsWith("data:") ? extractContentFromSse(raw) : raw;
    if (text && onDelta) onDelta(text);
    return text || "";
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let aggregated = "";
  let rawSse = "";
  let pending = "";
  const flush = () => {
    if (!pending) return;
    aggregated += pending;
    if (onDelta) onDelta(aggregated);
    pending = "";
  };

  const parseLine = (lineRaw) => {
    const line = String(lineRaw || "").trim();
    if (!line.startsWith("data:")) return;
    const payload = line.slice(5).trim();
    if (!payload || payload === "[DONE]") {
      flush();
      return;
    }

    let chunk;
    try {
      chunk = JSON.parse(payload);
    } catch {
      return;
    }

    const deltaText = extractDeltaTextFromChunk(chunk);
    if (!deltaText) return;

    pending += deltaText;
    if (pending.length >= 64 || /\n/.test(pending)) {
      flush();
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    const decoded = decoder.decode(value, { stream: true });
    rawSse += decoded;
    buffer += decoded;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || "";
    for (const line of lines) {
      parseLine(line);
    }
  }

  if (buffer) parseLine(buffer);
  flush();
  return aggregated.trim() ? aggregated : extractContentFromSse(rawSse);
}

/**
 * Send audio transcription request via Proxy (OpenAI-compatible).
 */
export async function sendAudioTranscription(file, model = DEFAULT_PROXY_MODEL, options = {}) {
  const context = options.context || "default";
  const { endpoint, enabled } = getProxyConfig(context);
  if (!enabled) {
    throw new Error(`Proxy dang tat cho chuc nang "${normalizeContext(context)}". Hay bat proxy trong cau hinh.`);
  }
  const resolvedModel = normalizeModelName(model) || DEFAULT_PROXY_MODEL;
  const useGeminiChatRoute = isGeminiOpenAIEndpoint(endpoint);

  if (useGeminiChatRoute) {
    try {
      return await sendAudioTranscriptionViaChat(file, resolvedModel, {
        ...options,
        context,
      });
    } catch (err) {
      const detail = String(err?.message || err || "");
      if (/^loi transcription/i.test(detail)) {
        throw (err instanceof Error ? err : new Error(detail));
      }
      throw new Error(buildTranscribeError(
        "chat/input_audio",
        endpoint,
        resolvedModel,
        detail
      ));
    }
  }

  const requestOptions = { ...options };
  delete requestOptions.context;
  const timeoutMs = requestOptions.timeoutMs;
  delete requestOptions.timeoutMs;
  const form = new FormData();
  form.append("file", file);
  form.append("model", resolvedModel);
  if (requestOptions.language) form.append("language", requestOptions.language);
  if (requestOptions.prompt) form.append("prompt", requestOptions.prompt);
  if (requestOptions.temperature !== undefined) form.append("temperature", String(requestOptions.temperature));

  let response;
  try {
    response = await fetchWithTimeout(`${endpoint}/audio/transcriptions`, {
      method: "POST",
      headers: buildAuthHeaders(context),
      body: form,
    }, timeoutMs ?? 180000);
  } catch (e) {
    if (String(e?.name || "").toLowerCase() === "aborterror") {
      throw new Error("Transcription qua Proxy bi timeout. Vui long thu lai hoac giam kich thuoc file.");
    }
    throw e;
  }

  if (!response.ok) {
    const detail = await buildHttpErrorMessage(response, `HTTP Error ${response.status}`);
    throw new Error(buildTranscribeError(
      "audio/transcriptions",
      endpoint,
      resolvedModel,
      detail
    ));
  }

  const raw = await response.text();
  let data = {};
  try {
    data = JSON.parse(raw || "{}");
  } catch {
    if (raw && raw.trim()) return raw.trim();
    throw new Error("Khong nhan duoc /audio/transcriptions (phan hoi rong).");
  }

  const transcript =
    (typeof data?.text === "string" ? data.text : "")
    || (typeof data?.transcript === "string" ? data.transcript : "")
    || (typeof data?.result?.text === "string" ? data.result.text : "")
    || "";

  if (!transcript.trim()) {
    throw new Error("Khong nhan duoc /audio/transcriptions");
  }
  return transcript.trim();
}

/**
 * Fallback transcription by sending audio as input_audio to chat/completions.
 * Useful when /audio/transcriptions is unavailable on the Proxy instance.
 */
export async function sendAudioTranscriptionViaChat(file, model = DEFAULT_PROXY_MODEL, options = {}) {
  const context = options.context || "default";
  const endpoint = getProxyEndpointForContext(context);
  const maxBytes = options.maxBytes ?? 12 * 1024 * 1024;
  const chunkWhenLarge = options.chunkWhenLarge !== false;
  const onProgress = typeof options.onProgress === "function" ? options.onProgress : null;
  const timeoutMs = options.timeoutMs ?? 45000;
  if (file.size > maxBytes) {
    if (!chunkWhenLarge) {
      throw new Error(`File audio qua lon cho fallback chat (${(file.size / 1024 / 1024).toFixed(1)}MB > ${(maxBytes / 1024 / 1024).toFixed(1)}MB).`);
    }
    return transcribeAudioViaChatChunked(file, model, {
      ...options,
      context,
      maxBytes,
      chunkWhenLarge: false,
      onProgress,
      timeoutMs,
    });
  }

  const prompt = options.prompt
    || "Hay chuyen toan bo audio nay thanh van ban tieng Viet. Chi tra ve transcript thuan text, khong giai thich.";

  const base64 = await fileToBase64(file);
  const { format } = resolveAudioFormatForEndpoint(file, getProxyEndpointForContext(context));

  const messages = [{
    role: "user",
    content: [
      { type: "text", text: prompt },
      { type: "input_audio", input_audio: { data: base64, format } },
    ],
  }];

  try {
    const text = await sendChatRequest(messages, model || DEFAULT_PROXY_MODEL, {
      temperature: options.temperature ?? 0,
      context,
      timeoutMs,
      stream: false,
      disableAliasRetry: true,
    });
    return text || "";
  } catch (err) {
    throw new Error(buildTranscribeError(
      "chat/input_audio",
      endpoint,
      model || DEFAULT_PROXY_MODEL,
      err?.message || err
    ));
  }
}

async function transcribeAudioViaChatChunked(file, model = DEFAULT_PROXY_MODEL, options = {}) {
  const maxBytes = Math.max(2 * 1024 * 1024, options.maxBytes ?? 10 * 1024 * 1024);
  const context = options.context || "default";
  const onProgress = typeof options.onProgress === "function" ? options.onProgress : null;
  const timeoutMs = options.timeoutMs ?? 45000;
  const totalChunks = Math.ceil(file.size / maxBytes);
  const transcripts = [];

  for (let i = 0; i < totalChunks; i++) {
    const start = i * maxBytes;
    const end = Math.min(file.size, start + maxBytes);
    const chunkBlob = file.slice(start, end, file.type || "audio/mpeg");
    const chunkFile = new File([chunkBlob], `${file.name || "audio"}_part_${i + 1}`, {
      type: chunkBlob.type || file.type || "audio/mpeg",
    });

    if (onProgress) {
      onProgress({
        part: i + 1,
        total: totalChunks,
        bytes: end - start,
      message: `Dang boc bang phan ${i + 1}/${totalChunks} qua Proxy...`,
      });
    }

    const partPrompt = [
      `Day la PHAN ${i + 1}/${totalChunks} cua cung mot file ghi am dai.`,
      "Hay chuyen chinh xac noi dung audio thanh transcript tieng Viet.",
      "Chi tra ve van ban transcript thuan text, khong tom tat, khong giai thich, khong them nhan xet.",
      "Giu dung thu tu cau tu trong phan audio nay.",
    ].join(" ");

    const partText = await sendAudioTranscriptionViaChat(chunkFile, model, {
      ...options,
      context,
      maxBytes,
      chunkWhenLarge: false,
      prompt: partPrompt,
      timeoutMs,
    });

    if (String(partText || "").trim()) {
      transcripts.push(partText.trim());
    }
  }

  return transcripts.join("\n").trim();
}

function resolveChatModel(model) {
  const requested = normalizeModelName(model);
  if (requested) return requested;

  const activeProvider = localStorage.getItem('vbai_active_provider') || 'openai';
  if (activeProvider === 'gemini') {
    return normalizeModelName(localStorage.getItem('vbai_gemini_model') || 'gemini-2.0-pro-exp-02-05');
  }

  const saved = normalizeModelName(
    localStorage.getItem("vbai_router_model")
    || ""
  );
  return saved || DEFAULT_PROXY_MODEL;
}

/**
 * Check whether AI Proxy endpoint is reachable.
 */
export async function checkProxyStatus(context = "default") {
  const { endpoint, enabled } = getProxyConfig(context);
  if (!enabled) return false;
  try {
    const res = await fetchWithTimeout(`${endpoint}/models`, {
      method: "GET",
      headers: buildAuthHeaders(context),
    }, 15000);
    return res.ok;
  } catch (e) {
    return false;
  }
}

export async function getProxyModelIds(context = "default") {
  const { endpoint, enabled } = getProxyConfig(context);
  if (!enabled) return [];
  try {
    const res = await fetchWithTimeout(`${endpoint}/models`, {
      method: "GET",
      headers: buildAuthHeaders(context),
    }, 15000);
    if (!res.ok) return [];
    const payload = await res.json().catch(() => ({}));
    const ids = Array.isArray(payload?.data)
      ? payload.data.map((m) => String(m?.id || "").trim()).filter(Boolean)
      : [];
    return ids;
  } catch {
    return [];
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
      if (typeof chunk?.output_text === "string" && chunk.output_text.trim()) {
        aggregated += chunk.output_text;
      }
      if (chunk?.type === "response.output_text.delta" && typeof chunk?.delta === "string") {
        aggregated += chunk.delta;
      }
      if (chunk?.type === "response.completed") {
        const completedText = extractTextFromPayload(chunk?.response || chunk);
        if (completedText && !aggregated.trim()) aggregated = completedText;
      }
      const delta = chunk?.choices?.[0]?.delta;
      const deltaText = extractTextFromContent(delta?.content);
      if (deltaText) aggregated += deltaText;
      const full = chunk?.choices?.[0]?.message?.content;
      const fullText = extractTextFromContent(full);
      if (!aggregated && fullText) aggregated = fullText;
    } catch {
      // Ignore malformed chunk and continue.
    }
  }
  return aggregated;
}

function extractDeltaTextFromChunk(chunk = {}) {
  if (chunk?.type === "response.output_text.delta" && typeof chunk?.delta === "string") {
    return chunk.delta;
  }

  const delta = chunk?.choices?.[0]?.delta;
  const deltaText = extractTextFromContent(delta?.content);
  if (deltaText) return deltaText;
  if (typeof delta?.content === "string" && delta.content.trim()) return delta.content;

  if (typeof chunk?.output_text === "string" && chunk.output_text.trim()) {
    return chunk.output_text;
  }
  return "";
}

function extractTextFromPayload(data = {}) {
  if (typeof data?.output_text === "string" && data.output_text.trim()) return data.output_text;
  if (typeof data?.response?.output_text === "string" && data.response.output_text.trim()) return data.response.output_text;

  if (Array.isArray(data?.output)) {
    const outputText = data.output
      .map((item) => extractTextFromContent(item?.content))
      .filter(Boolean)
      .join("\n");
    if (outputText.trim()) return outputText;
  }
  if (Array.isArray(data?.response?.output)) {
    const outputText = data.response.output
      .map((item) => extractTextFromContent(item?.content))
      .filter(Boolean)
      .join("\n");
    if (outputText.trim()) return outputText;
  }

  const topLevelContent = extractTextFromContent(data?.content);
  if (topLevelContent) return topLevelContent;
  const topLevelMessage = extractTextFromContent(data?.message);
  if (topLevelMessage) return topLevelMessage;

  if (Array.isArray(data?.candidates)) {
    const geminiText = data.candidates
      .map((c) => extractTextFromContent(c?.content?.parts))
      .filter(Boolean)
      .join("\n");
    if (geminiText.trim()) return geminiText;
  }

  const choice0 = data?.choices?.[0] || {};
  const messageContentText = extractTextFromContent(choice0?.message?.content);
  if (messageContentText) return messageContentText;

  const deltaText = extractTextFromContent(choice0?.delta?.content);
  if (deltaText) return deltaText;

  if (typeof choice0?.text === "string" && choice0.text.trim()) return choice0.text;

  if (typeof choice0?.message?.refusal === "string" && choice0.message.refusal.trim()) {
    return choice0.message.refusal;
  }

  if (Array.isArray(choice0?.message?.tool_calls) && choice0.message.tool_calls.length > 0) {
    const names = choice0.message.tool_calls
      .map((t) => t?.function?.name || t?.type || "tool_call")
      .filter(Boolean)
      .join(", ");
    return `Model yeu cau tool_call (${names}) nhung proxy chua tra ve text output.`;
  }

  return "";
}

function extractTextFromContent(content) {
  if (typeof content === "string") return content;

  if (content && typeof content === "object" && !Array.isArray(content)) {
    if (typeof content?.text === "string" && content.text.trim()) return content.text.trim();
    if (typeof content?.text?.value === "string" && content.text.value.trim()) return content.text.value.trim();
    if (content?.type === "output_text" && typeof content?.text === "string") return content.text.trim();
    if (Array.isArray(content?.parts)) return extractTextFromContent(content.parts);
    if (Array.isArray(content?.content)) return extractTextFromContent(content.content);
    return "";
  }

  if (!Array.isArray(content)) return "";

  const collected = [];
  for (const part of content) {
    if (!part) continue;
    if (typeof part === "string") {
      collected.push(part);
      continue;
    }

    if (typeof part?.text === "string") {
      collected.push(part.text);
      continue;
    }

    if (typeof part?.text?.value === "string") {
      collected.push(part.text.value);
      continue;
    }

    if (part?.type === "output_text" && typeof part?.text === "string") {
      collected.push(part.text);
      continue;
    }
  }

  return collected.join("\n").trim();
}

async function tryResponsesFallback(messages, model, options = {}) {
  const context = options.context || "default";
  const timeoutMs = options.timeoutMs ?? 120000;
  const { endpoint, enabled } = getProxyConfig(context);
  if (!enabled) return "";

  const payload = {
    model: normalizeModelName(model) || DEFAULT_PROXY_MODEL,
    input: normalizeMessagesForResponses(messages),
    stream: false,
  };
  if (typeof options.temperature === "number") {
    payload.temperature = options.temperature;
  }

  try {
    const res = await fetchWithTimeout(`${endpoint}/responses`, {
      method: "POST",
      headers: buildAuthHeaders(context, { "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }, timeoutMs);
    if (!res.ok) return "";

    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("text/event-stream")) {
      const raw = await res.text();
      return extractContentFromSse(raw);
    }

    const rawText = await res.text();
    if (rawText.trim().startsWith("data:")) {
      return extractContentFromSse(rawText);
    }
    const data = JSON.parse(rawText);
    return extractTextFromPayload(data);
  } catch {
    return "";
  }
}

function normalizeMessagesForResponses(messages = []) {
  if (!Array.isArray(messages)) return [];
  return messages
    .map((msg) => {
      const role = typeof msg?.role === "string" ? msg.role : "user";
      const content = normalizeMessageContent(msg?.content);
      return { role, content };
    })
    .filter((m) => m.content !== "");
}

function normalizeMessageContent(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  const normalized = [];
  for (const part of content) {
    if (!part) continue;
    if (typeof part === "string") {
      normalized.push({ type: "input_text", text: part });
      continue;
    }
    if (part?.type === "text" && typeof part?.text === "string") {
      normalized.push({ type: "input_text", text: part.text });
      continue;
    }
    if (part?.type === "input_audio" && part?.input_audio) {
      normalized.push(part);
      continue;
    }
    if (typeof part?.text === "string") {
      normalized.push({ type: "input_text", text: part.text });
    }
  }
  return normalized.length ? normalized : "";
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

function resolveAudioFormatForEndpoint(file, endpoint = "") {
  const detected = detectAudioFormat(file);
  const mime = String(file?.type || "").toLowerCase();
  const name = String(file?.name || "").toLowerCase();
  const hasMetadata = !!mime || /\.[a-z0-9]+$/i.test(name);

  if (!isGeminiOpenAIEndpoint(endpoint)) {
    return { format: detected, detected, downgraded: false };
  }

  if (detected === "wav" || detected === "mp3") {
    return { format: detected, detected, downgraded: false };
  }

  if (!hasMetadata) {
    return { format: "wav", detected, downgraded: true };
  }

  // Keep known format labels when metadata is clear to avoid mismatched content-type hints.
  return { format: detected, detected, downgraded: false };
}

async function findFallbackChatModel(context = "default", currentModel = "") {
  const { endpoint } = getProxyConfig(context);
  try {
    const res = await fetchWithTimeout(`${endpoint}/models`, {
      method: "GET",
      headers: buildAuthHeaders(context),
    }, 15000);
    if (!res.ok) return "";
    const payload = await res.json().catch(() => ({}));
    const ids = Array.isArray(payload?.data)
      ? payload.data.map((m) => String(m?.id || "").trim()).filter(Boolean)
      : [];
    if (!ids.length) return "";
    return selectPreferredChatModel(ids, currentModel);
  } catch {
    return "";
  }
}

function selectPreferredChatModel(modelIds = [], currentModel = "") {
  const normalizedCurrent = String(currentModel || "").toLowerCase();
  const filtered = modelIds.filter((id) => isChatLikeModelId(id));
  if (!filtered.length) return "";

  if (filtered.some((id) => id.toLowerCase() === normalizedCurrent)) return currentModel;

  const filteredSorted = [...filtered].sort((a, b) => {
    const aNorm = a.toLowerCase();
    const bNorm = b.toLowerCase();
    const aPenalty = aNorm.startsWith("v1/cx/") ? 1 : 0;
    const bPenalty = bNorm.startsWith("v1/cx/") ? 1 : 0;
    if (aPenalty !== bPenalty) return aPenalty - bPenalty;
    return 0;
  });

  const priority = [
    "gpt-5.5",
    "gpt-5",
    "gpt-4.1",
    "gpt-4o",
    "gpt-4o-mini",
    "o4-mini",
    "o3",
    "gemini-2.5-pro",
    "gemini",
  ];

  for (const p of priority) {
    const hit = filteredSorted.find((id) => id.toLowerCase().includes(p));
    if (hit) return hit;
  }

  return filteredSorted[0] || "";
}

function isChatLikeModelId(modelId = "") {
  const id = String(modelId || "").toLowerCase();
  if (!id) return false;
  if (/(transcribe|tts|realtime|audio|embedding|moderation|image)/.test(id)) return false;
  return /(gpt|o[134]|gemini|claude|glm|qwen|deepseek|llama|mistral|command-r|mixtral)/.test(id);
}

function getAliasModelCandidate(model = "") {
  return "";
}
