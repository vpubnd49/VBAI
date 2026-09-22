/**
 * Crawler + link-reference adapter for Cổng Chính phủ (chinhphu.vn).
 *
 * Key capabilities:
 *  - Build canonical search URLs for user-facing links
 *  - Fetch + parse HTML listings to extract document metadata + direct PDF links
 *  - Resolve PDF download URLs from datafiles.chinhphu.vn
 *
 * The portal uses ASP.NET WebForms with server-side rendering.
 * Document listings contain embedded PDF links → single page fetch = all metadata.
 */
'use strict';

const { SOURCE_REGISTRY } = require('../constants/source-registry');

const CHINHPHU_BASE = 'https://chinhphu.vn';
const CHINHPHU_LISTING_PAGE = '/?pageid=41852&mode=0';
const CHINHPHU_DETAIL_PAGEID = 27160;
const DATAFILES_BASE = 'https://datafiles.chinhphu.vn/cpp/files/vbpq';

const CHINHPHU_SOURCE = SOURCE_REGISTRY.chinhphu_gov;

// Simple in-memory cache with TTL
const _cache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function _getCached(key) {
  const entry = _cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    _cache.delete(key);
    return null;
  }
  return entry.data;
}

function _setCache(key, data) {
  // Evict oldest when cache grows too large
  if (_cache.size > 200) {
    const oldest = _cache.keys().next().value;
    _cache.delete(oldest);
  }
  _cache.set(key, { data, ts: Date.now() });
}

// ──────────────────────────────────────────────
// URL Builders
// ──────────────────────────────────────────────

function buildChinhphuSearchUrl(keyword = '') {
  // The chinhphu.vn search is PostBack-based, but the listing page URL is stable
  const value = String(keyword || '').trim();
  if (!value) return `${CHINHPHU_BASE}${CHINHPHU_LISTING_PAGE}`;
  // For keyword search, we still link to the listing page
  // (actual search requires PostBack, user will need to search manually)
  return `${CHINHPHU_BASE}${CHINHPHU_LISTING_PAGE}`;
}

