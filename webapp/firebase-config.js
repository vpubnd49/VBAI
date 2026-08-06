/**
 * Firebase Environment Configuration.
 * Supports dynamic environment configuration via import.meta.env (Vite) or window.__VBAI_CONFIG__.
 * Defaults to production Firebase project configuration when no environment overrides are provided.
 */

const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : {};
const globalConfig = (typeof window !== 'undefined' && window.__VBAI_CONFIG__) ? window.__VBAI_CONFIG__ : {};

export const firebaseConfig = {
  apiKey: globalConfig.FIREBASE_API_KEY || env.VITE_FIREBASE_API_KEY || "AIzaSyC_abC-4uR72rFd8SXnaHFYY_kJ2R0CFcA",
  authDomain: globalConfig.FIREBASE_AUTH_DOMAIN || env.VITE_FIREBASE_AUTH_DOMAIN || "vbai.tracuu.lamdong.vn",
  projectId: globalConfig.FIREBASE_PROJECT_ID || env.VITE_FIREBASE_PROJECT_ID || "gen-lang-client-0462350485",
  storageBucket: globalConfig.FIREBASE_STORAGE_BUCKET || env.VITE_FIREBASE_STORAGE_BUCKET || "gen-lang-client-0462350485.firebasestorage.app",
  messagingSenderId: globalConfig.FIREBASE_MESSAGING_SENDER_ID || env.VITE_FIREBASE_MESSAGING_SENDER_ID || "419728335518",
  appId: globalConfig.FIREBASE_APP_ID || env.VITE_FIREBASE_APP_ID || "1:419728335518:web:d62ad8064acf7df8fa118f"
};

/**
 * Validates that staging environment builds do not accidentally connect to production Firebase.
 */
export function validateEnvironmentConfig(overrideConfig = {}) {
  const cfg = { ...firebaseConfig, ...overrideConfig };
  const isStagingEnv = env.VITE_ENV === 'staging' || globalConfig.ENV === 'staging' || overrideConfig.isStaging === true;

  if (isStagingEnv && cfg.projectId === "gen-lang-client-0462350485") {
    throw new Error("[SECURITY GATE] Staging environment build cannot use production Firebase Project ID (gen-lang-client-0462350485)!");
  }
  return true;
}
