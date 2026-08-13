/**
 * Firebase environment configuration.
 *
 * Production keeps the existing client configuration as a controlled fallback.
 * Staging must provide a complete runtime or Vite configuration and fails closed
 * when any value is missing or points to the production Firebase project.
 */

const viteEnv =
  typeof import.meta !== 'undefined' && import.meta.env
    ? import.meta.env
    : {};

const runtimeConfig =
  typeof window !== 'undefined' && window.__VBAI_CONFIG__
    ? window.__VBAI_CONFIG__
    : {};

const IS_BROWSER = typeof window !== 'undefined';
const DEFAULT_ENVIRONMENT = IS_BROWSER
  ? 'development'
  : 'test';

const PRODUCTION_CONFIG = Object.freeze({
  apiKey: "AIzaSyC_abC-4uR72rFd8SXnaHFYY_kJ2R0CFcA",
  authDomain: "gen-lang-client-0462350485.firebaseapp.com",
  projectId: "gen-lang-client-0462350485",
  storageBucket: "gen-lang-client-0462350485.firebasestorage.app",
  messagingSenderId: "419728335518",
  appId: "1:419728335518:web:d62ad8064acf7df8fa118f",
});

const STAGING_IDENTITY = Object.freeze({
  projectId: 'vbai-staging-7a17c2af',
  authDomain: 'vbai-staging-7a17c2af.firebaseapp.com',
  storageBucket: 'vbai-staging-7a17c2af.firebasestorage.app',
  messagingSenderId: '684023952241',
  appIdPrefix: '1:684023952241:',
});

const REQUIRED_FIELDS = Object.freeze([
  'apiKey',
  'authDomain',
  'projectId',
  'storageBucket',
  'messagingSenderId',
  'appId',
]);

const ALLOWED_ENVIRONMENTS = new Set([
  'production',
  'staging',
  'development',
  'test',
]);

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeEnvironment(value) {
  const normalized = cleanString(value).toLowerCase() || 'production';

  if (!ALLOWED_ENVIRONMENTS.has(normalized)) {
    throw new Error(
      `[CONFIG] Unsupported application environment: ${normalized}`
    );
  }

  return normalized;
}

export const appEnvironment = normalizeEnvironment(
  runtimeConfig.APP_ENV ||
    runtimeConfig.ENV ||
    viteEnv.VITE_APP_ENV ||
    viteEnv.VITE_ENV ||
    DEFAULT_ENVIRONMENT
);

function resolveConfigValue(runtimeKey, viteKey, productionDefault) {
  const runtimeValue = cleanString(runtimeConfig[runtimeKey]);

  if (runtimeValue) {
    return runtimeValue;
  }

  const viteValue = cleanString(viteEnv[viteKey]);

  if (viteValue) {
    return viteValue;
  }

  return productionDefault;
}

export const firebaseConfig = Object.freeze({
  apiKey: resolveConfigValue(
    'FIREBASE_API_KEY',
    'VITE_FIREBASE_API_KEY',
    PRODUCTION_CONFIG.apiKey
  ),
  authDomain: resolveConfigValue(
    'FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_AUTH_DOMAIN',
    PRODUCTION_CONFIG.authDomain
  ),
  projectId: resolveConfigValue(
    'FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_PROJECT_ID',
    PRODUCTION_CONFIG.projectId
  ),
  storageBucket: resolveConfigValue(
    'FIREBASE_STORAGE_BUCKET',
    'VITE_FIREBASE_STORAGE_BUCKET',
    PRODUCTION_CONFIG.storageBucket
  ),
  messagingSenderId: resolveConfigValue(
    'FIREBASE_MESSAGING_SENDER_ID',
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    PRODUCTION_CONFIG.messagingSenderId
  ),
  appId: resolveConfigValue(
    'FIREBASE_APP_ID',
    'VITE_FIREBASE_APP_ID',
    PRODUCTION_CONFIG.appId
  ),
});

export function validateEnvironmentConfig(
  candidateConfig = firebaseConfig,
  options = {}
) {
  const environment = normalizeEnvironment(
    options.appEnvironment || appEnvironment
  );

  const config = Object.fromEntries(
    REQUIRED_FIELDS.map((field) => [
      field,
      cleanString(candidateConfig?.[field]),
    ])
  );

  const missingFields = REQUIRED_FIELDS.filter(
    (field) => !config[field]
  );

  if (missingFields.length > 0) {
    throw new Error(
      `[CONFIG] Missing required Firebase fields for ${environment}: ` +
        missingFields.join(', ')
    );
  }

  if (environment === 'staging') {
    if (config.projectId !== STAGING_IDENTITY.projectId) {
      throw new Error(
        '[SECURITY GATE] Staging must use the isolated staging Firebase project.'
      );
    }

    if (config.authDomain !== STAGING_IDENTITY.authDomain) {
      throw new Error(
        '[SECURITY GATE] Staging Firebase authDomain is not isolated.'
      );
    }

    if (config.storageBucket !== STAGING_IDENTITY.storageBucket) {
      throw new Error(
        '[SECURITY GATE] Staging Firebase storage bucket is not isolated.'
      );
    }

    if (
      config.messagingSenderId !==
      STAGING_IDENTITY.messagingSenderId
    ) {
      throw new Error(
        '[SECURITY GATE] Staging Firebase sender ID is not isolated.'
      );
    }

    if (!config.appId.startsWith(STAGING_IDENTITY.appIdPrefix)) {
      throw new Error(
        '[SECURITY GATE] Staging Firebase app ID is not isolated.'
      );
    }
  }

  if (environment === 'production') {
    if (config.projectId !== PRODUCTION_CONFIG.projectId) {
      throw new Error(
        '[SECURITY GATE] Production must use the production Firebase project.'
      );
    }

    if (
      config.storageBucket !==
      PRODUCTION_CONFIG.storageBucket
    ) {
      throw new Error(
        '[SECURITY GATE] Production Firebase storage bucket is invalid.'
      );
    }

    if (
      config.messagingSenderId !==
      PRODUCTION_CONFIG.messagingSenderId
    ) {
      throw new Error(
        '[SECURITY GATE] Production Firebase sender ID is invalid.'
      );
    }

    const productionAppPrefix =
      `1:${PRODUCTION_CONFIG.messagingSenderId}:`;

    if (!config.appId.startsWith(productionAppPrefix)) {
      throw new Error(
        '[SECURITY GATE] Production Firebase app ID is invalid.'
      );
    }
  }

  return true;
}

// Execute before main.js initializes Firebase in the browser.
// Missing runtime configuration therefore stops startup.
if (IS_BROWSER) {
  validateEnvironmentConfig(firebaseConfig, {
    appEnvironment,
  });
}
