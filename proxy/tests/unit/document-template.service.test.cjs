'use strict';

const assert = require('node:assert/strict');
const service = require('../../services/document-template.service');

const catalog = service.loadCatalog(true);
assert.equal(catalog.schemaVersion, 1);
assert.equal(service.validateCatalog(catalog).valid, true);
assert.deepEqual(
  service.listTemplates().map((item) => item.type),
  ['QUYET_DINH', 'THONG_BAO', 'KE_HOACH', 'CONG_VAN', 'GIAY_MOI', 'KET_LUAN', 'BIEN_BAN', 'TO_TRINH', 'NGHI_QUYET']
);
assert.equal(service.listTemplates({ keyword: 'quyết định' })[0].type, 'QUYET_DINH');
assert.equal(service.getTemplate('giay-moi-hoi-nghi').title, 'Giấy mời hội nghị');
assert.equal(service.select({ type: 'KET_LUAN', format: 'meeting', purpose: 'thông báo kết luận' }).id, 'ket-luan-cuoc-hop');
assert.equal(service.select({ type: 'NGHI_QUYET', format: 'HD05' }).id, 'nghi-quyet-du-thao');
assert.equal(service.getTemplate('ket-luan-cuoc-hop').templateVersion, 'catalog-1');
assert.equal(catalog.policy.metadataOnly, true);
assert.equal(catalog.policy.binaryCopied, false);
assert.equal(catalog.policy.rawContentExposed, false);
assert.equal(catalog.policy.piiIncluded, false);

const valid = service.resolve('giay-moi-hoi-nghi', {
  coQuanMoi: 'UBND tỉnh', soKyHieu: '01/GM', ngayMoi: '05/09/2026',
  thoiGian: '08:00', diaDiem: 'Phòng họp', thanhPhan: 'Đại biểu',
});
assert.equal(valid.valid, true);
assert.deepEqual(valid.missingRequired, []);
assert.equal(service.validate('giay-moi-hoi-nghi', {}).valid, false);
assert.equal(service.validate('giay-moi-hoi-nghi', {}).errors.length, 6);
assert.equal(service.getTemplate('../secret'), null);
assert.equal(service.applyPlaceholders('Kính gửi {{coQuan}} — {{missing}}', { coQuan: 'Sở Nội vụ' }), 'Kính gửi Sở Nội vụ — {{missing}}');
assert.deepEqual(service.extractPlaceholders('{{a}} {{a}} {{b}}'), ['a', 'b']);
for (const item of catalog.templates) {
  assert.equal(item.sourcePath.includes('..'), false);
  assert.equal(item.sourcePath.startsWith('bosung/'), true);
}
console.log('PASS document-template.service.test.cjs');
