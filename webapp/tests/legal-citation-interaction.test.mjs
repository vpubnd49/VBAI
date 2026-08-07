import assert from 'node:assert/strict';
import { renderCitationChip, replaceCitationsWithChips } from '../modules/legal/citation-renderer.js';

console.log('[TEST] Running Legal Citation Interaction Tests...');

const citation = {
  id: '30/2020/NĐ-CP',
  documentNumber: '30/2020/NĐ-CP',
  title: 'Nghị định số 30/2020/NĐ-CP về công tác văn thư',
  sourceTier: 'official',
  effectiveStatus: 'ACTIVE',
  coordinate: { raw: 'Điều 15 Khoản 1' }
};

const chipHtml = renderCitationChip(citation);

assert.ok(chipHtml.includes('30/2020/NĐ-CP'), 'Citation chip must include document number');
assert.ok(chipHtml.includes('chip-official'), 'Official citation chip must include chip-official class');
assert.ok(chipHtml.includes('data-citation-id="30/2020/NĐ-CP"'), 'Citation chip must contain data-citation-id attribute for interaction');

const text = 'Theo quy định tại [30/2020/NĐ-CP], văn bản phải đúng thể thức.';
const citationsMap = {
  '30/2020/NĐ-CP': citation
};

const replaced = replaceCitationsWithChips(text, citationsMap);
assert.ok(replaced.includes('legal-citation-chip'), 'replaceCitationsWithChips must substitute bracketed citation with interactive chip');

console.log('PASS: Legal citation interaction chips verified.');
