/**
 * Document number extraction, normalization, and verification.
 */
const FULL_DOC_NUMBER_REGEX = /\b(\d{1,4}\/\d{4}\/[A-Za-z0-9\u0110\u0111-]+)\b/i;
const STRICT_DOC_NUMBER_PATTERN = /^\d{1,4}\/\d{4}\/[A-Za-z0-9\u0110\u0111-]+$/;

function normalizeDocumentNumber(rawNumber = '') {
  if (!rawNumber) return '';
  let cleaned = String(rawNumber).trim().toUpperCase();
  cleaned = cleaned.replace(/\s+/g, '');
  return cleaned;
}

function extractFullDocumentNumber(text = '') {
  if (!text) return null;
  const match = String(text).match(FULL_DOC_NUMBER_REGEX);
  if (match) {
    return normalizeDocumentNumber(match[1]);
  }
  return null;
}

function isFullDocumentNumber(number = '') {
  if (!number) return false;
  const norm = normalizeDocumentNumber(number);
  return STRICT_DOC_NUMBER_PATTERN.test(norm);
}

function extractPartialDocumentNumber(text = '') {
  if (!text) return null;
  const match = String(text).match(/\b(\d{1,4}\/\d{4})\b/);
  return match ? match[1] : null;
}

module.exports = {
  FULL_DOC_NUMBER_REGEX,
  STRICT_DOC_NUMBER_PATTERN,
  normalizeDocumentNumber,
  extractFullDocumentNumber,
  isFullDocumentNumber,
  extractPartialDocumentNumber,
};
