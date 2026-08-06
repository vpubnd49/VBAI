/**
 * Provider Flow Unit Tests
 * Verifies Gemini API → Vertex AI fallback logic in executeProviderAttempt.
 *
 * Tests are static analysis of the source code to verify the control flow
 * ordering is correct, since the actual function is a closure inside the
 * /api/chat route handler and cannot be called directly without mocking
 * the entire Express + Firebase stack.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('[TEST] Running Provider Flow Validation...');

const serverPath = path.join(__dirname, '../../server.js');
const serverCode = fs.readFileSync(serverPath, 'utf8');

// Extract the executeProviderAttempt function body
const fnStart = serverCode.indexOf('const executeProviderAttempt = async (modelName) =>');
assert(fnStart > -1, 'executeProviderAttempt function must exist in server.js');

// Find the closing of this function (next occurrence of `};` at same indentation level)
const fnBody = serverCode.substring(fnStart, fnStart + 5000);

// === Test 1: Gemini API success returns immediately without Vertex call ===
// The code must check `providerRes && providerRes.ok` and return data BEFORE any Vertex call
const okCheckIndex = fnBody.indexOf('if (providerRes && providerRes.ok)');
assert(okCheckIndex > -1, 'Must check providerRes.ok');

const returnDataIndex = fnBody.indexOf('return { ok: true, status: 200, data }');
assert(returnDataIndex > -1, 'Must return success data when providerRes.ok is true');

const vertexFallbackIndex = fnBody.indexOf('executeVertexGeminiChat');
assert(vertexFallbackIndex > -1, 'Must contain Vertex AI fallback call');

// Success return MUST come before Vertex fallback
assert(returnDataIndex < vertexFallbackIndex,
  'Gemini API success return must come BEFORE Vertex AI fallback call. ' +
  'When providerRes.ok is true, we must return immediately without calling Vertex.'
);

console.log('  ✅ Test 1: Gemini API success returns immediately (no Vertex call)');

// === Test 2: Vertex fallback is called when API fails ===
const fallbackLogIndex = fnBody.indexOf('Falling back to Vertex AI');
assert(fallbackLogIndex > -1, 'Must log Vertex AI fallback message');
assert(fallbackLogIndex > returnDataIndex,
  'Vertex fallback log must come AFTER success return path');

console.log('  ✅ Test 2: Vertex AI fallback is called when Gemini API fails');

// === Test 3: Both-failed path exists ===
const bothFailedIndex = fnBody.indexOf('Both Gemini API key and Vertex AI calls failed');
assert(bothFailedIndex > -1, 'Must have error path for when both Gemini API and Vertex fail');
assert(bothFailedIndex > vertexFallbackIndex,
  'Both-failed error path must come after Vertex fallback attempt');

console.log('  ✅ Test 3: Both-failed error path exists after Vertex attempt');

// === Test 4: finalValidatedModel is NOT used in validate-gemini-key ===
const validateKeySection = serverCode.substring(
  serverCode.indexOf("app.post('/api/admin/validate-gemini-key'"),
  serverCode.indexOf("app.post('/api/admin/validate-gemini-key'") + 2000
);
assert(!validateKeySection.includes('finalValidatedModel'),
  'validate-gemini-key must NOT reference finalValidatedModel (ReferenceError fix)');

console.log('  ✅ Test 4: validate-gemini-key does not use finalValidatedModel');

// === Test 5: HTTP 429 retry is preserved ===
const retryIndex = fnBody.indexOf('429');
assert(retryIndex > -1, 'HTTP 429 retry logic must be preserved');
const retryDelayIndex = fnBody.indexOf('1500');
assert(retryDelayIndex > -1, 'HTTP 429 retry delay (1500ms) must be preserved');

console.log('  ✅ Test 5: HTTP 429 retry mechanism preserved');

console.log('🎉 All Provider Flow tests passed!');
