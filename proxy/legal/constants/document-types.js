/**
 * Standard legal document types in Vietnam legal system.
 */
const DOCUMENT_TYPES = Object.freeze({
  LUAT: 'luat',
  NGHI_DINH: 'nghi_dinh',
  THONG_TU: 'thong_tu',
  QUYET_DINH: 'quyet_dinh',
  NGHI_QUYET: 'nghi_quyet',
  CHITHI: 'chi_thi',
  CONG_VAN: 'cong_van',
  HIEN_PHAP: 'hien_phap',
  UNKNOWN: 'unknown',
});

const DOCUMENT_TYPE_ALIASES = Object.freeze({
  'luat': DOCUMENT_TYPES.LUAT,
  'bộ luật': DOCUMENT_TYPES.LUAT,
  'bo luat': DOCUMENT_TYPES.LUAT,
  'nghị định': DOCUMENT_TYPES.NGHI_DINH,
  'nghi dinh': DOCUMENT_TYPES.NGHI_DINH,
  'thông tư': DOCUMENT_TYPES.THONG_TU,
  'thong tu': DOCUMENT_TYPES.THONG_TU,
  'quyết định': DOCUMENT_TYPES.QUYET_DINH,
  'quyet dinh': DOCUMENT_TYPES.QUYET_DINH,
  'nghị quyết': DOCUMENT_TYPES.NGHI_QUYET,
  'nghi quyet': DOCUMENT_TYPES.NGHI_QUYET,
  'chỉ thị': DOCUMENT_TYPES.CHITHI,
  'chi thi': DOCUMENT_TYPES.CHITHI,
  'công văn': DOCUMENT_TYPES.CONG_VAN,
  'cong van': DOCUMENT_TYPES.CONG_VAN,
  'hiến pháp': DOCUMENT_TYPES.HIEN_PHAP,
  'hien phap': DOCUMENT_TYPES.HIEN_PHAP,
});

module.exports = {
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_ALIASES,
};
