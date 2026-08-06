/**
 * Source tier classification for legal verification.
 */
const { OFFICIAL_SOURCE_HOSTS, REFERENCE_SOURCE_HOSTS } = require('../constants/source-hosts');

function getHostFromUrl(url = '') {
  try {
    const parsed = new URL(url);
    return parsed.hostname.toLowerCase();
  } catch (e) {
    return '';
  }
}

function classifySourceTier(url = '') {
  const host = getHostFromUrl(url);
  if (!host) return 'unknown';

  for (const officialHost of OFFICIAL_SOURCE_HOSTS) {
    if (host === officialHost || host.endsWith('.' + officialHost)) {
      return 'official';
    }
  }

  for (const refHost of REFERENCE_SOURCE_HOSTS) {
    if (host === refHost || host.endsWith('.' + refHost)) {
      return 'reference';
    }
  }

  return 'unknown';
}

function isOfficialSource(url = '') {
  return classifySourceTier(url) === 'official';
}

module.exports = {
  getHostFromUrl,
  classifySourceTier,
  isOfficialSource,
};
