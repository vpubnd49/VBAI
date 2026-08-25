const { safeFetch } = require('../security/ssrf-guard');
/**
 * VBAI Real-Time Legal Crawler & Continuous Auto-Ingestion Service
 * Automated multi-source crawling and indexing of ONLY NEWEST laws, decrees, circulars, and official gazettes.
 * Sources: vanban.chinhphu.vn, xaydungchinhsach.chinhphu.vn, congbao.chinhphu.vn, chinhphu.vn, quochoi.vn, vbpl.vn
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
  recentDocuments: []
};

// Strict validation: Only accept valid Vietnamese Legal Normative Document numbers (VBQPPL)
function isValidLegalDocNumber(docNum) {
  if (!docNum || typeof docNum !== 'string') return false;
  const s = docNum.trim();
  if (s.endsWith('.docx') || s.endsWith('.doc') || s.endsWith('.pdf')) return false;
  if (/^(?:giấy mời|tờ trình|báo cáo|công văn|thông báo|kế hoạch|chương trình|giay moi|to trinh|bao cao|cong van|thong bao)/i.test(s)) return false;
  if (/\b(?:GM|CV|TB|BC|TTr|KH|KL|PA)-/i.test(s)) return false;
  
  // Valid VBQPPL suffixes according to Law on Promulgation of Legal Documents:
  // - Luật, Nghị quyết Quốc hội: QH15, NQ-QH15
  // - Nghị quyết UBTVQH: UBTVQH15, NQ-UBTVQH15
  // - Nghị định Chính phủ: NĐ-CP
  // - Quyết định Thủ tướng: QĐ-TTg
  // - Thông tư các Bộ/Ngành: TT-BCA, TT-BNV, TT-BTP, TT-BTC, TT-BKHĐT, TT-BKHCN, v.v.
  // - Thông tư liên tịch: TTLT-...
  // - Quyết định/Nghị quyết địa phương: QĐ-UBND, NQ-HĐND
  return /\d+\/(?:\d{4}|\d{2})\/(?:NĐ-CP|QH\d+|NQ-QH\d+|UBTVQH\d+|QĐ-TTg|TT-[A-ZĐ0-9\-]+|TTLT-[A-ZĐ0-9\-]+|NQ-CP|QĐ-UBND|NQ-HĐND)/i.test(s) || /luật\s+số\s+\d+/i.test(s);
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
 * Fetch and extract ONLY NEWEST legal documents from official government feeds & gazettes
 */
/**
 * Fetch and extract ONLY NEWEST legal documents from official government feeds & gazettes (Fast Parallel Ingestion)
 */
