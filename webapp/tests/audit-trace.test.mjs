import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webappRoot = path.resolve(__dirname, '..');
const proxyRoot = path.resolve(__dirname, '../../proxy');

console.log('[TEST] Running Visit Counter & Centralized Search Audit Trace Regression Tests...');

// 1. Verify proxy server.js contains visit counter routes and atomic increment
const serverJs = fs.readFileSync(path.join(proxyRoot, 'server.js'), 'utf8');

assert.ok(serverJs.includes("app.get('/api/stats/visits'"), 'proxy/server.js MUST contain GET /api/stats/visits route');
assert.ok(serverJs.includes("app.post('/api/stats/visits/session'"), 'proxy/server.js MUST contain POST /api/stats/visits/session route');
assert.ok(serverJs.includes('dbService.incrementVisitStats'), 'POST /api/stats/visits/session MUST use Mongo atomic increment');
assert.ok(!serverJs.includes('FieldValue.increment(1)'), 'Visit counter MUST not use Firestore sentinel');
assert.ok(!serverJs.includes("db.collection('stats').doc('visits')"), 'Visit counter MUST not target Firestore stats document');

// 2. Verify backend centralized search audit trace in POST /api/chat
assert.ok(serverJs.includes("delete req.body.trace"), 'Backend MUST strip/internalize trace metadata before model payload creation');
assert.ok(serverJs.includes("delete req.body.audit"), 'Backend MUST strip/internalize audit metadata before model payload creation');
assert.ok(serverJs.includes("db.collection('search_logs').add(") || serverJs.includes('dbService.addSearchLog('), 'Backend MUST log search event to search_logs collection');
assert.ok(serverJs.includes('user_id: decoded.uid || null'), 'Backend MUST use verified token user identity for audit ownership');
assert.ok(!serverJs.includes('query: auditQuery'), 'Backend MUST NOT persist raw audit query');
assert.ok(!serverJs.includes('prompt: auditQuery'), 'Backend MUST NOT persist raw prompt');
assert.ok(serverJs.includes('serverTimestamp()') || serverJs.includes('timestamp: new Date()'), 'Backend MUST timestamp trace logging');

// 3. Verify ai-proxy.js exports getVisitCount and recordVisitSession
const aiProxyJs = fs.readFileSync(path.join(webappRoot, 'modules/ai-proxy.js'), 'utf8');

assert.ok(aiProxyJs.includes('export async function getVisitCount()'), 'ai-proxy.js MUST export getVisitCount');
assert.ok(aiProxyJs.includes('export async function recordVisitSession()'), 'ai-proxy.js MUST export recordVisitSession');
assert.ok(aiProxyJs.includes("backendFetch('/stats/visits'"), 'getVisitCount MUST call GET /stats/visits via authenticated backendFetch');
assert.ok(aiProxyJs.includes("backendFetch('/stats/visits/session'"), 'recordVisitSession MUST call POST /stats/visits/session via authenticated backendFetch');

// 4. Verify dashboard.js visit counter hydration logic
const dashboardJs = fs.readFileSync(path.join(webappRoot, 'modules/dashboard.js'), 'utf8');

assert.ok(dashboardJs.includes('vbai_visit_session_v2'), 'dashboard.js MUST use sessionStorage key vbai_visit_session_v2');
assert.ok(dashboardJs.includes('#visit-count'), 'dashboard.js MUST preserve #visit-count element');
assert.ok(dashboardJs.includes('hydrateVisitCounter'), 'dashboard.js MUST invoke hydrateVisitCounter');

// 5. Verify legal-search.js supplies original query + mode + effectiveDate audit metadata
const legalSearchJs = fs.readFileSync(path.join(webappRoot, 'modules/legal-search.js'), 'utf8');

assert.ok(legalSearchJs.includes('feature: \'legal-search\''), 'legal-search.js MUST pass feature: legal-search in trace metadata');
assert.ok(legalSearchJs.includes('query: query'), 'legal-search.js MUST pass original user query in trace metadata');
assert.ok(legalSearchJs.includes('mode: currentSearchState.mode'), 'legal-search.js MUST pass current mode in trace metadata');
assert.ok(serverJs.includes('requestId: req.requestId'), 'Backend MUST persist requestId in audit metadata');
assert.ok(serverJs.includes('effectiveDate: auditEffectiveDate'), 'Backend MUST persist effectiveDate in audit metadata');

// 6. Verify chat-assistant.js duplicate client logging is disabled
const chatAssistantJs = fs.readFileSync(path.join(webappRoot, 'modules/chat-assistant.js'), 'utf8');

assert.ok(
  chatAssistantJs.includes('Backend centralized trace logging is active'),
  'chat-assistant.js MUST disable duplicate client-side search_logs addDoc'
);

// 7. Verify admin-panel.js handles legacy and V2 audit entries
const adminPanelJs = fs.readFileSync(path.join(webappRoot, 'modules/admin-panel.js'), 'utf8');

assert.ok(adminPanelJs.includes('item.data.userEmail || item.data.user'), 'admin-panel.js MUST handle legacy user fields');
assert.ok(adminPanelJs.includes('item.data.query || item.data.action'), 'admin-panel.js MUST handle legacy query fields');

console.log('PASS: All Visit Counter & Search Audit Trace regression assertions passed successfully.');
