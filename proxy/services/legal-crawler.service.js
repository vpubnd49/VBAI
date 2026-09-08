const { safeFetch } = require('../security/ssrf-guard');
/**
 * VBAI Real-Time Legal Crawler & Continuous Auto-Ingestion Service
 * Automated multi-source crawling and indexing of ONLY NEWEST laws, decrees, circulars, and official gazettes.
 * Sources (2026-09 updated):
 *   - vanban.chinhphu.vn (HTML scrape – document listing page)
 *   - chinhphu.vn (HTML scrape – homepage VB links)
 *   - congbao.chinhphu.vn (HTML scrape – official gazette)
 *   - baochinhphu.vn (HTML scrape – successor of xaydungchinhsach)
 *   - lamdong.gov.vn/sites/qppl (SharePoint HTML – Lâm Đồng province QPPL)
 */
const path = require('path');
const fs = require('fs');
const { getDb } = require('./db.service');
const { extractFullDocumentNumber, normalizeDocumentNumber } = require('../legal/domain/document-number');

let isCrawling = false;
let lastCrawlStatus = {
  lastRunAt: null,
  completedAt: null,
  status: 'idle',
  itemsIngested: 0,
  newItems: 0,
  updatedItems: 0,
  totalKnownDocs: 0,
  message: 'Chưa có lượt chạy cào dữ liệu nào gần đây.',
  recentDocuments: [],
  sourceHealth: []
};

// Strict validation: Only accept valid Vietnamese Legal Normative Document numbers (VBQPPL)
function isValidLegalDocNumber(docNum) {
  if (!docNum || typeof docNum !== 'string') return false;
  const s = docNum.trim();
  if (s.endsWith('.docx') || s.endsWith('.doc') || s.endsWith('.pdf')) return false;
  if (/^(?:giấy mời|tờ trình|báo cáo|công văn|thông báo|kế hoạch|chương trình|giay moi|to trinh|bao cao|cong van|thong bao)/i.test(s)) return false;
  if (/\b(?:GM|CV|TB|BC|TTr|KH|KL|PA)-/i.test(s)) return false;
  
  // Valid VBQPPL suffixes according to Law on Promulgation of Legal Documents:
  // Central government:
  //   - Luật, Nghị quyết Quốc hội: QH15, NQ-QH15
  //   - Nghị quyết UBTVQH: UBTVQH15, NQ-UBTVQH15
  //   - Nghị định Chính phủ: NĐ-CP
  //   - Quyết định Thủ tướng: QĐ-TTg
  //   - Thông tư các Bộ/Ngành: TT-BCA, TT-BNV, TT-BTP, TT-BTC, TT-BKHĐT, TT-BKHCN, v.v.
  //   - Thông tư liên tịch: TTLT-...
  // Local government (tỉnh/thành phố):
  //   - Quyết định UBND: QĐ-UBND
  //   - Nghị quyết HĐND: NQ-HĐND
  //   - Chỉ thị UBND: CT-UBND
  return /\d+\/(?:\d{4}|\d{2})\/(?:NĐ-CP|QH\d+|NQ-QH\d+|UBTVQH\d+|QĐ-TTg|TT-[A-ZĐ0-9\-]+|TTLT-[A-ZĐ0-9\-]+|NQ-CP|QĐ-UBND|NQ-HĐND|NQ-HDND|CT-UBND)/i.test(s) || /luật\s+số\s+\d+/i.test(s);
}

// Generate topic aliases and query patterns for fast lookup
function generateAliasesAndPatterns(docNum, title, summary) {
  const aliases = [docNum];
  const patterns = [docNum.toLowerCase()];

  const numMatch = docNum.match(/^(\d+)\/(\d{4})\/([A-ZĐ0-9\-]+)$/i);
  if (numMatch) {
    const num = numMatch[1];
    const year = numMatch[2];
    const typeCode = numMatch[3].toUpperCase();

    if (typeCode === 'NĐ-CP') {
      aliases.push(`nghị định ${num}`, `nghị định ${num}/${year}`, `nghị định số ${num}/${year}`, `nghị định số ${num}`);
      patterns.push(`nghi dinh ${num}`, `nghi dinh ${num}/${year}`, `nghi dinh so ${num}/${year}`, `nghi dinh so ${num}`, `${num}/${year}/nd-cp`, `${num}/${year}`);
    } else if (typeCode.startsWith('QH')) {
      aliases.push(`luật ${num}`, `luật ${num}/${year}`, `luật số ${num}`, `luật số ${num}/${year}`);
      patterns.push(`luat ${num}`, `luat ${num}/${year}`, `luat so ${num}`, `luat so ${num}/${year}`, `${num}/${year}/qh15`, `${num}/${year}`);
    } else if (typeCode.startsWith('TT-')) {
      aliases.push(`thông tư ${num}`, `thông tư ${num}/${year}`, `thông tư số ${num}`);
      patterns.push(`thong tu ${num}`, `thong tu ${num}/${year}`, `thong tu so ${num}`, `${num}/${year}/tt`);
    } else if (typeCode.startsWith('QĐ-')) {
      aliases.push(`quyết định ${num}`, `quyết định ${num}/${year}`, `quyết định số ${num}`);
      patterns.push(`quyet dinh ${num}`, `quyet dinh ${num}/${year}`, `quyet dinh so ${num}`);
    } else if (typeCode === 'NQ-HĐND' || typeCode === 'NQ-HDND') {
      aliases.push(`nghị quyết ${num}`, `nghị quyết ${num}/${year}`, `nghị quyết HĐND ${num}`);
      patterns.push(`nghi quyet ${num}`, `nghi quyet ${num}/${year}`, `nghi quyet hdnd ${num}`);
    }
  }

  if (title) {
    aliases.push(title.slice(0, 150));
    const cleanTitle = title.toLowerCase()
      .replace(/nghị định quy định về|quy định chi tiết|nghị định về|luật về/gi, '')
      .trim();
    if (cleanTitle.length > 5) {
      aliases.push(cleanTitle.slice(0, 100));
    }
  }

  return {
    topic_aliases: Array.from(new Set(aliases.filter(Boolean))),
    query_patterns: Array.from(new Set(patterns.filter(Boolean)))
  };
}

