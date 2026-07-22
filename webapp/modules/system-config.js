/**
 * System Configuration Module
 * Fetches and caches the AI system configuration from the backend proxy.
 * Used by various modules to determine active provider, models, and endpoints.
 */

const CONFIG_CACHE_KEY = 'vbai_system_config_cache';
const CONFIG_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const DEFAULT_BACKEND_BASE = '/api';
const ALLOWED_BACKEND_HOSTS = new Set([
  'vbai.tracuu.lamdong.vn',
  'vbai.tracuu.lamdong.gov.vn',
  'localhost',
  '127.0.0.1',
]);

let cachedConfig = null;
let cacheExpiresAt = 0;

function trimTrailingSlash(url = '') {
  return String(url || '').replace(/\/+$/, '');
}

function resolveBackendBase() {
  let saved = '';
  try {
    saved = localStorage.getItem('vbai_backend_url') || '';
  } catch (e) {}
  const val = String(saved || '').trim();
  if (!val) return DEFAULT_BACKEND_BASE;

  if (val.startsWith('/')) {
    if (val === '/api' || val.startsWith('/api/')) {
      return trimTrailingSlash(val);
    }
    throw new Error('Backend URL khong hop le. Chi duoc phep /api.');
  }

  let parsed;
  try {
    parsed = new URL(val);
  } catch (e) {
    throw new Error('Backend URL khong hop le.');
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('Backend URL phai dung http/https.');
  }

  const host = parsed.hostname.toLowerCase();
  const sameOrigin = typeof window !== 'undefined' && parsed.origin === window.location.origin;
  const whitelisted = ALLOWED_BACKEND_HOSTS.has(host);
  if (!sameOrigin && !whitelisted) {
    throw new Error('Backend host khong nam trong danh sach duoc phep.');
  }

  if (!parsed.pathname || parsed.pathname === '/') {
    parsed.pathname = '/api';
  }
  if (!parsed.pathname.startsWith('/api')) {
    throw new Error('Backend URL phai tro den duong dan /api.');
  }
  return trimTrailingSlash(parsed.toString());
}

/**
 * Get the Firebase ID token for authenticated requests.
 * Uses current Firebase auth state.
 */
async function getIdToken() {
  // We'll import Firebase from the CDN version at runtime in browser.
  // This module is intended for browser use only.
  if (typeof window === 'undefined') return null;

  // The auth module should set currentUser globally after login.
  const auth = window.currentUser ? window.currentUser : null;
  if (!auth) return null;

  try {
    return await auth.getIdToken();
  } catch (e) {
    console.error('Failed to get ID token:', e);
    return null;
  }
}

/**
 * Fetch system config from the backend proxy.
 * Falls back to localStorage defaults if backend is unavailable and we have a cache.
 */
export async function fetchSystemConfig(options = {}) {
  const forceRefresh = options?.forceRefresh === true;
  if (!forceRefresh && cachedConfig && Date.now() < cacheExpiresAt) {
    return cachedConfig;
  }
  const token = await getIdToken();
  if (!token) {
    // Not logged in; return null (no system config)
    return null;
  }

  let backendUrl = DEFAULT_BACKEND_BASE;
  try {
    backendUrl = resolveBackendBase();
  } catch (e) {
    console.warn('Invalid backend URL config, fallback to /api:', e?.message || e);
    backendUrl = DEFAULT_BACKEND_BASE;
  }

  try {
    const res = await fetch(`${backendUrl}/system-config-summary`, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      cache: 'no-store'
    });

    if (!res.ok) {
      throw new Error(`Backend responded ${res.status}`);
    }

    const data = await res.json();
    cachedConfig = data;
    cacheExpiresAt = Date.now() + CONFIG_CACHE_TTL;
    return data;
  } catch (err) {
    console.warn('Failed to fetch system config from backend:', err);
    // If we have a cached config, return it; else return null
    if (cachedConfig && Date.now() < cacheExpiresAt) {
      return cachedConfig;
    }
    return null;
  }
}

/**
 * Get current cached system config (synchronous). May be null if not loaded yet.
 */
export function getCachedSystemConfig() {
  return cachedConfig;
}

/**
 * Clear the config cache (useful on admin updates).
 */
export function clearSystemConfigCache() {
  cachedConfig = null;
  cacheExpiresAt = 0;
}

/**
 * Update system config on the backend.
 */
export async function updateSystemConfig(configData) {
  const token = await getIdToken();
  if (!token) throw new Error('Not authenticated');

  let backendUrl = DEFAULT_BACKEND_BASE;
  try {
    backendUrl = resolveBackendBase();
  } catch (e) {
    throw new Error(e?.message || 'Backend URL khong hop le');
  }

  const response = await fetch(`${backendUrl}/admin/system-config`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(configData)
  });

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const data = await response.json();
      message = data.message || message;
    } catch (e) {}
    throw new Error(message);
  }

  // Clear cache after successful update
  clearSystemConfigCache();
  const payload = await response.json();

  // Immediately re-fetch and broadcast so runtime can apply config without reload.
  let latestConfig = null;
  try {
    latestConfig = await fetchSystemConfig({ forceRefresh: true });
  } catch (e) {
    console.warn('Failed to refresh config right after update:', e);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('vbai:system-config-updated', {
      detail: {
        config: latestConfig || null,
        submitted: configData || null,
      }
    }));
  }

  return payload;
}

/**
 * Validate Gemini API key by calling backend live check endpoint (admin only).
 */
export async function validateGeminiApiKey(options = {}) {
  const token = await getIdToken();
  if (!token) throw new Error('Not authenticated');

  let backendUrl = DEFAULT_BACKEND_BASE;
  try {
    backendUrl = resolveBackendBase();
  } catch (e) {
    throw new Error(e?.message || 'Backend URL khong hop le');
  }

  const payload = {
    provider: String(options?.provider || 'gemini').trim(),
    gemini_api_key: String(options?.apiKey || '').trim(),
    gemini_endpoint: String(options?.gemini_endpoint || '').trim() || undefined,
    use_stored_key: options?.useStoredKey !== false,
    model: String(options?.model || '').trim() || undefined,
  };

  const response = await fetch(`${backendUrl}/admin/validate-gemini-key`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.message || `HTTP ${response.status}`);
  }
  return data;
}

/**
 * Check if user is admin based on Firebase custom claim.
 * Caches result in localStorage for the session.
 */
export function isCurrentUserAdmin() {
  if (typeof window === 'undefined') return false;
  // Check window flag set by login module
  if (window.isAdmin !== undefined) {
    return window.isAdmin;
  }
  // Fallback: check from localStorage if set by login flow
  const cached = localStorage.getItem('vbai_is_admin');
  if (cached !== null) {
    return cached === 'true';
  }
  return false;
}

export { isCurrentUserAdmin as isAdmin };

/**
 * Trigger Vertex AI Search document ingestion (Sync) (admin only).
 */
export async function triggerVertexIngestion(options = {}) {
  const token = await getIdToken();
  if (!token) throw new Error('Not authenticated');

  let backendUrl = DEFAULT_BACKEND_BASE;
  try {
    backendUrl = resolveBackendBase();
  } catch (e) {
    throw new Error(e?.message || 'Backend URL khong hop le');
  }

  const payload = {
    vertex_project_id: options?.projectId || undefined,
    vertex_location: options?.location || undefined,
    vertex_data_store_id: options?.dataStoreId || undefined,
    bucket_name: options?.bucketName || undefined,
  };

  const response = await fetch(`${backendUrl}/admin/ingest-vertex`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.message || data?.error || `HTTP ${response.status}`);
  }
  return data;
}
