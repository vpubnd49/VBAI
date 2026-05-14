export function shouldEnforceTwoTierTerminology(normalizeFn, query = '') {
  const n = typeof normalizeFn === 'function'
    ? normalizeFn(query)
    : String(query || '').toLowerCase();
  return /(chinh quyen dia phuong|to chuc chinh quyen dia phuong|cap huyen|cap tinh|cap xa|phan cap|phan quyen|uy quyen)/.test(n);
}

export function enforceTwoTierTerminology({
  answer = '',
  query = '',
  normalizeFn,
  isCitation = false,
  isComparison = false,
} = {}) {
  let text = String(answer || '');
  if (!text.trim()) return text;
  if (!shouldEnforceTwoTierTerminology(normalizeFn, query)) return text;
  if (isCitation || isComparison) return text;

  // Chính quyền địa phương hiện hành: 2 cấp (cấp tỉnh, cấp xã).
  text = text
    .replace(/cấp\s*tỉnh\s*,\s*(?:cấp\s*)?huyện\s*(?:,|và)\s*(?:cấp\s*)?xã/gi, 'cấp tỉnh và cấp xã')
    .replace(/cap\s*tinh\s*,\s*(?:cap\s*)?huyen\s*(?:,|va)\s*(?:cap\s*)?xa/gi, 'cap tinh va cap xa')
    .replace(/mô\s*hình\s*chính\s*quyền\s*địa\s*phương\s*3\s*cấp/gi, 'mô hình chính quyền địa phương 2 cấp')
    .replace(/mo\s*hinh\s*chinh\s*quyen\s*dia\s*phuong\s*3\s*cap/gi, 'mo hinh chinh quyen dia phuong 2 cap');

  return text;
}
