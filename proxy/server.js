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
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const admin = require('firebase-admin');

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
    res.json({
      active_provider: data.active_provider || 'openai',
      router_model: data.router_model || 'gpt-4o-mini',
      gemini_model: data.gemini_model || 'gemini-1.5-flash',
      openai_endpoint: data.openai_endpoint || 'https://api.openai.com/v1',
      gemini_endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai',
      google_search_configured: !!(data.google_search_key && data.google_search_cx),
      has_openai_key: !!data.openai_api_key,
      has_gemini_key: !!data.gemini_api_key,
      transcribe_model: data.transcribe_model || (data.active_provider === 'gemini' ? data.gemini_model : 'whisper-1'),
      openai_models: Array.isArray(data.openai_models) ? data.openai_models : [],
      gemini_models: Array.isArray(data.gemini_models) ? data.gemini_models : [],
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
      transcribe_model,
      openai_models,
      gemini_models
    } = req.body;

    // Validate allowed values
    const validProvider = active_provider === 'openai' || active_provider === 'gemini';
    if (!validProvider && active_provider !== undefined) {
      return res.status(400).json({ error: 'Invalid provider' });
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

    await getSystemConfigRef().set(updateData, { merge: true });
    res.json({ success: true, message: 'System config updated' });
  } catch (err) {
    console.error('POST /api/admin/system-config error:', err);
    res.status(500).json({ error: 'Internal server error', message: err.message });
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
    const endpoint = String(provider === 'gemini'
      ? config.gemini_endpoint || 'https://generativelanguage.googleapis.com/v1beta/openai'
      : (config.openai_endpoint || 'https://api.openai.com/v1')).replace(/\/+$/, '');
    const apiKey = provider === 'gemini' ? config.gemini_api_key : config.openai_api_key;
    const effectiveModel = model || (provider === 'gemini' ? config.gemini_model : config.router_model);

    if (!apiKey) {
      return res.status(503).json({ error: 'API key missing', message: 'Please contact administrator to configure AI provider key.' });
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
app.post('/api/transcribe', async (req, res) => {
  try {
    initFirebase();
    const decoded = await verifyIdToken(req);

    // When using multipart/form-data, express.json doesn't parse it.
    // In this simple version we'll accept a base64 audio in JSON.
    // Alternatively, we could use multer. For MVP, assume client sends JSON.
    const { audio_base64, filename, model } = req.body;
    if (!audio_base64) {
      return res.status(400).json({ error: 'audio_base64 required' });
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

    // Build multipart/form-data for provider
    const boundary = '----vbai-boundary-' + Date.now();
    const buffer = Buffer.from(audio_base64, 'base64');
    const body = Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${filename || 'audio'}"\r\n` +
      `Content-Type: audio/mpeg\r\n\r\n` +
      buffer.toString('binary') + `\r\n` +
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="model"\r\n\r\n` +
      effectiveModel + `\r\n` +
      `--${boundary}--\r\n`
    );

    const providerRes = await fetch(`${endpoint}/audio/transcriptions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        ...(provider === 'gemini' && { 'x-goog-api-key': apiKey }),
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      body
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
    initFirebase();
    const decoded = await verifyIdToken(req);

    const { query, expectedDocNumber } = req.body;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'query required' });
    }

    // Fetch system config for Google Search credentials
    const snap = await getSystemConfigRef().get();
    if (!snap.exists) {
      return res.status(503).json({ error: 'System not configured' });
    }
    const config = snap.data();
    const googleKey = config.google_search_key;
    const googleCx = config.google_search_cx;
    if (!googleKey || !googleCx) {
      return res.status(503).json({ error: 'Google Search not configured' });
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

    const executeSearch = async (q) => {
      const url = `https://www.googleapis.com/customsearch/v1?key=${googleKey}&cx=${googleCx}&q=${encodeURIComponent(q)}&num=10&sort=date`;
      const response = await fetch(url);
      if (!response.ok) return null;
      const data = await response.json();
      return data.items || [];
    };

    // 1st attempt: official government/legal sources only
    let items = await executeSearch(`${refinedQuery} (${officialDomainClause})`);

    // 2nd attempt: trusted legal reference sites
    if (!items || items.length === 0) {
      items = await executeSearch(`${refinedQuery} (${trustedReferenceClause})`);

      // 3rd attempt: broad search fallback
      if (!items || items.length === 0) {
        items = await executeSearch(refinedQuery);
      }
    }

    if (!items || items.length === 0) {
      return res.json({ results: '' });
    }

    // If an exact document number is expected, filter results to only those containing it
    if (expectedDocNumber) {
      const expectedUpper = String(expectedDocNumber).toUpperCase();
      items = items.filter(item => {
        const title = (item.title || '').toUpperCase();
        const snippet = (item.snippet || '').toUpperCase();
        return title.includes(expectedUpper) || snippet.includes(expectedUpper);
      });
      if (items.length === 0) {
        // No exact match found — signal caller to not use web data
        return res.json({ results: '__NO_EXACT_MATCH__' });
      }
    }

    // Return up to 8 results, formatted as markdown-like list
    const results = items.slice(0, 8).map(item => {
      const title = item.title || 'No Title';
      const link = item.link || '#';
      const snippet = item.snippet || '';
      return `- [${title}](${link}): ${snippet}`;
    }).join('\n\n');

    res.json({ results });
  } catch (err) {
    console.error('POST /api/web-search error:', err);
    res.status(500).json({ error: 'Internal server error', message: err.message });
  }
});

// Helper: Get current year context for search queries
function getCurrentYearContext() {
  const now = new Date();
  const current = now.getFullYear();
  return { current, next: current + 1, prev: current - 1 };
}

// Start server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`VBAI Proxy listening on port ${PORT}`);
});
