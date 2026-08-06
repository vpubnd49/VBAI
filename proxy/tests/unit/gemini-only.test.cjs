/**
 * Gemini-Only Architecture Validation Tests.
 * Verifies backend endpoints reject 9Router and enforce Gemini-only routing.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('[TEST] Running Gemini-Only Architecture Validation...');

// 1. Verify proxy/server.js source code rules
const serverPath = path.join(__dirname, '../../server.js');
const serverCode = fs.readFileSync(serverPath, 'utf8');

// Ensure ALLOWED_GEMINI_MODELS is present
assert(serverCode.includes('ALLOWED_GEMINI_MODELS'), 'server.js must define ALLOWED_GEMINI_MODELS');
assert(serverCode.includes('UNSUPPORTED_AI_PROVIDER'), 'server.js must return UNSUPPORTED_AI_PROVIDER error');

// Ensure 9Router endpoints/helpers are purged
assert(!serverCode.includes("active_provider === '9router'"), 'server.js must not contain active_provider 9router checks');
assert(!serverCode.includes('nine_router_api_key'), 'server.js must not read nine_router_api_key');
assert(!serverCode.includes('DevGOVietnam-Elite'), 'server.js must not default to DevGOVietnam-Elite');

console.log('✅ server.js Gemini-only static analysis passed.');

// 2. Verify webapp/modules/system-config.js source code rules
const sysConfigPath = path.join(__dirname, '../../../webapp/modules/system-config.js');
const sysConfigCode = fs.readFileSync(sysConfigPath, 'utf8');

assert(sysConfigCode.includes('normalizeGeminiOnlyConfig'), 'system-config.js must export normalizeGeminiOnlyConfig');
assert(!sysConfigCode.includes("provider: String(options?.provider"), 'system-config.js must not include provider in validateGeminiApiKey');

console.log('✅ system-config.js Gemini-only static analysis passed.');

// 3. Verify webapp/modules/admin-panel.js source code rules
const adminPanelPath = path.join(__dirname, '../../../webapp/modules/admin-panel.js');
const adminPanelCode = fs.readFileSync(adminPanelPath, 'utf8');

assert(adminPanelCode.includes('admin-ai-badge'), 'admin-panel.js must contain admin-ai-badge element');
assert(!adminPanelCode.includes('nine_router_api_key'), 'admin-panel.js must not contain 9Router input fields');
assert(!adminPanelCode.includes('active_chat_provider'), 'admin-panel.js must not contain provider radio controls');

console.log('✅ admin-panel.js Gemini-only static analysis passed.');

console.log('🎉 All Gemini-Only unit tests passed successfully!');
