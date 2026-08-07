/**
 * Node ESM Custom Loader for Browser Remote Dependencies
 * Intercepts https://www.gstatic.com/firebasejs/... URLs during Node unit/smoke testing
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
  if (specifier.startsWith('https://www.gstatic.com/firebasejs/')) {
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
  if (url.startsWith('https://www.gstatic.com/firebasejs/')) {
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

      // Firebase Firestore Mocks
      export const getFirestore = () => ({});
      export const collection = (...args) => ({ type: 'collection', path: args.join('/') });
      export const doc = (...args) => ({ type: 'doc', path: args.join('/') });
      export const getDoc = async () => ({ exists: () => true, data: () => ({ count: 1050 }) });
      export const getDocs = async () => ({
        docs: [],
        empty: true,
        size: 0,
        forEach: () => {}
      });
      export const query = (...args) => ({ type: 'query', args });
      export const where = (...args) => ({ type: 'where', args });
      export const orderBy = (...args) => ({ type: 'orderBy', args });
      export const limit = (n) => ({ type: 'limit', value: n });
      export const startAfter = (...args) => ({ type: 'startAfter', args });
      export const addDoc = async () => ({ id: 'mock_doc_id_' + Date.now() });
      export const setDoc = async () => {};
      export const updateDoc = async () => {};
      export const deleteDoc = async () => {};
      export const writeBatch = () => ({
        set: () => {},
        update: () => {},
        delete: () => {},
        commit: async () => {}
      });
      export const serverTimestamp = () => ({ seconds: Math.floor(Date.now() / 1000) });
      export const increment = (n) => ({ type: 'increment', value: n });
      export const onSnapshot = (ref, callback) => {
        if (typeof callback === 'function') {
          callback({ docs: [], exists: () => false, data: () => ({}) });
        }
        return () => {};
      };

      // Firebase Storage Mocks
      export const getStorage = () => ({});
      export const ref = (...args) => ({ type: 'storage_ref', path: args.join('/') });
      export const uploadBytes = async () => ({ ref: { fullPath: 'mock/path.pdf' } });
      export const getDownloadURL = async () => 'https://mock.storage.url/file.pdf';
    `;

    return {
      format: 'module',
      source: code,
      shortCircuit: true,
    };
  }

  return defaultLoad(url, context, defaultLoad);
}
