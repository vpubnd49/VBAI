/**
 * VBAI SSRF Protection Guard (Server-Side Request Forgery Defense)
 * Prevents access to loopback, private networks, and cloud metadata services (e.g., 169.254.169.254).
 */
const dns = require('dns').promises;
const net = require('net');

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * Checks if an IPv4 address is private or reserved.
 */
function isPrivateIPv4(ip) {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) return true;
  
  const [b1, b2, b3, b4] = parts;
  
  // 127.0.0.0/8 (Loopback)
  if (b1 === 127) return true;
  // 10.0.0.0/8 (Private)
  if (b1 === 10) return true;
  // 172.16.0.0/12 (Private)
  if (b1 === 172 && b2 >= 16 && b2 <= 31) return true;
  // 192.168.0.0/16 (Private)
  if (b1 === 192 && b2 === 168) return true;
  // 169.254.0.0/16 (Link Local / Cloud Metadata Service)
  if (b1 === 169 && b2 === 254) return true;
  // 0.0.0.0/8 (Current network)
  if (b1 === 0) return true;
  // 100.64.0.0/10 (Shared Address Space)
  if (b1 === 100 && b2 >= 64 && b2 <= 127) return true;
  // 192.0.0.0/24 (IETF Protocol Assignments)
  if (b1 === 192 && b2 === 0 && b3 === 0) return true;
  // 198.18.0.0/15 (Benchmarking)
  if (b1 === 198 && (b2 === 18 || b2 === 19)) return true;
  // 224.0.0.0/4 (Multicast) & 240.0.0.0/4 (Reserved)
  if (b1 >= 224) return true;
  
  return false;
}

/**
 * Checks if an IPv6 address is private or loopback.
 */
function isPrivateIPv6(ip) {
  const normalized = ip.toLowerCase().trim();
  if (normalized === '::1' || normalized === '::') return true;
  // Unique local addresses (fc00::/7 -> fc00 to fdff)
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
  // Link-local addresses (fe80::/10 -> fe80 to febf)
  if (normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) return true;
  // IPv4-mapped IPv6 (::ffff:127.0.0.1, etc.)
  if (normalized.startsWith('::ffff:')) {
    const ipv4Part = normalized.substring(7);
    if (net.isIPv4(ipv4Part)) {
      return isPrivateIPv4(ipv4Part);
    }
  }
  return false;
}

/**
 * Checks if an IP is private, loopback, or reserved.
 */
function isPrivateOrReservedIP(ip) {
  if (!ip || typeof ip !== 'string') return true;
  const cleanIp = ip.trim();
  if (net.isIPv4(cleanIp)) {
    return isPrivateIPv4(cleanIp);
  }
  if (net.isIPv6(cleanIp)) {
    return isPrivateIPv6(cleanIp);
  }
  return true;
}

/**
 * Validates a target URL against SSRF attacks.
 */
async function validateUrlForSSRF(targetUrl) {
  if (!targetUrl || typeof targetUrl !== 'string') {
    return { safe: false, error: 'URL không hợp lệ hoặc rỗng.' };
  }

  let parsed;
  try {
    parsed = new URL(targetUrl.trim());
  } catch (err) {
    return { safe: false, error: 'Cấu trúc URL không đúng định dạng.' };
  }

  // 1. Check protocol
  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    return { safe: false, error: `Giao thức "${parsed.protocol}" bị chặn để phòng chống SSRF.` };
  }

  const hostname = parsed.hostname.toLowerCase();

  // 2. Check for obvious localhost / metadata names
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname === '169.254.169.254' ||
    hostname === 'metadata.google.internal' ||
    hostname === 'metadata' ||
    hostname === 'instance-data'
  ) {
    return { safe: false, error: `Tên miền/IP "${hostname}" bị chặn (Truy cập tài nguyên nội bộ).` };
  }

  // 3. If hostname is directly an IP, validate it
  if (net.isIP(hostname)) {
    if (isPrivateOrReservedIP(hostname)) {
      return { safe: false, error: `Địa chỉ IP "${hostname}" nằm trong dải mạng nội bộ bị cấm.` };
    }
    return { safe: true, parsedUrl: parsed };
  }

  // 4. Resolve DNS to detect DNS rebinding / private IP aliasing
  try {
    const addresses = await dns.lookup(hostname, { all: true });
    for (const record of addresses) {
      if (isPrivateOrReservedIP(record.address)) {
        return {
          safe: false,
          error: `Tên miền "${hostname}" phân giải về IP nội bộ/bị cấm (${record.address}).`
        };
      }
    }
  } catch (dnsErr) {
    return { safe: false, error: `Không thể phân giải tên miền: ${dnsErr.message}` };
  }

  return { safe: true, parsedUrl: parsed };
}

/**
 * Safe fetch wrapper that enforces SSRF validation before issuing the HTTP request.
 */
async function safeFetch(targetUrl, options = {}) {
  const check = await validateUrlForSSRF(targetUrl);
  if (!check.safe) {
    const error = new Error(`[SSRF Blocked] ${check.error}`);
    error.name = 'SSRFBlockedError';
    error.status = 403;
    throw error;
  }

  return await fetch(targetUrl, options);
}

module.exports = {
  validateUrlForSSRF,
  isPrivateOrReservedIP,
  safeFetch
};