async function crawlOfficialSources() {
  const discoveredDocs = [];
  const now = new Date();
  const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000;
  const cutoffDate = new Date(now.getTime() - SIXTY_DAYS_MS);

  const sources = [
    {
      name: 'Báo điện tử Chính phủ - Xây dựng Chính sách',
      url: 'https://xaydungchinhsach.chinhphu.vn/rss/home.rss',
      type: 'rss'
    },
    {
      name: 'Cổng Thông tin điện tử Chính phủ - Văn bản mới',
      url: 'https://vanban.chinhphu.vn/rss/home.rss',
      type: 'rss'
    },
    {
      name: 'Cổng Thông tin điện tử Chính phủ - Trang chủ',
      url: 'https://chinhphu.vn/rss/home.rss',
      type: 'rss'
    },
    {
      name: 'Chính phủ - Văn bản chỉ đạo điều hành',
      url: 'https://xaydungchinhsach.chinhphu.vn/van-ban-chi-dao-dieu-hanh.htm',
      type: 'html'
    }
  ];

  // Fetch all official sources concurrently in parallel (Max 5s timeout per source)
  const fetchPromises = sources.map(async (src) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const res = await safeFetch(src.url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 VBAI-Legal-Crawler/3.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      });
      clearTimeout(timeoutId);

      if (!res.ok) return [];
      const rawText = await res.text();
      const items = [];

      if (src.type === 'rss') {
        const itemMatches = rawText.match(/<item>[\s\S]*?<\/item>/gi) || [];
        for (const itemXml of itemMatches) {
          const titleMatch = itemXml.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/i) || itemXml.match(/<title>([\s\S]*?)<\/title>/i);
          const linkMatch = itemXml.match(/<link><!\[CDATA\[([\s\S]*?)\]\]><\/link>/i) || itemXml.match(/<link>([\s\S]*?)<\/link>/i);
          const descMatch = itemXml.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/i) || itemXml.match(/<description>([\s\S]*?)<\/description>/i);
          const pubDateMatch = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);

          const title = (titleMatch ? titleMatch[1] : '').replace(/<[^>]+>/g, '').trim();
          const link = (linkMatch ? linkMatch[1] : '').trim();
          const desc = (descMatch ? descMatch[1] : '').replace(/<[^>]+>/g, '').trim();
          const pubDate = pubDateMatch ? new Date(pubDateMatch[1]) : now;

          if (pubDate < cutoffDate && pubDate.getFullYear() < now.getFullYear()) {
            continue;
          }

          if (!title) continue;

          const combinedText = `${title} ${desc}`;
          const docNum = extractFullDocumentNumber(combinedText);

          if (!isValidLegalDocNumber(docNum)) {
            continue;
          }

          let docType = 'van_ban';
          if (/nghị định/i.test(combinedText) || /NĐ-CP/i.test(docNum)) docType = 'nghi_dinh';
          else if (/thông tư/i.test(combinedText) || /TT-/i.test(docNum)) docType = 'thong_tu';
          else if (/luật/i.test(combinedText) || /QH/i.test(docNum)) docType = 'luat';
          else if (/quyết định/i.test(combinedText) || /QĐ-/i.test(docNum)) docType = 'quyet_dinh';
          else if (/nghị quyết/i.test(combinedText) || /NQ-/i.test(docNum)) docType = 'nghi_quyet';

          const { topic_aliases, query_patterns } = generateAliasesAndPatterns(docNum, title, desc);

          items.push({
            document_number: docNum,
            title: title,
            document_type: docType,
            topic_aliases,
            query_patterns,
            issuer: /chính phủ/i.test(combinedText) ? 'Chính phủ' : (/quốc hội/i.test(combinedText) ? 'Quốc hội' : (/thủ tướng/i.test(combinedText) ? 'Thủ tướng Chính phủ' : 'Cơ quan nhà nước')),
            issue_date: pubDate.toISOString().split('T')[0],
            effective_date: pubDate.toISOString().split('T')[0],
            effective_status: 'in_force',
            status_as_of: now.toISOString().split('T')[0],
            tom_tat_chinh_sach: desc || title,
            official_source_urls: [link || src.url],
            source_feed: src.name,
            crawled_at: now
          });
        }
      } else if (src.type === 'html') {
        const linkMatches = rawText.match(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi) || [];
        for (const aTag of linkMatches) {
          const textMatch = aTag.match(/>([^<]+)</);
          const linkMatch = aTag.match(/href=["']([^"']+)["']/i);
          const title = textMatch ? textMatch[1].trim() : '';
          const link = linkMatch ? linkMatch[1].trim() : '';

          if (!title || title.length < 15) continue;
          const docNum = extractFullDocumentNumber(title);
          if (!isValidLegalDocNumber(docNum)) continue;

          let fullLink = link;
          if (link && !link.startsWith('http')) {
            fullLink = `https://xaydungchinhsach.chinhphu.vn${link.startsWith('/') ? '' : '/'}${link}`;
          }

          let docType = 'van_ban';
          if (/nghị định/i.test(title) || /NĐ-CP/i.test(docNum)) docType = 'nghi_dinh';
          else if (/thông tư/i.test(title) || /TT-/i.test(docNum)) docType = 'thong_tu';
          else if (/luật/i.test(title) || /QH/i.test(docNum)) docType = 'luat';
          else if (/quyết định/i.test(title) || /QĐ-/i.test(docNum)) docType = 'quyet_dinh';
          else if (/nghị quyết/i.test(title) || /NQ-/i.test(docNum)) docType = 'nghi_quyet';

          const { topic_aliases, query_patterns } = generateAliasesAndPatterns(docNum, title, '');

          items.push({
            document_number: docNum,
            title: title,
            document_type: docType,
            topic_aliases,
            query_patterns,
            issuer: /chính phủ/i.test(title) ? 'Chính phủ' : (/quốc hội/i.test(title) ? 'Quốc hội' : (/thủ tướng/i.test(title) ? 'Thủ tướng Chính phủ' : 'Cơ quan nhà nước')),
            issue_date: now.toISOString().split('T')[0],
            effective_date: now.toISOString().split('T')[0],
            effective_status: 'in_force',
            status_as_of: now.toISOString().split('T')[0],
            tom_tat_chinh_sach: title,
            official_source_urls: [fullLink],
            source_feed: src.name,
            crawled_at: now
          });
        }
      }
      return items;
    } catch (err) {
      console.warn(`[Crawler] Source ${src.name} fetch failed or timed out:`, err.message);
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
  return Array.from(uniqueMap.values());
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
    const discovered = await crawlOfficialSources();

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

      if (existing) {
        await db.collection('known_documents').updateOne(
          { _id: existing._id },
          {
            $set: {
              ...doc,
              documentNumber: doc.document_number,
              issueDate: doc.issue_date,
              effectiveDate: doc.effective_date,
              effectiveStatus: doc.effective_status,
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

    lastCrawlStatus = {
      lastRunAt: startedAt,
      completedAt: new Date(),
      status: 'idle',
      itemsIngested: newCount + updatedCount,
      newItems: newCount,
      updatedItems: updatedCount,
      totalKnownDocs: totalCount,
      message: `Đã hoàn tất quét văn bản mới nhất: ${newCount} văn bản mới, ${updatedCount} văn bản cập nhật. Tổng văn bản quy phạm pháp luật: ${totalCount}.`,
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
      status: 'success'
    });

    console.log(`[Crawler] Completed: ${newCount} new, ${updatedCount} updated. Total: ${totalCount}`);
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
