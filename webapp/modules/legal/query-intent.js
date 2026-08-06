/**
 * Client query intent detection.
 */
export function extractDocNumberFromQuery(query = '') {
  const match = String(query).match(/\b(\d{1,4}\/\d{4}\/[A-Za-z0-9\u0110\u0111-]+)\b/);
  return match ? match[1].toUpperCase() : null;
}

export function isFreshnessNeeded(query = '') {
  const q = String(query).toLowerCase();
  return /(mới nhất|hiện hành|hiệu lực|sửa đổi|bổ sung|thay thế|bãi bỏ|cập nhật)/.test(q);
}

export function isExtractRequested(query = '') {
  const q = String(query).toLowerCase();
  return /(điều|khoản|điểm|trích|nội dung điều)/.test(q);
}