function buildChinhphuDetailUrl(docid = '') {
  const value = String(docid || '').trim();
  if (!value) return buildChinhphuSearchUrl();
  if (/^https?:\/\//i.test(value)) return value;
  return `${CHINHPHU_BASE}/?pageid=${CHINHPHU_DETAIL_PAGEID}&docid=${encodeURIComponent(value)}`;
}

/**
 * Attempt to predict PDF URL from document metadata.
 * Pattern: datafiles.chinhphu.vn/cpp/files/vbpq/{YYYY}/{M}/{number}_{type}_{ddmmyyyy}-signed.signed.pdf
 *
 * @param {string} docNumber e.g. "1805/QĐ-TTg"
 * @param {string} issueDate e.g. "18/09/2026" or "18-09-2026"
 * @returns {string|null}
 */
function predictPdfUrl(docNumber = '', issueDate = '') {
  if (!docNumber || !issueDate) return null;
  try {
    // Parse document number: "1805/QĐ-TTg" → number=1805, type=qd-ttg
    const parts = String(docNumber).split('/');
    if (parts.length < 2) return null;
    const num = parts[0].trim();
    // Combine remaining parts and normalize to ASCII lowercase with hyphens
    const typeParts = parts.slice(1).join('-')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    // Parse date
    const dateParts = String(issueDate).replace(/-/g, '/').split('/');
    if (dateParts.length < 3) return null;
    const day = dateParts[0].padStart(2, '0');
    const month = dateParts[1].padStart(2, '0');
    const year = dateParts[2];

    const dateStr = `${day}${month}${year}`;
    const filename = `${num}_${typeParts}_${dateStr}-signed.pdf`;
    return `${DATAFILES_BASE}/${year}/${parseInt(month, 10)}/${filename}`;
  } catch (_) {
    return null;
  }
}

// ──────────────────────────────────────────────
// HTML Parser — Extract documents from listing page
// ──────────────────────────────────────────────

/**
 * Parse HTML from chinhphu.vn listing page → array of document objects.
 * Each object includes metadata + direct PDF download link if available.
 *
 * Actual HTML structure (discovered via live analysis):
 *   <tr>
 *     <td>
 *       <a href='/?pageid=27160&docid=219538'>
 *         <span class="code">1805 /QĐ-TTg</span>
 *         <span class="issue-v2">18/09/2026</span>
 *       </a>
 *     </td>
 *     <td><span class="issued-date">18/09/2026</span></td>
 *     <td>
 *       <a href='/?pageid=27160&docid=219538'>
 *         <span class="substract">Phê duyệt sắp xếp...</span>
 *       </a>
 *       <div class="bl-doc-files">
 *         <div class="bl-doc-file">
 *           <a href="https://datafiles.chinhphu.vn/.../file.pdf" target="_blank" download>Tài liệu đính kèm</a>
 *         </div>
 *       </div>
 *     </td>
 *   </tr>
 */
function parseListingHtml(html = '') {
  if (!html) return [];
  const results = [];

  // Strategy: parse each <tr> that contains pageid=27160 detail links
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;
  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const rowHtml = rowMatch[1];

    // Must contain a detail link to pageid=27160
    const detailLinkMatch = rowHtml.match(/href\s*=\s*['"][^'"]*pageid=27160[^'"]*docid=(\d+)[^'"]*['"]/i);
    if (!detailLinkMatch) continue;

    const docid = detailLinkMatch[1];

    // Extract document number from <span class="code">
    const codeMatch = rowHtml.match(/<span\s+class\s*=\s*["']code["'][^>]*>([\s\S]*?)<\/span>/i);
    const docNumber = codeMatch
      ? codeMatch[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
      : '';

    // Extract issue date from <span class="issue-v2"> or <span class="issued-date">
    const dateMatch = rowHtml.match(/<span\s+class\s*=\s*["'](?:issue-v2|issued-date)["'][^>]*>([\s\S]*?)<\/span>/i);
    const issueDate = dateMatch
      ? dateMatch[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
      : '';

    // Extract title from <span class="substract">
    const titleMatch = rowHtml.match(/<span\s+class\s*=\s*["']substract["'][^>]*>([\s\S]*?)<\/span>/i);
    const title = titleMatch
      ? titleMatch[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
      : '';

    if (!docNumber && !title) continue;

    // Extract PDF link from <div class="bl-doc-file"> → <a href="...pdf">
    const pdfMatch = rowHtml.match(/<div\s+class\s*=\s*["']bl-doc-file["'][^>]*>\s*<a\s+href\s*=\s*["'](https?:\/\/datafiles\.chinhphu\.vn\/[^"'\s]+\.pdf)["']/i);
    // Fallback: any PDF link in the row
    const pdfMatchFallback = !pdfMatch
      ? rowHtml.match(/href\s*=\s*["'](https?:\/\/datafiles\.chinhphu\.vn\/cpp\/files\/[^"'\s]+\.pdf)["']/i)
      : null;
    const pdfUrl = pdfMatch ? pdfMatch[1] : (pdfMatchFallback ? pdfMatchFallback[1] : null);

    results.push({
      docid,
      title,
      documentNumber: docNumber,
      issueDate,
      issuer: '',  // Not directly available in listing rows
      pdfUrl: pdfUrl || null,
      pdfVerified: Boolean(pdfUrl), // true if link was found in HTML
      detailUrl: buildChinhphuDetailUrl(docid),
      source: 'chinhphu_gov',
      sourceUrl: buildChinhphuDetailUrl(docid),
    });
  }

  return results;
}

/**
 * Parse a detail page HTML to extract document metadata + PDF link.
 */
function parseDetailHtml(html = '') {
  if (!html) return null;

  const result = {
    title: '',
    documentNumber: '',
    issueDate: '',
    issuer: '',
    signer: '',
    documentType: '',
    pdfUrl: null,
    summary: '',
  };

  // Extract title
  const titleMatch = html.match(/<h1[^>]*class\s*=\s*["'][^"']*doc-title[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i)
    || html.match(/<div[^>]*class\s*=\s*["'][^"']*doc-title[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)
    || html.match(/<span[^>]*class\s*=\s*["'][^"']*heading-1[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);
  if (titleMatch) {
    result.title = titleMatch[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  }

  // Extract PDF link
  const pdfMatch = html.match(/href\s*=\s*["'](https?:\/\/datafiles\.chinhphu\.vn\/cpp\/files\/[^"'\s]+\.pdf)["']/i);
  if (pdfMatch) {
    result.pdfUrl = pdfMatch[1];
  }

  // Extract metadata fields using common label patterns
  const metaPatterns = [
    { key: 'documentNumber', regex: /(?:Số\s*(?:ký\s*hiệu|hiệu))\s*[:：]\s*([^<\n]+)/i },
    { key: 'issueDate', regex: /(?:Ngày\s*ban\s*hành)\s*[:：]\s*([^<\n]+)/i },
    { key: 'issuer', regex: /(?:Cơ\s*quan\s*ban\s*hành)\s*[:：]\s*([^<\n]+)/i },
    { key: 'signer', regex: /(?:Người\s*ký)\s*[:：]\s*([^<\n]+)/i },
    { key: 'documentType', regex: /(?:Loại\s*văn\s*bản)\s*[:：]\s*([^<\n]+)/i },
  ];

  const plainText = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ');
  for (const { key, regex } of metaPatterns) {
    const match = plainText.match(regex);
    if (match) {
      result[key] = match[1].replace(/\s+/g, ' ').trim();
    }
  }

  return result;
}

// ──────────────────────────────────────────────
// Fetch helpers (SSRF-safe)
// ──────────────────────────────────────────────

async function _fetchSafe(url, timeoutMs = 15000) {
  const { URL } = require('url');
  const parsed = new URL(url);
  const allowed = ['chinhphu.vn', 'vanban.chinhphu.vn', 'datafiles.chinhphu.vn'];
  const hostname = parsed.hostname.toLowerCase();
  if (!allowed.some(h => hostname === h || hostname.endsWith('.' + h))) {
    throw new Error(`SSRF blocked: ${hostname}`);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'VBAI-LegalBot/1.0 (+https://vbai.tracuu.lamdong.vn)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.5',
      },
    });
    return resp;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Verify a PDF URL exists by sending a HEAD request.
 * Returns the URL if it exists (HTTP 200), null otherwise.
 */
async function verifyPdfUrl(url) {
  if (!url) return null;
  try {
    const resp = await _fetchSafe(url, 8000);
    // Accept the response even without reading body
    if (resp.ok) {
      // Drain body
      try { await resp.text(); } catch (_) {}
      return url;
    }
    try { await resp.text(); } catch (_) {}
    return null;
  } catch (_) {
    return null;
  }
}

// ──────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────

/**
 * Fetch document listing from chinhphu.vn and extract metadata + PDF links.
 * Returns array of document objects with direct PDF download URLs.
 *
 * @param {string} keyword Search keyword (optional)
 * @param {number} limit Max results to return
 * @returns {Promise<Array>}
 */
async function fetchChinhphuDocuments(keyword = '', limit = 20) {
  const cacheKey = `chinhphu:listing:${String(keyword || '').trim().toLowerCase()}`;
  const cached = _getCached(cacheKey);
  if (cached) return cached.slice(0, limit);

  try {
    // Fetch the listing page
    const listingUrl = `${CHINHPHU_BASE}${CHINHPHU_LISTING_PAGE}`;
    const resp = await _fetchSafe(listingUrl);
    if (!resp.ok) {
      console.warn(`[chinhphu-crawler] Listing fetch failed: HTTP ${resp.status}`);
      return _buildFallbackResult(keyword);
    }

    const html = await resp.text();
    let docs = parseListingHtml(html);

    // Filter by keyword if provided
    if (keyword) {
      const kw = keyword.trim().toLowerCase();
      docs = docs.filter(d => {
        const text = `${d.title} ${d.documentNumber} ${d.issuer}`.toLowerCase();
        return text.includes(kw);
      });
    }

    const result = docs.slice(0, limit);
    _setCache(cacheKey, docs);
    return result;
  } catch (err) {
    console.warn(`[chinhphu-crawler] Error fetching listing:`, err.message);
    return _buildFallbackResult(keyword);
  }
}

/**
 * Fetch a single document's detail page from chinhphu.vn.
 *
 * @param {string} docid The chinhphu.vn docid
 * @returns {Promise<Object|null>}
 */
async function fetchChinhphuDocumentDetail(docid = '') {
  if (!docid) return null;
  const cacheKey = `chinhphu:detail:${docid}`;
  const cached = _getCached(cacheKey);
  if (cached) return cached;

  try {
    const url = buildChinhphuDetailUrl(docid);
    const resp = await _fetchSafe(url);
    if (!resp.ok) return null;

    const html = await resp.text();
    const result = parseDetailHtml(html);
    if (result) {
      result.docid = docid;
      result.detailUrl = url;
      result.source = 'chinhphu_gov';
      _setCache(cacheKey, result);
    }
    return result;
  } catch (err) {
    console.warn(`[chinhphu-crawler] Error fetching detail for docid=${docid}:`, err.message);
    return null;
  }
}

/**
 * Search for a specific document by number and return with PDF link.
 * Tries multiple strategies:
 *  1. Search in cached listing
 *  2. Predict PDF URL from document number + date
 *  3. Return fallback link-reference
 *
 * @param {string} docNumber e.g. "1805/QĐ-TTg"
 * @param {Object} opts Additional options
 * @returns {Promise<Object>}
 */
async function resolveChinhphuDocument(docNumber = '', opts = {}) {
  if (!docNumber) return null;
  const normDocNum = String(docNumber).trim().toUpperCase().replace(/\s+/g, '');

  // Strategy 1: Check cached listing data (exact match only)
  for (const [, entry] of _cache) {
    if (!Array.isArray(entry.data)) continue;
    const found = entry.data.find(d => {
      const dn = String(d.documentNumber || '').toUpperCase().replace(/\s+/g, '');
      return dn === normDocNum;
    });
    if (found) return found;
  }

  // Strategy 2: Try to fetch from listing (exact match only)
  try {
    const docs = await fetchChinhphuDocuments('', 50);
    const found = docs.find(d => {
      const dn = String(d.documentNumber || '').toUpperCase().replace(/\s+/g, '');
      return dn === normDocNum;
    });
    if (found) return found;
  } catch (_) {}

  // Strategy 2.5: Check official source URLs for chinhphu docid to crawl detail page directly
  const officialUrls = Array.isArray(opts.official_source_urls)
    ? opts.official_source_urls
    : (opts.officialUrl ? [opts.officialUrl] : []);
  for (const u of officialUrls) {
    const docidMatch = String(u).match(/docid=(\d+)/i);
    if (docidMatch) {
      try {
        const detail = await fetchChinhphuDocumentDetail(docidMatch[1]);
        if (detail && detail.pdfUrl) {
          return {
            documentNumber: docNumber,
            title: opts.title || detail.title || `Văn bản số ${docNumber}`,
            pdfUrl: detail.pdfUrl,
            pdfVerified: true,
            detailUrl: detail.detailUrl || u,
            source: 'chinhphu_gov',
            sourceUrl: detail.detailUrl || u,
          };
        }
      } catch (_) {}
    }
  }

  // Strategy 3: Predict PDF URL if we have issue date (only if verified via HTTP HEAD)
  const issueDate = opts.issueDate || opts.issue_date || null;
  if (issueDate) {
    const predicted = predictPdfUrl(docNumber, issueDate);
    if (predicted) {
      const verified = await verifyPdfUrl(predicted);
      if (verified) {
        return {
          documentNumber: docNumber,
          title: opts.title || `Văn bản số ${docNumber}`,
          pdfUrl: verified,
          pdfVerified: true,
          detailUrl: buildChinhphuSearchUrl(docNumber),
          source: 'chinhphu_gov',
          sourceUrl: buildChinhphuSearchUrl(docNumber),
        };
      }
    }
  }

  // Strategy 4: Return link-reference fallback
  return {
    documentNumber: docNumber,
    title: opts.title || `Tra cứu VB ${docNumber} trên Cổng Chính phủ`,
    pdfUrl: null,
    pdfVerified: false,
    detailUrl: buildChinhphuSearchUrl(docNumber),
    source: 'chinhphu_gov',
    sourceUrl: buildChinhphuSearchUrl(docNumber),
    link_reference: true,
  };
}

function _buildFallbackResult(keyword = '') {
  const searchUrl = buildChinhphuSearchUrl(keyword);
  return [{
    documentNumber: '',
    title: `Tra cứu văn bản trên Cổng Chính phủ${keyword ? `: ${String(keyword).trim()}` : ''}`,
    pdfUrl: null,
    pdfVerified: false,
    detailUrl: searchUrl,
    source: 'chinhphu_gov',
    sourceUrl: searchUrl,
    source_feed: 'chinhphu.vn',
    link_reference: true,
    query: String(keyword || '').trim(),
  }];
}

module.exports = {
  buildChinhphuSearchUrl,
  buildChinhphuDetailUrl,
  predictPdfUrl,
  parseListingHtml,
  parseDetailHtml,
  fetchChinhphuDocuments,
  fetchChinhphuDocumentDetail,
  resolveChinhphuDocument,
  verifyPdfUrl,
};
