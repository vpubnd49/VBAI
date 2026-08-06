import assert from 'node:assert/strict';

import {
  appEnvironment,
  firebaseConfig,
  validateEnvironmentConfig,
} from '../firebase-config.js';

console.log('[TEST] Running Firebase environment isolation tests...');

assert.equal(
  appEnvironment,
  'test',
  'Node imports must use the controlled test environment'
);

assert.doesNotThrow(() => {
  validateEnvironmentConfig(firebaseConfig, {
    appEnvironment: 'production',
  });
});

console.log('  PASS: production fallback validates');

const stagingConfig = {
  apiKey: 'test-staging-web-key',
  authDomain: 'vbai-staging-7a17c2af.firebaseapp.com',
  projectId: 'vbai-staging-7a17c2af',
  storageBucket: 'vbai-staging-7a17c2af.firebasestorage.app',
  messagingSenderId: '684023952241',
  appId: '1:684023952241:web:teststagingappid',
};

assert.doesNotThrow(() => {
  validateEnvironmentConfig(stagingConfig, {
    appEnvironment: 'staging',
  });
});

console.log('  PASS: complete isolated staging config validates');

assert.throws(
  () => {
    validateEnvironmentConfig(firebaseConfig, {
      appEnvironment: 'staging',
    });
  },
  /Staging must use the isolated staging Firebase project/,
  'Staging must reject the production Firebase project'
);

console.log('  PASS: staging rejects production project');

assert.throws(
  () => {
    validateEnvironmentConfig(
      {
        ...stagingConfig,
        apiKey: '',
      },
      {
        appEnvironment: 'staging',
      }
    );
  },
  /Missing required Firebase fields/,
  'Staging must reject missing Firebase values'
);

console.log('  PASS: staging rejects missing values');

assert.throws(
  () => {
    validateEnvironmentConfig(
      {
        ...stagingConfig,
        messagingSenderId: '999999999999',
      },
      {
        appEnvironment: 'staging',
      }
    );
  },
  /sender ID is not isolated/,
  'Staging must reject mismatched Firebase identity'
);

console.log('  PASS: staging rejects mismatched identity');

assert.throws(
  () => {
    validateEnvironmentConfig(stagingConfig, {
      appEnvironment: 'unknown-environment',
    });
  },
  /Unsupported application environment/
);

console.log('  PASS: unknown application environment rejected');
console.log('Firebase environment isolation tests passed.');
