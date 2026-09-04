'use strict';
const assert = require('assert');
const { extractAssistantText } = require('../../lib/provider-response');

assert.strictEqual(extractAssistantText({ choices: [{ message: { content: 'hello' } }] }), 'hello');
assert.strictEqual(extractAssistantText({ choices: [{ message: { content: [{ type: 'text', text: 'json' }] } }] }), 'json');
assert.strictEqual(extractAssistantText({ output_text: '{"ok":true}' }), '{"ok":true}');
console.log('Provider response parsing tests passed.');