/**
 * Fetch with retry – retries once on failure after a short delay
 */
async function fetchWithRetry(url, options = {}, retries = 1) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const res = await safeFetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 VBAI-Legal-Crawler/4.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.5',
          ...(options.headers || {})
        }
      });
      clearTimeout(timeoutId);
      return res;
    } catch (err) {
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      throw err;
    }
  }
}

/**
 * Detect document type from text and document number
 */
function detectDocType(text, docNum) {
  if (/nghị định/i.test(text) || /NĐ-CP/i.test(docNum)) return 'nghi_dinh';
  if (/thông tư/i.test(text) || /TT-/i.test(docNum)) return 'thong_tu';
  if (/luật/i.test(text) || /QH/i.test(docNum)) return 'luat';
  if (/quyết định/i.test(text) || /QĐ-/i.test(docNum)) return 'quyet_dinh';
  if (/nghị quyết/i.test(text) || /NQ-/i.test(docNum)) return 'nghi_quyet';
  if (/chỉ thị/i.test(text) || /CT-/i.test(docNum)) return 'chi_thi';
  return 'van_ban';
}

/**
 * Detect issuer from text
 */
function detectIssuer(text) {
  if (/UBND tỉnh|ủy ban nhân dân tỉnh/i.test(text)) return 'UBND tỉnh Lâm Đồng';
  if (/HĐND tỉnh|hội đồng nhân dân tỉnh/i.test(text)) return 'HĐND tỉnh Lâm Đồng';
  if (/chính phủ/i.test(text)) return 'Chính phủ';
  if (/quốc hội/i.test(text)) return 'Quốc hội';
  if (/thủ tướng/i.test(text)) return 'Thủ tướng Chính phủ';
  return 'Cơ quan nhà nước';
}

/**
 * Decode HTML entities (&#xHEX;, &#DEC;, &amp; etc.) to proper Unicode characters.
 * Government HTML pages encode Vietnamese diacritics as HTML entities.
 */
