import assert from 'node:assert/strict';
import { setActiveDocumentContext, getActiveDocumentContext, clearActiveDocumentContext } from '../modules/legal/conversation-memory.js';

clearActiveDocumentContext();
assert.equal(getActiveDocumentContext().documentNumber, null);

setActiveDocumentContext('72/2025/QH15', 'Luật an ninh mạng');
assert.equal(getActiveDocumentContext().documentNumber, '72/2025/QH15');
assert.equal(getActiveDocumentContext().title, 'Luật an ninh mạng');

console.log('PASS legal-conversation-memory.test.mjs');
