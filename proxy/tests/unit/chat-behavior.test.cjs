'use strict';
const assert = require('assert');
const {
  createConversationMemory,
  classifyIntent,
  buildBehaviorContext,
  normalizeResponseMeta,
} = require('../../services/chat-behavior.service');

const memory = createConversationMemory({ ttlMs: 1000, maxTurns: 2, maxSessions: 1 });
memory.append('u1', 's1', [
  { role: 'user', content: 'câu hỏi một' },
  { role: 'assistant', content: 'trả lời một' },
  { role: 'user', content: 'câu hỏi hai' },
]);
assert.deepStrictEqual(memory.get('u1', 's1').map((x) => x.content), ['trả lời một', 'câu hỏi hai']);
assert.strictEqual(memory.get('u1', 'missing').length, 0);
assert.strictEqual(memory.get('u1', 's1', Date.now() + 1001).length, 0, 'memory must expire by TTL');

const legal = classifyIntent('Điều 5 nghị định này còn hiệu lực không?');
assert.strictEqual(legal.category, 'legal');
assert.strictEqual(legal.intent, 'legal_search');
assert.strictEqual(classifyIntent('cụ thể hơn').isFollowUp, true);
const context = buildBehaviorContext(memory, 'u2', 's2', 'soạn công văn');
assert.strictEqual(context.intent.category, 'document_drafting');
assert.strictEqual(normalizeResponseMeta({}, { intent: legal, turns: [], memoryEnabled: false }).behavior.memory_enabled, false);
console.log('Chat behavior memory/routing tests passed.');
