'use strict';

const assert = require('node:assert/strict');
const {
  buildBosungMetadataIndex,
  findDuplicateTopLevelKeys,
  parseBosungMetadata,
} = require('../../legal/repositories/bosung-metadata-index');

assert.deepEqual(findDuplicateTopLevelKeys('{"same":{},"same":{}}'), ['same']);
assert.throws(
  () => parseBosungMetadata('{"same":{},"same":{}}'),
  /Duplicate top-level source keys/,
  'duplicate JSON keys must fail closed before JSON.parse can silently overwrite them'
);

const raw = {
  z: { so_hieu: '1/2026/QH', trich_yeu: 'A', original_filename: 'z.pdf' },
  a: { so_hieu: '1/2026/qh', trich_yeu: 'A', original_filename: 'a.docx' },
  b: { so_hieu: '2/2026/QH', trich_yeu: 'B1' },
  c: { so_hieu: '2/2026/QH', trich_yeu: 'B2' },
  d: { so_hieu: '3/2026/QH', trich_yeu: 'D' },
  e: { so_hieu: '4/2026/QH', trich_yeu: 'E' },
  f: { so_hieu: '4/2026/QH', trich_yeu: 'E', tom_tat_chuong_dieu: 'Details' },
};

const unresolved = buildBosungMetadataIndex(raw, { schemaVersion: 1, resolutions: [] });
assert.equal(unresolved.records.get('1/2026/QH').sourceKey, 'a', 'identical duplicates choose lexical source key');
assert.equal(unresolved.records.has('2/2026/QH'), false, 'unresolved conflicting duplicate fails closed');
assert.equal(unresolved.records.get('3/2026/QH').sourceKey, 'd');
assert.equal(unresolved.records.get('4/2026/QH').record.tom_tat_chuong_dieu, 'Details');
assert.equal(unresolved.diagnostics.duplicateGroups, 3);
assert.equal(unresolved.diagnostics.identicalGroups, 1);
assert.equal(unresolved.diagnostics.mergedComplementaryGroups, 1);
assert.equal(unresolved.diagnostics.unresolvedConflicts.length, 1);

const resolved = buildBosungMetadataIndex(raw, {
  schemaVersion: 1,
  resolutions: [{
    so_hieu: '2/2026/QH',
    canonical_source_key: 'c',
    reason: 'Reviewed against the official source',
    reviewed_by: 'legal-reviewer',
    reviewed_at: '2026-08-12T10:00:00+07:00',
  }],
});
assert.equal(resolved.records.get('2/2026/QH').sourceKey, 'c');
assert.equal(resolved.diagnostics.resolvedConflicts, 1);
assert.equal(resolved.diagnostics.unresolvedConflicts.length, 0);

console.log('PASS bosung-metadata-index.test.cjs');
