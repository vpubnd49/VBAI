/**
 * SSRF-Safe Legal Content Fetcher.
 */
const { OFFICIAL_SOURCE_HOSTS, REFERENCE_SOURCE_HOSTS } = require('../constants/source-hosts');

const ALLOWED_HOSTS = new Set([...OFFICIAL_SOURCE_HOSTS, ...REFERENCE_SOURCE_HOSTS]);

function isAllowedHost(hostname = '') {
  const host = hostname.toLowerCase();
  for (const allowed of ALLOWED_HOSTS) {
    if (host === allowed || host.endsWith('.' + allowed)) {
      return true;
    }
  }
  return false;
}

function isPrivateIp(hostname = '') {
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '0.0.0.0') {
    return true;
  }
  if (hostname.startsWith('10.') || hostname.startsWith('192.168.') || hostname.startsWith('172.16.')) {
    return true;
  }
  return false;
}

function validateFetchUrl(rawUrl = '') {
  let parsed = null;
  try {
    parsed = new URL(rawUrl);
  } catch (e) {
    return { valid: false, reason: 'Invalid URL format' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { valid: false, reason: 'Only HTTP and HTTPS protocols are allowed' };
  }

  if (isPrivateIp(parsed.hostname)) {
    return { valid: false, reason: 'Access to private IP addresses or localhost is forbidden (SSRF protection)' };
  }

  if (!isAllowedHost(parsed.hostname)) {
    return { valid: false, reason: `Host ${parsed.hostname} is not in the allowed domain list` };
  }

  return { valid: true, url: parsed.toString(), hostname: parsed.hostname };
}

module.exports = {
  isAllowedHost,
  isPrivateIp,
  validateFetchUrl,
};
