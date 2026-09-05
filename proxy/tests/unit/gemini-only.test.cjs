/**
 * Gemini-Only Architecture Validation Tests.
 * Verifies backend endpoints reject 9Router and enforce Gemini-only routing.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('[TEST] Running Gemini-only Chat Architecture Validation...');

// 1. Verify proxy/server.js source code rules
const serverPath = path.join(__dirname, '../../server.js');
const serverCode = fs.readFileSync(serverPath, 'utf8');
assert(serverCode.includes('resolveGeminiConfig'), 'server.js must resolve canonical Gemini config');
assert(!serverCode.includes('resolveAiConfig'), 'server.js must not retain provider-neutral model resolution');
assert(serverCode.includes('AI_CONFIG_MISSING'), 'server.js must fail closed when AI config is missing');
assert(serverCode.includes('GEMINI_AUDIO_INPUT_UNSUPPORTED'), 'server.js must use the canonical Gemini audio error code');
assert(!serverCode.includes('process.env.GEMINI_API_KEY'), 'server.js must not read Gemini API keys from environment');
assert(serverCode.includes('UNSUPPORTED_AI_PROVIDER'), 'server.js must return UNSUPPORTED_AI_PROVIDER error');

// Ensure 9Router endpoints/helpers are purged or rejected
assert(serverCode.includes('LEGACY_AI_CONFIG_NOT_SUPPORTED'), 'server.js must reject legacy config payloads');
assert(!serverCode.includes("active_chat_provider = '9router'"), 'server.js must not assign 9router as active provider');
assert(!serverCode.includes('DevGOVietnam-Elite'), 'server.js must not default to DevGOVietnam-Elite');

console.log('✅ server.js Gemini-only static analysis passed.');

// 2. Verify webapp/modules/system-config.js source code rules
const sysConfigPath = path.join(__dirname, '../../../webapp/modules/system-config.js');
const sysConfigCode = fs.readFileSync(sysConfigPath, 'utf8');

assert(sysConfigCode.includes('normalizeAiProxyConfig'), 'system-config.js must export normalizeAiProxyConfig');
assert(!sysConfigCode.includes("provider: String(options?.provider"), 'system-config.js must not include provider in validateGeminiApiKey');

console.log('✅ system-config.js Gemini-only static analysis passed.');

// 3. Verify webapp/modules/admin-panel.js source code rules
const adminPanelPath = path.join(__dirname, '../../../webapp/modules/admin-panel.js');
const adminPanelCode = fs.readFileSync(adminPanelPath, 'utf8');

assert(adminPanelCode.includes('gemini_api_key'), 'admin-panel.js must contain Gemini API key input');
assert(!adminPanelCode.includes('nine_router_api_key'), 'admin-panel.js must not contain 9Router input fields');
assert(!adminPanelCode.includes('active_chat_provider'), 'admin-panel.js must not contain provider radio controls');

console.log('✅ admin-panel.js Gemini-only static analysis passed.');

console.log('🎉 All Gemini-Only unit tests passed successfully!');
