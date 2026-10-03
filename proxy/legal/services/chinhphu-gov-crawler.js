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

const CHINHPHU_BASE = 'https://vanban.chinhphu.vn';
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
  // vanban.chinhphu.vn uses ASP.NET PostBack for search — no URL-based search available
  // Link to homepage where users can manually enter the keyword
  return 'https://vanban.chinhphu.vn/';
}

function buildChinhphuDetailUrl(docid = '') {
  const value = String(docid || '').trim();
  if (!value) return buildChinhphuSearchUrl();
  if (/^https?:\/\//i.test(value)) return value;
  return `${CHINHPHU_BASE}/?pageid=${CHINHPHU_DETAIL_PAGEID}&docid=${encodeURIComponent(value)}`;
}

/**
 * Attempt to predict PDF URL from document metadata.
 * Real chinhphu.vn PDF patterns observed:
 *   - 243-cp.signed.pdf
 *   - 243-nd-cp.signed.pdf  (NĐ-CP → nd-cp)
 *   - 31-2024-qh15_3.pdf
 *   - 1805_qd-ttg_18092026-signed.pdf
 *
 * Returns an ARRAY of candidate URLs to try with HTTP HEAD.
 *
 * @param {string} docNumber e.g. "243/2025/NĐ-CP" or "1805/QĐ-TTg"
 * @param {string} issueDate e.g. "18/09/2026" or "2026-09-18"
 * @returns {string[]}
 */
function predictPdfUrl(docNumber = '', issueDate = '') {
  if (!docNumber) return [];
  try {
    const parts = String(docNumber).split('/');
    if (parts.length < 2) return [];
    const num = parts[0].trim();

    // Normalize type: "NĐ-CP" → "nd-cp", "QĐ-TTg" → "qd-ttg"
    const typeParts = parts.slice(1).join('-')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    // Extract year from doc number (e.g. "243/2025/NĐ-CP" → 2025)
    const yearFromNum = parts.find(p => /^20\d{2}$/.test(p.trim()));

    // Parse issue date if provided (dd/mm/yyyy or yyyy-mm-dd)
    let year = '', month = '', day = '';
    if (issueDate) {
      const ds = String(issueDate).trim();
      if (/^\d{4}-\d{2}-\d{2}/.test(ds)) {
        // yyyy-mm-dd format
        [year, month, day] = ds.split(/[-T]/);
      } else {
        const dp = ds.replace(/-/g, '/').split('/');
        if (dp.length >= 3) { day = dp[0]; month = dp[1]; year = dp[2]; }
      }
    }
    if (!year && yearFromNum) year = yearFromNum;
    if (!year) return [];
    month = month || '1';
    const monthNum = parseInt(month, 10);

    // Short type for simple patterns: "NĐ-CP" → "cp", "QĐ-TTg" → "ttg"
    const lastType = (parts[parts.length - 1] || '')
      .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd')
      .replace(/[^a-z0-9]/g, '').trim();

    const candidates = [];
    const base = `${DATAFILES_BASE}/${year}/${monthNum}`;

    // Pattern 1: 243-cp.signed.pdf (most common for NĐ-CP)
    candidates.push(`${base}/${num}-${lastType}.signed.pdf`);
    // Pattern 2: 243-nd-cp.signed.pdf
    candidates.push(`${base}/${num}-${typeParts}.signed.pdf`);
    // Pattern 3: 376_nd-cp_ddmmyyyy-signed.pdf (old format)
    if (day) {
      const dateStr = `${day.padStart(2,'0')}${month.padStart(2,'0')}${year}`;
      candidates.push(`${base}/${num}_${typeParts}_${dateStr}-signed.pdf`);
      // Pattern 3b: 376_nd-cp_ddmmyyyy-signed.signed.pdf (double signed — very common!)
      candidates.push(`${base}/${num}_${typeParts}_${dateStr}-signed.signed.pdf`);
    }
    // Pattern 4: 376_2026_nd-cp_ddmmyyyy-signed.signed.pdf (with year in filename)
    if (day) {
      const dateStr = `${day.padStart(2,'0')}${month.padStart(2,'0')}${year}`;
      candidates.push(`${base}/${num}_${year}_${typeParts}_${dateStr}-signed.signed.pdf`);
      candidates.push(`${base}/${num}_${year}_${typeParts}_${dateStr}-signed.pdf`);
    }
    // Pattern 5: 243-2025-nd-cp.pdf or 31-2024-qh15.pdf
    candidates.push(`${base}/${num}-${year}-${typeParts}.pdf`);
    // Pattern 6: Try adjacent months (docs sometimes filed under different month)
    const adjMonth = monthNum > 1 ? monthNum - 1 : monthNum + 1;
    candidates.push(`${DATAFILES_BASE}/${year}/${adjMonth}/${num}-${lastType}.signed.pdf`);
    candidates.push(`${DATAFILES_BASE}/${year}/${adjMonth}/${num}-${typeParts}.signed.pdf`);

    // Deduplicate
    return [...new Set(candidates)];
  } catch (_) {
    return [];
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
// vanban.chinhphu.vn PostBack Search
// ──────────────────────────────────────────────

/**
 * Search vanban.chinhphu.vn using ASP.NET PostBack.
 * Returns { docid, detailUrl, pdfUrl, title, documentNumber, issueDate } or null.
 */
async function searchVanbanChinhphu(keyword = '') {
  if (!keyword) return null;
  const cacheKey = `vanban:search:${String(keyword).trim().toLowerCase()}`;
  const cached = _getCached(cacheKey);
  if (cached) return cached;

  try {
    // Step 1: GET the page to obtain VIEWSTATE
    const pageUrl = 'https://vanban.chinhphu.vn/';
    const resp1 = await _fetchSafe(pageUrl);
    if (!resp1.ok) return null;
    const html1 = await resp1.text();

    const vsMatch = html1.match(/name="__VIEWSTATE"[^>]*value="([^"]*)"/);
    const evMatch = html1.match(/name="__EVENTVALIDATION"[^>]*value="([^"]*)"/);
    const vsgMatch = html1.match(/name="__VIEWSTATEGENERATOR"[^>]*value="([^"]*)"/);
    if (!vsMatch) return null;

    // Step 2: POST search
    const params = new URLSearchParams();
    params.append('__VIEWSTATE', vsMatch[1]);
    params.append('__EVENTVALIDATION', evMatch ? evMatch[1] : '');
    params.append('__VIEWSTATEGENERATOR', vsgMatch ? vsgMatch[1] : '');
    params.append('__VIEWSTATEENCRYPTED', '');
    params.append('ctrl_191017_163$txtSearchKeyword', keyword);
    params.append('ctrl_191017_163$btnSearch', 'Tìm kiếm');
    params.append('ctrl_191017_163$hidIsSearch', '1');
    params.append('ctrl_191017_163$drdRecordPerPage', '50');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const resp2 = await fetch(pageUrl, {
        method: 'POST',
        body: params.toString(),
        signal: controller.signal,
        headers: {
          'User-Agent': 'VBAI-LegalBot/1.0 (+https://vbai.tracuu.lamdong.vn)',
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'text/html',
          'Referer': pageUrl,
        },
      });
      clearTimeout(timer);
      if (!resp2.ok) return null;

      const html2 = await resp2.text();

      // Parse results
      const docidMatches = html2.match(/pageid=27160[^"']*docid=(\d+)/);
      if (!docidMatches) return null;

      const docid = docidMatches[1];
      const codeMatch = html2.match(/<span\s+class="code"[^>]*>([^<]+)<\/span>/);
      const titleMatch = html2.match(/<span\s+class="substract"[^>]*>([^<]+)<\/span>/);
      const dateMatch = html2.match(/<span\s+class="(?:issue-v2|issued-date)"[^>]*>([^<]+)<\/span>/);
      const pdfMatch = html2.match(/href="(https:\/\/datafiles\.chinhphu\.vn\/[^"]+\.pdf)"/);

      const result = {
        docid,
        documentNumber: codeMatch ? codeMatch[1].trim() : keyword,
        title: titleMatch ? titleMatch[1].trim() : '',
        issueDate: dateMatch ? dateMatch[1].trim() : '',
        pdfUrl: pdfMatch ? pdfMatch[1] : null,
        pdfVerified: Boolean(pdfMatch),
        detailUrl: `https://vanban.chinhphu.vn/default.aspx?pageid=${CHINHPHU_DETAIL_PAGEID}&docid=${docid}`,
        source: 'vanban_chinhphu',
        sourceUrl: `https://vanban.chinhphu.vn/default.aspx?pageid=${CHINHPHU_DETAIL_PAGEID}&docid=${docid}`,
      };

      _setCache(cacheKey, result);
      console.log(`[chinhphu-crawler] vanban.chinhphu.vn search: found ${result.documentNumber} → docid=${docid}, pdf=${Boolean(pdfMatch)}`);
      return result;
    } catch (e) {
      clearTimeout(timer);
      throw e;
    }
  } catch (err) {
    console.warn(`[chinhphu-crawler] vanban.chinhphu.vn search error:`, err.message);
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

  // Strategy 2.1: Fetch homepage HTML and search for doc number directly
  // (handles encoding issues where doc number in HTML may differ from MongoDB)
  try {
    const resp = await _fetchSafe('https://vanban.chinhphu.vn/');
    if (resp.ok) {
      const html = await resp.text();
      // Extract the number part (e.g. "376" from "376/2026/NĐ-CP")
      const numOnly = normDocNum.match(/^(\d+)\//)?.[1];
      if (numOnly) {
        // Split HTML by table rows and search each row
        const rows = html.split(/<\/tr>/i);
        for (const rowHtml of rows) {
          // Check if this row contains our document number (check span.code or PDF filename)
          const hasDocNum = rowHtml.includes(`>${numOnly}/`) 
            || rowHtml.includes(`/${numOnly}_`)
            || rowHtml.includes(`/${numOnly}-`);
          if (!hasDocNum) continue;

          // Extract PDF link from bl-doc-file
          const pdfM = rowHtml.match(/href="(https:\/\/datafiles\.chinhphu\.vn\/[^"]+\.pdf)"/i);
          // Extract docid from detail link
          const docidM = rowHtml.match(/docid=(\d+)/i);
          if (pdfM || docidM) {
            const detailUrl = docidM ? buildChinhphuDetailUrl(docidM[1]) : 'https://vanban.chinhphu.vn/';
            console.log(`[chinhphu-crawler] Strategy 2.1: found ${docNumber} on homepage → pdf=${Boolean(pdfM)}, docid=${docidM?.[1] || 'none'}`);
            return {
              documentNumber: docNumber,
              title: opts.title || `Văn bản số ${docNumber}`,
              issueDate: opts.issueDate || '',
              pdfUrl: pdfM ? pdfM[1] : null,
              pdfVerified: Boolean(pdfM),
              detailUrl,
              source: 'chinhphu_gov',
              sourceUrl: detailUrl,
            };
          }
        }
      }
    }
  } catch (_) {}

  // Strategy 2.3: Check MongoDB known_documents for source_url / official_source_urls
  try {
    const { getDb } = require('../../services/db.service');
    const db = await getDb();
    const mongoDoc = await db.collection('known_documents').findOne({
      $or: [
        { document_number: docNumber },
        { documentNumber: docNumber },
        { normalized_number: normDocNum.replace(/[\s/]/g, '').toLowerCase() }
      ]
    });
    if (mongoDoc) {
      const srcUrl = mongoDoc.source_url
        || (Array.isArray(mongoDoc.official_source_urls) && mongoDoc.official_source_urls[0])
        || '';
      // If source URL has docid, fetch detail page for PDF
      const docidMatch = srcUrl.match(/docid=(\d+)/i);
      if (docidMatch) {
        try {
          const detail = await fetchChinhphuDocumentDetail(docidMatch[1]);
          if (detail && detail.pdfUrl) {
            return {
              documentNumber: docNumber,
              title: mongoDoc.title || detail.title || `Văn bản số ${docNumber}`,
              issueDate: mongoDoc.issue_date || mongoDoc.issueDate || detail.issueDate || '',
              pdfUrl: detail.pdfUrl,
              pdfVerified: true,
              detailUrl: detail.detailUrl || srcUrl,
              source: 'chinhphu_gov',
              sourceUrl: detail.detailUrl || srcUrl,
            };
          }
        } catch (_) {}
      }
      // Use MongoDB data for predict
      opts.issueDate = opts.issueDate || mongoDoc.issue_date || mongoDoc.issueDate || '';
      opts.title = opts.title || mongoDoc.title || '';
    }
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

  // Strategy 2.7: Search vanban.chinhphu.vn via PostBack (most reliable for any document number)
  try {
    const vanbanResult = await searchVanbanChinhphu(docNumber);
    if (vanbanResult && (vanbanResult.pdfUrl || vanbanResult.detailUrl)) {
      return {
        documentNumber: docNumber,
        title: vanbanResult.title || opts.title || `Văn bản số ${docNumber}`,
        issueDate: vanbanResult.issueDate || opts.issueDate || null,
        pdfUrl: vanbanResult.pdfUrl || null,
        pdfVerified: vanbanResult.pdfVerified || false,
        detailUrl: vanbanResult.detailUrl,
        source: 'vanban_chinhphu',
        sourceUrl: vanbanResult.sourceUrl || vanbanResult.detailUrl,
      };
    }
  } catch (_) {}

  // Strategy 3: Predict PDF URL — try multiple patterns with HTTP HEAD verification
  const issueDate = opts.issueDate || opts.issue_date || null;
  const candidates = predictPdfUrl(docNumber, issueDate);
  for (const candidate of candidates) {
    const verified = await verifyPdfUrl(candidate);
    if (verified) {
      return {
        documentNumber: docNumber,
        title: opts.title || `Văn bản số ${docNumber}`,
        pdfUrl: verified,
        pdfVerified: true,
        detailUrl: `https://vanban.chinhphu.vn/`,
        source: 'chinhphu_gov',
        sourceUrl: `https://vanban.chinhphu.vn/`,
      };
    }
  }

  // Strategy 4: Return link-reference fallback
  return {
    documentNumber: docNumber,
    title: opts.title || `Tra cứu VB ${docNumber} trên Cổng Chính phủ`,
    pdfUrl: null,
    pdfVerified: false,
    detailUrl: `https://vanban.chinhphu.vn/`,
    source: 'chinhphu_gov',
    sourceUrl: `https://vanban.chinhphu.vn/`,
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
  searchVanbanChinhphu,
  resolveChinhphuDocument,
  verifyPdfUrl,
};
