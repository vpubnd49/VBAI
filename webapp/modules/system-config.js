/**
 * System Configuration Module
 * Fetches and caches the AI system configuration from the backend proxy.
 * Used by various modules to determine active provider, models, and endpoints.
 */

const CONFIG_CACHE_KEY = 'vbai_system_config_cache';
const CONFIG_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

let cachedConfig = null;
let cacheExpiresAt = 0;

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
export async function fetchSystemConfig() {
  const token = await getIdToken();
  if (!token) {
    // Not logged in; return null (no system config)
    return null;
  }

  // Determine backend URL
  let backendUrl;
  try {
    // Try to read from localStorage if user has previously saved custom backend
    const saved = localStorage.getItem('vbai_backend_url');
    if (saved) {
      backendUrl = saved;
    } else {
      // Derive from Firebase config? Or use a fixed relative path?
      // Use relative path so it works on same domain (proxy likely at /api)
      backendUrl = '/api';
    }
  } catch (e) {
    backendUrl = '/api';
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

  let backendUrl = '/api';
  try {
    const saved = localStorage.getItem('vbai_backend_url');
    if (saved) backendUrl = saved;
  } catch (e) {}

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
  return await response.json();
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
