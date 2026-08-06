import assert from 'node:assert/strict';
import { renderCitationBadge } from '../modules/legal/citation-renderer.js';

const html = renderCitationBadge({ title: 'Cổng thông tin', url: 'https://vbpl.vn', sourceTier: 'official' });
assert.ok(html.includes('badge-official'));
assert.ok(html.includes('https://vbpl.vn'));

console.log('PASS legal-citation-renderer.test.mjs');
