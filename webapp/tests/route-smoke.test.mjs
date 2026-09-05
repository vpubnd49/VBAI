/**
 * VBAI Legal Pro V2 — Full Route Import & Render Smoke Test
 * Dynamically imports and verifies rendering functions for all 16 client routes.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MODULES_DIR = path.resolve(__dirname, '../modules');

// Setup minimal browser DOM environment mocks for Node execution
if (typeof global.window === 'undefined') {
  const mockStorage = () => {
    let store = {};
    return {
      getItem: (k) => store[k] || null,
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
      clear: () => { store = {}; }
    };
  };

  global.window = {
    location: { reload: () => {} },
    localStorage: mockStorage(),
    sessionStorage: mockStorage(),
    currentUser: { uid: 'test_user_123', email: 'test@lamdong.gov.vn', getIdToken: async () => 'mock_token' },
    isAdmin: true,

    __VBAI_CONFIG__: {
      APP_ENV: 'development',
      FIREBASE_API_KEY: 'test-api-key',
      FIREBASE_AUTH_DOMAIN: 'test.local',
      FIREBASE_PROJECT_ID: 'test-project',
      FIREBASE_STORAGE_BUCKET: 'test-bucket',
      FIREBASE_MESSAGING_SENDER_ID: '1234567890',
      FIREBASE_APP_ID: '1:1234567890:web:test'
    },

    addEventListener: () => {},
    removeEventListener: () => {},
    matchMedia: () => ({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {}
    }),
  };
  global.localStorage = global.window.localStorage;
  global.sessionStorage = global.window.sessionStorage;
}

if (typeof global.document === 'undefined') {
  class MockElement {
    constructor(tagName = 'div') {
      this.tagName = tagName;
      this.children = [];
      this.innerHTML = '';
      this.style = {};
      this.classList = {
        add: () => {},
        remove: () => {},
        toggle: () => {},
        contains: () => false
      };
      this.dataset = {};
    }
    querySelector() { return new MockElement('div'); }
    querySelectorAll() { return [new MockElement('div')]; }
    appendChild(child) { this.children.push(child); return child; }
    addEventListener() {}
    click() {}
    removeEventListener() {}
    setAttribute() {}
    removeAttribute() {}
  }

  global.document = {
    createElement: (tag) => new MockElement(tag),
    querySelector: () => new MockElement('div'),
    querySelectorAll: () => [new MockElement('div')],
    getElementById: () => new MockElement('div'),
    body: new MockElement('body'),
    visibilityState: 'visible',
    addEventListener: () => {},
    removeEventListener: () => {},
  };
}

// ROUTE_SMOKE_FETCH_MOCK
// Browser modules legitimately use relative URLs.
// Node requires absolute URLs, therefore smoke tests intercept
// only known browser-relative requests and never access network.

global.fetch = async (input) => {
  const url =
    typeof input === 'string'
      ? input
      : String(input?.url || input || '');

  let payload = {};

  if (url === '/api/stats/visits') {
    payload = {
      count: 1050
    };
  }
  else if (url === '/api/stats/visits/session') {
    payload = {
      count: 1050
    };
  }
  else if (url === '/api/system-config-summary') {
    payload = {
      provider: 'gemini',
      gemini_model: 'gemini-3.5-flash-lite',
      gemini_endpoint: '',
      transcribe_model: 'gemini-3.5-flash-lite',
      has_gemini_key: false
    };
  }
  else if (url === './skills-manifest.json') {
    payload = {
      skills: []
    };
  }
  else if (
    url.startsWith('/search-history') ||
    url.startsWith('/api/search-history')
  ) {
    payload = {
      logs: [],
      isAdmin: true,
      pagination: { pageSize: 15, hasMore: false, nextCursor: null }
    };
  }
  else if (url.startsWith('/api/admin/users')) {
    payload = { success: true, users: [], pagination: { totalPages: 1, total: 0 } };
  }
  else if (url === '/api/admin/training-datasets') {
    payload = { success: true, data: [] };
  }
  else if (url === '/api/admin/crawler/status') {
    payload = { status: 'idle', totalKnownDocs: 0, recentDocuments: [] };
  }
  else {
    throw new Error(
      `Unexpected network request during route smoke: ${url}`
    );
  }

  return {
    ok: true,
    status: 200,
    json: async () => payload,
    text: async () => JSON.stringify(payload),
    blob: async () => new Blob(
      [JSON.stringify(payload)],
      {
        type: 'application/json'
      }
    ),
    arrayBuffer: async () =>
      new TextEncoder()
        .encode(JSON.stringify(payload))
        .buffer
  };
};

const ROUTE_MODULE_MAP = [
  { route: 'dashboard', file: 'dashboard.js', exportFn: 'renderDashboard' },
  { route: 'legal-search', file: 'legal-search.js', exportFn: 'renderLegalSearchUI' },
  { route: 'document-lookup', file: 'legal-search.js', exportFn: 'renderLegalSearchUI' },
  { route: 'situation-analysis', file: 'legal-search.js', exportFn: 'renderLegalSearchUI' },
  { route: 'compare-regulations', file: 'legal-search.js', exportFn: 'renderLegalSearchUI' },
  { route: 'effective-date', file: 'legal-search.js', exportFn: 'renderLegalSearchUI' },
  { route: 'chat-assistant', file: 'chat-assistant.js', exportFn: 'renderChatUI' },
  { route: 'vb-dang', file: 'vb-dang.js', exportFn: 'renderVBDang' },
  { route: 'vb-nd30', file: 'vb-nd30.js', exportFn: 'renderVBND30' },
  { route: 'pdf-tool', file: 'pdf-tool.js', exportFn: 'renderPdfTool' },
  { route: 'docx-tool', file: 'docx-tool.js', exportFn: 'renderDocxTool' },
  { route: 'spell-check', file: 'spell-check.js', exportFn: 'renderSpellCheck' },
  { route: 'meeting-minutes', file: 'meeting-minutes.js', exportFn: 'renderMeetingMinutes' },
  { route: 'pdf-publisher', file: 'pdf-publisher.js', exportFn: 'renderPdfPublisher' },
  { route: 'search-history', file: 'search-history.js', exportFn: 'renderSearchHistory' },
  { route: 'admin-panel', file: 'admin-panel.js', exportFn: 'renderAdminPanel' },
];

console.log('🧪 Bắt đầu Smoke Test 16 Tuyến Đường (Import & Module Integrity)...');

let passedCount = 0;
let failedCount = 0;

async function runRouteSmokeTest() {
  for (const item of ROUTE_MODULE_MAP) {
    const filePath = path.join(MODULES_DIR, item.file);
    if (!fs.existsSync(filePath)) {
      console.error(`  ❌ [FAIL] Route '${item.route}': File ${item.file} missing`);
      failedCount++;
      continue;
    }

    try {
      const fileUrl = pathToFileURL(filePath).href;
      const mod = await import(fileUrl);
      if (typeof mod[item.exportFn] === 'function') {
        const mockContainer = global.document.createElement('div');
        // Import and render must both succeed.
        await Promise.resolve(
          mod[item.exportFn](
            mockContainer,
            item.route === 'search-history'
              ? () => {}
              : undefined
          )
        );

        console.log(`  ✅ [PASS] Route '${item.route}' -> ${item.file}::${item.exportFn}() loaded and rendered cleanly`);
        passedCount++;
      } else {
        console.error(`  ❌ [FAIL] Route '${item.route}': Export function ${item.exportFn} missing in ${item.file}`);
        failedCount++;
      }
    } catch (err) {
      console.error(`  ❌ [FAIL] Route '${item.route}': Import/Execution error: ${err.message}`);
      failedCount++;
    }
  }

  console.log(`\n📊 KẾT QUẢ ROUTE SMOKE TEST: Passed: ${passedCount}/${ROUTE_MODULE_MAP.length}, Failed: ${failedCount}`);

  if (failedCount === 0) {
    console.log('🎉 TẤT CẢ 16 TUYẾN ĐƯỜNG CỦA VBAI LEGAL PRO V2 ĐÃ SẴN SÀNG VÀ TẢI THÀNH CÔNG!');
  } else {
    console.error('⚠️ PHÁT HIỆN LỖI KHI TẢI TUYẾN ĐƯỜNG.');
    process.exit(1);
  }
}

runRouteSmokeTest();
