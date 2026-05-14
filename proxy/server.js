/**
 * VBAI Cloud Run Proxy Service
 *
 * Provides secure, authenticated endpoints for:
 * - Chat completions (OpenAI/Gemini)
 * - Audio transcription (Whisper/Gemini)
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

const DIRECT_SOURCE_TIMEOUT_MS = Number(process.env.DIRECT_SOURCE_TIMEOUT_MS || '4500');
const DIRECT_SOURCE_MAX_PER_SOURCE = Number(process.env.DIRECT_SOURCE_MAX_PER_SOURCE || '8');
const DIRECT_SOURCE_URLS_PER_SOURCE = Number(process.env.DIRECT_SOURCE_URLS_PER_SOURCE || '2');
const WEB_SEARCH_CSE_TIMEOUT_MS = Number(process.env.WEB_SEARCH_CSE_TIMEOUT_MS || '6000');
const WEB_SEARCH_CSE_TOTAL_BUDGET_MS = Number(process.env.WEB_SEARCH_CSE_TOTAL_BUDGET_MS || '9000');
const WEB_SEARCH_FALLBACK_BUDGET_MS = Number(process.env.WEB_SEARCH_FALLBACK_BUDGET_MS || '12000');
const WEB_SEARCH_FAST_PRIMARY_TOTAL_BUDGET_MS = Number(process.env.WEB_SEARCH_FAST_PRIMARY_TOTAL_BUDGET_MS || '5200');
const WEB_SEARCH_FAST_PRIMARY_PROVIDER_TIMEOUT_MS = Number(process.env.WEB_SEARCH_FAST_PRIMARY_PROVIDER_TIMEOUT_MS || '2600');
const WEB_SEARCH_FAST_PRIMARY_FALLBACK_BUDGET_MS = Number(process.env.WEB_SEARCH_FAST_PRIMARY_FALLBACK_BUDGET_MS || '2800');
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
const DEFAULT_WEB_SEARCH_MODE = 'fast_primary';
const DEFAULT_WEB_SEARCH_PROVIDER = 'cse';
const WEB_SEARCH_RESULT_CACHE = new Map();

function normalizeVietnamese(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
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
    const snap = await getSystemConfigRef().get();
    if (!snap.exists) {
      return res.status(404).json({ error: 'System config not found' });
    }
    const data = snap.data();
    // Return masked version (do not send full API keys)
    const fallbackSources = sanitizeFallbackSources(data.web_search_fallback_sources);
    const webSearchMode = sanitizeWebSearchMode(data.web_search_mode);
    const webSearchProvider = sanitizeWebSearchProvider(data.web_search_provider);
    res.json({
      active_provider: data.active_provider || 'openai',
      router_model: data.router_model || 'gpt-4o-mini',
      gemini_model: data.gemini_model || 'gemini-1.5-flash',
      openai_endpoint: data.openai_endpoint || 'https://api.openai.com/v1',
      gemini_endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai',
      google_search_configured: !!((data.google_search_key && data.google_search_cx) || (data.vertex_project_id && data.vertex_data_store_id)),
      has_openai_key: !!data.openai_api_key,
      has_gemini_key: !!data.gemini_api_key,
      transcribe_model: data.transcribe_model || (data.active_provider === 'gemini' ? data.gemini_model : 'whisper-1'),
      openai_models: Array.isArray(data.openai_models) ? data.openai_models : [],
      gemini_models: Array.isArray(data.gemini_models) ? data.gemini_models : [],
      web_search_provider: webSearchProvider,
      web_search_mode: webSearchMode,
      web_search_fallback_sources: fallbackSources,
      vertex_project_id: data.vertex_project_id || '',
      vertex_location: data.vertex_location || 'global',
      vertex_data_store_id: data.vertex_data_store_id || '',
      vertex_serving_config: data.vertex_serving_config || '',
      updated_at: data.updated_at?.toDate ? data.updated_at.toDate().toISOString() : data.updated_at,
      updated_by: data.updated_by
    });
  } catch (err) {
    console.error('GET /api/system-config-summary error:', err);
    res.status(401).json({ error: 'Unauthorized', message: err.message });
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
      active_provider,
      openai_api_key,
      openai_endpoint,
      router_model,
      gemini_api_key,
      gemini_model,
      google_search_key,
      google_search_cx,
      web_search_provider,
      web_search_mode,
      web_search_fallback_sources,
      vertex_project_id,
      vertex_location,
      vertex_data_store_id,
      vertex_serving_config,
      transcribe_model,
      openai_models,
      gemini_models
    } = req.body;

    // Validate allowed values
    const validProvider = active_provider === 'openai' || active_provider === 'gemini';
    if (!validProvider && active_provider !== undefined) {
      return res.status(400).json({ error: 'Invalid provider' });
    }
    if (web_search_mode !== undefined && !isValidWebSearchMode(web_search_mode)) {
      return res.status(400).json({ error: 'Invalid web_search_mode' });
    }
    if (web_search_provider !== undefined && !isValidWebSearchProvider(web_search_provider)) {
      return res.status(400).json({ error: 'Invalid web_search_provider' });
    }

    const updateData = {
      active_provider: active_provider || 'openai',
      router_model: router_model || 'gpt-4o-mini',
      gemini_model: gemini_model || 'gemini-1.5-flash',
      openai_endpoint: String(openai_endpoint || 'https://api.openai.com/v1').replace(/\/+$/, ''),
      transcribe_model: transcribe_model || 'whisper-1',
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_by: decoded.email || decoded.uid
    };

    // Only update keys if provided (non-empty)
    if (openai_api_key && openai_api_key.trim()) {
      updateData.openai_api_key = openai_api_key.trim();
    }
    if (gemini_api_key && gemini_api_key.trim()) {
      updateData.gemini_api_key = gemini_api_key.trim();
    }
    if (google_search_key && google_search_key.trim()) {
      updateData.google_search_key = google_search_key.trim();
    }
    if (google_search_cx && google_search_cx.trim()) {
      updateData.google_search_cx = google_search_cx.trim();
    }
    // Update model lists (always overwrite)
    if (Array.isArray(openai_models)) {
      updateData.openai_models = openai_models.filter(m => typeof m === 'string' && m.trim()).map(m => m.trim());
    }
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
    if (vertex_project_id !== undefined && String(vertex_project_id || '').trim()) {
      updateData.vertex_project_id = String(vertex_project_id || '').trim();
    }
    if (vertex_location !== undefined && String(vertex_location || '').trim()) {
      updateData.vertex_location = String(vertex_location || '').trim();
    }
    if (vertex_data_store_id !== undefined && String(vertex_data_store_id || '').trim()) {
      updateData.vertex_data_store_id = String(vertex_data_store_id || '').trim();
    }
    if (vertex_serving_config !== undefined && String(vertex_serving_config || '').trim()) {
      updateData.vertex_serving_config = String(vertex_serving_config || '').trim();
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

    const provider = config.active_provider || 'openai';
    const isVertexGemini = (provider === 'vertex') || (provider === 'gemini' && String(config.gemini_endpoint || '').includes('aiplatform.googleapis.com'));

    const endpoint = String(provider === 'gemini'
      ? config.gemini_endpoint || 'https://generativelanguage.googleapis.com/v1beta/openai'
      : (config.openai_endpoint || 'https://api.openai.com/v1')).replace(/\/+$/, '');
    const apiKey = provider === 'gemini' ? config.gemini_api_key : config.openai_api_key;
    const effectiveModel = model || ((provider === 'gemini' || provider === 'vertex') ? config.gemini_model : config.router_model);

    if (!apiKey && !isVertexGemini) {
      return res.status(503).json({ error: 'API key missing', message: 'Please contact administrator to configure AI provider key.' });
    }

    // Native Vertex AI Gemini Path
    if (isVertexGemini) {
      try {
        const vertexResult = await executeVertexGeminiChat({
          messages,
          model: effectiveModel,
          temperature,
          max_tokens,
          vertexConfig: buildVertexSearchConfig(config)
        });
        return res.json(vertexResult);
      } catch (err) {
        return res.status(500).json({ error: 'Vertex AI Gemini error', message: err.message });
      }
    }

    // Build provider request
    const payload = {
      model: effectiveModel,
      messages: messages,
      stream: false, // TODO: implement streaming if needed
      temperature: temperature,
      ...(max_tokens && { max_tokens })
    };

    // For OpenAI reasoning models (o1, o3-mini), adjust payload
    const m = String(effectiveModel || '').toLowerCase();
    if (m.includes('o1') || m.includes('o3')) {
      delete payload.temperature;
      if (payload.max_tokens) {
        payload.max_completion_tokens = payload.max_tokens;
        delete payload.max_tokens;
      }
    }

    // Make request to provider
    const providerRes = await fetch(`${endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        ...(provider === 'gemini' && { 'x-goog-api-key': apiKey })
      },
      body: JSON.stringify(payload)
    });

    if (!providerRes.ok) {
      let errorMsg = `Provider error ${providerRes.status}`;
      try {
        const errBody = await providerRes.json();
        errorMsg = errBody.error?.message || errBody.message || errorMsg;
      } catch (e) {}
      return res.status(providerRes.status).json({ error: 'Provider request failed', message: errorMsg });
    }

    const data = await providerRes.json();
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

    const provider = config.active_provider || 'openai';
    const endpoint = provider === 'gemini'
      ? config.gemini_endpoint || 'https://generativelanguage.googleapis.com/v1beta/openai'
      : (config.openai_endpoint || 'https://api.openai.com/v1');
    const apiKey = provider === 'gemini' ? config.gemini_api_key : config.openai_api_key;
    const effectiveModel = model || config.transcribe_model || (provider === 'gemini' ? config.gemini_model : 'whisper-1');

    if (!apiKey) {
      return res.status(503).json({ error: 'API key missing' });
    }

    // Build multipart/form-data for provider without lossy string conversion.
    const formData = new FormData();
    const audioBlob = new Blob([audioBuffer], { type: detectedMimeType });
    formData.append('file', audioBlob, effectiveFilename);
    formData.append('model', effectiveModel);

    const providerRes = await fetch(`${endpoint}/audio/transcriptions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        ...(provider === 'gemini' && { 'x-goog-api-key': apiKey }),
      },
      body: formData
    });

    if (!providerRes.ok) {
      let errorMsg = `Provider error ${providerRes.status}`;
      try {
        const errBody = await providerRes.json();
        errorMsg = errBody.error?.message || errBody.message || errorMsg;
      } catch (e) {}
      return res.status(providerRes.status).json({ error: 'Transcription failed', message: errorMsg });
    }

    const data = await providerRes.json();
    res.json(data);
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
    const decoded = await verifyIdToken(req);

    const requestStartMs = Date.now();
    const { query, expectedDocNumber, forceFresh = false, freshnessLevel, recencyDays } = req.body;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'query required' });
    }

    // Fetch system config for Google Search credentials
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
    const vertexConfig = buildVertexSearchConfig(config);
    const cseConfigured = !!(cseConfig.key && cseConfig.cx);
    const vertexConfigured = isVertexSearchConfigured(vertexConfig);
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
    const cacheKey = buildWebSearchCacheKey({
      query,
      expectedDocNumber,
      forceFresh: forceFresh === true,
      freshnessLevel: normalizedFreshnessLevel,
      recencyDays: normalizedRecencyDays,
      webSearchProvider: effectiveSearchProvider,
      webSearchMode,
      fallbackSources,
    });
    const cachedPayload = forceFresh === true ? null : getWebSearchCache(cacheKey);
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

    if (forceFresh !== true) {
      const hotIndexHit = await findHotIndexHit({
        query,
        expectedDocNumber: expectedDocNumber || null,
      });
      if (hotIndexHit && Array.isArray(hotIndexHit.items) && hotIndexHit.items.length > 0) {
        return res.json({
          results: formatSearchResults(hotIndexHit.items),
          meta: buildWebSearchMeta({
            strategy: hotIndexHit.strategy || 'hot_index',
            webSearchProvider: effectiveSearchProvider,
            webSearchMode,
            query,
            refinedQuery: query,
            dateRestrict: null,
            expectedDocNumber: expectedDocNumber || null,
            exactMatch: hotIndexHit.exactMatch === true,
            cseStatus: null,
            cseErrorReason: null,
            fallbackUsed: false,
            enabledFallbackSources: fallbackSources,
            items: hotIndexHit.items,
            cacheHit: false,
            servedInMs: Date.now() - requestStartMs,
          }),
        });
      }
    }

    if (webSearchMode === 'vertex_answer' && effectiveSearchProvider === 'vertex_ai_search') {
      try {
        const answerResult = await executeVertexAnswer({
          query,
          vertexConfig,
          timeoutMs: 30000
        });
        return res.json({
          results: answerResult.answer,
          meta: buildWebSearchMeta({
            strategy: 'vertex_answer_api',
            webSearchProvider: effectiveSearchProvider,
            webSearchMode,
            query,
            refinedQuery: query,
            dateRestrict: null,
            expectedDocNumber: expectedDocNumber || null,
            exactMatch: true,
            cseStatus: null,
            cseErrorReason: null,
            fallbackUsed: false,
            enabledFallbackSources: fallbackSources,
            items: answerResult.citations,
            cacheHit: false,
            servedInMs: Date.now() - requestStartMs,
          }),
        });
      } catch (err) {
        console.warn('Vertex Answer API failed, falling back to standard search:', err.message);
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
      refinedQuery += ` mới nhất ${current} ${next}`;
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

    const runDirectFallback = async (docNumber = expectedDocNumber, fallbackQuery = refinedQuery) => {
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
    }) => {
      const responseResults = noExactMatch ? '__NO_EXACT_MATCH__' : formatSearchResults(items);
      diagnostics.fallback_used = fallbackUsed === true;
      const meta = buildWebSearchMeta({
        strategy,
        webSearchProvider: effectiveSearchProvider,
        webSearchMode,
        query,
        refinedQuery,
        dateRestrict,
        expectedDocNumber: expectedDocNumber || null,
        exactMatch,
        cseStatus: diagnostics.cse_status,
        cseErrorReason: diagnostics.cse_error_reason,
        fallbackUsed: diagnostics.fallback_used,
        enabledFallbackSources: fallbackSources,
        items,
        cacheHit: false,
        servedInMs: Date.now() - requestStartMs,
      });
      const payload = {
        results: responseResults,
        meta,
      };
      const shouldCache = forceFresh !== true && !noExactMatch && Array.isArray(items) && items.length > 0;
      if (shouldCache) setWebSearchCache(cacheKey, payload);
      if (shouldCache) {
        updateWebSearchHotIndex({
          query: refinedQuery || query,
          expectedDocNumber: expectedDocNumber || null,
          items,
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
      if (effectiveSearchProvider !== 'cse') return;
      if (!attemptResult) return;
      if (Number.isFinite(attemptResult.status)) diagnostics.cse_status = attemptResult.status;
      if (attemptResult.errorReason) diagnostics.cse_error_reason = attemptResult.errorReason;
    };

    const providerQuery = effectiveSearchProvider === 'vertex_ai_search'
      ? refinedQuery
      : `${refinedQuery} (${officialDomainClause})`;

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
      if (webSearchMode === 'google_only_fast') {
        return sendWebSearchResponse({
          strategy: diagnostics.cse_error_reason ? 'cse_error_fast' : 'cse_empty_fast',
          items: [],
          exactMatch: expectedDocNumber ? false : null,
        });
      }
      const directItems = await runDirectFallback();
      if (!directItems || directItems.length === 0) {
        return sendWebSearchResponse({
          strategy: webSearchMode === 'fast_primary' ? 'fast_primary_empty' : 'direct_fallback_empty',
          items: [],
          exactMatch: expectedDocNumber ? false : null,
          fallbackUsed: true,
        });
      }
      return sendWebSearchResponse({
        strategy: webSearchMode === 'fast_primary'
          ? (diagnostics.cse_error_reason ? 'fast_primary_cse_error_direct_fallback' : 'fast_primary_direct_fallback')
          : (diagnostics.cse_error_reason ? 'cse_error_direct_fallback' : 'direct_fallback'),
        items: directItems,
        exactMatch: expectedDocNumber ? true : null,
        fallbackUsed: true,
      });
    }

    // If an exact document number is expected, filter results to only those containing it.
    if (expectedDocNumber) {
      const exactItems = pickExactDocItems(items, expectedDocNumber);
      if (exactItems.length > 0) {
        return sendWebSearchResponse({
          strategy: `${cseStrategy}_exact_match`,
          items: exactItems,
          exactMatch: true,
        });
      }

      const targetedQueries = [
        `${expectedDocNumber} ${refinedQuery}`,
        `${expectedDocNumber} luat`,
        `${expectedDocNumber}`,
      ];
      for (const targetedQuery of targetedQueries) {
        if (getRemainingCseBudgetMs() <= 900) break;
        const targetedAttempt = await executeSearch(
          targetedQuery,
          Math.min(searchBudgets.providerTimeoutMs, getRemainingCseBudgetMs()),
        );
        captureCseDiagnostic(targetedAttempt);
        const targetedExactItems = pickExactDocItems(targetedAttempt.items || [], expectedDocNumber);
        if (targetedExactItems.length > 0) {
          return sendWebSearchResponse({
            strategy: `${cseStrategy}_targeted_exact_match`,
            items: targetedExactItems,
            exactMatch: true,
          });
        }
      }

      if (webSearchMode === 'google_only_fast') {
        return sendWebSearchResponse({
          strategy: 'no_exact_match',
          items: [],
          exactMatch: false,
          noExactMatch: true,
        });
      }

      const directExactItems = await runDirectFallback(expectedDocNumber, `${expectedDocNumber} ${refinedQuery}`);
      if (!directExactItems || directExactItems.length === 0) {
        return sendWebSearchResponse({
          strategy: 'no_exact_match',
          items: [],
          exactMatch: false,
          noExactMatch: true,
          fallbackUsed: true,
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

    const plain = cleanStrictText(decodeHtmlEntities(stripHtml(html)));
    if (!plain) return res.json({ text: '', extracted: false, strict_match: false });

    const strictEnabled = strict === true;
    const strictTarget = {
      article: target_article,
      clause: target_clause,
      point: target_point,
    };
    const strictResult = extractStrictLegalText(plain, strictTarget);
    if (strictEnabled) {
      return res.json({
        text: strictResult.text || '',
        extracted: strictResult.extracted === true,
        strict_match: strictResult.strict_match === true,
        article_found: strictResult.article_found,
        clause_found: strictResult.clause_found,
        point_found: strictResult.point_found,
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
        text: plain.slice(0, 1200),
        extracted: false,
        strict_match: strictResult.strict_match === true,
        article_found: strictResult.article_found,
        clause_found: strictResult.clause_found,
        point_found: strictResult.point_found,
      });
    }

    const snippetStart = Math.max(0, bestStart - 240);
    const snippetEnd = Math.min(plain.length, bestStart + 1600);
    return res.json({
      text: plain.slice(snippetStart, snippetEnd),
      extracted: true,
      keyword: bestKeyword,
      strict_match: strictResult.strict_match === true,
      article_found: strictResult.article_found,
      clause_found: strictResult.clause_found,
      point_found: strictResult.point_found,
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
  if (normalizedMode === 'fast_primary') {
    return {
      providerTotalMs: WEB_SEARCH_FAST_PRIMARY_TOTAL_BUDGET_MS,
      providerTimeoutMs: WEB_SEARCH_FAST_PRIMARY_PROVIDER_TIMEOUT_MS,
      fallbackBudgetMs: WEB_SEARCH_FAST_PRIMARY_FALLBACK_BUDGET_MS,
      useTrustedStage: false,
      useBroadStage: true,
    };
  }
  return {
    providerTotalMs: WEB_SEARCH_CSE_TOTAL_BUDGET_MS,
    providerTimeoutMs: WEB_SEARCH_CSE_TIMEOUT_MS,
    fallbackBudgetMs: WEB_SEARCH_FALLBACK_BUDGET_MS,
    useTrustedStage: true,
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

function formatSearchResults(items = []) {
  return (items || [])
    .slice(0, 8)
    .map((item) => {
      const title = String(item?.title || 'No Title').replace(/[\r\n]+/g, ' ').trim();
      const link = String(item?.link || '#').trim();
      const snippetParts = [
        String(item?.snippet || '').replace(/[\r\n]+/g, ' ').trim(),
        item?.source ? `[Nguon truc tiep: ${item.source}]` : '',
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
  cacheHit = false,
  servedInMs = null,
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
    sources_used: collectSourcesUsed(items),
    item_count: Array.isArray(items) ? Math.min(8, items.length) : 0,
    cache_hit: cacheHit === true,
    served_in_ms: Number.isFinite(servedInMs) ? Math.max(0, Math.round(servedInMs)) : null,
    fetched_at: new Date().toISOString(),
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
  return String(value || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, '\'')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function cleanText(value = '') {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/[\r\n]+/g, ' ')
    .trim();
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
  return String(raw || '').trim().toLowerCase() === 'cse'
    || String(raw || '').trim().toLowerCase() === 'vertex_ai_search';
}

function sanitizeWebSearchProvider(raw = '') {
  const normalized = String(raw || '').trim().toLowerCase();
  if (normalized === 'vertex_ai_search') return 'vertex_ai_search';
  return DEFAULT_WEB_SEARCH_PROVIDER;
}

function buildVertexSearchConfig(config = {}) {
  return {
    projectId: String(config?.vertex_project_id || '').trim(),
    location: String(config?.vertex_location || 'global').trim() || 'global',
    dataStoreId: String(config?.vertex_data_store_id || '').trim(),
    servingConfig: String(config?.vertex_serving_config || '').trim(),
  };
}

function isVertexSearchConfigured(vertexConfig = {}) {
  if (!vertexConfig || typeof vertexConfig !== 'object') return false;
  if (vertexConfig.servingConfig) return true;
  return Boolean(vertexConfig.projectId && vertexConfig.location && vertexConfig.dataStoreId);
}

function buildVertexServingConfigPath(vertexConfig = {}) {
  const direct = String(vertexConfig?.servingConfig || '').trim();
  if (direct.startsWith('projects/')) return direct;
  if (!isVertexSearchConfigured(vertexConfig)) return '';
  return `projects/${vertexConfig.projectId}/locations/${vertexConfig.location}/collections/default_collection/dataStores/${vertexConfig.dataStoreId}/servingConfigs/default_serving_config`;
}

function resolveEffectiveWebSearchProvider({ requestedProvider, cseConfigured, vertexConfigured }) {
  const requested = sanitizeWebSearchProvider(requestedProvider);
  if (requested === 'vertex_ai_search') {
    if (vertexConfigured) return 'vertex_ai_search';
    if (cseConfigured) return 'cse';
    return '';
  }
  if (cseConfigured) return 'cse';
  if (vertexConfigured) return 'vertex_ai_search';
  return '';
}

async function fetchServiceAccountAccessToken(timeoutMs = 3000) {
  const response = await fetchWithTimeout(
    'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',
    {
      headers: {
        'Metadata-Flavor': 'Google',
      },
    },
    timeoutMs,
  );
  if (!response || !response.ok) return '';
  try {
    const data = await response.json();
    return String(data?.access_token || '');
  } catch {
    return '';
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

function mapVertexSearchResults(data = {}) {
  const rawResults = Array.isArray(data?.results) ? data.results : [];
  return rawResults
    .map((result) => {
      const document = result?.document || {};
      const structData = document?.structData || {};
      const derived = document?.derivedStructData || {};
      const title = cleanText(
        String(derived?.title || structData?.title || document?.title || ''),
      );
      const link = String(
        derived?.link
        || derived?.uri
        || structData?.link
        || structData?.uri
        || document?.name
        || '',
      ).trim();
      const snippet = cleanText(
        String(
          derived?.snippet
          || structData?.snippet
          || (Array.isArray(derived?.extractiveSegments) ? derived.extractiveSegments[0]?.content : '')
          || '',
        ),
      );
      if (!title || !link) return null;
      return { title, link, snippet };
    })
    .filter(Boolean);
}

async function executeVertexSearch({ query, timeoutMs, vertexConfig }) {
  const servingConfig = buildVertexServingConfigPath(vertexConfig);
  if (!servingConfig) {
    return {
      items: [],
      status: 503,
      errorReason: 'vertex_not_configured',
    };
  }
  const accessToken = await fetchServiceAccountAccessToken(Math.min(3000, timeoutMs));
  if (!accessToken) {
    return {
      items: [],
      status: 401,
      errorReason: 'vertex_auth_unavailable',
    };
  }

  const url = `https://discoveryengine.googleapis.com/v1/${servingConfig}:search`;
  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      pageSize: 10,
    }),
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
      if (message) reason = message.slice(0, 140);
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
      items: mapVertexSearchResults(data),
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
  const normalized = sanitizeWebSearchProvider(provider);
  if (normalized === 'vertex_ai_search') {
    const vertexResult = await executeVertexSearch({ query, timeoutMs, vertexConfig });
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
  const vertexConfig = buildVertexSearchConfig(config);
  const cseConfigured = !!(cseConfig.key && cseConfig.cx);
  const vertexConfigured = isVertexSearchConfigured(vertexConfig);
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
  const vertexConfig = buildVertexSearchConfig(config);
  const cseConfigured = !!(cseConfig.key && cseConfig.cx);
  const vertexConfigured = isVertexSearchConfigured(vertexConfig);
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
  return m === 'google_only_fast'
    || m === 'hybrid_fallback'
    || m === 'fast_primary'
    || m === 'vertex_answer';
}

function sanitizeWebSearchMode(raw = '') {
  const normalized = String(raw || '').trim().toLowerCase();
  if (normalized === 'fast_primary') return 'fast_primary';
  if (normalized === 'hybrid_fallback') return 'hybrid_fallback';
  if (normalized === 'vertex_answer') return 'vertex_answer';
  return DEFAULT_WEB_SEARCH_MODE;
}

async function executeVertexGeminiChat({ messages, model, temperature, max_tokens, vertexConfig }) {
  const accessToken = await fetchServiceAccountAccessToken(5000);
  if (!accessToken) throw new Error('Could not fetch service account token for Vertex AI');

  const projectId = vertexConfig.projectId;
  const location = vertexConfig.location || 'us-central1';
  const modelName = String(model || 'gemini-1.5-pro').trim();

  const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelName}:generateContent`;

  // Convert OpenAI messages to Vertex AI contents
  const contents = messages
    .filter(m => m.role !== 'system' && m.role !== 'developer')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

  const systemInstruction = messages.find(m => m.role === 'system' || m.role === 'developer')?.content;

  const payload = {
    contents,
    generationConfig: {
      temperature,
      maxOutputTokens: max_tokens || 2048,
    },
    ...(systemInstruction && { systemInstruction: { parts: [{ text: systemInstruction }] } })
  };

  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload)
  }, 60000);

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Vertex AI error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

  // Return OpenAI-compatible format for the frontend
  return {
    id: `chatcmpl-vertex-${Date.now()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: modelName,
    choices: [{
      index: 0,
      message: { role: 'assistant', content: text },
      finish_reason: 'stop'
    }]
  };
}

async function executeVertexAnswer({ query, vertexConfig, timeoutMs }) {
  const servingConfig = buildVertexServingConfigPath(vertexConfig);
  if (!servingConfig) throw new Error('Vertex Search not configured');

  const accessToken = await fetchServiceAccountAccessToken(5000);
  if (!accessToken) throw new Error('Could not fetch service account token');

  const url = `https://discoveryengine.googleapis.com/v1/${servingConfig}:answer`;
  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: { text: query },
      answerGenerationSpec: {
        ignoreAdversarialQuery: true,
        ignoreNonAnswerSeekingQuery: true,
        modelSpec: { modelVersion: 'stable' },
        promptSpec: { preamble: 'Bạn là một trợ lý hành chính chuyên nghiệp. Hãy trả lời câu hỏi dựa trên các tài liệu pháp luật được cung cấp.' },
        includeCitations: true,
      }
    })
  }, timeoutMs);

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Vertex Answer API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const answer = data?.answer?.answerText || '';
  const citations = (data?.answer?.citations || []).map(c => ({
    title: c.title || 'Tài liệu dẫn chứng',
    link: c.uri || '',
    snippet: c.snippet || ''
  }));

  return { answer, citations };
}

// Start server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`VBAI Proxy listening on port ${PORT}`);
});
