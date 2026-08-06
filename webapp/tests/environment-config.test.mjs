/**
 * Environment Configuration Unit Test.
 * Validates Firebase environment config loading, production default fallback,
 * and staging cross-environment rejection gate.
 */

import assert from 'node:assert';
import { firebaseConfig, validateEnvironmentConfig } from '../firebase-config.js';

console.log('[TEST] Running Environment Configuration Unit Tests...');

// Test 1: Production Default Fallback
assert.strictEqual(firebaseConfig.projectId, 'gen-lang-client-0462350485', 'Default project ID must match production');
assert.strictEqual(firebaseConfig.authDomain, 'vbai.tracuu.lamdong.vn', 'Default auth domain must match production');
console.log('  ✅ Test 1: Default production fallback verified');

// Test 2: Normal Production Validation Passes
assert.doesNotThrow(() => {
  validateEnvironmentConfig();
}, 'Production config validation must pass without throwing');
console.log('  ✅ Test 2: Production environment validation passed');

// Test 3: Staging Mode Rejects Production Project ID
assert.throws(() => {
  validateEnvironmentConfig({ isStaging: true, projectId: 'gen-lang-client-0462350485' });
}, /SECURITY GATE/, 'Staging build with production project ID must be strictly rejected');
console.log('  ✅ Test 3: Staging build with production project ID strictly rejected');

// Test 4: Staging Mode Accepts Staging Project ID
assert.doesNotThrow(() => {
  validateEnvironmentConfig({ isStaging: true, projectId: 'vbai-staging-7a17c2af' });
}, 'Staging build with isolated staging project ID must pass validation');
console.log('  ✅ Test 4: Staging build with staging project ID accepted');

console.log('🎉 Environment Configuration tests passed!');
