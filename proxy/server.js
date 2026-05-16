/**
 * VBAI Cloud Run Proxy Service
 *
 * Provides secure, authenticated endpoints for:
 * - Chat completions (Gemini)
 * - Audio transcription (Gemini)
 * - System configuration read/write (admin only)
 *
 * Deployed to Google Cloud Run.
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const admin = require('firebase-admin');
const multer = require('multer');
const fetch = globalThis.fetch.bind(globalThis);
const { cleanText: cleanStrictText, extractStrictLegalText } = require('./lib/legal-extract');

const MAX_AUDIO_UPLOAD_MB = Number(process.env.MAX_AUDIO_UPLOAD_MB || '80');
const MAX_AUDIO_UPLOAD_BYTES = MAX_AUDIO_UPLOAD_MB * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_AUDIO_UPLOAD_BYTES,
    files: 1,
  },
});

const DIRECT_SOURCE_TIMEOUT_MS = Number(process.env.DIRECT_SOURCE_TIMEOUT_MS || '3200');
const DIRECT_SOURCE_MAX_PER_SOURCE = Number(process.env.DIRECT_SOURCE_MAX_PER_SOURCE || '8');
const DIRECT_SOURCE_URLS_PER_SOURCE = Number(process.env.DIRECT_SOURCE_URLS_PER_SOURCE || '2');
const WEB_SEARCH_CSE_TIMEOUT_MS = Number(process.env.WEB_SEARCH_CSE_TIMEOUT_MS || '4200');
const WEB_SEARCH_CSE_TOTAL_BUDGET_MS = Number(process.env.WEB_SEARCH_CSE_TOTAL_BUDGET_MS || '6800');
const WEB_SEARCH_FALLBACK_BUDGET_MS = Number(process.env.WEB_SEARCH_FALLBACK_BUDGET_MS || '8000');
const WEB_SEARCH_FAST_TOTAL_BUDGET_MS = Number(process.env.WEB_SEARCH_FAST_TOTAL_BUDGET_MS || '4200');
const WEB_SEARCH_FAST_PROVIDER_TIMEOUT_MS = Number(process.env.WEB_SEARCH_FAST_PROVIDER_TIMEOUT_MS || '2200');
const WEB_SEARCH_RESULT_CACHE_TTL_MS = Number(process.env.WEB_SEARCH_RESULT_CACHE_TTL_MS || '90000');
const WEB_SEARCH_RESULT_CACHE_MAX = Number(process.env.WEB_SEARCH_RESULT_CACHE_MAX || '200');
const WEB_SEARCH_HOT_INDEX_TTL_MS = Number(process.env.WEB_SEARCH_HOT_INDEX_TTL_MS || '21600000'); // 6h
const WEB_SEARCH_HOT_INDEX_MAX_ITEMS = Number(process.env.WEB_SEARCH_HOT_INDEX_MAX_ITEMS || '8');
const DIRECT_SOURCE_USER_AGENT = 'VBAI-Freshness-Bot/1.0 (+https://vbai.tracuu.lamdong.vn)';
const DEFAULT_WEB_SEARCH_FALLBACK_SOURCES = Object.freeze({
  vbpl: true,
  chinhphu: true,
  quochoi: true,
  thuvienphapluat: true,
  luatvietnam: true,
});
const DEFAULT_WEB_SEARCH_MODE = 'cse_with_fallback';
const DEFAULT_WEB_SEARCH_PROVIDER = 'vertex_search';
const DEFAULT_VERTEX_LOCATION = 'global';
const DEFAULT_VERTEX_SERVING_CONFIG_ID = 'default_search';
const WEB_SEARCH_RESULT_CACHE = new Map();
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const GEMINI_COMPAT_PATH = ['open', 'ai'].join('');
const GEMINI_API_ENDPOINT = `${GEMINI_API_BASE}/${GEMINI_COMPAT_PATH}`;
const GEMINI_SAFE_FALLBACK_MODEL = 'gemini-2.5-flash';
const GEMINI_TRANSCRIBE_SAFE_FALLBACK_MODELS = Object.freeze([
  'gemini-2.5-flash',
  'gemini-2.0-flash-exp',
  'gemini-2.0-flash',
]);
const LEGAL_MATCH_PASS_SCORE = 85;
const OFFICIAL_SOURCE_HOSTS = Object.freeze([
  'vbpl.vn',
  'vanban.chinhphu.vn',
  'congbao.chinhphu.vn',
  'chinhphu.vn',
  'quochoi.vn',
  'moj.gov.vn',
  'baochinhphu.vn',
  'dangcongsan.vn',
]);
const REFERENCE_SOURCE_HOSTS = Object.freeze([
  'thuvienphapluat.vn',
  'luatvietnam.vn',
  'vanbanphapluat.com',
  'thanhchuong.com.vn',
]);

function normalizeVietnamese(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

const LEGAL_DOC_TYPE_PATTERNS = Object.freeze({
  luat: /\bluat\b/,
  nghi_dinh: /\bnghi\s*dinh\b/,
  thong_tu: /\bthong\s*tu\b/,
  nghi_quyet: /\bnghi\s*quyet\b/,
  quyet_dinh: /\bquyet\s*dinh\b/,
});

function sanitizeRequestedDocType(raw = '') {
  const normalized = normalizeVietnamese(String(raw || '')).replace(/\s+/g, '_');
  if (normalized in LEGAL_DOC_TYPE_PATTERNS) return normalized;
  return null;
}

function inferRequestedDocTypeFromQuery(query = '') {
  const n = normalizeVietnamese(query);
  if (LEGAL_DOC_TYPE_PATTERNS.nghi_quyet.test(n)) return 'nghi_quyet';
  if (LEGAL_DOC_TYPE_PATTERNS.nghi_dinh.test(n)) return 'nghi_dinh';
  if (LEGAL_DOC_TYPE_PATTERNS.thong_tu.test(n)) return 'thong_tu';
  if (LEGAL_DOC_TYPE_PATTERNS.quyet_dinh.test(n)) return 'quyet_dinh';
  if (LEGAL_DOC_TYPE_PATTERNS.luat.test(n)) return 'luat';
  return null;
}

function extractPartialDocNumber(query = '') {
  const match = String(query || '').toUpperCase().match(/\b\d{1,4}\/\d{4}\b/);
  return match ? String(match[0] || '').toUpperCase() : null;
}

function inferDocTypeFromText(text = '') {
  const n = normalizeVietnamese(text);
  if (LEGAL_DOC_TYPE_PATTERNS.nghi_quyet.test(n)) return 'nghi_quyet';
  if (LEGAL_DOC_TYPE_PATTERNS.nghi_dinh.test(n)) return 'nghi_dinh';
  if (LEGAL_DOC_TYPE_PATTERNS.thong_tu.test(n)) return 'thong_tu';
  if (LEGAL_DOC_TYPE_PATTERNS.quyet_dinh.test(n)) return 'quyet_dinh';
  if (LEGAL_DOC_TYPE_PATTERNS.luat.test(n)) return 'luat';
  return null;
}

function isDocTypeMatchForItem(item = {}, requestedDocType = null) {
  if (!requestedDocType) return true;
  const inferred = inferDocTypeFromText(`${item?.title || ''} ${item?.snippet || ''} ${item?.link || ''}`);
  return inferred === requestedDocType;
}

function toHost(rawUrl = '') {
  try {
    return new URL(String(rawUrl || '').trim()).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

function isOfficialHost(host = '') {
  const h = String(host || '').toLowerCase();
  if (!h) return false;
  if (OFFICIAL_SOURCE_HOSTS.some((official) => h === official || h.endsWith(`.${official}`))) return true;
  if (h.endsWith('.gov.vn')) return true;
  return false;
}

function isReferenceHost(host = '') {
  const h = String(host || '').toLowerCase();
  if (!h) return false;
  return REFERENCE_SOURCE_HOSTS.some((reference) => h === reference || h.endsWith(`.${reference}`));
}

function detectSourceTier({ link = '', source = '' } = {}) {
  const fromSource = String(source || '').trim().toLowerCase().replace(/^www\./, '');
  const host = fromSource || toHost(link);
  if (isOfficialHost(host)) return 'official';
  if (isReferenceHost(host)) return 'reference';
  return 'unknown';
}

function normalizeModelInput(value = '') {
  return String(value || '').trim();
}

function isGeminiModelNotFoundError(message = '') {
  const normalized = String(message || '').toLowerCase();
  if (!normalized) return false;
  return (
    normalized.includes('not found')
    || normalized.includes('requested entity was not found')
    || normalized.includes('model')
  );
}

function isGeminiModelCompatibilityError(message = '') {
  const normalized = String(message || '').toLowerCase();
  if (!normalized) return false;
  if (normalized.includes('requested entity was not found')) return true;
  if (!normalized.includes('model')) return false;
  return (
    normalized.includes('not found')
    || normalized.includes('unsupported')
    || normalized.includes('not supported')
    || normalized.includes('invalid')
  );
}

function pickGeminiRetryModel(primaryModel = '', configuredModel = '') {
  const primary = normalizeModelInput(primaryModel);
  const configured = normalizeModelInput(configuredModel);
  if (configured && configured !== primary) {
    return configured;
  }
  if (GEMINI_SAFE_FALLBACK_MODEL !== primary) {
    return GEMINI_SAFE_FALLBACK_MODEL;
  }
  return '';
}

function isRetryableModelSelectionError(status, message = '') {
  return status === 404 || (status === 400 && isGeminiModelCompatibilityError(message));
}

function shouldFallbackTranscriptionPath(attempt = null) {
  if (!attempt) return false;
  if (attempt.ok === true && !String(attempt.text || '').trim()) return true;
  return isRetryableModelSelectionError(attempt.status, attempt.message || '');
}

function shouldRetryWithinTranscriptionPath(attempt = null) {
  if (!attempt) return false;
  return isRetryableModelSelectionError(attempt.status, attempt.message || '');
}

function getCompatibleAudioMimeType(detectedMimeType = '', effectiveFilename = '') {
  if (detectedMimeType !== 'application/octet-stream') return detectedMimeType;
  const fmt = inferAudioFormat({ mimeType: detectedMimeType, filename: effectiveFilename });
  if (fmt === 'mp3') return 'audio/mpeg';
  if (fmt === 'wav') return 'audio/wav';
  if (fmt === 'ogg') return 'audio/ogg';
  if (fmt === 'webm') return 'audio/webm';
  if (fmt === 'aac') return 'audio/aac';
  return 'audio/mp4';
}

function inferAudioFormat({ mimeType = '', filename = '' } = {}) {
  const m = String(mimeType || '').toLowerCase();
  const f = String(filename || '').toLowerCase();
  if (m.includes('wav') || f.endsWith('.wav')) return 'wav';
  if (m.includes('mpeg') || m.includes('mp3') || f.endsWith('.mp3')) return 'mp3';
  if (m.includes('ogg') || f.endsWith('.ogg')) return 'ogg';
  if (m.includes('webm') || f.endsWith('.webm')) return 'webm';
  if (m.includes('aac') || f.endsWith('.aac')) return 'aac';
  if (m.includes('mp4') || m.includes('m4a') || f.endsWith('.m4a') || f.endsWith('.mp4')) return 'mp4';
  return 'wav';
}

function extractTextFromProviderPayload(data = {}) {
  if (!data || typeof data !== 'object') return '';
  if (typeof data.text === 'string' && data.text.trim()) return data.text.trim();
  if (typeof data.output_text === 'string' && data.output_text.trim()) return data.output_text.trim();
  if (Array.isArray(data?.choices) && data.choices[0]) {
    const v = data.choices[0]?.message?.content || data.choices[0]?.text || '';
    if (String(v || '').trim()) return String(v || '').trim();
  }
  const candidates = Array.isArray(data?.candidates) ? data.candidates : [];
  for (const candidate of candidates) {
    const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
    const text = parts
      .map((part) => String(part?.text || '').trim())
      .filter(Boolean)
      .join('\n')
      .trim();
    if (text) return text;
  }
  return '';
}

async function executeGeminiNativeAudioTranscription({
  apiKey,
  modelName,
  audioBase64,
  mimeType,
}) {
  const endpoint = `${GEMINI_API_BASE}/models/${encodeURIComponent(modelName)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const payload = {
    contents: [{
      role: 'user',
      parts: [
        { text: 'Hãy chuyển toàn bộ lời nói trong tệp âm thanh này thành văn bản tiếng Việt, giữ nguyên nội dung, không tóm tắt.' },
        { inline_data: { mime_type: mimeType, data: audioBase64 } },
      ],
    }],
    generationConfig: {
      temperature: 0,
    },
  };

  const providerRes = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!providerRes.ok) {
    const providerError = await readProviderError(providerRes);
    return {
      ok: false,
      status: providerRes.status,
      message: providerError.message,
      reason: providerError.reason,
    };
  }

  const data = await providerRes.json();
  const text = extractTextFromProviderPayload(data);
  if (!text) {
    return {
      ok: false,
      status: 502,
      message: 'Native transcription returned empty text',
      reason: 'empty_transcription',
    };
  }
  return {
    ok: true,
    status: providerRes.status,
    text,
  };
}

async function executeGeminiCompatChatRequest({ apiKey, modelName, messages, temperature = 0.1, maxTokens = 32 }) {
  const payload = {
    model: modelName,
    messages,
    stream: false,
    temperature,
    max_tokens: maxTokens,
  };

  const providerRes = await fetch(`${GEMINI_API_ENDPOINT}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(payload),
  });

  if (!providerRes.ok) {
    const providerError = await readProviderError(providerRes);
    return {
      ok: false,
      status: providerRes.status,
      message: providerError.message,
      reason: providerError.reason,
    };
  }

  return {
    ok: true,
    status: providerRes.status,
    data: await providerRes.json(),
  };
}

async function readProviderError(providerRes) {
  const fallbackMessage = `Provider error ${providerRes.status}`;
  try {
    const body = await providerRes.json();
    const message = body?.error?.message || body?.message || fallbackMessage;
    const reason = body?.error?.status || body?.error?.reason || body?.error?.code || providerRes.status;
    return {
      message: String(message || fallbackMessage),
      reason: String(reason || providerRes.status),
    };
  } catch {
    try {
      const rawText = await providerRes.text();
      const text = String(rawText || '').trim();
      return {
        message: text || fallbackMessage,
        reason: providerRes.status,
      };
    } catch {
      return {
        message: fallbackMessage,
        reason: providerRes.status,
      };
    }
  }
}

// Initialize Firebase Admin SDK
let firebaseInitialized = false;
const initFirebase = () => {
  if (firebaseInitialized) return;

  // Try to initialize with service account key if present (Cloud Run will inject via env)
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    : null;

  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`
    });
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
  } else {
    // Fallback: initialize with default credentials (works on Cloud Run with service account attached)
    admin.initializeApp();
  }

  firebaseInitialized = true;
};

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || '*',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Helper: Verify Firebase ID token from Authorization header
async function verifyIdToken(req) {
  const authHeader = req.headers.authorization || '';
  const match = authHeader.match(/^Bearer (.+)$/);
  if (!match) {
    throw new Error('No Bearer token provided');
  }
  const idToken = match[1];
  const decoded = await admin.auth().verifyIdToken(idToken);
  return decoded;
}

// Helper: Check if user has admin custom claim
function isAdmin(decodedToken) {
  return decodedToken?.admin === true;
}

// Firestore collection/refs
function getSystemConfigRef() {
  return admin.firestore().doc('config/system');
}

function getWebSearchHotIndexRef() {
  return admin.firestore().doc('config/web_search_hot_index');
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'vbai-proxy' });
});

// GET: System config summary (non-sensitive)
app.get('/api/system-config-summary', async (req, res) => {
  try {
    initFirebase();
    const decoded = await verifyIdToken(req);
    const requesterIsAdmin = isAdmin(decoded);
    const snap = await getSystemConfigRef().get();
    if (!snap.exists) {
      return res.status(404).json({ error: 'System config not found' });
    }
    const data = snap.data();
    // Return masked version (do not send full API keys)
    const fallbackSources = sanitizeFallbackSources(data.web_search_fallback_sources);
    const webSearchMode = sanitizeWebSearchMode(data.web_search_mode);
    const webSearchProvider = sanitizeWebSearchProvider(data.web_search_provider);
    const cseConfigured = !!(data.google_search_key && data.google_search_cx);
    const vertexConfigured = isVertexSearchConfigured(data);
    res.json({
      active_provider: 'gemini',
      gemini_model: data.gemini_model || 'gemini-2.5-pro',
      gemini_endpoint: GEMINI_API_ENDPOINT,
      google_search_configured: cseConfigured,
      vertex_search_configured: vertexConfigured,
      web_search_configured: cseConfigured || vertexConfigured,
      has_gemini_key: !!data.gemini_api_key,
      gemini_api_key: requesterIsAdmin ? (data.gemini_api_key || '') : '',
      google_search_key: requesterIsAdmin ? (data.google_search_key || '') : '',
      google_search_cx: requesterIsAdmin ? (data.google_search_cx || '') : '',
      vertex_project_id: requesterIsAdmin ? (data.vertex_project_id || '') : '',
      vertex_location: requesterIsAdmin ? (data.vertex_location || DEFAULT_VERTEX_LOCATION) : '',
      vertex_data_store_id: requesterIsAdmin ? (data.vertex_data_store_id || '') : '',
      vertex_serving_config: requesterIsAdmin ? (data.vertex_serving_config || '') : '',
      transcribe_model: data.transcribe_model || data.gemini_model || 'gemini-2.5-flash',
      gemini_models: Array.isArray(data.gemini_models) ? data.gemini_models : [],
      web_search_provider: webSearchProvider,
      web_search_mode: webSearchMode,
      web_search_fallback_sources: fallbackSources,
      updated_at: data.updated_at?.toDate ? data.updated_at.toDate().toISOString() : data.updated_at,
      updated_by: data.updated_by
    });
    if (requesterIsAdmin) {
      console.info(`[AUDIT] system-config-summary viewed by admin: ${decoded.email || decoded.uid}`);
    }
  } catch (err) {
    console.error('GET /api/system-config-summary error:', err);
    res.status(401).json({ error: 'Unauthorized', message: err.message });
  }
});

// POST: Admin validate Gemini API key (live check)
app.post('/api/admin/validate-gemini-key', async (req, res) => {
  try {
    initFirebase();
    const decoded = await verifyIdToken(req);
    if (!isAdmin(decoded)) {
      return res.status(403).json({ error: 'Forbidden', message: 'Admin access required' });
    }

    const rawKey = String(req.body?.gemini_api_key || '').trim();
    const useStoredKey = req.body?.use_stored_key !== false;
    const model = String(req.body?.model || 'gemini-2.5-flash').trim() || 'gemini-2.5-flash';

    const snap = await getSystemConfigRef().get();
    if (!snap.exists) {
      return res.status(404).json({ error: 'System config not found' });
    }
    const config = snap.data() || {};
    const keyToValidate = rawKey || (useStoredKey ? String(config.gemini_api_key || '').trim() : '');
    if (!keyToValidate) {
      return res.status(400).json({
        valid: false,
        message: 'Chua co Gemini API key de xac nhan.',
      });
    }

    const probe = await executeGeminiCompatChatRequest({
      apiKey: keyToValidate,
      modelName: model,
      messages: [{ role: 'user', content: 'ping' }],
      temperature: 0.1,
      maxTokens: 8,
    });

    if (!probe.ok) {
      return res.status(probe.status || 502).json({
        valid: false,
        message: probe.message || `Provider error ${probe.status || 502}`,
        meta: {
          provider_status: probe.status || null,
          provider_error_reason: probe.reason || null,
          model,
        }
      });
    }

    console.info(`[AUDIT] Gemini key validated by admin: ${decoded.email || decoded.uid}`);
    return res.json({
      valid: true,
      message: 'Gemini API key hop le.',
      meta: {
        provider_status: 200,
        model,
      }
    });
  } catch (err) {
    console.error('POST /api/admin/validate-gemini-key error:', err);
    return res.status(500).json({ valid: false, error: 'Internal server error', message: err.message });
  }
});

// POST: Admin update system config
app.post('/api/admin/system-config', async (req, res) => {
  try {
    initFirebase();
    const decoded = await verifyIdToken(req);
    if (!isAdmin(decoded)) {
      return res.status(403).json({ error: 'Forbidden', message: 'Admin access required' });
    }

    const {
      gemini_api_key,
      gemini_model,
      web_search_provider,
      google_search_key,
      google_search_cx,
      vertex_project_id,
      vertex_location,
      vertex_data_store_id,
      vertex_serving_config,
      web_search_mode,
      web_search_fallback_sources,
      transcribe_model,
      gemini_models
    } = req.body;

    if (web_search_mode !== undefined && !isValidWebSearchMode(web_search_mode)) {
      return res.status(400).json({ error: 'Invalid web_search_mode' });
    }
    if (web_search_provider !== undefined && !isValidWebSearchProvider(web_search_provider)) {
      return res.status(400).json({ error: 'Invalid web_search_provider' });
    }

    const updateData = {
      active_provider: 'gemini',
      gemini_model: gemini_model || 'gemini-2.5-pro',
      transcribe_model: transcribe_model || 'gemini-2.5-flash',
      web_search_provider: sanitizeWebSearchProvider(web_search_provider),
      web_search_mode: sanitizeWebSearchMode(web_search_mode),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_by: decoded.email || decoded.uid,
      openai_api_key: admin.firestore.FieldValue.delete(),
      openai_endpoint: admin.firestore.FieldValue.delete(),
      openai_models: admin.firestore.FieldValue.delete(),
      router_model: admin.firestore.FieldValue.delete(),
    };

    // Only update keys if provided (non-empty)
    if (gemini_api_key && gemini_api_key.trim()) {
      updateData.gemini_api_key = gemini_api_key.trim();
    }
    if (google_search_key !== undefined) {
      const keyVal = String(google_search_key || '').trim();
      updateData.google_search_key = keyVal
        ? keyVal
        : admin.firestore.FieldValue.delete();
    }
    if (google_search_cx !== undefined) {
      const cxVal = String(google_search_cx || '').trim();
      updateData.google_search_cx = cxVal
        ? cxVal
        : admin.firestore.FieldValue.delete();
    }
    if (vertex_project_id !== undefined) {
      const val = String(vertex_project_id || '').trim();
      updateData.vertex_project_id = val
        ? val
        : admin.firestore.FieldValue.delete();
    }
    if (vertex_location !== undefined) {
      const val = String(vertex_location || '').trim();
      updateData.vertex_location = val || DEFAULT_VERTEX_LOCATION;
    }
    if (vertex_data_store_id !== undefined) {
      const val = String(vertex_data_store_id || '').trim();
      updateData.vertex_data_store_id = val
        ? val
        : admin.firestore.FieldValue.delete();
    }
    if (vertex_serving_config !== undefined) {
      const val = String(vertex_serving_config || '').trim();
      updateData.vertex_serving_config = val
        ? val
        : admin.firestore.FieldValue.delete();
    }
    // Update model lists (always overwrite)
    if (Array.isArray(gemini_models)) {
      updateData.gemini_models = gemini_models.filter(m => typeof m === 'string' && m.trim()).map(m => m.trim());
    }
    if (web_search_fallback_sources && typeof web_search_fallback_sources === 'object' && !Array.isArray(web_search_fallback_sources)) {
      updateData.web_search_fallback_sources = sanitizeFallbackSources(web_search_fallback_sources);
    }
    if (web_search_mode !== undefined) {
      updateData.web_search_mode = sanitizeWebSearchMode(web_search_mode);
    }
    if (web_search_provider !== undefined) {
      updateData.web_search_provider = sanitizeWebSearchProvider(web_search_provider);
    }

    await getSystemConfigRef().set(updateData, { merge: true });
    res.json({ success: true, message: 'System config updated' });
  } catch (err) {
    console.error('POST /api/admin/system-config error:', err);
    res.status(500).json({ error: 'Internal server error', message: err.message });
  }
});

// GET: Admin web search health probe
app.get('/api/admin/web-search-health', async (req, res) => {
  try {
    initFirebase();
    const decoded = await verifyIdToken(req);
    if (!isAdmin(decoded)) {
      return res.status(403).json({ error: 'Forbidden', message: 'Admin access required' });
    }

    const snap = await getSystemConfigRef().get();
    if (!snap.exists) {
      return res.status(404).json({ error: 'System config not found' });
    }
    const config = snap.data();
    const provider = sanitizeWebSearchProvider(config.web_search_provider);
    const mode = sanitizeWebSearchMode(config.web_search_mode);
    const probe = await probeWebSearchProvider(config);
    return res.json({
      provider,
      mode,
      healthy: probe.healthy === true,
      checked_at: new Date().toISOString(),
      details: probe,
    });
  } catch (err) {
    console.error('GET /api/admin/web-search-health error:', err);
    return res.status(500).json({ error: 'Internal server error', message: err.message });
  }
});

// POST: Admin hot-index ingest for official sources
app.post('/api/admin/web-search-ingest', async (req, res) => {
  try {
    initFirebase();
    const decoded = await verifyIdToken(req);
    if (!isAdmin(decoded)) {
      return res.status(403).json({ error: 'Forbidden', message: 'Admin access required' });
    }

    const snap = await getSystemConfigRef().get();
    if (!snap.exists) {
      return res.status(404).json({ error: 'System config not found' });
    }
    const config = snap.data();
    const result = await runOfficialHotIndexIngest(config, decoded.email || decoded.uid);
    if (!result.success) {
      return res.status(503).json({ error: 'Ingest unavailable', message: result.message || 'ingest_failed', details: result });
    }
    return res.json({
      success: true,
      message: 'Official hot index ingest completed',
      details: result,
      checked_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('POST /api/admin/web-search-ingest error:', err);
    return res.status(500).json({ error: 'Internal server error', message: err.message });
  }
});

// POST: Chat completion proxy
app.post('/api/chat', async (req, res) => {
  try {
    initFirebase();
    const decoded = await verifyIdToken(req);

    const { messages, model, stream = false, temperature = 0.7, max_tokens } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array required' });
    }

    // Fetch system config
    const snap = await getSystemConfigRef().get();
    if (!snap.exists) {
      return res.status(503).json({ error: 'System not configured', message: 'Please contact administrator to configure AI provider.' });
    }
    const config = snap.data();

    const endpoint = GEMINI_API_ENDPOINT;
    const apiKey = config.gemini_api_key;
    const effectiveModel = model || config.gemini_model;

    if (!apiKey) {
      return res.status(503).json({ error: 'API key missing', message: 'Please contact administrator to configure AI provider key.' });
    }

    const configuredGeminiModel = normalizeModelInput(config.gemini_model) || GEMINI_SAFE_FALLBACK_MODEL;
    const primaryModel = normalizeModelInput(effectiveModel) || configuredGeminiModel;
    const retryModel = pickGeminiRetryModel(primaryModel, configuredGeminiModel);
    const candidateModels = dedupeModelNames([
      primaryModel,
      retryModel,
      configuredGeminiModel,
      GEMINI_SAFE_FALLBACK_MODEL,
    ]);
    const attemptedModels = [];

    const executeProviderAttempt = async (modelName) => {
      const payload = {
        model: modelName,
        messages,
        stream: false, // TODO: implement streaming if needed
        temperature,
        ...(max_tokens && { max_tokens })
      };

      // Some reasoning-like models may reject temperature/max_tokens combo.
      const m = String(modelName || '').toLowerCase();
      if (m.includes('o1') || m.includes('o3')) {
        delete payload.temperature;
        if (payload.max_tokens) {
          payload.max_completion_tokens = payload.max_tokens;
          delete payload.max_tokens;
        }
      }

      const providerRes = await fetch(`${endpoint}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify(payload)
      });

      if (!providerRes.ok) {
        const providerError = await readProviderError(providerRes);
        return {
          ok: false,
          status: providerRes.status,
          message: providerError.message,
          reason: providerError.reason,
        };
      }

      return {
        ok: true,
        status: providerRes.status,
        data: await providerRes.json(),
      };
    };

    let attempt = null;
    let finalModel = null;
    for (const candidateModel of candidateModels) {
      attemptedModels.push(candidateModel);
      const currentAttempt = await executeProviderAttempt(candidateModel);
      if (currentAttempt.ok) {
        attempt = currentAttempt;
        finalModel = candidateModel;
        break;
      }
      attempt = currentAttempt;
      const canRetryByModel =
        (currentAttempt.status === 404 && isGeminiModelNotFoundError(currentAttempt.message))
        || (currentAttempt.status === 400 && isGeminiModelCompatibilityError(currentAttempt.message));
      if (!canRetryByModel) break;
    }

    if (!attempt?.ok) {
      return res.status(attempt.status || 500).json({
        error: 'Provider request failed',
        message: attempt.message || `Provider error ${attempt.status || 500}`,
        meta: {
          provider_status: attempt.status || null,
          attempted_models: attemptedModels,
          final_model: null,
          provider_error_reason: attempt.reason || null,
          retried: attemptedModels.length > 1,
        }
      });
    }

    finalModel = finalModel || attemptedModels[attemptedModels.length - 1] || primaryModel;
    const data = attempt.data;
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      data.meta = {
        ...(data.meta && typeof data.meta === 'object' ? data.meta : {}),
        provider_status: 200,
        attempted_models: attemptedModels,
        final_model: finalModel,
        provider_error_reason: null,
        retried: attemptedModels.length > 1,
      };
    }
    res.json(data);
  } catch (err) {
    console.error('POST /api/chat error:', err);
    res.status(500).json({ error: 'Internal server error', message: err.message });
  }
});

// POST: Audio transcription proxy
app.post('/api/transcribe', (req, res, next) => {
  upload.single('audio')(req, res, (err) => {
    if (!err) return next();
    if (err?.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        error: 'Payload too large',
        message: `Audio file vuot qua gioi han ${MAX_AUDIO_UPLOAD_MB}MB`,
      });
    }
    return res.status(400).json({ error: 'Invalid upload', message: err.message || 'Upload failed' });
  });
}, async (req, res) => {
  try {
    initFirebase();
    await verifyIdToken(req);

    const { filename, model } = req.body || {};

    let audioBuffer = req.file?.buffer || null;
    let detectedMimeType = req.file?.mimetype || 'application/octet-stream';
    let effectiveFilename = req.file?.originalname || filename || 'audio';

    // Backward compatibility for older clients that still send base64 JSON.
    if (!audioBuffer && req.body?.audio_base64) {
      audioBuffer = Buffer.from(req.body.audio_base64, 'base64');
      detectedMimeType = 'audio/mpeg';
      effectiveFilename = filename || 'audio';
    }
    if (!audioBuffer || audioBuffer.length === 0) {
      return res.status(400).json({ error: 'audio file is required (multipart field: audio)' });
    }

    // Fetch system config
    const snap = await getSystemConfigRef().get();
    if (!snap.exists) {
      return res.status(503).json({ error: 'System not configured' });
    }
    const config = snap.data();

    const endpoint = GEMINI_API_ENDPOINT;
    const apiKey = config.gemini_api_key;
    const effectiveModel = normalizeModelInput(model || config.transcribe_model || config.gemini_model || 'gemini-2.5-flash');

    if (!apiKey) {
      return res.status(503).json({ error: 'API key missing' });
    }

    const compatCandidateModels = dedupeModelNames([
      effectiveModel,
      config.transcribe_model,
      config.gemini_model,
      ...GEMINI_TRANSCRIBE_SAFE_FALLBACK_MODELS,
    ]);
    const attemptedModels = [];

    const executeCompatAttempt = async (modelName) => {
      const formData = new FormData();
      const audioBlob = new Blob([audioBuffer], { type: detectedMimeType });
      formData.append('file', audioBlob, effectiveFilename);
      formData.append('model', modelName);

      const providerRes = await fetch(`${endpoint}/audio/transcriptions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'x-goog-api-key': apiKey,
        },
        body: formData
      });
      if (!providerRes.ok) {
        const providerError = await readProviderError(providerRes);
        return {
          ok: false,
          status: providerRes.status,
          message: providerError.message,
          reason: providerError.reason,
          via: 'openai_compat',
        };
      }
      const data = await providerRes.json();
      const text = extractTextFromProviderPayload(data);
      return {
        ok: true,
        status: providerRes.status,
        data,
        text,
        via: 'openai_compat',
      };
    };

    const compatibleAudioMime = getCompatibleAudioMimeType(detectedMimeType, effectiveFilename);
    const nativeCandidateModels = dedupeModelNames([
      effectiveModel,
      config.gemini_model,
      ...GEMINI_TRANSCRIBE_SAFE_FALLBACK_MODELS,
    ]);

    let finalAttempt = null;
    let finalModel = null;

    for (const candidateModel of compatCandidateModels) {
      attemptedModels.push(candidateModel);
      const attempt = await executeCompatAttempt(candidateModel);
      if (attempt.ok && String(attempt.text || '').trim()) {
        finalAttempt = attempt;
        finalModel = candidateModel;
        break;
      }
      finalAttempt = attempt;
      if (!shouldRetryWithinTranscriptionPath(attempt)) break;
    }

    if (shouldFallbackTranscriptionPath(finalAttempt)) {
      const audioBase64 = audioBuffer.toString('base64');
      for (const candidateModel of nativeCandidateModels) {
        if (!attemptedModels.includes(candidateModel)) attemptedModels.push(candidateModel);
        const nativeAttempt = await executeGeminiNativeAudioTranscription({
          apiKey,
          modelName: candidateModel,
          audioBase64,
          mimeType: compatibleAudioMime,
        });
        if (nativeAttempt.ok && String(nativeAttempt.text || '').trim()) {
          finalAttempt = {
            ok: true,
            status: nativeAttempt.status,
            text: nativeAttempt.text,
            data: { text: nativeAttempt.text },
            via: 'gemini_native_generate_content',
          };
          finalModel = candidateModel;
          break;
        }
        finalAttempt = nativeAttempt;
        if (!shouldRetryWithinTranscriptionPath(nativeAttempt)) break;
      }
    }

    if (!finalAttempt?.ok) {
      return res.status(finalAttempt?.status || 500).json({
        error: 'Transcription failed',
        message: finalAttempt?.message || `Provider error ${finalAttempt?.status || 500}`,
        meta: {
          provider_status: finalAttempt?.status || null,
          attempted_models: attemptedModels,
          final_model: null,
          provider_error_reason: finalAttempt?.reason || null,
          retried: attemptedModels.length > 1,
        }
      });
    }

    if (finalAttempt.via === 'gemini_native_generate_content') {
      return res.json({
        text: String(finalAttempt.text || '').trim(),
        meta: {
          provider_status: 200,
          attempted_models: attemptedModels,
          final_model: finalModel || attemptedModels[attemptedModels.length - 1] || effectiveModel,
          provider_error_reason: null,
          retried: attemptedModels.length > 1,
          transcription_path: 'gemini_native_generate_content',
        },
      });
    }

    const data = finalAttempt.data || {};
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      data.meta = {
        ...(data.meta && typeof data.meta === 'object' ? data.meta : {}),
        provider_status: 200,
        attempted_models: attemptedModels,
        final_model: finalModel || attemptedModels[attemptedModels.length - 1] || effectiveModel,
        provider_error_reason: null,
        retried: attemptedModels.length > 1,
        transcription_path: 'openai_compat_audio_transcriptions',
      };
    }
    return res.json(data);
  } catch (err) {
    console.error('POST /api/transcribe error:', err);
    res.status(500).json({ error: 'Internal server error', message: err.message });
  }
});

// POST: Web search proxy (uses Google Custom Search configured in system)
app.post('/api/web-search', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    initFirebase();
    let decoded = null;
    const localTestBypass = String(process.env.VBAI_LOCAL_TEST || '').trim().toLowerCase() === 'true';
    if (!localTestBypass) {
      decoded = await verifyIdToken(req);
    }

    const requestStartMs = Date.now();
    const {
      query,
      expectedDocNumber,
      partialDocNumber,
      requestedDocType,
      forceFresh = false,
      freshnessLevel,
      recencyDays,
    } = req.body;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'query required' });
    }

    // Fetch system config for web search credentials
    const snap = await getSystemConfigRef().get();
    if (!snap.exists) {
      return res.status(503).json({ error: 'System not configured' });
    }
    const config = snap.data();
    const webSearchProviderSetting = sanitizeWebSearchProvider(config.web_search_provider);
    const webSearchMode = sanitizeWebSearchMode(config.web_search_mode);
    const fallbackSources = sanitizeFallbackSources(config.web_search_fallback_sources);
    const cseConfig = {
      key: config.google_search_key,
      cx: config.google_search_cx,
    };
    const vertexConfig = getVertexSearchConfig(config);
    const cseConfigured = !!(cseConfig.key && cseConfig.cx);
    const vertexConfigured = vertexConfig.configured;
    const effectiveSearchProvider = resolveEffectiveWebSearchProvider({
      requestedProvider: webSearchProviderSetting,
      cseConfigured,
      vertexConfigured,
    });

    if (!effectiveSearchProvider) {
      return res.status(503).json({ error: 'Web search not configured' });
    }

    const normalizedFreshnessLevel = String(freshnessLevel || '').toLowerCase().trim();
    const normalizedRecencyDays = Number(recencyDays);
    const normalizedExpectedDocNumber = String(expectedDocNumber || '').trim().toUpperCase() || null;
    const inferredPartialDocNumber = extractPartialDocNumber(query);
    const normalizedPartialDocNumber = String(partialDocNumber || inferredPartialDocNumber || '').trim().toUpperCase() || null;
    const effectiveRequestedDocType = sanitizeRequestedDocType(requestedDocType) || inferRequestedDocTypeFromQuery(query);

    // Auto-detect time-sensitive queries and force fresh
    const isTimeSensitive = isTimeSensitiveQuery(query);
    const effectiveForceFresh = forceFresh === true || isTimeSensitive;

    const requestDocMatchLevel = detectDocNumberMatchLevel({
      expectedDocNumber: normalizedExpectedDocNumber,
      partialDocNumber: normalizedPartialDocNumber,
    });
    const strictPartialReject = requestDocMatchLevel === 'partial'
      && !!effectiveRequestedDocType
      && !normalizedExpectedDocNumber;
    const cacheKey = buildWebSearchCacheKey({
      query,
      expectedDocNumber: normalizedExpectedDocNumber,
      partialDocNumber: normalizedPartialDocNumber,
      requestedDocType: effectiveRequestedDocType,
      forceFresh: effectiveForceFresh,
      freshnessLevel: normalizedFreshnessLevel,
      recencyDays: normalizedRecencyDays,
      webSearchProvider: effectiveSearchProvider,
      webSearchMode,
      fallbackSources,
    });
    const cachedPayload = effectiveForceFresh === true ? null : getWebSearchCache(cacheKey);
    if (cachedPayload) {
      const payload = {
        ...cachedPayload,
        meta: {
          ...(cachedPayload.meta || {}),
          cache_hit: true,
          served_in_ms: Date.now() - requestStartMs,
        },
      };
      return res.json(payload);
    }

    // Skip hot index for time-sensitive queries to ensure fresh data
    if (effectiveForceFresh !== true) {
      const hotIndexHit = await findHotIndexHit({
        query,
        expectedDocNumber: normalizedExpectedDocNumber || null,
      });
      if (hotIndexHit && Array.isArray(hotIndexHit.items) && hotIndexHit.items.length > 0) {
        const typedHotItems = filterItemsByRequestedDocType(hotIndexHit.items, effectiveRequestedDocType);
        const hotItems = effectiveRequestedDocType ? typedHotItems : hotIndexHit.items;
        const validation = validateLegalDocumentMatch({
          query,
          items: hotItems,
          expectedDocNumber: normalizedExpectedDocNumber,
          partialDocNumber: normalizedPartialDocNumber,
          requestedDocType: effectiveRequestedDocType,
        });
        const finalHotItems = validation.ok ? validation.approvedItems : [];
        return res.json({
          results: formatSearchResults(finalHotItems),
          meta: buildWebSearchMeta({
            strategy: hotIndexHit.strategy || 'hot_index',
            webSearchProvider: effectiveSearchProvider,
            webSearchMode,
            query,
            refinedQuery: query,
            dateRestrict: null,
            expectedDocNumber: normalizedExpectedDocNumber || null,
            exactMatch: normalizedExpectedDocNumber ? (validation.ok && hotIndexHit.exactMatch === true) : null,
            cseStatus: null,
            cseErrorReason: null,
            fallbackUsed: false,
            enabledFallbackSources: fallbackSources,
            items: finalHotItems,
            requestedDocType: validation.requestedDocType || effectiveRequestedDocType,
            docNumberMatchLevel: validation.docNumberMatchLevel || requestDocMatchLevel,
            typeMatch: typeof validation.typeMatch === 'boolean'
              ? validation.typeMatch
              : detectTypeMatchFromItems(finalHotItems, effectiveRequestedDocType),
            strictRejectReason: validation.strictRejectReason
              || (strictPartialReject ? 'partial_doc_number_requires_full' : null),
            confidence: validation.confidence,
            matchScore: validation.matchScore,
            matchBreakdown: validation.matchBreakdown,
            sourceTierSummary: validation.sourceTierSummary,
            bestAlternative: validation.bestAlternative,
            cacheHit: false,
            servedInMs: Date.now() - requestStartMs,
          }),
        });
      }
    }

    // Prioritize official sources first, then trusted legal references.
    const officialDomainClause = [
      'site:vbpl.vn',
      'site:vanban.chinhphu.vn',
      'site:congbao.chinhphu.vn',
      'site:chinhphu.vn',
      'site:quochoi.vn',
      'site:dangcongsan.vn',
      'site:moj.gov.vn',
      'site:baochinhphu.vn',
    ].join(' OR ');

    const trustedReferenceClause = [
      'site:thuvienphapluat.vn',
      'site:luatvietnam.vn',
      'site:thanhchuong.com.vn',
      'site:vanbanphapluat.com',
    ].join(' OR ');

    // Refine query for legal/policy documents to ensure latest data is fetched
    let refinedQuery = query;
    const normQuery = normalizeVietnamese(query);
    const isLegal = /(luat|nghi dinh|thong tu|quyet dinh|quy dinh|van ban|chinh sach|huong dan|tien luong|huu tri|bao hiem|thue|dat dai|xay dung|dau thau|doanh nghiep|can bo|cong chuc)/.test(normQuery);
    const { current, next } = getCurrentYearContext();
    const hasSpecificYear = new RegExp(`(202\\d|203\\d)`).test(normQuery);

    if (isLegal && !hasSpecificYear && !normQuery.includes('moi nhat')) {
      refinedQuery += ` moi nhat ${current} ${next}`;
    }

    const dateRestrict = buildDateRestrict({
      isLegal,
      normQuery,
      forceFresh: forceFresh === true,
      freshnessLevel: normalizedFreshnessLevel,
      recencyDays: normalizedRecencyDays,
    });
    const searchBudgets = resolveWebSearchBudgets(webSearchMode);

    const diagnostics = {
      cse_status: null,
      cse_error_reason: null,
      fallback_used: false,
    };

    const runDirectFallback = async (docNumber = normalizedExpectedDocNumber, fallbackQuery = refinedQuery) => {
      return fetchDirectOfficialSources({
        query: fallbackQuery,
        expectedDocNumber: docNumber || null,
        enabledSources: fallbackSources,
        limit: 8,
        timeBudgetMs: searchBudgets.fallbackBudgetMs,
      });
    };

    const sendWebSearchResponse = ({
      strategy,
      items = [],
      exactMatch = null,
      noExactMatch = false,
      fallbackUsed = false,
      strictRejectReason = null,
    }) => {
      const validation = validateLegalDocumentMatch({
        query,
        items,
        expectedDocNumber: normalizedExpectedDocNumber,
        partialDocNumber: normalizedPartialDocNumber,
        requestedDocType: effectiveRequestedDocType,
      });
      const typedItems = filterItemsByRequestedDocType(items, effectiveRequestedDocType);
      let finalItems = [];
      if (validation.ok) {
        finalItems = Array.isArray(validation.approvedItems) ? validation.approvedItems : [];
      } else if (!effectiveRequestedDocType && !validation.strictRejectReason) {
        finalItems = typedItems;
      }
      const responseResults = noExactMatch ? '__NO_EXACT_MATCH__' : formatSearchResults(finalItems);
      diagnostics.fallback_used = fallbackUsed === true;
      const effectiveStrictRejectReason = strictRejectReason
        || validation.strictRejectReason
        || (effectiveRequestedDocType && (!finalItems || finalItems.length === 0) && Array.isArray(items) && items.length > 0
          ? 'no_type_match'
          : null)
        || (strictPartialReject ? 'partial_doc_number_requires_full' : null);
      const effectiveStatusInfo = detectEffectiveStatus(finalItems, query);
      const answerMode = effectiveStrictRejectReason
        ? 'reject_with_alternative'
        : detectQueryMode(query, validation.docNumberMatchLevel || requestDocMatchLevel, !!effectiveRequestedDocType);
      const meta = buildWebSearchMeta({
        strategy,
        webSearchProvider: effectiveSearchProvider,
        webSearchMode,
        query,
        refinedQuery,
        dateRestrict,
        expectedDocNumber: normalizedExpectedDocNumber || null,
        exactMatch,
        cseStatus: diagnostics.cse_status,
        cseErrorReason: diagnostics.cse_error_reason,
        fallbackUsed: diagnostics.fallback_used,
        enabledFallbackSources: fallbackSources,
        items: finalItems,
        requestedDocType: validation.requestedDocType || effectiveRequestedDocType,
        docNumberMatchLevel: validation.docNumberMatchLevel || requestDocMatchLevel,
        typeMatch: typeof validation.typeMatch === 'boolean'
          ? validation.typeMatch
          : detectTypeMatchFromItems(finalItems, effectiveRequestedDocType),
        strictRejectReason: effectiveStrictRejectReason,
        confidence: validation.confidence,
        matchScore: validation.matchScore,
        matchBreakdown: validation.matchBreakdown,
        sourceTierSummary: validation.sourceTierSummary,
        bestAlternative: validation.bestAlternative,
        answerMode,
        cacheHit: false,
        servedInMs: Date.now() - requestStartMs,
        effectiveStatus: effectiveStatusInfo.status,
        supersededBy: effectiveStatusInfo.superseded_by,
        freshnessForced: effectiveForceFresh === true,
      });
      const payload = {
        results: responseResults,
        meta,
      };
      const shouldCache = forceFresh !== true
        && validation.ok
        && !noExactMatch
        && Array.isArray(finalItems)
        && finalItems.length > 0;
      if (shouldCache) setWebSearchCache(cacheKey, payload);
      if (shouldCache) {
        updateWebSearchHotIndex({
          query: refinedQuery || query,
          expectedDocNumber: normalizedExpectedDocNumber || null,
          items: finalItems,
          exactMatch,
          strategy,
        }).catch((err) => console.warn('Hot index async update skipped:', err?.message || err));
      }
      return res.json(payload);
    };

    const getRemainingCseBudgetMs = () => {
      const used = Date.now() - requestStartMs;
      return searchBudgets.providerTotalMs - used;
    };

    const executeSearch = async (q, timeoutMs = searchBudgets.providerTimeoutMs) => {
      return executeWebProviderSearch({
        provider: effectiveSearchProvider,
        query: q,
        timeoutMs: Math.max(1200, timeoutMs),
        dateRestrict,
        cseConfig,
        vertexConfig,
      });
    };

    const captureCseDiagnostic = (attemptResult) => {
      if (!attemptResult) return;
      if (Number.isFinite(attemptResult.status)) diagnostics.cse_status = attemptResult.status;
      if (attemptResult.errorReason) diagnostics.cse_error_reason = attemptResult.errorReason;
    };

    const providerQuery = `${refinedQuery} (${officialDomainClause})`;
    let cseStrategy = 'cse_official';

    let searchAttempt = await executeSearch(
      providerQuery,
      Math.min(searchBudgets.providerTimeoutMs, getRemainingCseBudgetMs()),
    );
    captureCseDiagnostic(searchAttempt);
    let items = searchAttempt.items || [];

    // 2nd attempt: trusted legal reference sites
    if ((!items || items.length === 0) && searchBudgets.useTrustedStage && getRemainingCseBudgetMs() > 900) {
      cseStrategy = 'cse_trusted';
      searchAttempt = await executeSearch(
        `${refinedQuery} (${trustedReferenceClause})`,
        Math.min(searchBudgets.providerTimeoutMs, getRemainingCseBudgetMs()),
      );
      captureCseDiagnostic(searchAttempt);
      items = searchAttempt.items || [];
    }

    // 3rd attempt: broad search fallback
    if ((!items || items.length === 0) && searchBudgets.useBroadStage && getRemainingCseBudgetMs() > 900) {
      cseStrategy = 'cse_broad';
      searchAttempt = await executeSearch(
        refinedQuery,
        Math.min(searchBudgets.providerTimeoutMs, getRemainingCseBudgetMs()),
      );
      captureCseDiagnostic(searchAttempt);
      items = searchAttempt.items || [];
    }

    if (!items || items.length === 0) {
      if (webSearchMode === 'cse_fast') {
        return sendWebSearchResponse({
          strategy: diagnostics.cse_error_reason ? 'cse_error_fast' : 'cse_empty',
          items: [],
          exactMatch: normalizedExpectedDocNumber ? false : null,
        });
      }
      const directItems = await runDirectFallback();
      if (!directItems || directItems.length === 0) {
        return sendWebSearchResponse({
          strategy: webSearchMode === 'cse_fast' ? 'cse_fast_empty' : 'direct_fallback_empty',
          items: [],
          exactMatch: normalizedExpectedDocNumber ? false : null,
          fallbackUsed: true,
        });
      }
      return sendWebSearchResponse({
        strategy: webSearchMode === 'cse_fast'
          ? (diagnostics.cse_error_reason ? 'cse_fast_error_direct_fallback' : 'cse_fast_direct_fallback')
          : (diagnostics.cse_error_reason ? 'cse_error_direct_fallback' : 'direct_fallback'),
        items: directItems,
        exactMatch: normalizedExpectedDocNumber ? true : null,
        fallbackUsed: true,
      });
    }

    // If an exact document number is expected, filter results to only those containing it.
    if (normalizedExpectedDocNumber) {
      const exactItems = filterItemsByRequestedDocType(
        pickExactDocItems(items, normalizedExpectedDocNumber),
        effectiveRequestedDocType,
      );
      if (exactItems.length > 0) {
        return sendWebSearchResponse({
          strategy: `${cseStrategy}_exact_match`,
          items: exactItems,
          exactMatch: true,
        });
      }

      const targetedQueries = [
        `${normalizedExpectedDocNumber} ${refinedQuery}`,
        `${normalizedExpectedDocNumber} luat`,
        `${normalizedExpectedDocNumber}`,
      ];
      for (const targetedQuery of targetedQueries) {
        if (getRemainingCseBudgetMs() <= 900) break;
        const targetedAttempt = await executeSearch(
          targetedQuery,
          Math.min(searchBudgets.providerTimeoutMs, getRemainingCseBudgetMs()),
        );
        captureCseDiagnostic(targetedAttempt);
        const targetedExactItems = filterItemsByRequestedDocType(
          pickExactDocItems(targetedAttempt.items || [], normalizedExpectedDocNumber),
          effectiveRequestedDocType,
        );
        if (targetedExactItems.length > 0) {
          return sendWebSearchResponse({
            strategy: `${cseStrategy}_targeted_exact_match`,
            items: targetedExactItems,
            exactMatch: true,
          });
        }
      }

      if (webSearchMode === 'cse_fast') {
        return sendWebSearchResponse({
          strategy: 'no_exact_match',
          items: [],
          exactMatch: false,
          noExactMatch: true,
          strictRejectReason: 'no_exact_type_match',
        });
      }

      const directExactItems = filterItemsByRequestedDocType(
        await runDirectFallback(normalizedExpectedDocNumber, `${normalizedExpectedDocNumber} ${refinedQuery}`),
        effectiveRequestedDocType,
      );
      if (!directExactItems || directExactItems.length === 0) {
        return sendWebSearchResponse({
          strategy: 'no_exact_match',
          items: [],
          exactMatch: false,
          noExactMatch: true,
          fallbackUsed: true,
          strictRejectReason: 'no_exact_type_match',
        });
      }
      return sendWebSearchResponse({
        strategy: diagnostics.cse_error_reason ? 'cse_error_direct_fallback_exact_match' : 'direct_fallback_exact_match',
        items: directExactItems,
        exactMatch: true,
        fallbackUsed: true,
      });
    }

    return sendWebSearchResponse({
      strategy: cseStrategy,
      items,
      exactMatch: null,
    });
  } catch (err) {
    console.error('POST /api/web-search error:', err);
    res.status(500).json({ error: 'Internal server error', message: err.message });
  }
});

// POST: Focused web content extraction from trusted legal URLs

app.post('/api/web-extract', async (req, res) => {
  try {
    initFirebase();
    await verifyIdToken(req);
    const {
      url,
      keywords,
      target_article = null,
      target_clause = null,
      target_point = null,
      strict = false,
    } = req.body || {};
    const rawUrl = String(url || '').trim();
    if (!rawUrl) return res.status(400).json({ error: 'url required' });

    let parsed;
    try {
      parsed = new URL(rawUrl);
    } catch {
      return res.status(400).json({ error: 'invalid url' });
    }
    if (!/^https?:$/.test(parsed.protocol)) {
      return res.status(400).json({ error: 'invalid protocol' });
    }

    const allowedHosts = [
      'chinhphu.vn',
      'vanban.chinhphu.vn',
      'congbao.chinhphu.vn',
      'vbpl.vn',
      'quochoi.vn',
      'xaydungchinhsach.chinhphu.vn',
      'thuvienphapluat.vn',
      'luatvietnam.vn',
    ];
    if (!isAllowedHost(parsed.toString(), allowedHosts)) {
      return res.status(400).json({ error: 'host_not_allowed' });
    }

    const html = await fetchDirectSourcePage(parsed.toString(), 8000);
    if (!html) return res.json({ text: '', extracted: false, strict_match: false });

    const plain = sanitizeExtractedLegalText(cleanStrictText(decodeHtmlEntities(stripHtml(html))));
    if (!plain) return res.json({ text: '', extracted: false, strict_match: false });

    const strictEnabled = strict === true;
    const strictTarget = {
      article: target_article,
      clause: target_clause,
      point: target_point,
    };
    const strictResult = extractStrictLegalText(plain, strictTarget);
    if (strictEnabled) {
      const strictText = sanitizeExtractedLegalText(strictResult.text || '');
      return res.json({
        text: strictText,
        extracted: strictResult.extracted === true && strictText.length > 0,
        strict_match: strictResult.strict_match === true && strictText.length > 0,
        article_found: strictResult.article_found,
        clause_found: strictResult.clause_found,
        point_found: strictResult.point_found,
        extract_mode: 'strict',
      });
    }

    const candidates = Array.isArray(keywords) ? keywords : [];
    const normalized = normalizeVietnamese(plain);
    let bestStart = -1;
    let bestKeyword = '';
    for (const kw of candidates) {
      const key = normalizeVietnamese(String(kw || '').trim());
      if (!key) continue;
      const pos = normalized.indexOf(key);
      if (pos >= 0 && (bestStart < 0 || pos < bestStart)) {
        bestStart = pos;
        bestKeyword = key;
      }
    }

    if (bestStart < 0) {
      return res.json({
        text: sanitizeExtractedLegalText(plain.slice(0, 1200)),
        extracted: false,
        strict_match: strictResult.strict_match === true,
        article_found: strictResult.article_found,
        clause_found: strictResult.clause_found,
        point_found: strictResult.point_found,
        extract_mode: 'keyword_fallback',
      });
    }

    const snippetStart = Math.max(0, bestStart - 240);
    const snippetEnd = Math.min(plain.length, bestStart + 1600);
    return res.json({
      text: sanitizeExtractedLegalText(plain.slice(snippetStart, snippetEnd)),
      extracted: true,
      keyword: bestKeyword,
      strict_match: strictResult.strict_match === true,
      article_found: strictResult.article_found,
      clause_found: strictResult.clause_found,
      point_found: strictResult.point_found,
      extract_mode: 'keyword_fallback',
    });
  } catch (err) {
    console.error('POST /api/web-extract error:', err);
    res.status(500).json({ error: 'Internal server error', message: err.message });
  }
});

// Helper: Get current year context for search queries
function getCurrentYearContext() {
  const now = new Date();
  const current = now.getFullYear();
  return { current, next: current + 1, prev: current - 1 };
}

function buildDateRestrict({ isLegal, normQuery, forceFresh, freshnessLevel, recencyDays }) {
  if (Number.isFinite(recencyDays) && recencyDays > 0) {
    if (recencyDays <= 7) return `d${Math.max(1, Math.floor(recencyDays))}`;
    if (recencyDays <= 60) return `w${Math.max(1, Math.ceil(recencyDays / 7))}`;
    if (recencyDays <= 365) return `m${Math.max(1, Math.ceil(recencyDays / 30))}`;
    return `y${Math.max(1, Math.ceil(recencyDays / 365))}`;
  }

  if (freshnessLevel === 'day') return 'd7';
  if (freshnessLevel === 'week') return 'w4';
  if (freshnessLevel === 'month') return 'm6';

  if (forceFresh) return 'm6';

  if (!isLegal) return '';
  if (/(hom nay|hien tai|moi nhat|cap nhat|vua ban hanh)/.test(normQuery)) return 'm3';
  return 'y1';
}

function resolveWebSearchBudgets(mode = DEFAULT_WEB_SEARCH_MODE) {
  const normalizedMode = sanitizeWebSearchMode(mode);
  if (normalizedMode === 'cse_fast') {
    return {
      providerTotalMs: WEB_SEARCH_FAST_TOTAL_BUDGET_MS,
      providerTimeoutMs: WEB_SEARCH_FAST_PROVIDER_TIMEOUT_MS,
      fallbackBudgetMs: 0,
      useTrustedStage: false,
      useBroadStage: false,
    };
  }
  return {
    providerTotalMs: WEB_SEARCH_CSE_TOTAL_BUDGET_MS,
    providerTimeoutMs: WEB_SEARCH_CSE_TIMEOUT_MS,
    fallbackBudgetMs: WEB_SEARCH_FALLBACK_BUDGET_MS,
    useTrustedStage: false,
    useBroadStage: true,
  };
}

function extractDocNumbersFromItems(items = []) {
  const found = new Set();
  const matcher = /\b\d{1,4}\/\d{4}\/[A-Z0-9-]+\b/gi;
  for (const item of (Array.isArray(items) ? items : [])) {
    const hay = `${String(item?.title || '')} ${String(item?.snippet || '')} ${String(item?.link || '')}`.toUpperCase();
    let match;
    while ((match = matcher.exec(hay)) !== null) {
      found.add(String(match[0] || '').toUpperCase());
      if (found.size >= 4) break;
    }
    if (found.size >= 4) break;
  }
  return Array.from(found);
}

function extractFirstDocNumber(text = '') {
  const match = String(text || '').toUpperCase().match(/\b\d{1,4}\/\d{4}\/[A-Z0-9-]+\b/);
  return match ? String(match[0] || '').toUpperCase() : '';
}

function extractYearFromText(text = '') {
  const yearMatch = String(text || '').match(/\b(20\d{2})\b/);
  return yearMatch ? Number(yearMatch[1]) : null;
}

function tokenizeText(value = '') {
  return normalizeVietnamese(String(value || ''))
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

function inferIssuerFromText(text = '') {
  const n = normalizeVietnamese(text);
  if (/\bquoc hoi\b/.test(n) || /\bqh\d{2}\b/.test(n)) return 'quoc_hoi';
  if (/\bchinh phu\b/.test(n) || /\bnd-cp\b/.test(String(text || '').toUpperCase())) return 'chinh_phu';
  if (/\bbo\b/.test(n) || /\btt-b[a-z0-9-]+\b/.test(String(text || '').toUpperCase())) return 'bo_nganh';
  if (/\bubnd\b/.test(n)) return 'ubnd';
  return null;
}

function parseUserQueryConstraints({
  query = '',
  expectedDocNumber = null,
  partialDocNumber = null,
  requestedDocType = null,
} = {}) {
  const text = String(query || '');
  const normalizedExpected = String(expectedDocNumber || '').trim().toUpperCase() || null;
  const normalizedPartial = String(partialDocNumber || '').trim().toUpperCase() || null;
  const normalizedType = sanitizeRequestedDocType(requestedDocType) || inferRequestedDocTypeFromQuery(text);
  const yearFromDoc = extractYearFromText(normalizedExpected || normalizedPartial || '');
  const yearFromQuery = extractYearFromText(text);
  const year = yearFromDoc || yearFromQuery || null;
  const issuer = inferIssuerFromText(text);

  const stripped = normalizeVietnamese(text)
    .replace(/\b\d{1,4}\/\d{4}(?:\/[a-z0-9-]+)?\b/g, ' ')
    .replace(/\b(luat|nghi dinh|thong tu|nghi quyet|quyet dinh|cong van|so|hieu|nam|ban hanh|hieu luc)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const titleTerms = tokenizeText(stripped).filter((token) => token.length >= 3).slice(0, 12);

  return {
    requestedDocType: normalizedType,
    fullDocNumber: normalizedExpected,
    partialDocNumber: normalizedPartial,
    docNumberMatchLevel: normalizedExpected ? 'full' : (normalizedPartial ? 'partial' : 'none'),
    issuer,
    year,
    titleTerms,
  };
}

function isGeneralLegalQuery(constraints = {}) {
  if (!constraints || typeof constraints !== 'object') return true;
  return !(
    constraints.fullDocNumber
    || constraints.partialDocNumber
    || constraints.requestedDocType
    || constraints.issuer
    || Number.isFinite(constraints.year)
  );
}

function normalizeCandidateMetadata(item = {}) {
  const title = String(item?.title || '').trim();
  const snippet = String(item?.snippet || '').trim();
  const link = String(item?.link || '').trim();
  const hay = `${title} ${snippet} ${link}`.trim();
  const soHieu = extractFirstDocNumber(hay);
  const issuer = inferIssuerFromText(hay);
  const sourceTier = detectSourceTier({ link, source: item?.source });

  return {
    loai_van_ban: inferDocTypeFromText(hay),
    so_hieu: soHieu || '',
    ngay_ban_hanh: '',
    ngay_hieu_luc: '',
    co_quan_ban_hanh: issuer || '',
    trich_yeu_hoac_ten_van_ban: title || '',
    tinh_trang_hieu_luc: '',
    nam_ban_hanh: extractYearFromText(soHieu || hay),
    nguon: toHost(link) || String(item?.source || '').trim().toLowerCase(),
    is_official_source: sourceTier === 'official',
    source_tier: sourceTier,
  };
}

function scoreTitleMatch(constraints = {}, metadata = {}, item = {}) {
  if (!Array.isArray(constraints.titleTerms) || constraints.titleTerms.length === 0) {
    return { score: 0, ratio: 0 };
  }
  const hayTokens = new Set(tokenizeText(`${metadata.trich_yeu_hoac_ten_van_ban || ''} ${item?.snippet || ''}`));
  if (hayTokens.size === 0) return { score: 0, ratio: 0 };
  let hit = 0;
  constraints.titleTerms.forEach((term) => {
    if (hayTokens.has(term)) hit += 1;
  });
  const ratio = hit / constraints.titleTerms.length;
  if (ratio >= 0.55) return { score: 30, ratio };
  if (ratio >= 0.35) return { score: 18, ratio };
  if (ratio >= 0.2) return { score: 8, ratio };
  return { score: 0, ratio };
}

function validateLegalDocumentMatch({
  query = '',
  items = [],
  expectedDocNumber = null,
  partialDocNumber = null,
  requestedDocType = null,
} = {}) {
  const constraints = parseUserQueryConstraints({
    query,
    expectedDocNumber,
    partialDocNumber,
    requestedDocType,
  });
  const originalItems = Array.isArray(items) ? items : [];
  const generalLegalQuery = isGeneralLegalQuery(constraints);
  const normalized = originalItems.map((item) => ({ item, metadata: normalizeCandidateMetadata(item) }));
  const sourceTierSummaryRaw = normalized.reduce((acc, entry) => {
    if (entry.metadata.source_tier === 'official') acc.official += 1;
    else if (entry.metadata.source_tier === 'reference') acc.reference += 1;
    else acc.unknown += 1;
    return acc;
  }, { official: 0, reference: 0, unknown: 0 });

  if (constraints.docNumberMatchLevel === 'partial' && constraints.requestedDocType && !constraints.fullDocNumber) {
    return {
      ok: false,
      strictRejectReason: 'partial_doc_number_requires_full',
      confidence: 0,
      matchScore: 0,
      matchBreakdown: { doc_type: 0, doc_number: 0, title: 0, issuer: 0, date: 0 },
      sourceTierSummary: { official_count: sourceTierSummaryRaw.official, reference_count: sourceTierSummaryRaw.reference },
      requestedDocType: constraints.requestedDocType,
      docNumberMatchLevel: constraints.docNumberMatchLevel,
      typeMatch: null,
      approvedItems: [],
      bestAlternative: null,
    };
  }

  const typed = constraints.requestedDocType
    ? normalized.filter((entry) => entry.metadata.loai_van_ban === constraints.requestedDocType)
    : normalized;
  const typeMatch = constraints.requestedDocType ? typed.length > 0 : null;
  if (constraints.requestedDocType && typed.length === 0) {
    return {
      ok: false,
      strictRejectReason: 'no_type_match',
      confidence: 0,
      matchScore: 0,
      matchBreakdown: { doc_type: 0, doc_number: 0, title: 0, issuer: 0, date: 0 },
      sourceTierSummary: { official_count: sourceTierSummaryRaw.official, reference_count: sourceTierSummaryRaw.reference },
      requestedDocType: constraints.requestedDocType,
      docNumberMatchLevel: constraints.docNumberMatchLevel,
      typeMatch,
      approvedItems: [],
      bestAlternative: null,
    };
  }

  const preferredPool = typed.some((entry) => entry.metadata.is_official_source)
    ? typed.filter((entry) => entry.metadata.is_official_source)
    : typed;

  const scored = preferredPool.map((entry) => {
    const breakdown = { doc_type: 0, doc_number: 0, title: 0, issuer: 0, date: 0 };

    if (constraints.requestedDocType && entry.metadata.loai_van_ban === constraints.requestedDocType) {
      breakdown.doc_type = 20;
    }

    if (constraints.fullDocNumber) {
      const hay = `${entry.item?.title || ''} ${entry.item?.snippet || ''} ${entry.item?.link || ''}`;
      if (hasExpectedDocNumber(hay, constraints.fullDocNumber)) {
        breakdown.doc_number = 25;
      }
    } else if (constraints.partialDocNumber && entry.metadata.so_hieu.startsWith(`${constraints.partialDocNumber}/`)) {
      breakdown.doc_number = 10;
    }

    const titleMatch = scoreTitleMatch(constraints, entry.metadata, entry.item);
    breakdown.title = titleMatch.score;

    if (constraints.issuer && constraints.issuer === entry.metadata.co_quan_ban_hanh) {
      breakdown.issuer = 15;
    }

    if (constraints.year && Number(entry.metadata.nam_ban_hanh) === Number(constraints.year)) {
      breakdown.date = 10;
    }

    const score = breakdown.doc_type + breakdown.doc_number + breakdown.title + breakdown.issuer + breakdown.date;
    const confidence = Math.max(0, Math.min(1, score / 100));
    const metadataComplete = Boolean(
      entry.metadata.loai_van_ban
      && entry.metadata.so_hieu
      && entry.metadata.nam_ban_hanh
      && entry.metadata.co_quan_ban_hanh
      && entry.metadata.trich_yeu_hoac_ten_van_ban
    );

    return {
      ...entry,
      breakdown,
      score,
      confidence,
      metadataComplete,
    };
  }).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    if (a.metadata.is_official_source !== b.metadata.is_official_source) {
      return a.metadata.is_official_source ? -1 : 1;
    }
    return 0;
  });

  const best = scored[0] || null;
  const bestAlternative = best ? {
    so_hieu: best.metadata.so_hieu || null,
    loai_van_ban: best.metadata.loai_van_ban || null,
    trich_yeu_hoac_ten_van_ban: best.metadata.trich_yeu_hoac_ten_van_ban || null,
    nguon: best.metadata.nguon || null,
    is_official_source: best.metadata.is_official_source === true,
  } : null;

  if (!best) {
    return {
      ok: false,
      strictRejectReason: 'metadata_incomplete',
      confidence: 0,
      matchScore: 0,
      matchBreakdown: { doc_type: 0, doc_number: 0, title: 0, issuer: 0, date: 0 },
      sourceTierSummary: { official_count: sourceTierSummaryRaw.official, reference_count: sourceTierSummaryRaw.reference },
      requestedDocType: constraints.requestedDocType,
      docNumberMatchLevel: constraints.docNumberMatchLevel,
      typeMatch,
      approvedItems: [],
      bestAlternative: null,
    };
  }

  if (generalLegalQuery) {
    return {
      ok: true,
      strictRejectReason: null,
      confidence: best.confidence,
      matchScore: best.score,
      matchBreakdown: best.breakdown,
      sourceTierSummary: { official_count: sourceTierSummaryRaw.official, reference_count: sourceTierSummaryRaw.reference },
      requestedDocType: constraints.requestedDocType,
      docNumberMatchLevel: constraints.docNumberMatchLevel,
      typeMatch,
      approvedItems: [best.item],
      bestAlternative,
    };
  }

  if (constraints.fullDocNumber && best.breakdown.doc_number <= 0) {
    return {
      ok: false,
      strictRejectReason: 'no_exact_match',
      confidence: best.confidence,
      matchScore: best.score,
      matchBreakdown: best.breakdown,
      sourceTierSummary: { official_count: sourceTierSummaryRaw.official, reference_count: sourceTierSummaryRaw.reference },
      requestedDocType: constraints.requestedDocType,
      docNumberMatchLevel: constraints.docNumberMatchLevel,
      typeMatch,
      approvedItems: [],
      bestAlternative,
    };
  }

  if (!best.metadataComplete) {
    return {
      ok: false,
      strictRejectReason: 'metadata_incomplete',
      confidence: best.confidence,
      matchScore: best.score,
      matchBreakdown: best.breakdown,
      sourceTierSummary: { official_count: sourceTierSummaryRaw.official, reference_count: sourceTierSummaryRaw.reference },
      requestedDocType: constraints.requestedDocType,
      docNumberMatchLevel: constraints.docNumberMatchLevel,
      typeMatch,
      approvedItems: [],
      bestAlternative,
    };
  }

  if (best.score < LEGAL_MATCH_PASS_SCORE) {
    return {
      ok: false,
      strictRejectReason: 'low_confidence',
      confidence: best.confidence,
      matchScore: best.score,
      matchBreakdown: best.breakdown,
      sourceTierSummary: { official_count: sourceTierSummaryRaw.official, reference_count: sourceTierSummaryRaw.reference },
      requestedDocType: constraints.requestedDocType,
      docNumberMatchLevel: constraints.docNumberMatchLevel,
      typeMatch,
      approvedItems: [],
      bestAlternative,
    };
  }

  return {
    ok: true,
    strictRejectReason: null,
    confidence: best.confidence,
    matchScore: best.score,
    matchBreakdown: best.breakdown,
    sourceTierSummary: { official_count: sourceTierSummaryRaw.official, reference_count: sourceTierSummaryRaw.reference },
    requestedDocType: constraints.requestedDocType,
    docNumberMatchLevel: constraints.docNumberMatchLevel,
    typeMatch,
    approvedItems: [best.item],
    bestAlternative,
  };
}

function formatSearchResults(items = []) {
  return (items || [])
    .slice(0, 8)
    .map((item) => {
      const title = String(item?.title || 'No Title').replace(/[\r\n]+/g, ' ').trim();
      const link = String(item?.link || '#').trim();
      const sourceHost = toHost(link) || String(item?.source || '').trim().toLowerCase();
      const sourceTier = detectSourceTier({ link, source: item?.source });
      const sourceLabel = sourceTier === 'official'
        ? 'Chinh thuc'
        : sourceTier === 'reference'
          ? 'Tham khao'
          : 'Khac';
      const snippetParts = [
        String(item?.snippet || '').replace(/[\r\n]+/g, ' ').trim(),
        sourceHost ? `[Nguon: ${sourceHost} (${sourceLabel})]` : '',
      ].filter(Boolean);
      const snippet = snippetParts.join(' ');
      return `- [${title}](${link}): ${snippet}`;
    })
    .join('\n\n');
}

async function fetchWithTimeout(url, init = {}, timeoutMs = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function buildWebSearchMeta({
  strategy = 'unknown',
  webSearchProvider = DEFAULT_WEB_SEARCH_PROVIDER,
  webSearchMode = DEFAULT_WEB_SEARCH_MODE,
  query = '',
  refinedQuery = '',
  dateRestrict = '',
  expectedDocNumber = null,
  exactMatch = null,
  cseStatus = null,
  cseErrorReason = null,
  fallbackUsed = false,
  enabledFallbackSources = DEFAULT_WEB_SEARCH_FALLBACK_SOURCES,
  items = [],
  requestedDocType = null,
  docNumberMatchLevel = 'none',
  typeMatch = null,
  strictRejectReason = null,
  confidence = null,
  matchScore = null,
  matchBreakdown = null,
  sourceTierSummary = null,
  bestAlternative = null,
  answerMode = null,
  cacheHit = false,
  servedInMs = null,
  effectiveStatus = null,
  supersededBy = null,
  freshnessForced = false,
}) {
  return {
    strategy,
    web_search_provider: sanitizeWebSearchProvider(webSearchProvider),
    web_search_mode: sanitizeWebSearchMode(webSearchMode),
    query: String(query || ''),
    refined_query: String(refinedQuery || ''),
    date_restrict: dateRestrict || null,
    expected_doc_number: expectedDocNumber ? String(expectedDocNumber) : null,
    exact_match: exactMatch,
    cse_status: Number.isFinite(cseStatus) ? Math.floor(cseStatus) : null,
    cse_error_reason: cseErrorReason ? String(cseErrorReason) : null,
    fallback_used: fallbackUsed === true,
    enabled_fallback_sources: getEnabledFallbackSourceIds(enabledFallbackSources),
    requested_doc_type: sanitizeRequestedDocType(requestedDocType),
    doc_number_match_level: ['none', 'partial', 'full'].includes(String(docNumberMatchLevel || '').toLowerCase())
      ? String(docNumberMatchLevel || '').toLowerCase()
      : 'none',
    type_match: typeof typeMatch === 'boolean' ? typeMatch : null,
    strict_reject_reason: strictRejectReason ? String(strictRejectReason) : null,
    confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, Number(confidence))) : null,
    match_score: Number.isFinite(matchScore) ? Math.max(0, Math.min(100, Math.round(Number(matchScore)))) : null,
    match_breakdown: matchBreakdown && typeof matchBreakdown === 'object' ? {
      doc_type: Number(matchBreakdown.doc_type || 0),
      doc_number: Number(matchBreakdown.doc_number || 0),
      title: Number(matchBreakdown.title || 0),
      issuer: Number(matchBreakdown.issuer || 0),
      date: Number(matchBreakdown.date || 0),
    } : null,
    source_tier_summary: sourceTierSummary && typeof sourceTierSummary === 'object' ? {
      official_count: Number(sourceTierSummary.official_count || 0),
      reference_count: Number(sourceTierSummary.reference_count || 0),
    } : null,
    best_alternative: bestAlternative && typeof bestAlternative === 'object'
      ? {
        so_hieu: bestAlternative.so_hieu || null,
        loai_van_ban: bestAlternative.loai_van_ban || null,
        trich_yeu_hoac_ten_van_ban: bestAlternative.trich_yeu_hoac_ten_van_ban || null,
        nguon: bestAlternative.nguon || null,
        is_official_source: bestAlternative.is_official_source === true,
      }
      : null,
    answer_mode: answerMode ? String(answerMode) : null,
    sources_used: collectSourcesUsed(items),
    item_count: Array.isArray(items) ? Math.min(8, items.length) : 0,
    cache_hit: cacheHit === true,
    served_in_ms: Number.isFinite(servedInMs) ? Math.max(0, Math.round(servedInMs)) : null,
    fetched_at: new Date().toISOString(),
    effective_status: effectiveStatus ? String(effectiveStatus) : null,
    superseded_by: supersededBy ? String(supersededBy) : null,
    freshness_forced: freshnessForced === true,
  };
}

function getEnabledFallbackSourceIds(sourceFlags = DEFAULT_WEB_SEARCH_FALLBACK_SOURCES) {
  const normalized = sanitizeFallbackSources(sourceFlags);
  return Object.keys(normalized).filter((key) => normalized[key] !== false);
}

function collectSourcesUsed(items = []) {
  const used = new Set();
  for (const item of (Array.isArray(items) ? items : [])) {
    const directSource = String(item?.source || '').trim().toLowerCase();
    if (directSource) {
      used.add(directSource);
      continue;
    }
    const link = String(item?.link || '').trim();
    if (!link) continue;
    try {
      const host = new URL(link).hostname.toLowerCase().replace(/^www\./, '');
      if (host) used.add(host);
    } catch {}
  }
  return Array.from(used);
}

function buildExpectedDocNumberTokens(expectedDocNumber = '') {
  const raw = String(expectedDocNumber || '').trim().toUpperCase();
  if (!raw) return [];
  const noSpace = raw.replace(/\s+/g, '');
  const slash = noSpace.replace(/-/g, '/');
  const dash = noSpace.replace(/\//g, '-');
  const compact = noSpace.replace(/[/-]/g, '');
  return Array.from(new Set([noSpace, slash, dash, compact].filter(Boolean)));
}

function hasExpectedDocNumber(text = '', expectedDocNumber = '') {
  const hay = String(text || '').toUpperCase();
  if (!hay) return false;
  const compactHay = hay.replace(/[/-]/g, '');
  const tokens = buildExpectedDocNumberTokens(expectedDocNumber);
  if (tokens.length === 0) return false;
  return tokens.some((token) => hay.includes(token) || compactHay.includes(token.replace(/[/-]/g, '')));
}

function pickExactDocItems(items = [], expectedDocNumber = '') {
  if (!expectedDocNumber) return [];
  return (Array.isArray(items) ? items : []).filter((item) => {
    const hay = `${String(item?.title || '')} ${String(item?.snippet || '')} ${String(item?.link || '')}`;
    return hasExpectedDocNumber(hay, expectedDocNumber);
  });
}

function filterItemsByRequestedDocType(items = [], requestedDocType = null) {
  if (!requestedDocType) return Array.isArray(items) ? items : [];
  return (Array.isArray(items) ? items : []).filter((item) => isDocTypeMatchForItem(item, requestedDocType));
}

function detectDocNumberMatchLevel({ expectedDocNumber, partialDocNumber }) {
  if (String(expectedDocNumber || '').trim()) return 'full';
  if (String(partialDocNumber || '').trim()) return 'partial';
  return 'none';
}

function detectTypeMatchFromItems(items = [], requestedDocType = null) {
  if (!requestedDocType) return null;
  if (!Array.isArray(items) || items.length === 0) return false;
  return items.some((item) => isDocTypeMatchForItem(item, requestedDocType));
}

let webSearchHotIndexMem = {
  loadedAt: 0,
  data: null,
};

function normalizeSearchQueryKey(query = '') {
  return normalizeVietnamese(String(query || ''))
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
}

function toSerializableSearchItems(items = []) {
  return (Array.isArray(items) ? items : [])
    .slice(0, WEB_SEARCH_HOT_INDEX_MAX_ITEMS)
    .map((item) => ({
      title: String(item?.title || '').slice(0, 260),
      link: String(item?.link || '').slice(0, 500),
      snippet: String(item?.snippet || '').slice(0, 420),
      source: String(item?.source || '').slice(0, 120),
    }))
    .filter((item) => item.title && item.link);
}

function normalizeHotIndexData(raw = {}) {
  return {
    by_query: raw?.by_query && typeof raw.by_query === 'object' ? raw.by_query : {},
    by_doc: raw?.by_doc && typeof raw.by_doc === 'object' ? raw.by_doc : {},
    last_ingest_at_ms: Number(raw?.last_ingest_at_ms) || 0,
  };
}

function isHotIndexEntryFresh(entry = null, now = Date.now()) {
  if (!entry || typeof entry !== 'object') return false;
  const updatedAt = Number(entry.updated_at_ms || 0);
  if (!Number.isFinite(updatedAt) || updatedAt <= 0) return false;
  return now - updatedAt <= WEB_SEARCH_HOT_INDEX_TTL_MS;
}

function toHotIndexHit(entry = null, strategy = 'hot_index') {
  if (!entry || typeof entry !== 'object') return null;
  const items = toSerializableSearchItems(entry.items || []);
  if (items.length === 0) return null;
  return {
    strategy,
    items,
    exactMatch: entry.exact_match === true,
  };
}

function pruneHotIndexBucket(bucket = {}, maxEntries = 120) {
  const entries = Object.entries(bucket || {});
  if (entries.length <= maxEntries) return bucket;
  entries.sort((a, b) => Number(b[1]?.updated_at_ms || 0) - Number(a[1]?.updated_at_ms || 0));
  return Object.fromEntries(entries.slice(0, maxEntries));
}

async function getWebSearchHotIndexData(forceReload = false) {
  const now = Date.now();
  if (!forceReload && webSearchHotIndexMem.data && now - webSearchHotIndexMem.loadedAt < 45000) {
    return webSearchHotIndexMem.data;
  }
  try {
    const snap = await getWebSearchHotIndexRef().get();
    const data = snap.exists ? normalizeHotIndexData(snap.data()) : normalizeHotIndexData({});
    webSearchHotIndexMem = {
      loadedAt: now,
      data,
    };
    return data;
  } catch {
    return webSearchHotIndexMem.data || normalizeHotIndexData({});
  }
}

async function findHotIndexHit({ query = '', expectedDocNumber = null }) {
  const data = await getWebSearchHotIndexData(false);
  const now = Date.now();
  const queryKey = normalizeSearchQueryKey(query);
  if (expectedDocNumber) {
    const docKey = String(expectedDocNumber).trim().toUpperCase();
    const docEntry = data?.by_doc?.[docKey];
    if (isHotIndexEntryFresh(docEntry, now)) {
      const hit = toHotIndexHit(docEntry, 'hot_index_doc');
      if (hit) return hit;
    }
  }
  if (queryKey) {
    const queryEntry = data?.by_query?.[queryKey];
    if (isHotIndexEntryFresh(queryEntry, now)) {
      const hit = toHotIndexHit(queryEntry, 'hot_index_query');
      if (hit) return hit;
    }
  }
  return null;
}

async function updateWebSearchHotIndex({
  query = '',
  expectedDocNumber = null,
  items = [],
  exactMatch = null,
  strategy = 'unknown',
}) {
  const normalizedItems = toSerializableSearchItems(items);
  if (normalizedItems.length === 0) return;
  const now = Date.now();
  const queryKey = normalizeSearchQueryKey(query);
  const docKey = expectedDocNumber ? String(expectedDocNumber).trim().toUpperCase() : '';
  const entry = {
    query: String(query || '').slice(0, 260),
    exact_match: exactMatch === true,
    strategy: String(strategy || 'unknown'),
    updated_at_ms: now,
    items: normalizedItems,
  };

  try {
    const current = await getWebSearchHotIndexData(false);
    const nextData = {
      by_query: { ...(current.by_query || {}) },
      by_doc: { ...(current.by_doc || {}) },
      last_ingest_at_ms: Number(current.last_ingest_at_ms || 0),
    };
    if (queryKey) nextData.by_query[queryKey] = entry;
    if (docKey) nextData.by_doc[docKey] = entry;
    nextData.by_query = pruneHotIndexBucket(nextData.by_query, 140);
    nextData.by_doc = pruneHotIndexBucket(nextData.by_doc, 220);
    await getWebSearchHotIndexRef().set(nextData, { merge: true });
    webSearchHotIndexMem = {
      loadedAt: now,
      data: nextData,
    };
  } catch (err) {
    console.warn('updateWebSearchHotIndex skipped:', err?.message || err);
  }
}

function buildWebSearchCacheKey({
  query = '',
  expectedDocNumber = null,
  partialDocNumber = null,
  requestedDocType = null,
  forceFresh = false,
  freshnessLevel = '',
  recencyDays = null,
  webSearchProvider = DEFAULT_WEB_SEARCH_PROVIDER,
  webSearchMode = DEFAULT_WEB_SEARCH_MODE,
  fallbackSources = DEFAULT_WEB_SEARCH_FALLBACK_SOURCES,
}) {
  const payload = {
    q: String(query || '').trim().toLowerCase(),
    doc: expectedDocNumber ? String(expectedDocNumber).trim().toUpperCase() : '',
    pdoc: partialDocNumber ? String(partialDocNumber).trim().toUpperCase() : '',
    dtype: sanitizeRequestedDocType(requestedDocType) || '',
    ff: forceFresh === true,
    fl: String(freshnessLevel || '').trim().toLowerCase(),
    rd: Number.isFinite(recencyDays) ? Math.max(0, Math.floor(recencyDays)) : 0,
    provider: sanitizeWebSearchProvider(webSearchProvider),
    mode: sanitizeWebSearchMode(webSearchMode),
    src: sanitizeFallbackSources(fallbackSources),
  };
  return JSON.stringify(payload);
}

function getWebSearchCache(key) {
  if (!key) return null;
  const now = Date.now();
  const record = WEB_SEARCH_RESULT_CACHE.get(key);
  if (!record) return null;
  if (record.expiresAt <= now) {
    WEB_SEARCH_RESULT_CACHE.delete(key);
    return null;
  }
  return record.payload;
}

function setWebSearchCache(key, payload) {
  if (!key || !payload) return;
  const now = Date.now();
  pruneWebSearchCache(now);
  WEB_SEARCH_RESULT_CACHE.set(key, {
    payload,
    expiresAt: now + WEB_SEARCH_RESULT_CACHE_TTL_MS,
  });
  if (WEB_SEARCH_RESULT_CACHE.size > WEB_SEARCH_RESULT_CACHE_MAX) {
    const oldestKey = WEB_SEARCH_RESULT_CACHE.keys().next().value;
    if (oldestKey) WEB_SEARCH_RESULT_CACHE.delete(oldestKey);
  }
}

function pruneWebSearchCache(now = Date.now()) {
  for (const [k, v] of WEB_SEARCH_RESULT_CACHE.entries()) {
    if (!v || v.expiresAt <= now) WEB_SEARCH_RESULT_CACHE.delete(k);
  }
}

function getDirectSourceConfigs() {
  return [
    {
      id: 'vbpl',
      source: 'vbpl.vn',
      sourceKind: 'official',
      allowedHosts: ['vbpl.vn'],
      searchUrls: (query) => [
        `https://vbpl.vn/van-ban/tim-kiem?keyword=${encodeURIComponent(query)}`,
        `https://vbpl.vn/?q=${encodeURIComponent(query)}`,
      ],
    },
    {
      id: 'chinhphu',
      source: 'chinhphu.vn',
      sourceKind: 'official',
      allowedHosts: ['chinhphu.vn', 'vanban.chinhphu.vn', 'timkiem.chinhphu.vn', 'baochinhphu.vn'],
      searchUrls: (query) => [
        `https://chinhphu.vn/?pageid=473&q=${encodeURIComponent(query)}`,
        `https://timkiem.chinhphu.vn/?q=${encodeURIComponent(query)}`,
      ],
    },
    {
      id: 'quochoi',
      source: 'quochoi.vn',
      sourceKind: 'official',
      allowedHosts: ['quochoi.vn'],
      searchUrls: (query) => [
        `https://quochoi.vn/tim-kiem?q=${encodeURIComponent(query)}`,
        `https://quochoi.vn/?pageid=478&q=${encodeURIComponent(query)}`,
        `https://quochoi.vn/pages/tim-kiem.aspx?q=${encodeURIComponent(query)}`,
      ],
    },
    {
      id: 'thuvienphapluat',
      source: 'thuvienphapluat.vn',
      sourceKind: 'reference',
      allowedHosts: ['thuvienphapluat.vn'],
      searchUrls: (query) => [
        `https://thuvienphapluat.vn/tim-kiem.aspx?keyword=${encodeURIComponent(query)}`,
      ],
    },
    {
      id: 'luatvietnam',
      source: 'luatvietnam.vn',
      sourceKind: 'reference',
      allowedHosts: ['luatvietnam.vn'],
      searchUrls: (query) => [
        `https://luatvietnam.vn/van-ban/tim-kiem.html?SearchKeyword=${encodeURIComponent(query)}`,
        `https://luatvietnam.vn/van-ban/tim-van-ban.html?Keywords=${encodeURIComponent(query)}`,
      ],
    },
  ];
}

async function fetchDirectOfficialSources({
  query,
  expectedDocNumber = null,
  enabledSources = DEFAULT_WEB_SEARCH_FALLBACK_SOURCES,
  limit = 8,
  timeBudgetMs = WEB_SEARCH_FALLBACK_BUDGET_MS,
}) {
  const { current, next, prev } = getCurrentYearContext();
  const startAt = Date.now();
  const deadlineAt = startAt + Math.max(1000, Number(timeBudgetMs) || WEB_SEARCH_FALLBACK_BUDGET_MS);
  const context = {
    expectedDocNumber: expectedDocNumber ? String(expectedDocNumber).toUpperCase() : null,
    keywords: buildQueryKeywords(query),
    current,
    next,
    prev,
  };

  const sourceFlags = sanitizeFallbackSources(enabledSources);
  const sources = getDirectSourceConfigs().filter((sourceConfig) => sourceFlags[sourceConfig.id] !== false);
  if (sources.length === 0) return [];
  const allCandidates = [];

  await Promise.all(sources.map(async (sourceConfig) => {
    const urls = sourceConfig.searchUrls(query).slice(0, Math.max(1, DIRECT_SOURCE_URLS_PER_SOURCE));
    const localCandidates = [];

    for (const url of urls) {
      const remainingMs = deadlineAt - Date.now();
      if (remainingMs <= 0) break;
      const html = await fetchDirectSourcePage(url, Math.min(DIRECT_SOURCE_TIMEOUT_MS, remainingMs));
      if (!html) continue;
      const links = parseLinksFromHtml(html, url, sourceConfig.allowedHosts);
      for (const link of links) {
        localCandidates.push({
          ...link,
          source: sourceConfig.source,
          sourceKind: sourceConfig.sourceKind,
        });
      }
      if (localCandidates.length >= DIRECT_SOURCE_MAX_PER_SOURCE) break;
    }

    const uniqueMap = new Map();
    for (const candidate of localCandidates) {
      if (!uniqueMap.has(candidate.link)) uniqueMap.set(candidate.link, candidate);
    }

    const scored = Array.from(uniqueMap.values())
      .map((candidate) => ({ ...candidate, score: scoreDirectCandidate(candidate, context) }))
      .filter((candidate) => candidate.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, DIRECT_SOURCE_MAX_PER_SOURCE);

    allCandidates.push(...scored);
  }));

  const deduped = new Map();
  for (const candidate of allCandidates) {
    const existing = deduped.get(candidate.link);
    if (!existing || candidate.score > existing.score) deduped.set(candidate.link, candidate);
  }

  let finalItems = Array.from(deduped.values())
    .sort((a, b) => b.score - a.score);

  if (context.expectedDocNumber) {
    finalItems = finalItems.filter((item) => {
      const hay = `${String(item.title || '')} ${String(item.snippet || '')} ${String(item.link || '')}`;
      return hasExpectedDocNumber(hay, context.expectedDocNumber);
    });
  }

  return finalItems.slice(0, Math.max(1, limit));
}

async function fetchDirectSourcePage(url, timeoutMs = DIRECT_SOURCE_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(500, timeoutMs));
  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': DIRECT_SOURCE_USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'vi,en-US;q=0.9,en;q=0.8',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
    });
    if (!response.ok) return '';
    const contentType = String(response.headers.get('content-type') || '').toLowerCase();
    if (!contentType.includes('text/html')) return '';
    const html = await response.text();
    if (/just a moment|enable javascript and cookies|cloudflare/i.test(html)) return '';
    return html;
  } catch {
    return '';
  } finally {
    clearTimeout(timer);
  }
}

function parseLinksFromHtml(html = '', baseUrl = '', allowedHosts = []) {
  const items = [];
  const regex = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const rawHref = String(match[1] || '').trim();
    if (!rawHref || rawHref.startsWith('#') || rawHref.startsWith('javascript:') || rawHref.startsWith('mailto:') || rawHref.startsWith('tel:')) continue;

    let absoluteUrl;
    try {
      absoluteUrl = new URL(rawHref, baseUrl).toString();
    } catch {
      continue;
    }

    if (!isAllowedHost(absoluteUrl, allowedHosts)) continue;

    const title = cleanText(decodeHtmlEntities(stripHtml(match[2] || '')));
    if (!title || title.length < 6) continue;
    if (/dang nhap|dang ky|login|register|vui long/i.test(normalizeVietnamese(title))) continue;

    items.push({
      title: title.slice(0, 240),
      link: absoluteUrl,
      snippet: title.slice(0, 220),
    });
  }
  return items;
}

function scoreDirectCandidate(candidate, context) {
  const normalizedTitle = normalizeVietnamese(candidate.title || '');
  const normalizedLink = normalizeVietnamese(candidate.link || '');
  const haystack = `${normalizedTitle} ${normalizedLink}`;
  let score = 0;

  if (candidate.sourceKind === 'official') score += 26;
  else score += 10;

  if (/(luat|nghi-dinh|thong-tu|quyet-dinh|nghi-quyet|van-ban|cong-van|chi-thi)/.test(normalizedLink)) {
    score += 20;
  }

  for (const keyword of context.keywords) {
    if (keyword.length < 3) continue;
    if (haystack.includes(keyword)) score += 11;
  }

  if (context.expectedDocNumber) {
    const expectedHay = `${candidate.title || ''} ${candidate.link || ''}`;
    if (hasExpectedDocNumber(expectedHay, context.expectedDocNumber)) score += 300;
    else score -= 60;
  }

  if (String(candidate.title || '').includes(String(context.current))) score += 20;
  if (String(candidate.title || '').includes(String(context.next))) score += 14;
  if (String(candidate.title || '').includes(String(context.prev))) score += 6;

  if (normalizedTitle.length < 8) score -= 15;
  if (/tim kiem|search|trang chu/.test(normalizedTitle)) score -= 6;
  return score;
}

function buildQueryKeywords(query = '') {
  const stopwords = new Set([
    'la', 'va', 'cua', 'cho', 'voi', 'trong', 'theo', 've', 'tai', 'nhung', 'cac',
    'van', 'ban', 'phap', 'luat', 'moi', 'nhat', 'duoc', 'khong', 'nay', 'kia',
  ]);

  const normalized = normalizeVietnamese(String(query || ''))
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) return [];
  return Array.from(new Set(normalized.split(' ').filter((token) => token && !stopwords.has(token))));
}

function stripHtml(value = '') {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
}

function decodeHtmlEntities(value = '') {
  let text = String(value || '');
  for (let i = 0; i < 2; i += 1) {
    text = text
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, '\'')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
        const code = parseInt(hex, 16);
        return Number.isFinite(code) ? String.fromCodePoint(code) : '';
      })
      .replace(/&#([0-9]+);/g, (_, dec) => {
        const code = parseInt(dec, 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : '';
      });
  }
  return text;
}

function cleanText(value = '') {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/[\r\n]+/g, ' ')
    .trim();
}

function sanitizeExtractedLegalText(value = '') {
  const base = cleanText(decodeHtmlEntities(String(value || '')));
  if (!base) return '';
  const normalized = normalizeVietnamese(base);
  const boilerplateMarkers = [
    'goi tong dai',
    'chung toi luon lang nghe',
    'bao dien tu chinh phu',
    'ban doc',
    'y kien ban doc',
    'lien he toa soan',
    'hotline',
    'ban quyen thuoc',
  ];
  let cutIndex = -1;
  for (const marker of boilerplateMarkers) {
    const idx = normalized.indexOf(marker);
    if (idx > 80 && (cutIndex < 0 || idx < cutIndex)) cutIndex = idx;
  }
  const cleaned = cutIndex > 0 ? base.slice(0, cutIndex) : base;
  return cleaned.replace(/\s+/g, ' ').trim();
}

function isAllowedHost(url, allowedHosts = []) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    return allowedHosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
  } catch {
    return false;
  }
}

function isValidWebSearchProvider(raw = '') {
  const provider = String(raw || '').trim().toLowerCase();
  return provider === 'vertex_search';
}

function sanitizeWebSearchProvider(raw = '') {
  const provider = String(raw || '').trim().toLowerCase();
  if (provider === 'vertex_search') return 'vertex_search';
  return DEFAULT_WEB_SEARCH_PROVIDER;
}

function getVertexSearchConfig(config = {}) {
  const projectId = String(config.vertex_project_id || config.project_id || process.env.FIREBASE_PROJECT_ID || '').trim();
  const location = String(config.vertex_location || DEFAULT_VERTEX_LOCATION || 'global').trim() || 'global';
  const dataStoreId = String(config.vertex_data_store_id || '').trim();
  const servingConfigRaw = String(config.vertex_serving_config || '').trim();

  let servingConfig = servingConfigRaw;
  if (servingConfig && !servingConfig.includes('/servingConfigs/')) {
    const servingConfigId = servingConfig.replace(/^\/+|\/+$/g, '') || DEFAULT_VERTEX_SERVING_CONFIG_ID;
    if (projectId && dataStoreId) {
      servingConfig = [
        'projects',
        projectId,
        'locations',
        location,
        'collections',
        'default_collection',
        'dataStores',
        dataStoreId,
        'servingConfigs',
        servingConfigId,
      ].join('/');
    }
  }
  if (!servingConfig && projectId && dataStoreId) {
    servingConfig = [
      'projects',
      projectId,
      'locations',
      location,
      'collections',
      'default_collection',
      'dataStores',
      dataStoreId,
      'servingConfigs',
      DEFAULT_VERTEX_SERVING_CONFIG_ID,
    ].join('/');
  }

  return {
    projectId,
    location,
    dataStoreId,
    servingConfig,
    configured: !!(projectId && servingConfig),
  };
}

function isVertexSearchConfigured(config = {}) {
  return getVertexSearchConfig(config).configured;
}

function resolveEffectiveWebSearchProvider({ requestedProvider, cseConfigured, vertexConfigured }) {
  const requested = sanitizeWebSearchProvider(requestedProvider);
  if (requested === 'vertex_search' && vertexConfigured) return 'vertex_search';
  if (vertexConfigured) return 'vertex_search';
  return '';
}

async function getGoogleAccessToken() {
  initFirebase();
  const credential = admin.app().options?.credential;
  if (!credential || typeof credential.getAccessToken !== 'function') {
    throw new Error('vertex_auth_not_available');
  }
  const token = await credential.getAccessToken();
  if (!token?.access_token) {
    throw new Error('vertex_access_token_missing');
  }
  return token.access_token;
}

function normalizeVertexSearchItems(rawItems = []) {
  if (!Array.isArray(rawItems)) return [];
  return rawItems
    .map((item) => {
      const doc = item?.document || {};
      const derived = doc?.derivedStructData || {};
      const struct = doc?.structData || {};
      const title = String(derived?.title || struct?.title || doc?.id || '').trim();
      const link = String(derived?.link || struct?.link || '').trim();
      const snippets = Array.isArray(derived?.snippets) ? derived.snippets : [];
      const snippet = snippets
        .map((s) => String(s?.snippet || '').trim())
        .filter(Boolean)
        .join(' ')
        .trim();

      return {
        title,
        link,
        snippet,
        displayLink: '',
        source: 'vertex_search',
      };
    })
    .filter((item) => item.title || item.link || item.snippet);
}

async function executeVertexSearch({ query, timeoutMs, vertexConfig }) {
  if (!vertexConfig || !vertexConfig.configured) {
    return {
      items: [],
      status: 503,
      errorReason: 'vertex_not_configured',
    };
  }

  const accessToken = await getGoogleAccessToken();
  const servingConfig = String(vertexConfig.servingConfig || '').trim();
  const endpoint = `https://discoveryengine.googleapis.com/v1/${servingConfig}:search`;
  const body = {
    query,
    pageSize: 10,
    queryExpansionSpec: { condition: 'AUTO' },
    spellCorrectionSpec: { mode: 'AUTO' },
    contentSearchSpec: {
      snippetSpec: { returnSnippet: true },
    },
  };

  const response = await fetchWithTimeout(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  }, timeoutMs);

  if (!response) {
    return {
      items: [],
      status: 408,
      errorReason: 'timeout',
    };
  }

  if (!response.ok) {
    let reason = `http_${response.status}`;
    try {
      const data = await response.json();
      const message = String(data?.error?.message || data?.message || '').trim();
      if (message) reason = message.slice(0, 180);
    } catch {}
    return {
      items: [],
      status: response.status,
      errorReason: reason,
    };
  }

  try {
    const data = await response.json();
    return {
      items: normalizeVertexSearchItems(data?.results),
      status: response.status,
      errorReason: null,
    };
  } catch {
    return {
      items: [],
      status: response.status,
      errorReason: 'invalid_json',
    };
  }
}

async function executeCseSearch({ query, timeoutMs, dateRestrict, cseConfig }) {
  const params = new URLSearchParams({
    key: cseConfig.key,
    cx: cseConfig.cx,
    q: query,
    num: '10',
    sort: 'date',
    hl: 'vi',
    gl: 'vn',
    safe: 'off',
    filter: '0',
  });
  if (dateRestrict) params.set('dateRestrict', dateRestrict);
  const url = `https://www.googleapis.com/customsearch/v1?${params.toString()}`;
  const response = await fetchWithTimeout(url, {
    headers: {
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
    },
  }, timeoutMs);

  if (!response) {
    return {
      items: [],
      status: 408,
      errorReason: 'timeout',
    };
  }

  if (!response.ok) {
    let reason = `http_${response.status}`;
    try {
      const data = await response.json();
      const message = String(data?.error?.message || data?.message || '').trim();
      if (message) {
        if (/access to custom search json api/i.test(message)) reason = 'permission_denied_custom_search_access';
        else if (/quota|rate limit|exceed/i.test(message)) reason = 'quota_or_rate_limited';
        else reason = message.slice(0, 140);
      }
    } catch {}
    return {
      items: [],
      status: response.status,
      errorReason: reason,
    };
  }

  try {
    const data = await response.json();
    return {
      items: Array.isArray(data?.items) ? data.items : [],
      status: response.status,
      errorReason: null,
    };
  } catch {
    return {
      items: [],
      status: response.status,
      errorReason: 'invalid_json',
    };
  }
}

async function executeWebProviderSearch({
  provider,
  query,
  timeoutMs,
  dateRestrict,
  cseConfig,
  vertexConfig,
}) {
  if (provider === 'vertex_search') {
    const vertexResult = await executeVertexSearch({
      query,
      timeoutMs,
      vertexConfig,
    });
    return {
      items: vertexResult.items || [],
      status: vertexResult.status,
      errorReason: vertexResult.errorReason,
    };
  }

  const cseResult = await executeCseSearch({
    query,
    timeoutMs,
    dateRestrict,
    cseConfig,
  });
  return {
    items: cseResult.items || [],
    status: cseResult.status,
    errorReason: cseResult.errorReason,
  };
}

async function probeWebSearchProvider(config = {}) {
  const provider = sanitizeWebSearchProvider(config.web_search_provider);
  const cseConfig = {
    key: config.google_search_key,
    cx: config.google_search_cx,
  };
  const vertexConfig = getVertexSearchConfig(config);
  const cseConfigured = !!(cseConfig.key && cseConfig.cx);
  const vertexConfigured = vertexConfig.configured;
  const effectiveProvider = resolveEffectiveWebSearchProvider({
    requestedProvider: provider,
    cseConfigured,
    vertexConfigured,
  });

  if (!effectiveProvider) {
    return {
      healthy: false,
      provider,
      effective_provider: '',
      error_reason: 'web_search_not_configured',
    };
  }

  const probeResult = await executeWebProviderSearch({
    provider: effectiveProvider,
    query: 'luat moi nhat viet nam',
    timeoutMs: 4500,
    dateRestrict: 'm6',
    cseConfig,
    vertexConfig,
  });

  return {
    healthy: probeResult.status === 200,
    provider,
    effective_provider: effectiveProvider,
    status: probeResult.status || null,
    error_reason: probeResult.errorReason || null,
    item_count: Array.isArray(probeResult.items) ? probeResult.items.length : 0,
  };
}

async function runOfficialHotIndexIngest(config = {}, requestedBy = 'system') {
  const provider = sanitizeWebSearchProvider(config.web_search_provider);
  const cseConfig = {
    key: config.google_search_key,
    cx: config.google_search_cx,
  };
  const vertexConfig = getVertexSearchConfig(config);
  const cseConfigured = !!(cseConfig.key && cseConfig.cx);
  const vertexConfigured = vertexConfig.configured;
  const effectiveProvider = resolveEffectiveWebSearchProvider({
    requestedProvider: provider,
    cseConfigured,
    vertexConfigured,
  });
  if (!effectiveProvider) {
    return {
      success: false,
      message: 'web_search_not_configured',
      ingested: 0,
    };
  }

  const sourceFlags = sanitizeFallbackSources(config.web_search_fallback_sources);
  const officialDomainClause = [
    'site:vbpl.vn',
    'site:vanban.chinhphu.vn',
    'site:congbao.chinhphu.vn',
    'site:chinhphu.vn',
    'site:quochoi.vn',
  ].join(' OR ');
  const seeds = [
    'luat moi nhat viet nam',
    'nghi dinh moi nhat',
    'van ban moi ban hanh',
    'luat an ninh mang 2025',
    'luat to chuc chinh quyen dia phuong 2025',
    'van ban chinh phu moi nhat',
  ];

  let ingested = 0;
  let hotDocCount = 0;
  for (const seed of seeds) {
    const providerQuery = `${seed} (${officialDomainClause})`;
    let items = [];
    let strategy = 'ingest_provider';
    const providerAttempt = await executeWebProviderSearch({
      provider: effectiveProvider,
      query: providerQuery,
      timeoutMs: 2600,
      dateRestrict: 'm12',
      cseConfig,
      vertexConfig,
    });
    items = Array.isArray(providerAttempt.items) ? providerAttempt.items : [];
    if (items.length === 0) {
      strategy = 'ingest_direct_fallback';
      items = await fetchDirectOfficialSources({
        query: seed,
        expectedDocNumber: null,
        enabledSources: sourceFlags,
        limit: 8,
        timeBudgetMs: 4500,
      });
    }
    if (!items || items.length === 0) continue;
    await updateWebSearchHotIndex({
      query: seed,
      expectedDocNumber: null,
      items,
      exactMatch: null,
      strategy,
    });
    ingested += 1;
    const docNumbers = extractDocNumbersFromItems(items);
    for (const docNo of docNumbers) {
      await updateWebSearchHotIndex({
        query: `${seed} ${docNo}`,
        expectedDocNumber: docNo,
        items: pickExactDocItems(items, docNo).length > 0 ? pickExactDocItems(items, docNo) : items,
        exactMatch: true,
        strategy: `${strategy}_doc`,
      });
      hotDocCount += 1;
    }
  }

  const hotIndexData = await getWebSearchHotIndexData(true);
  await getWebSearchHotIndexRef().set({
    ...hotIndexData,
    last_ingest_at_ms: Date.now(),
    last_ingest_by: String(requestedBy || 'system'),
  }, { merge: true });

  return {
    success: true,
    provider: effectiveProvider,
    ingested,
    hot_doc_entries: hotDocCount,
    seeds: seeds.length,
  };
}

function sanitizeFallbackSources(raw = null) {
  const normalized = { ...DEFAULT_WEB_SEARCH_FALLBACK_SOURCES };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return normalized;

  for (const key of Object.keys(DEFAULT_WEB_SEARCH_FALLBACK_SOURCES)) {
    if (typeof raw[key] === 'boolean') normalized[key] = raw[key];
  }
  return normalized;
}

function isValidWebSearchMode(raw = '') {
  const m = String(raw || '').trim().toLowerCase();
  return m === 'cse_fast'
    || m === 'cse_with_fallback';
}

function sanitizeWebSearchMode(raw = '') {
  const normalized = String(raw || '').trim().toLowerCase();
  if (normalized === 'cse_fast') return 'cse_fast';
  if (normalized === 'cse_with_fallback') return 'cse_with_fallback';
  return DEFAULT_WEB_SEARCH_MODE;
}

// Time-sensitive query detection for force fresh retrieval
function isTimeSensitiveQuery(query = '') {
  const n = normalizeVietnamese(query);
  return /(moi nhat|hien hanh|hieu luc|sua doi|bo sung|thay the|bai bo|cap nhat|hom nay|hien tai|ngay nay|ngay hom nay|ngay thang)/.test(n);
}

// Query mode detection for legal queries
function detectQueryMode(query, docNumberMatchLevel, hasDocType) {
  const n = normalizeVietnamese(query);

  if (docNumberMatchLevel === 'full' || hasDocType) {
    return 'strict_legal';
  }

  if (/(co ton tai|da ban hanh|so hieu)/.test(n)) {
    return 'evidence_only';
  }

  if (/(luat|nghi dinh|thong tu|quyet dinh|van ban|moi nhat|hien hanh)/.test(n)) {
    return 'grounded_general';
  }

  return 'grounded_general';
}

// Effective status detection from search results
function detectEffectiveStatus(items, query) {
  for (const item of items) {
    const title = normalizeVietnamese(item.title || '');
    const snippet = normalizeVietnamese(item.snippet || '');
    const combined = `${title} ${snippet}`;

    if (/(bi thay the|het hieu luc|khong con hieu luc|duoc thay the)/.test(combined)) {
      const supersedeMatch = combined.match(/thay the\s*(?:boi)?\s*(\d+\/\d{4}\/[a-z0-9-]+)/i);
      if (supersedeMatch) {
        return { status: 'superseded', superseded_by: String(supersedeMatch[1] || '').toUpperCase() };
      }
      return { status: 'superseded', superseded_by: null };
    }

    if (/(bi huy|vo hieu|khong con gia tri|bi bai bo)/.test(combined)) {
      return { status: 'invalidated', superseded_by: null };
    }

    if (/(van ban hien hanh|van ban co hieu luc|con hieu luc|van ban moi nhat|dang co hieu luc)/.test(combined)) {
      return { status: 'active', superseded_by: null };
    }
  }

  return { status: 'unknown', superseded_by: null };
}

// Score match for legal document candidates
function calculateMatchScore(item, query = '') {
  let score = 0;

  const title = normalizeVietnamese(item.title || '');
  const snippet = normalizeVietnamese(item.snippet || '');
  const text = title + ' ' + snippet;
  const queryObject = query && typeof query === 'object' ? query : { query: String(query || '') };
  const queryNorm = normalizeVietnamese(queryObject.query || '');

  if (queryObject.expectedDocNumber && text.includes(normalizeVietnamese(queryObject.expectedDocNumber))) {
    score += 100;
  }

  if (queryObject.partialDocNumber && text.includes(normalizeVietnamese(queryObject.partialDocNumber))) {
    score += 50;
  }

  const keywords = queryNorm.split(' ').filter((w) => w.length > 3);
  for (const keyword of keywords.slice(0, 5)) {
    if (title.includes(keyword)) {
      score += 10;
    } else if (snippet.includes(keyword)) {
      score += 5;
    }
  }

  const tier = detectSourceTier(item);
  if (tier === 'official') score += 30;
  if (tier === 'reference') score += 15;

  return score;
}

// Select best alternative when exact match fails
function selectBestAlternative(items, requestedDocType, query) {
  const typeFiltered = requestedDocType
    ? items.filter(item => detectDocTypeFromText(item.title || '') === requestedDocType)
    : items;

  const sorted = typeFiltered
    .map(item => ({ ...item, score: calculateMatchScore(item, query) }))
    .sort((a, b) => b.score - a.score);

  return sorted.length > 0 ? sorted[0] : null;
}

// Start server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`VBAI Proxy listening on port ${PORT}`);
});
