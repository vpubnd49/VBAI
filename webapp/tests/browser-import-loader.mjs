/**
 * Node ESM Custom Loader for Browser Remote Dependencies
 * Intercepts Firebase Auth/App browser URLs during Node unit/smoke testing
 * and returns deterministic, side-effect-free mock exports.
 */

const FILE_SAVER_TEST_URL = 'vbai-test:file-saver';

export async function resolve(specifier, context, defaultResolve) {
  if (specifier === 'file-saver') {
    return {
      url: FILE_SAVER_TEST_URL,
      shortCircuit: true,
    };
  }
  if (specifier.endsWith('/firebase-app.js') || specifier.endsWith('/firebase-auth.js')) {
    return {
      url: specifier,
      shortCircuit: true,
    };
  }
  return defaultResolve(specifier, context, defaultResolve);
}

export async function load(url, context, defaultLoad) {
  if (url === FILE_SAVER_TEST_URL) {
    return {
      format: 'module',
      shortCircuit: true,
      source: `
        export function saveAs() {
          return undefined;
        }

        export default {
          saveAs
        };
      `,
    };
  }
  if (url.endsWith('/firebase-app.js') || url.endsWith('/firebase-auth.js')) {
    const code = `
      // Firebase App Mocks
      export const initializeApp = () => ({ name: '[DEFAULT]' });
      export const getApps = () => [];
      export const getApp = () => ({ name: '[DEFAULT]' });

      // Firebase Auth Mocks
      export const getAuth = () => ({
        currentUser: null,
        onAuthStateChanged: (cb) => { cb(null); return () => {}; }
      });
      export const onAuthStateChanged = (auth, callback) => {
        if (typeof callback === 'function') callback(null);
        return () => {};
      };
      export const getIdTokenResult = async () => ({ claims: { admin: true } });
      export const signOut = async () => {};

    `;

    return {
      format: 'module',
      source: code,
      shortCircuit: true,
    };
  }

  return defaultLoad(url, context, defaultLoad);
}