function decodeHtmlEntities(str) {
  if (!str) return '';
  return str
    // Decode hex entities: &#x1EED; -> ử
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    // Decode decimal entities: &#7917; -> ử
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    // Decode common named entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

/**
 * Helper to find the best title, direct link, and dates for a document from decoded HTML
 */
function findBestTitleAndLink(decodedHtml, rawMatch, baseUrl) {
  const esc = rawMatch.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&');
  let title = '';
  let detailUrl = baseUrl;

  // 1. Check if enclosed in an <a> tag with title attribute or text
  const aRegex = new RegExp('<a\\b([^>]*)>([\\s\\S]*?)<\\/a>', 'gi');
  let m;
  while ((m = aRegex.exec(decodedHtml)) !== null) {
    const fullTag = m[0];
    const attrs = m[1];
    const text = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (fullTag.includes(rawMatch) || text.includes(rawMatch)) {
      const titleAttrMatch = attrs.match(/title=["']([^"']+)["']/i);
      const titleAttr = titleAttrMatch ? titleAttrMatch[1].trim() : '';

      const hrefMatch = attrs.match(/href=["']([^"']+)["']/i);
      if (hrefMatch && hrefMatch[1] && !hrefMatch[1].startsWith('javascript:') && !hrefMatch[1].startsWith('#')) {
        try {
          detailUrl = new URL(hrefMatch[1], baseUrl).href;
        } catch (_) {}
      }

      const cand = titleAttr.length >= text.length ? titleAttr : text;
      if (cand.length > title.length) {
        title = cand;
      }
    }
  }

  // 2. Check heading or paragraph if title is still weak
  if (!title || title.length < 20) {
    const hRegex = new RegExp('<(h[1-4]|p|li|td)[^>]*>([\\s\\S]*?' + esc + '[\\s\\S]*?)<\\/\\1>', 'gi');
    let hm;
    while ((hm = hRegex.exec(decodedHtml)) !== null) {
      const clean = hm[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (clean.length > title.length) {
        title = clean;
      }
    }
  }

  // 3. Fallback to surrounding text window
  if (!title || title.length < 15) {
    const ctxRegex = new RegExp('.{0,250}' + esc + '.{0,250}', 'i');
    const cm = decodedHtml.match(ctxRegex);
    if (cm) {
      title = cm[0].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    }
  }

  // Clean title: remove HTML residues, quotes, brackets
  title = title
    .replace(/^["'\s>–—\-:]+|["'\s<–—\-:]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Extract issue date if found in text
  let issueDate = null;
  const dateM = title.match(/ngày\s+(\d{1,2})\s*(?:tháng|\/|\-)\s*(\d{1,2})\s*(?:năm|\/|\-)\s*(\d{4})/i)
    || decodedHtml.match(new RegExp(esc + '.{0,100}ngày\\s+(\\d{1,2})\\s*(?:tháng|\\/|\\-)\\s*(\\d{1,2})\\s*(?:năm|\\/|\\-)\\s*(\\d{4})', 'i'));
  if (dateM) {
    const d = String(dateM[1]).padStart(2, '0');
    const mo = String(dateM[2]).padStart(2, '0');
    const y = dateM[3];
    issueDate = `${y}-${mo}-${d}`;
  }

  // Extract effective date if present
  let effectiveDate = null;
  const effM = title.match(/hiệu lực (?:từ )?ngày\s+(\d{1,2})\s*(?:tháng|\/|\-)\s*(\d{1,2})\s*(?:năm|\/|\-)\s*(\d{4})/i)
    || decodedHtml.match(new RegExp(esc + '.{0,150}hiệu lực (?:từ )?ngày\\s+(\\d{1,2})\\s*(?:tháng|\\/|\\-)\\s*(\\d{1,2})\\s*(?:năm|\\/|\\-)\\s*(\\d{4})', 'i'));
  if (effM) {
    const d = String(effM[1]).padStart(2, '0');
    const mo = String(effM[2]).padStart(2, '0');
    const y = effM[3];
    effectiveDate = `${y}-${mo}-${d}`;
  }

  return { title, detailUrl, issueDate, effectiveDate };
}

/**
 * Universal HTML document extractor – scans the ENTIRE raw HTML for document numbers
 * with intelligent trích yếu extraction, direct link resolution, and date parsing.
 */
function extractDocumentsFromRawHtml(rawHtml, baseUrl, sourceFeedName) {
  const now = new Date();
  const items = [];
  const seen = new Set();

  // Pre-decode the entire HTML so that doc numbers with entities (e.g. N&#x110;-CP) are found
  const decodedHtml = decodeHtmlEntities(rawHtml);

  // Global regex to find all document numbers anywhere in the HTML
  const DOC_NUM_GLOBAL = /(\d{1,4}\/\d{4}\/(?:N\u0110-CP|N\u0111-CP|ND-CP|QH\d+|NQ-QH\d+|UBTVQH\d+|Q\u0110-TTg|QD-TTg|TT-[A-Z\u01100-9\-]+|TTLT-[A-Z\u01100-9\-]+|NQ-CP|Q\u0110-UBND|QD-UBND|NQ-H\u0110ND|NQ-HDND|CT-UBND|VBHN-[A-Z\u01100-9\-]+))/gi;

  const allMatches = decodedHtml.match(DOC_NUM_GLOBAL) || [];

  for (const rawMatch of allMatches) {
    const docNum = normalizeDocumentNumber(rawMatch);
    if (!docNum || seen.has(docNum)) continue;
    if (!isValidLegalDocNumber(docNum)) continue;
    // Skip false positives like timestamps (2240/2026/9)
    if (/\/\d{1,2}$/.test(docNum)) continue;

    seen.add(docNum);

    const { title: extractedTitle, detailUrl, issueDate, effectiveDate } = findBestTitleAndLink(decodedHtml, rawMatch, baseUrl);

    // If extracted title is empty or too short, generate a clean fallback
    let finalTitle = extractedTitle;
    if (!finalTitle || finalTitle.length < 10) {
      finalTitle = `Văn bản quy phạm pháp luật số ${docNum}`;
    }

    const docType = detectDocType(finalTitle, docNum);
    const { topic_aliases, query_patterns } = generateAliasesAndPatterns(docNum, finalTitle, '');

    const resolvedIssueDate = issueDate || now.toISOString().split('T')[0];
    const resolvedEffectiveDate = effectiveDate || resolvedIssueDate;

    items.push({
      document_number: docNum,
      title: finalTitle,
      document_type: docType,
      topic_aliases,
      query_patterns,
      issuer: detectIssuer(finalTitle),
      issue_date: resolvedIssueDate,
      effective_date: resolvedEffectiveDate,
      effective_status: 'in_force',
      status_as_of: now.toISOString().split('T')[0],
      tom_tat_chinh_sach: finalTitle,
      official_source_urls: [detailUrl || baseUrl],
      source_feed: sourceFeedName,
      crawled_at: now
    });
  }

  return items;
}

/**
 * Source 1: vanban.chinhphu.vn - Document listing page
 */
async function crawlVanbanChinhphu() {
  const year = new Date().getFullYear();
  const url = `https://vanban.chinhphu.vn/default.aspx?pageid=27160&docid=0&classid=0&TypeSearch=0&KeySearch=&KeyOganization=0&OrganizationSearch=&Keyword=&KeyOrganization=&SignerName=&FieldNum=&Year=${year}&MonthPublish=0&LoaiVanBan=0&IssuedDateFrom=&IssuedDateTo=&EffectedDateFrom=&EffectedDateTo=&PublishStatus=1`;
  const res = await fetchWithRetry(url);
  if (!res.ok) return [];
  const html = await res.text();
  return extractDocumentsFromRawHtml(html, url, 'vanban.chinhphu.vn');
}

/**
 * Source 2: chinhphu.vn homepage
 */
async function crawlChinhphuHomepage() {
  const res = await fetchWithRetry('https://chinhphu.vn');
  if (!res.ok) return [];
  const html = await res.text();
  return extractDocumentsFromRawHtml(html, 'https://chinhphu.vn', 'chinhphu.vn');
}

/**
 * Source 3: congbao.chinhphu.vn - Official Gazette
 */
async function crawlCongbao() {
  const res = await fetchWithRetry('https://congbao.chinhphu.vn');
  if (!res.ok) return [];
  const html = await res.text();
  return extractDocumentsFromRawHtml(html, 'https://congbao.chinhphu.vn', 'congbao.chinhphu.vn');
}

/**
 * Source 4: baochinhphu.vn (successor of xaydungchinhsach)
 */
async function crawlBaochinhphu() {
  const res = await fetchWithRetry('https://baochinhphu.vn');
  if (!res.ok) return [];
  const html = await res.text();
  return extractDocumentsFromRawHtml(html, 'https://baochinhphu.vn', 'baochinhphu.vn');
}

/**
 * Source 5: lamdong.gov.vn/sites/qppl - Lam Dong province QPPL (SharePoint)
 */
async function crawlLamDongQPPL() {
  const url = 'https://lamdong.gov.vn/sites/qppl/SitePages/Home.aspx';
  const res = await fetchWithRetry(url);
  if (!res.ok) return [];
  const html = await res.text();
  const decoded = html.replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&#58;/g, ':').replace(/&#123;/g, '{').replace(/&#125;/g, '}');
  return extractDocumentsFromRawHtml(decoded, url, 'lamdong.gov.vn/sites/qppl');
}

/**
 * Source 6: chinhphu.vn/Default.aspx?tabid=73 - VB chi dao dieu hanh
 * This page contains NĐ-CP, QĐ-TTg and other important government documents
 */
async function crawlChinhphuVBCD() {
  const url = 'https://chinhphu.vn/Default.aspx?tabid=73';
  const res = await fetchWithRetry(url);
  if (!res.ok) return [];
  const html = await res.text();
  return extractDocumentsFromRawHtml(html, url, 'chinhphu.vn/vb-chi-dao');
}

/**
 * Source 7: congbao.chinhphu.vn/van-ban-moi - Newly published gazette documents
 * Contains latest TT, NĐ, Luật published in the Official Gazette
 */
async function crawlCongbaoVanbanMoi() {
  const url = 'https://congbao.chinhphu.vn/van-ban-moi';
  const res = await fetchWithRetry(url);
  if (!res.ok) return [];
  const html = await res.text();
  return extractDocumentsFromRawHtml(html, url, 'congbao.chinhphu.vn/van-ban-moi');
}

/**
/**
 * Source: phaply.net.vn - Legal news and analysis site
 * Crawls RSS feeds (structured titles, descriptions, direct links) and HTML category pages.
 * Fetches detail pages for discovered documents to extract comprehensive trích yếu & key provisions.
 */
async function crawlPhaplyNet() {
  const items = [];
  const now = new Date();

  // 1. RSS Feeds - fast, structured, clean Unicode titles & summaries
  const rssFeeds = [
    'https://phaply.net.vn/rss/chinh-sach-moi.rss',
    'https://phaply.net.vn/rss/xay-dung-phap-luat.rss',
    'https://phaply.net.vn/rss/tin-moi.rss',
    'https://phaply.net.vn/rss/su-kien-chinh-sach.rss',
    'https://phaply.net.vn/rss/dien-dan-luat-gia.rss'
  ];

  for (const feedUrl of rssFeeds) {
    try {
      const res = await fetchWithRetry(feedUrl);
      if (!res.ok) continue;
      const xml = decodeHtmlEntities(await res.text());
      const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];

      for (const b of itemBlocks) {
        const titleMatch = b.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/i) || b.match(/<title>([\s\S]*?)<\/title>/i);
        const linkMatch = b.match(/<link><!\[CDATA\[([\s\S]*?)\]\]><\/link>/i) || b.match(/<link>([\s\S]*?)<\/link>/i);
        const descMatch = b.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/i) || b.match(/<description>([\s\S]*?)<\/description>/i);
        const pubMatch = b.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);

        const title = titleMatch ? titleMatch[1].trim() : '';
        const link = linkMatch ? linkMatch[1].trim() : '';
        const desc = descMatch ? descMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '';

        const combined = `${title} ${desc}`;
        const DOC_NUM_GLOBAL = /(\d{1,4}\/\d{4}\/(?:N\u0110-CP|N\u0111-CP|ND-CP|QH\d+|NQ-QH\d+|UBTVQH\d+|Q\u0110-TTg|QD-TTg|TT-[A-Z\u01100-9\-]+|TTLT-[A-Z\u01100-9\-]+|NQ-CP|Q\u0110-UBND|QD-UBND|NQ-H\u0110ND|NQ-HDND|CT-UBND|VBHN-[A-Z\u01100-9\-]+))/gi;
        const docMatches = combined.match(DOC_NUM_GLOBAL) || [];

        for (const rawDm of docMatches) {
          const dm = normalizeDocumentNumber(rawDm);
          if (!dm || !isValidLegalDocNumber(dm)) continue;
          if (items.some(i => i.document_number === dm)) continue;

          let issueDate = now.toISOString().split('T')[0];
          if (pubMatch && pubMatch[1]) {
            try {
              const d = new Date(pubMatch[1]);
              if (!isNaN(d.getTime())) issueDate = d.toISOString().split('T')[0];
            } catch (_) {}
          }
          const dateM = combined.match(/ngày\s+(\d{1,2})\s*(?:tháng|\/|\-)\s*(\d{1,2})\s*(?:năm|\/|\-)\s*(\d{4})/i);
          if (dateM) {
            issueDate = `${dateM[3]}-${String(dateM[2]).padStart(2, '0')}-${String(dateM[1]).padStart(2, '0')}`;
          }

          const docType = detectDocType(title || desc, dm);
          const { topic_aliases, query_patterns } = generateAliasesAndPatterns(dm, title, desc);

          items.push({
            document_number: dm,
            title: title || `Văn bản quy phạm pháp luật số ${dm}`,
            document_type: docType,
            topic_aliases,
            query_patterns,
            issuer: detectIssuer(title || desc),
            issue_date: issueDate,
            effective_date: issueDate,
            effective_status: 'in_force',
            status_as_of: now.toISOString().split('T')[0],
            tom_tat_chinh_sach: desc || title,
            noi_dung_chi_tiet: desc || title,
            official_source_urls: [link || feedUrl],
            source_feed: 'phaply.net.vn/rss',
            crawled_at: now
          });
        }
      }
    } catch (_) {}
  }

  // 2. HTML category and homepage scraping
  const htmlUrls = [
    'https://phaply.net.vn/',
    'https://phaply.net.vn/c/xay-dung-phap-luat',
    'https://phaply.net.vn/c/gop-y-chinh-sach',
    'https://phaply.net.vn/category/van-ban-phap-luat/'
  ];

  for (const url of htmlUrls) {
    try {
      const res = await fetchWithRetry(url);
      if (!res.ok) continue;
      const html = await res.text();
      const docs = extractDocumentsFromRawHtml(html, url, 'phaply.net.vn');
      for (const d of docs) {
        if (!items.some(i => i.document_number === d.document_number)) {
          items.push(d);
        }
      }
    } catch (_) {}
  }

  // 3. Deep detail enrichment: for items with specific article links, fetch detail page
  for (const item of items) {
    const detailLink = item.official_source_urls?.[0];
    if (detailLink && detailLink.startsWith('http') && !detailLink.endsWith('.rss') && !detailLink.endsWith('.aspx') && detailLink !== 'https://phaply.net.vn/') {
      try {
        const detailRes = await fetchWithRetry(detailLink, {}, 0);
        if (detailRes && detailRes.ok) {
          const detailHtml = decodeHtmlEntities(await detailRes.text());
          const h1Match = detailHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
          const metaDescMatch = detailHtml.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
          const paragraphs = (detailHtml.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || [])
            .map(p => p.replace(/<[^>]+>/g, '').trim())
            .filter(p => p.length > 35 && !p.includes('Chia sẻ') && !p.includes('Bình luận'));

          if (h1Match && h1Match[1]) {
            const cleanH1 = h1Match[1].replace(/<[^>]+>/g, '').trim();
            if (cleanH1.length > item.title.length) {
              item.title = cleanH1;
            }
          }

          const desc = metaDescMatch ? metaDescMatch[1].trim() : '';
          const bodySnippet = paragraphs.slice(0, 4).join('\n\n');
          if (bodySnippet || desc) {
            item.noi_dung_chi_tiet = [desc, bodySnippet].filter(Boolean).join('\n\n');
            if (desc && desc.length > 30) {
              item.tom_tat_chinh_sach = desc;
            }
          }
        }
      } catch (_) {}
    }
  }

  return items;
}

