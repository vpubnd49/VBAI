/**
 * Normalize Vietnamese text for legal matching and searches.
 */
function normalizeVietnamese(text = '') {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0111/g, 'd')
    .replace(/\u0110/g, 'd');
}

function cleanLegalQueryText(text = '') {
  return String(text || '')
    .trim()
    .replace(/\s+/g, ' ');
}

function removePunctuation(text = '') {
  return String(text || '')
    .replace(/[^\w\s\/-]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = {
  normalizeVietnamese,
  cleanLegalQueryText,
  removePunctuation,
};