/**
 * Fetch and extract legal documents from all official sources (Fast Parallel Ingestion with Health Tracking)
 * Prioritizes high-veracity and comprehensive legal sources.
 */
async function crawlOfficialSources() {
  const discoveredDocs = [];
  const sourceHealth = [];

  const sources = [
    { name: 'phaply.net.vn (chuyen trang phap ly)', fn: crawlPhaplyNet, scope: 'central' },
    { name: 'congbao.chinhphu.vn', fn: crawlCongbao, scope: 'central' },
    { name: 'congbao (van ban moi)', fn: crawlCongbaoVanbanMoi, scope: 'central' },
    { name: 'vanban.chinhphu.vn', fn: crawlVanbanChinhphu, scope: 'central' },
    { name: 'chinhphu.vn (trang chu)', fn: crawlChinhphuHomepage, scope: 'central' },
    { name: 'chinhphu.vn (VB chi dao)', fn: crawlChinhphuVBCD, scope: 'central' },
    { name: 'baochinhphu.vn', fn: crawlBaochinhphu, scope: 'central' },
    { name: 'lamdong.gov.vn/sites/qppl', fn: crawlLamDongQPPL, scope: 'local_lamdong' },
  ];

  // Fetch all sources concurrently in parallel
  const fetchPromises = sources.map(async (src) => {
    const startTime = Date.now();
    try {
      const items = await src.fn();
      const elapsed = Date.now() - startTime;
      sourceHealth.push({
        name: src.name,
        scope: src.scope,
        status: 'ok',
        itemCount: items.length,
        responseTimeMs: elapsed,
        error: null
      });
      console.log(`[Crawler] ✅ ${src.name}: ${items.length} documents (${elapsed}ms)`);
      return items;
    } catch (err) {
      const elapsed = Date.now() - startTime;
      sourceHealth.push({
        name: src.name,
        scope: src.scope,
        status: 'error',
        itemCount: 0,
        responseTimeMs: elapsed,
        error: err.message
      });
      console.warn(`[Crawler] ❌ ${src.name} failed (${elapsed}ms):`, err.message);
      return [];
    }
  });

  const results = await Promise.allSettled(fetchPromises);
  for (const r of results) {
    if (r.status === 'fulfilled' && Array.isArray(r.value)) {
      discoveredDocs.push(...r.value);
    }
  }

  // Deduplicate discovered documents
  const uniqueMap = new Map();
  for (const d of discoveredDocs) {
    if (!uniqueMap.has(d.document_number)) {
      uniqueMap.set(d.document_number, d);
    }
  }

  const failedCount = sourceHealth.filter(s => s.status === 'error').length;
  const totalSources = sourceHealth.length;

  return {
    documents: Array.from(uniqueMap.values()),
    sourceHealth,
    failedCount,
    totalSources,
    allFailed: failedCount === totalSources
  };
}

/**
 * Run the full crawling process
 */
async function runCrawlerTask(requestedBy = 'scheduler') {
  if (isCrawling) {
    return { success: false, message: 'Robot cào dữ liệu đang trong quá trình thực thi...' };
  }

  isCrawling = true;
  const startedAt = new Date();
  lastCrawlStatus.status = 'running';
  console.log(`[Crawler] Starting real-time legal crawler run requested by ${requestedBy} at ${startedAt.toISOString()}...`);

  try {
    const db = await getDb();
    const crawlResult = await crawlOfficialSources();
    const discovered = crawlResult.documents;

    let newCount = 0;
    let updatedCount = 0;

    for (const doc of discovered) {
      const normNum = normalizeDocumentNumber(doc.document_number);
      const existing = await db.collection('known_documents').findOne({
        $or: [
          { document_number: doc.document_number },
          { documentNumber: doc.document_number },
          { normalized_number: normNum }
        ]
      });

      const nowStr = startedAt.toISOString().split('T')[0];
      if (existing) {
        // Smart non-destructive merge: preserve richer information and clean up any broken titles
        const cleanDocTitle = (doc.title || '').replace(/[">]+$/g, '').trim();
        const cleanExistingTitle = (existing.title || '').replace(/[">]+$/g, '').trim();

        const docTitleIsSubstantial = cleanDocTitle.length > 20 && !cleanDocTitle.startsWith('Văn bản') && !cleanDocTitle.startsWith('ngày ');
        const existingTitleIsSubstantial = cleanExistingTitle.length > 20 && !cleanExistingTitle.startsWith('Văn bản') && !cleanExistingTitle.startsWith('ngày ');

        let betterTitle = cleanExistingTitle;
        if (docTitleIsSubstantial) {
          betterTitle = cleanDocTitle;
        } else if (!existingTitleIsSubstantial && cleanDocTitle) {
          betterTitle = cleanDocTitle;
        }

        const betterSummary = (doc.tom_tat_chinh_sach && doc.tom_tat_chinh_sach.length > 30 && !doc.tom_tat_chinh_sach.startsWith('ngày '))
          ? doc.tom_tat_chinh_sach
          : (existing.tom_tat_chinh_sach || existing.summary || doc.tom_tat_chinh_sach || betterTitle);

        const betterDetail = doc.noi_dung_chi_tiet || existing.noi_dung_chi_tiet || betterSummary;

        const mergedUrls = Array.from(new Set([
          ...(Array.isArray(existing.official_source_urls) ? existing.official_source_urls : []),
          ...(Array.isArray(doc.official_source_urls) ? doc.official_source_urls : [])
        ])).filter(u => u && !u.endsWith('.rss'));

        // Issue date: prefer parsed date over today's fallback date
        let finalIssueDate = doc.issue_date;
        if (finalIssueDate === nowStr && existing.issue_date && existing.issue_date !== nowStr) {
          finalIssueDate = existing.issue_date;
        }

        await db.collection('known_documents').updateOne(
          { _id: existing._id },
          {
            $set: {
              ...doc,
              title: betterTitle,
              tom_tat_chinh_sach: betterSummary,
              summary: betterSummary,
              noi_dung_chi_tiet: betterDetail,
              official_source_urls: mergedUrls.length > 0 ? mergedUrls : [doc.official_source_urls?.[0] || 'https://phaply.net.vn/'],
              documentNumber: doc.document_number,
              issue_date: finalIssueDate,
              issueDate: finalIssueDate,
              effectiveDate: doc.effective_date || existing.effective_date || finalIssueDate,
              effectiveStatus: doc.effective_status || existing.effective_status || 'in_force',
              normalized_number: normNum,
              updated_at: new Date()
            }
          }
        );
        updatedCount++;
      } else {
        await db.collection('known_documents').insertOne({
          ...doc,
          documentNumber: doc.document_number,
          issueDate: doc.issue_date,
          effectiveDate: doc.effective_date,
          effectiveStatus: doc.effective_status,
          normalized_number: normNum,
          created_at: new Date(),
          updated_at: new Date()
        });
        newCount++;
      }
    }

    const totalCount = await db.collection('known_documents').countDocuments({
      document_number: { $not: /\.docx$|\.doc$|\.pdf$/i }
    });

    const recentList = await db.collection('known_documents')
      .find({ document_number: { $not: /\.docx$|\.doc$|\.pdf$/i } })
      .sort({ issue_date: -1, issueDate: -1, updated_at: -1 })
      .limit(10)
      .toArray();

    // Determine overall status based on source health
    let statusStr = 'idle';
    let messageStr = `Đã hoàn tất quét văn bản mới nhất: ${newCount} văn bản mới, ${updatedCount} văn bản cập nhật. Tổng văn bản quy phạm pháp luật: ${totalCount}.`;

    if (crawlResult.allFailed) {
      statusStr = 'all_sources_failed';
      messageStr = `⚠️ CẢNH BÁO: Tất cả ${crawlResult.totalSources} nguồn dữ liệu đều thất bại! Kiểm tra kết nối mạng hoặc các trang web nguồn có thể đã thay đổi cấu trúc.`;
    } else if (crawlResult.failedCount > 0) {
      messageStr += ` (${crawlResult.failedCount}/${crawlResult.totalSources} nguồn bị lỗi)`;
    }

    lastCrawlStatus = {
      lastRunAt: startedAt,
      completedAt: new Date(),
      status: statusStr,
      itemsIngested: newCount + updatedCount,
      newItems: newCount,
      updatedItems: updatedCount,
      totalKnownDocs: totalCount,
      message: messageStr,
      sourceHealth: crawlResult.sourceHealth,
      recentDocuments: recentList.map(d => ({
        document_number: d.document_number || d.documentNumber,
        title: d.title || d.titleHint || d.trich_yeu,
        document_type: d.document_type || d.documentType,
        issuer: d.issuer,
        issue_date: d.issue_date || d.issueDate,
        effective_status: d.effective_status || d.effectiveStatus,
        crawled_at: d.crawled_at || d.updated_at
      }))
    };

    // Log to crawler_logs
    await db.collection('crawler_logs').insertOne({
      started_at: startedAt,
      completed_at: new Date(),
      requested_by: requestedBy,
      new_count: newCount,
      updated_count: updatedCount,
      total_count: totalCount,
      source_health: crawlResult.sourceHealth,
      failed_sources: crawlResult.failedCount,
      status: crawlResult.allFailed ? 'all_sources_failed' : 'success'
    });

    // Refresh in-memory known documents repository cache
    try {
      const { syncMongoDocuments } = require('../legal/repositories/known-documents.repository');
      await syncMongoDocuments(true);
    } catch (_) {}

    console.log(`[Crawler] Completed: ${newCount} new, ${updatedCount} updated. Total: ${totalCount}. Sources: ${crawlResult.totalSources - crawlResult.failedCount}/${crawlResult.totalSources} OK`);
    return {
      success: true,
      ...lastCrawlStatus
    };
  } catch (err) {
    console.error('[Crawler] Execution error:', err);
    lastCrawlStatus.status = 'error';
    lastCrawlStatus.message = `Lỗi cào dữ liệu: ${err.message}`;
    return {
      success: false,
      error: err.message
    };
  } finally {
    isCrawling = false;
  }
}

/**
 * Just-in-Time Auto-Ingestion: Instantly save a verified legal document into MongoDB
 */
async function autoIngestLegalDocument(docData = {}) {
  try {
    const docNum = String(docData.document_number || docData.documentNumber || '').trim();
    if (!docNum || !isValidLegalDocNumber(docNum)) {
      return { success: false, reason: 'INVALID_DOCUMENT_NUMBER' };
    }

    const db = await getDb();
    const normNum = normalizeDocumentNumber(docNum);
    const now = new Date();

    const { topic_aliases, query_patterns } = generateAliasesAndPatterns(
      docNum,
      docData.title || docData.trich_yeu || '',
      docData.tom_tat_chinh_sach || docData.summary || ''
    );

    const record = {
      document_number: docNum,
      documentNumber: docNum,
      title: docData.title || docData.trich_yeu || `Văn bản ${docNum}`,
      document_type: docData.document_type || docData.documentType || 'van_ban',
      topic_aliases: Array.from(new Set([...(docData.topic_aliases || []), ...topic_aliases])),
      query_patterns: Array.from(new Set([...(docData.query_patterns || []), ...query_patterns])),
      issuer: docData.issuer || 'Chính phủ',
      issue_date: docData.issue_date || docData.issueDate || docData.ngay_ban_hanh || now.toISOString().split('T')[0],
      issueDate: docData.issue_date || docData.issueDate || docData.ngay_ban_hanh || now.toISOString().split('T')[0],
      effective_date: docData.effective_date || docData.effectiveDate || docData.ngay_hieu_luc || now.toISOString().split('T')[0],
      effectiveDate: docData.effective_date || docData.effectiveDate || docData.ngay_hieu_luc || now.toISOString().split('T')[0],
      effective_status: docData.effective_status || docData.effectiveStatus || 'in_force',
      effectiveStatus: docData.effective_status || docData.effectiveStatus || 'in_force',
      replaces: docData.replaces || docData.thay_the_cho || [],
      tom_tat_chinh_sach: docData.tom_tat_chinh_sach || docData.summary || '',
      summary: docData.tom_tat_chinh_sach || docData.summary || '',
      official_source_urls: docData.official_source_urls || ['https://vanban.chinhphu.vn/'],
      normalized_number: normNum,
      verification_status: 'verified',
      review_state: 'published',
      auto_ingested: true,
      updated_at: now
    };

    await db.collection('known_documents').updateOne(
      {
        $or: [
          { document_number: docNum },
          { documentNumber: docNum },
          { normalized_number: normNum }
        ]
      },
      {
        $set: record,
        $setOnInsert: { created_at: now }
      },
      { upsert: true }
    );

    console.log(`[Auto-Ingest] Successfully ingested document: ${docNum} (${record.title})`);
    return { success: true, document: record };
  } catch (err) {
    console.warn(`[Auto-Ingest] Failed to ingest document:`, err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Get current crawler status and recent documents
 */
async function getCrawlerStatus() {
  try {
    const db = await getDb();
    const totalCount = await db.collection('known_documents').countDocuments({
      document_number: { $not: /\.docx$|\.doc$|\.pdf$/i }
    });
    const recentList = await db.collection('known_documents')
      .find({ document_number: { $not: /\.docx$|\.doc$|\.pdf$/i } })
      .sort({ issue_date: -1, issueDate: -1, updated_at: -1 })
      .limit(15)
      .toArray();
    
    return {
      ...lastCrawlStatus,
      totalKnownDocs: totalCount,
      recentDocuments: recentList.map(d => ({
        document_number: d.document_number || d.documentNumber,
        title: d.title || d.titleHint || d.trich_yeu,
        document_type: d.document_type || d.documentType,
        issuer: d.issuer,
        issue_date: d.issue_date || d.issueDate,
        effective_status: d.effective_status || d.effectiveStatus,
        crawled_at: d.crawled_at || d.updated_at
      }))
    };
  } catch (e) {
    return lastCrawlStatus;
  }
}

/**
 * Clean all non-VBQPPL garbage documents (GM, CV, TB, BC, test docs) from MongoDB
 */
async function cleanGarbageDocuments() {
  try {
    const db = await getDb();
    const result = await db.collection('known_documents').deleteMany({
      $or: [
        { document_number: { $regex: /GM|CV|TB|BC|TTr|KH/i } },
        { documentNumber: { $regex: /GM|CV|TB|BC|TTr|KH/i } },
        { document_number: "330/2026/NĐ-CP" },
        { documentNumber: "330/2026/NĐ-CP" },
        { title: { $regex: /Mời họp Phiên họp|Giấy mời/i } }
      ]
    });
    console.log(`[Crawler Cleanup] Removed ${result.deletedCount} non-VBQPPL records.`);
    return { success: true, deletedCount: result.deletedCount };
  } catch (err) {
    console.error('[Crawler Cleanup] Error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Delete a specific document by number
 */
async function deleteDocumentByNumber(docNum) {
  try {
    if (!docNum) return { success: false, message: 'Số hiệu không hợp lệ' };
    const db = await getDb();
    const result = await db.collection('known_documents').deleteMany({
      $or: [
        { document_number: docNum },
        { documentNumber: docNum }
      ]
    });
    return { success: true, deletedCount: result.deletedCount };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Initialize 15-minute continuous scheduler
 */
function initCrawlerScheduler() {
  console.log('[Crawler Scheduler] Initialized. Continuous legal crawler runs every 15 minutes.');
  setTimeout(() => {
    cleanGarbageDocuments().catch(() => {});
    runCrawlerTask('startup_scheduler').catch(e => console.warn('[Crawler Startup]', e.message));
  }, 10000);

  const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
  setInterval(() => {
    runCrawlerTask('cron_15min_scheduler').catch(e => console.warn('[Crawler Cron]', e.message));
  }, FIFTEEN_MINUTES_MS);
}

module.exports = {
  runCrawlerTask,
  autoIngestLegalDocument,
  cleanGarbageDocuments,
  deleteDocumentByNumber,
  getCrawlerStatus,
  initCrawlerScheduler
};
