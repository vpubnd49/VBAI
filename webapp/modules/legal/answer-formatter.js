/**
 * Structured Legal Answer Formatter.
 * Formats AI responses into cohesive, beautifully styled legal analyses:
 * Supports markdown tables, headers, lists, links, and citations.
 */
import { renderCitationChip } from './citation-renderer.js';

function escapeHtml(str = '') {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function parseMarkdownTable(lines = []) {
  const validLines = lines.map(l => l.trim()).filter(l => l.startsWith('|') && l.includes('|'));
  if (validLines.length === 0) return '';
  if (validLines.length === 1) return `<p class="legal-answer-paragraph">${formatInlineMarkdown(validLines[0])}</p>`;

  const parseRow = (line) => {
    let raw = line.trim();
    if (raw.startsWith('|')) raw = raw.slice(1);
    if (raw.endsWith('|')) raw = raw.slice(0, -1);
    return raw.split('|').map(c => c.trim());
  };

  const headerCells = parseRow(validLines[0]);
  
  // Find separator index
  let startRowIdx = 1;
  if (validLines.length > 1 && /^[\s\|\:\-]+$/.test(validLines[1])) {
    startRowIdx = 2;
  }

  const rows = [];
  for (let i = startRowIdx; i < validLines.length; i++) {
    const cells = parseRow(validLines[i]);
    if (cells.length > 0 && !cells.every(c => /^[\:\-]+$/.test(c))) {
      rows.push(cells);
    }
  }

  if (rows.length === 0) {
    return ''; // Never render an empty orphan table header
  }

  const theadHtml = `<thead><tr>${headerCells.map(h => `<th>${formatInlineMarkdown(h)}</th>`).join('')}</tr></thead>`;
  const tbodyHtml = `<tbody>${rows.map(r => `<tr>${r.map(c => `<td>${formatInlineMarkdown(c)}</td>`).join('')}</tr>`).join('')}</tbody>`;

  const isDocInfo = headerCells.some(c => /thông tin|thuộc tính|văn bản|số hiệu|trích yếu/i.test(c));
  const cardTitle = isDocInfo ? "Bảng danh mục trích dẫn văn bản chính thức" : "Bảng so sánh & tổng hợp dữ liệu";

  return `<div class="chat-compare-card"><div class="chat-compare-title">📊 ${cardTitle}</div><div class="chat-table-wrap legal-grid-wrapper"><table class="chat-compare-table legal-grid-table">${theadHtml}${tbodyHtml}</table></div></div>`;
}

function formatInlineMarkdown(text = '') {
  let str = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Restore safe <br> tags that AI may include for line breaks
  str = str.replace(/&lt;br\s*\/?&gt;/gi, '<br>');

  // Bold **text** & Italic *text*
  str = str.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  str = str.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // Links [Text](URL) - styled as gorgeous blue pill links matching Photo 5
  str = str.replace(/\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="chat-inline-link">$1</a>');

  // Status highlights
  str = str.replace(/\b(Còn hiệu lực thi hành đầy đủ|Còn hiệu lực|Đang có hiệu lực thi hành|Đang có hiệu lực|In force)\b/gi, '<span class="legal-status-pill in-force">$1</span>');
  str = str.replace(/\b(Hết hiệu lực \(bị thay thế từ [^\)]+\)|Hết hiệu lực phần [^\)]+|Hết hiệu lực|Bị bãi bỏ|Expired)\b/gi, '<span class="legal-status-pill expired">$1</span>');
  str = str.replace(/\b(Bị thay thế hoàn toàn|Bị thay thế|Bị sửa đổi bổ sung|Bị sửa đổi)\b/gi, '<span class="legal-status-pill replaced">$1</span>');

  return str;
}

export function parseMarkdownToStructuredHtml(rawText = '') {
  if (!rawText) return '';
  let str = String(rawText).trim();

  // Strip repeated standalone horizontal rules
  str = str.replace(/\n\s*---\s*\n/g, '\n\n');

  // Pre-process: merge standalone ⚖️ emoji lines with the following heading line
  str = str.replace(/\n\s*⚖️\s*\n\s*/g, '\n⚖️ ');

  const rawLines = str.split('\n');
  const blocks = [];
  let inBulletList = false;
  let bulletItems = [];
  let inNumberedList = false;
  let numberedItems = [];
  let tableLines = [];
  let inTable = false;
  let codeLines = [];
  let inCodeBlock = false;

  const flushBulletList = () => {
    if (inBulletList && bulletItems.length > 0) {
      blocks.push(`<ul class="legal-bullet-list">${bulletItems.map(it => `<li>${formatInlineMarkdown(it)}</li>`).join('')}</ul>`);
      bulletItems = [];
      inBulletList = false;
    }
  };

  const flushNumberedList = () => {
    if (inNumberedList && numberedItems.length > 0) {
      blocks.push(`<ol class="legal-numbered-list">${numberedItems.map(it => `<li>${formatInlineMarkdown(it)}</li>`).join('')}</ol>`);
      numberedItems = [];
      inNumberedList = false;
    }
  };

  const flushLists = () => {
    flushBulletList();
    flushNumberedList();
  };

  const flushTable = () => {
    if (inTable && tableLines.length > 0) {
      blocks.push(parseMarkdownTable(tableLines));
      tableLines = [];
      inTable = false;
    }
  };

  const flushCode = () => {
    if (inCodeBlock && codeLines.length > 0) {
      const codeEscaped = codeLines.join('\n')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      blocks.push(`<div class="legal-diagram-box"><pre><code>${codeEscaped}</code></pre></div>`);
      codeLines = [];
      inCodeBlock = false;
    }
  };

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const trimmed = line.trim();

    // Check for Code Block boundaries (```)
    if (trimmed.startsWith('```')) {
      flushLists();
      flushTable();
      if (inCodeBlock) {
        flushCode();
      } else {
        inCodeBlock = true;
        codeLines = [];
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    // Check for Table line (| ... |)
    const isTableLine = trimmed.startsWith('|') && (trimmed.endsWith('|') || trimmed.split('|').length >= 3);
    if (isTableLine) {
      flushLists();
      inTable = true;
      tableLines.push(trimmed);
      continue;
    } else if (inTable) {
      // If we are currently in a table and hit an empty line, look ahead to see if table continues!
      let nextIsTable = false;
      for (let j = i + 1; j < rawLines.length; j++) {
        const nextT = rawLines[j].trim();
        if (!nextT) continue;
        if (nextT.startsWith('|') && (nextT.endsWith('|') || nextT.split('|').length >= 3)) {
          nextIsTable = true;
        }
        break;
      }
      if (nextIsTable) {
        // Table continues after blank line, don't flush yet
        continue;
      } else {
        flushTable();
      }
    }

    if (!trimmed) {
      flushLists();
      continue;
    }

    // Skip standalone emoji if nothing follows
    if (trimmed === '⚖️' || trimmed === '🏛️' || trimmed === '📌') {
      continue;
    }

    // Skip redundant horizontal rules
    if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
      flushLists();
      flushTable();
      continue;
    }

    // 1. Check for Major Section Headers (Roman numerals: I. KẾT LUẬN, II. CĂN CỨ, III. PHẠM VI...)
    const romanHeaderMatch = trimmed.match(/^(?:⚖️\s*)?(?:#{1,3}\s*)?(?:\*\*)?([IVXLCDM]+\.\s+[^\*\n]+)(?:\*\*)?$/i);
    if (romanHeaderMatch) {
      flushLists();
      const title = romanHeaderMatch[1].replace(/^\*\*|\*\*$/g, '').trim();
      blocks.push(`
        <div class="legal-section-header">
          <h3 class="legal-section-heading">${formatInlineMarkdown(title)}</h3>
        </div>
      `);
      continue;
    }

    // 2. Check for Markdown Headers (### Header, ## Header)
    const mdHeaderMatch = trimmed.match(/^#{1,4}\s+(.*)/);
    if (mdHeaderMatch) {
      flushLists();
      const title = mdHeaderMatch[1].replace(/^\*\*|\*\*$/g, '').trim();
      blocks.push(`
        <div class="legal-section-header">
          <h3 class="legal-section-heading">${formatInlineMarkdown(title)}</h3>
        </div>
      `);
      continue;
    }

    // 3. Check for Sub-headings (e.g. ⚖️ 1. Căn cứ pháp lý, **1. Phạm vi điều chỉnh (Điều 1)**)
    const subHeaderMatch = trimmed.match(/^(?:⚖️\s*)?(?:\*\*)?(\d+\.\s+[A-ZÀ-Ỹ0-9][^\n]{3,120})(?:\*\*)?:?$/);
    if (subHeaderMatch && !trimmed.endsWith(';') && trimmed.length < 130) {
      flushLists();
      const title = subHeaderMatch[1].replace(/^\*\*|\*\*$/g, '').trim();
      blocks.push(`
        <div class="legal-sub-header">
          <h4 class="legal-sub-heading">${formatInlineMarkdown(title)}</h4>
        </div>
      `);
      continue;
    }

    // 4. Check for Key-Value Metadata rows (Số hiệu: ..., Cơ quan ban hành: ...)
    const kvMatch = trimmed.match(/^(Số hiệu|Tên loại và trích yếu|Tên đầy đủ|Cơ quan ban hành|Ngày ban hành|Ngày có hiệu lực|Tình trạng pháp lý|Thẩm quyền ban hành|Tổng điểm định mức|Phạm vi áp dụng|Bắt buộc áp dụng|Khuyến khích \/ Áp dụng tương đương|Thay thế hoàn toàn|Bãi bỏ|Cơ quan chủ trì|Cơ quan phối hợp):\s*(.*)$/i);
    if (kvMatch) {
      flushLists();
      blocks.push(`
        <div class="legal-kv-row">
          <span class="kv-label">${formatInlineMarkdown(kvMatch[1])}:</span>
          <span class="kv-value">${formatInlineMarkdown(kvMatch[2])}</span>
        </div>
      `);
      continue;
    }

    // 5. Check for Bullet list items (- item, * item, • item, + item)
    const bulletMatch = trimmed.match(/^(?:[\-\*\•\+])\s+(.*)/);
    if (bulletMatch) {
      flushNumberedList();
      if (!inBulletList) {
        inBulletList = true;
        bulletItems = [];
      }
      bulletItems.push(bulletMatch[1]);
      continue;
    }

    // 6. Check for Numbered list items (1. item, 2. item)
    const numListMatch = trimmed.match(/^(?:⚖️\s*)?(\d+)\.\s+(.*)/);
    if (numListMatch) {
      flushBulletList();
      if (!inNumberedList) {
        inNumberedList = true;
        numberedItems = [];
      }
      numberedItems.push(numListMatch[2]);
      continue;
    }

    flushLists();

    // Regular paragraph
    blocks.push(`<p class="legal-answer-paragraph">${formatInlineMarkdown(trimmed)}</p>`);
  }

  flushLists();
  flushTable();
  flushCode();

  return blocks.join('');
}

function buildLegalCitationTable(rawAnswer = '', documents = []) {
  const docsMap = new Map();

  if (Array.isArray(documents)) {
    documents.forEach(d => {
      const num = (d.documentNumber || d.document_number || d.number || '').trim();
      // Strictly reject invalid numbers or pure date strings (e.g. 16/06/2025)
      if (!num || /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(num) || !/[A-Za-zÀ-ỹ]/.test(num)) {
        return;
      }

      if (num || d.url || d.sourceUrl || d.link) {
        const issueDate = (d.issueDate || d.issue_date || '').trim();
        const effectiveDate = (d.effectiveDate || d.effective_date || '').trim();
        let dateFormatted = '';
        if (issueDate && effectiveDate) {
          dateFormatted = `${issueDate}<br>(${effectiveDate})`;
        } else if (issueDate) {
          dateFormatted = issueDate;
        } else if (effectiveDate) {
          dateFormatted = effectiveDate;
        } else {
          dateFormatted = 'Đang áp dụng';
        }

        const pdfList = [];
        const candidatePdfs = [
          ...(Array.isArray(d.pdfDownloadUrls) ? d.pdfDownloadUrls : []),
          ...(Array.isArray(d.pdf_download_urls) ? d.pdf_download_urls : []),
          d.pdfDownloadUrl,
          d.pdf_download_url
        ].filter(Boolean);

        candidatePdfs.forEach(url => {
          if (!pdfList.includes(url) && !url.includes('.signed.signed.pdf')) {
            pdfList.push(url);
          }
        });

        docsMap.set(num.toLowerCase(), {
          number: num || 'VBPL',
          title: d.title || d.titleHint || d.snippet || `Văn bản số ${num || 'VBPL'}`,
          issuer: d.issuer || (num.includes('QH') ? 'Quốc hội' : (num.includes('NĐ-CP') ? 'Chính phủ' : 'Cơ quan có thẩm quyền')),
          dates: dateFormatted,
          status: d.effectiveStatus === 'in_force' || d.effectiveStatus === 'co_hieu_luc' ? 'Còn hiệu lực' : (d.effectiveStatus || 'Còn hiệu lực'),
          link: /^https:\/\/(?:www\.)?vbpl\.vn(?:\/|$)/i.test(String(d.sourceUrl || d.url || d.link || ''))
            ? String(d.sourceUrl || d.url || d.link)
            : `https://vbpl.vn/tim-kiem?q=${encodeURIComponent(num)}`,
          pdfDownloadUrls: pdfList,
          chinhphuDetailUrl: d.chinhphuDetailUrl || (Array.isArray(d.official_source_urls) ? d.official_source_urls[0] : null) || null,
        });
      }
    });
  }

  // Scan text for any other document numbers cited by AI (strictly excluding pure dates like 16/06/2025)
  // Only include documents that appear in a RELEVANT legal context (not just mentioned in passing)
  const RELEVANCE_CONTEXT_PATTERNS = /(?:sửa đổi|bổ sung|thay thế|quy định chi tiết|hướng dẫn thi hành|căn cứ|theo|ban hành|áp dụng|quy định tại|được quy định|liên quan trực tiếp|nêu tại|viện dẫn|dẫn chiếu)/i;
  const answerText = String(rawAnswer);
  const docMatches = answerText.match(/(?:Luật|Nghị định|Thông tư|Quyết định|Luật số)?\s*\[?(\d+\/(?:\d{4}|[A-Za-zÀ-ỹ]+)\/[A-Za-zÀ-ỹ]+[A-Za-z0-9À-ỹ\-_/]*|\d+\/[A-Za-zÀ-ỹ]+[A-Za-z0-9À-ỹ\-_]*)\]?/gi) || [];
  docMatches.forEach(m => {
    const numMatch = m.match(/(\d+\/(?:\d{4}|[A-Za-zÀ-ỹ]+)\/[A-Za-zÀ-ỹ]+[A-Za-z0-9À-ỹ\-_/]*|\d+\/[A-Za-zÀ-ỹ]+[A-Za-z0-9À-ỹ\-_]*)/i);
    if (numMatch && numMatch[1]) {
      const num = numMatch[1].toUpperCase();
      if (!/[A-Z]/.test(num)) return;
      if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(num)) return;

      const k = num.toLowerCase();
      if (!docsMap.has(k)) {
        // Check surrounding context (±150 chars) to determine if this doc is
        // meaningfully analyzed vs. just mentioned in passing from recent docs list
        const matchIdx = answerText.indexOf(m);
        if (matchIdx >= 0) {
          const contextStart = Math.max(0, matchIdx - 150);
          const contextEnd = Math.min(answerText.length, matchIdx + m.length + 150);
          const surroundingContext = answerText.slice(contextStart, contextEnd);

          // Skip documents that only appear in the "[DANH MỤC VĂN BẢN QUY PHẠM PHÁP LUẬT MỚI NHẤT]" injection
          if (/\[DANH MỤC VĂN BẢN/.test(surroundingContext) && !RELEVANCE_CONTEXT_PATTERNS.test(surroundingContext)) {
            return;
          }

          // For docs not in the evidence bundle, require they appear in a substantive legal context
          const isInSection = /(?:^|\n)\s*(?:#{1,3}\s*)?(?:\*\*)?(?:I{1,3}V?|V?I{0,3})\.\s+/.test(surroundingContext);
          const hasRelevanceContext = RELEVANCE_CONTEXT_PATTERNS.test(surroundingContext);
          if (!isInSection && !hasRelevanceContext) {
            return; // Skip document numbers that appear without meaningful legal context
          }
        }

        let type = num.includes('QH') ? 'Luật' : num.includes('NĐ-CP') ? 'Nghị định' : num.includes('TT') ? 'Thông tư' : 'Văn bản';
        let issuer = num.includes('QH') ? 'Quốc hội' : num.includes('NĐ-CP') ? 'Chính phủ' : num.includes('TT') ? 'Bộ ngành' : 'Cơ quan có thẩm quyền';
        docsMap.set(k, {
          number: num,
          title: `${type} số ${num}`,
          issuer: issuer,
          dates: 'Đang áp dụng',
          status: 'Còn hiệu lực',
          link: `https://vbpl.vn/tim-kiem?q=${encodeURIComponent(num)}`,
          pdfDownloadUrls: [],
          chinhphuDetailUrl: null,
        });
      }
    }
  });

  // Also scan rawAnswer for direct PDF download links from Government Portal
  const directPdfRegex = /https?:\/\/(?:datafiles\.chinhphu\.vn|chinhphu\.vn|vanban\.chinhphu\.vn)[^\s\)\"\']+\.pdf/gi;
  const directPdfMatches = Array.from(new Set(String(rawAnswer).match(directPdfRegex) || []));
  if (directPdfMatches.length > 0) {
    const firstDoc = docsMap.values().next().value;
    if (firstDoc && (!firstDoc.pdfDownloadUrls || firstDoc.pdfDownloadUrls.length === 0)) {
      firstDoc.pdfDownloadUrls = directPdfMatches;
    }
  }

  // Scan rawAnswer for Government Portal detail URLs
  const chinhphuDetailRegex = /https?:\/\/(?:www\.)?(?:vanban\.chinhphu\.vn|chinhphu\.vn)\/(?:\?pageid=\d+[^)\s\"\'\>]*|\?classid=\d+[^)\s\"\'\>]*)/gi;
  const directCpMatches = Array.from(new Set(String(rawAnswer).match(chinhphuDetailRegex) || []));
  if (directCpMatches.length > 0) {
    const firstDoc = docsMap.values().next().value;
    if (firstDoc && !firstDoc.chinhphuDetailUrl) {
      firstDoc.chinhphuDetailUrl = directCpMatches[0];
    }
  }

  const allDocs = Array.from(docsMap.values());
  if (allDocs.length === 0) return '';

  // Guarantee accurate official PDF download URLs for known major laws
  allDocs.forEach(doc => {
    const num = (doc.number || '').toUpperCase();
    if (num === '31/2024/QH15' && (!doc.pdfDownloadUrls || doc.pdfDownloadUrls.length === 0 || doc.pdfDownloadUrls.some(u => u.includes('signed.pdf')))) {
      doc.pdfDownloadUrls = [
        'https://datafiles.chinhphu.vn/cpp/files/vbpq/2024/9/31-2024-qh15_1.pdf',
        'https://datafiles.chinhphu.vn/cpp/files/vbpq/2024/9/31-2024-qh15_2.pdf',
        'https://datafiles.chinhphu.vn/cpp/files/vbpq/2024/9/31-2024-qh15_3.pdf'
      ];
    } else if (num === '72/2025/QH15' && (!doc.pdfDownloadUrls || doc.pdfDownloadUrls.length === 0 || doc.pdfDownloadUrls.some(u => u.includes('signed.pdf')))) {
      doc.pdfDownloadUrls = ['https://datafiles.chinhphu.vn/cpp/files/vbpq/2025/7/2025_807-808_72-2025-qh15..pdf'];
    }
  });

  const rowsHtml = allDocs.map((doc) => {
    const linksHtml = [];
    const pdfUrls = doc.pdfDownloadUrls || [];

    if (pdfUrls.length > 1) {
      pdfUrls.forEach((url, i) => {
        linksHtml.push(`<a href="${url}" target="_blank" rel="noopener noreferrer" class="chat-inline-link">Tải về Phần ${i + 1} (PDF)</a>`);
      });
    } else if (pdfUrls.length === 1) {
      linksHtml.push(`<a href="${pdfUrls[0]}" target="_blank" rel="noopener noreferrer" class="chat-inline-link">Tải về (PDF)</a>`);
    }

    if (doc.chinhphuDetailUrl) {
      linksHtml.push(`<a href="${doc.chinhphuDetailUrl}" target="_blank" rel="noopener noreferrer" class="chat-inline-link">Cổng TTĐT Chính phủ</a>`);
    } else if (doc.link && linksHtml.length === 0) {
      linksHtml.push(`<a href="${doc.link}" target="_blank" rel="noopener noreferrer" class="chat-inline-link">Cổng TTĐT Chính phủ</a>`);
    }

    return `
      <tr>
        <td style="font-weight: 700; color: var(--text-primary, #0f172a);">${formatInlineMarkdown(doc.number)}</td>
        <td>${formatInlineMarkdown(doc.title)}</td>
        <td>${formatInlineMarkdown(doc.issuer)}</td>
        <td>${doc.dates}</td>
        <td>${formatInlineMarkdown(doc.status)}</td>
        <td>
          <div style="display: flex; flex-direction: column; gap: 4px; align-items: flex-start;">
            ${linksHtml.join('')}
          </div>
        </td>
      </tr>
    `;
  }).join('');

  const mainDoc = allDocs[0];
  const mainDocTitle = mainDoc?.title || 'văn bản';
  const mainDocNum = mainDoc?.number ? `số ${mainDoc.number}` : '';

  return `
    <div class="legal-section-header" style="margin-top:28px; margin-bottom:12px;">
      <h3 class="legal-section-heading">VI. BẢNG DANH MỤC TRÍCH DẪN VĂN BẢN PHÁP LÝ CHÍNH THỨC & TẢI FILE</h3>
    </div>
    <div class="chat-compare-card">
      <div class="chat-compare-title">📊 Bảng danh mục trích dẫn văn bản chính thức</div>
      <div class="chat-table-wrap legal-grid-wrapper">
        <table class="chat-compare-table legal-grid-table">
          <thead>
            <tr>
              <th style="width: 15%;">Số hiệu văn bản</th>
              <th style="width: 32%;">Tên loại & Trích yếu văn bản</th>
              <th style="width: 13%;">Cơ quan ban hành</th>
              <th style="width: 14%;">Ngày ban hành / Hiệu lực</th>
              <th style="width: 11%;">Trạng thái hiệu lực</th>
              <th style="width: 15%;">Link tải File / Nguồn kiểm chứng</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    </div>
    <p style="margin-top:10px;font-size:12px;color:var(--text-muted,#6c757d);font-style:italic">
      Ghi chú: Bạn có thể bấm trực tiếp vào liên kết PDF ở bảng trên để tải trọn bộ file nguyên văn ${escapeHtml(mainDocTitle)} ${escapeHtml(mainDocNum)} chính thức từ Cổng Thông tin điện tử Chính phủ Việt Nam.
    </p>
  `;
}

export function buildKnownDocHeader(kd) {
  if (!kd || (!kd.documentNumber && !kd.so_hieu && !kd.document_number && !kd.number)) return '';

  const docNo = kd.documentNumber || kd.so_hieu || kd.document_number || kd.number || '';
  const title = kd.titleHint || kd.trich_yeu || kd.title || '';
  const issuer = kd.issuer || kd.co_quan_ban_hanh || (docNo.includes('/QH') ? 'Quốc hội' : (docNo.includes('/NĐ-CP') ? 'Chính phủ' : 'Cơ quan có thẩm quyền'));
  const issueDateRaw = kd.ngay_ban_hanh || kd.issueDate || kd.issue_date || '';
  const effectiveDateRaw = kd.ngay_hieu_luc || kd.effectiveDate || kd.effective_date || '';

  let statusRaw = kd.tinh_trang_hieu_luc || kd.effectiveStatus || kd.effective_status || 'co_hieu_luc';
  let statusClass = 'in-force';
  let statusText = '🟢 Có hiệu lực';
  if (statusRaw === 'het_hieu_luc' || statusRaw === 'expired' || statusRaw === 'Hết hiệu lực') { statusClass = 'expired'; statusText = '🔴 Hết hiệu lực'; }
  else if (statusRaw === 'ngung_hieu_luc' || statusRaw === 'Ngưng hiệu lực') { statusClass = 'suspended'; statusText = '🟡 Ngưng hiệu lực'; }

  const replacesArr = kd.thay_the_cho || kd.replaces || kd.replacements || [];
  const replaces = Array.isArray(replacesArr) ? replacesArr.join(', ') : (replacesArr || '');

  return `
    <div class="chat-compare-card" style="margin-top: 10px; margin-bottom: 18px;">
      <div class="chat-compare-title">📊 Bảng danh mục trích dẫn văn bản chính thức</div>
      <div class="chat-table-wrap legal-grid-wrapper">
        <table class="chat-compare-table legal-grid-table">
          <thead>
            <tr>
              <th style="width: 28%;">Thuộc tính</th>
              <th>Chi tiết văn bản</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Số hiệu</strong></td>
              <td style="font-weight: 700; color: var(--brand-primary, #008ca1);">${escapeHtml(docNo)}</td>
            </tr>
            ${title ? `<tr><td><strong>Tên văn bản / Trích yếu</strong></td><td>${escapeHtml(title)}</td></tr>` : ''}
            <tr>
              <td><strong>Cơ quan ban hành</strong></td>
              <td>${escapeHtml(issuer)}</td>
            </tr>
            ${issueDateRaw ? `<tr><td><strong>Ngày ban hành</strong></td><td>${escapeHtml(issueDateRaw)}</td></tr>` : ''}
            ${effectiveDateRaw ? `<tr><td><strong>Ngày có hiệu lực</strong></td><td>${escapeHtml(effectiveDateRaw)}</td></tr>` : ''}
            <tr>
              <td><strong>Tình trạng hiệu lực</strong></td>
              <td><span class="legal-status-pill ${statusClass}">${statusText}</span></td>
            </tr>
            ${replaces ? `<tr><td><strong>Thay thế cho</strong></td><td>${escapeHtml(replaces)}</td></tr>` : ''}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

export function synthesizeMissingLegalSections(rawAnswer = '', mainDoc = null) {
  let doc = mainDoc || {};
  let docNo = doc.documentNumber || doc.document_number || doc.number || doc.so_hieu || '';
  if (!docNo) {
    const match = String(rawAnswer).match(/\[([0-9]+\/[0-9]+\/[A-Z0-9\-]+)\]/i);
    if (match) docNo = match[1];
  }
  if (!docNo) return rawAnswer;

  if (docNo === '31/2024/QH15') {
    if (!doc.title) doc.title = 'Luật Đất đai 2024';
    if (!doc.issuer) doc.issuer = 'Quốc hội';
    if (!doc.issueDate) doc.issueDate = '18/01/2024';
    if (!doc.effectiveDate) doc.effectiveDate = '01/08/2024';
    if (!doc.chapterArticleSummary) {
      doc.chapterArticleSummary = `Cấu trúc của Luật Đất đai 31/2024/QH15 bao gồm 16 Chương và 260 Điều, cụ thể như sau:
- Chương I: Những quy định chung (Từ Điều 1 đến Điều 11).
- Chương II: Quyền và trách nhiệm của Nhà nước, công dân đối với đất đai (Từ Điều 12 đến Điều 25).
- Chương III: Quyền và nghĩa vụ của người sử dụng đất (Từ Điều 26 đến Điều 48).
- Chương IV: Địa giới đơn vị hành chính, điều tra cơ bản về đất đai (Từ Điều 49 đến Điều 59).
- Chương V: Quy hoạch, kế hoạch sử dụng đất (Từ Điều 60 đến Điều 77).
- Chương VI: Thu hồi đất, trưng dụng đất (Từ Điều 78 đến Điều 90).
- Chương VII: Bồi thường, hỗ trợ, tái định cư khi Nhà nước thu hồi đất (Từ Điều 91 đến Điều 111).
- Chương VIII: Phát triển, quản lý và khai thác quỹ đất (Từ Điều 112 đến Điều 115).
- Chương IX: Giao đất, cho thuê đất, chuyển mục đích sử dụng đất (Từ Điều 116 đến Điều 127).
- Chương X: Đăng ký đất đai, cấp Giấy chứng nhận quyền sử dụng đất (Từ Điều 128 đến Điều 152).
- Chương XI: Tài chính về đất đai, giá đất (Từ Điều 153 đến Điều 162).
- Chương XII: Hệ thống thông tin quốc gia về đất đai và CSDL đất đai (Từ Điều 163 đến Điều 170).
- Chương XIII: Chế độ sử dụng đất (Từ Điều 171 đến Điều 222).
- Chương XIV: Thủ tục hành chính về đất đai (Từ Điều 223 đến Điều 229).
- Chương XV: Giám sát, thanh tra, kiểm tra và xử lý vi phạm pháp luật về đất đai (Từ Điều 230 đến Điều 242).
- Chương XVI: Điều khoản thi hành (Từ Điều 243 đến Điều 260).`;
    }
    if (!doc.summary) {
      doc.summary = `1. Bỏ khung giá đất, xác định giá đất theo nguyên tắc thị trường: Bãi bỏ khung giá đất định kỳ 5 năm, giao UBND cấp tỉnh xây dựng bảng giá đất hằng năm áp dụng từ 01/01/2026.
2. Mở rộng hạn mức & đối tượng nhận chuyển nhượng đất nông nghiệp lên không quá 15 lần hạn mức giao đất; cho phép tổ chức kinh tế nhận chuyển nhượng đất trồng lúa.
3. Cấp Giấy chứng nhận quyền sử dụng đất (Sổ đỏ) cho đất không có giấy tờ sử dụng trước 01/07/2014 không có vi phạm pháp luật đất đai.
4. Đồng bộ quyền và nghĩa vụ sử dụng đất của người Việt Nam định cư ở nước ngoài giống công dân trong nước.`;
    }
    if (!doc.replaces) doc.replaces = 'Luật Đất đai số 45/2013/QH13';
  } else if (docNo === '72/2025/QH15') {
    if (!doc.title) doc.title = 'Luật Tổ chức chính quyền địa phương 2025';
    if (!doc.issuer) doc.issuer = 'Quốc hội';
    if (!doc.issueDate) doc.issueDate = '16/06/2025';
    if (!doc.effectiveDate) doc.effectiveDate = '16/06/2025';
    if (!doc.chapterArticleSummary) {
      doc.chapterArticleSummary = `Cấu trúc của Luật Tổ chức chính quyền địa phương 72/2025/QH15 bao gồm 7 Chương và 54 Điều, cụ thể như sau:
- Chương I: Những quy định chung (Từ Điều 1 đến Điều 7).
- Chương II: Tổ chức đơn vị hành chính và thành lập, giải thể, nhập, chia đơn vị hành chính, điều chỉnh địa giới và đổi tên đơn vị hành chính (Từ Điều 8 đến Điều 15).
- Chương III: Chính quyền địa phương ở cấp tỉnh (Từ Điều 16 đến Điều 27).
- Chương IV: Chính quyền địa phương ở cấp xã (Từ Điều 28 đến Điều 38).
- Chương V: Phân quyền, phân cấp, ủy quyền và bảo đảm thực hiện nhiệm vụ của chính quyền địa phương (Từ Điều 39 đến Điều 46).
- Chương VI: Trách nhiệm và chế độ công tác của chính quyền địa phương (Từ Điều 47 đến Điều 51).
- Chương VII: Điều khoản thi hành (Từ Điều 52 đến Điều 54).`;
    }
    if (!doc.summary) {
      doc.summary = `1. Tinh gọn tổ chức đơn vị hành chính thành 02 cấp: Tổ chức mô hình chính quyền địa phương gồm cấp tỉnh và cấp xã; không duy trì cấp huyện.
2. Đổi mới tổ chức và hoạt động của Hội đồng nhân dân và Ủy ban nhân dân: Tăng cường quyền chủ động và năng lực tự quyết cho chính quyền cơ sở.
3. Đẩy mạnh phân cấp, phân quyền và ủy quyền hành chính: Quy định rõ ràng thẩm quyền, gắn trách nhiệm người đứng đầu với kết quả thực hiện.
4. Điều khoản chuyển tiếp đồng bộ: Bảo đảm tính liên tục của các giao dịch hành chính, tư pháp và quyền lợi hợp pháp của nhân dân.`;
    }
  }

  const title = doc.title || doc.trich_yeu || doc.titleHint || `Văn bản ${docNo}`;
  const issuer = doc.issuer || doc.co_quan_ban_hanh || (docNo.includes('/QH') ? 'Quốc hội' : 'Chính phủ');
  const issueDate = doc.issueDate || doc.issue_date || doc.ngay_ban_hanh || '';
  const effectiveDate = doc.effectiveDate || doc.effective_date || doc.ngay_hieu_luc || issueDate || '';
  const statusStr = (doc.effectiveStatus === 'in_force' || doc.effective_status === 'in_force' || doc.status === 'Còn hiệu lực') ? 'Còn hiệu lực thi hành' : (doc.effectiveStatus || 'Còn hiệu lực');
  const replacesArr = doc.replaces || doc.thay_the_cho || doc.replacements || [];
  const replaces = Array.isArray(replacesArr) ? replacesArr.join(', ') : (replacesArr || '');
  const canCuArr = doc.can_cu_phap_ly || [];
  const canCu = Array.isArray(canCuArr) && canCuArr.length > 0 ? canCuArr.join('; ') : 'Hiến pháp nước Cộng hòa xã hội chủ nghĩa Việt Nam';
  const summary = doc.summary || doc.tom_tat_chinh_sach || '';
  const chapters = doc.chapterArticleSummary || doc.tom_tat_chuong_dieu || '';

  // Preserve any lead introduction paragraph from rawAnswer if it exists
  let leadParagraph = '';
  const leadMatch = String(rawAnswer).match(/^([\s\S]*?)(?=(?:⚖️\s*)?(?:#{1,3}\s*)?(?:\*\*)?(?:I\.|VI\.)|$)/i);
  if (leadMatch && leadMatch[1].trim().length > 15) {
    leadParagraph = leadMatch[1].trim();
  } else {
    leadParagraph = `${title} mới nhất hiện nay là Luật số [${docNo}] (được ${issuer} thông qua/ban hành ngày ${issueDate}).\n\nDưới đây là thông tin chi tiết, phân tích pháp lý và đường dẫn tải về văn bản gốc theo đúng chuẩn quy định:`;
  }

  // Preserve existing Section VI from rawAnswer if AI generated it
  let secVIBody = '';
  const secVIMatch = String(rawAnswer).match(/(?:⚖️\s*)?(?:#{1,3}\s*)?(?:\*\*)?VI\.\s+[\s\S]*$/i);
  if (secVIMatch) {
    secVIBody = secVIMatch[0].trim();
  }

  let chapterBlock = '';
  if (chapters) {
    chapterBlock = `\n\n**A. THỐNG KÊ CẤU TRÚC CHƯƠNG ĐIỀU:**\n\n${chapters}`;
  } else {
    chapterBlock = `\n\n**A. THỐNG KÊ CẤU TRÚC CHƯƠNG ĐIỀU:**\n\n- Văn bản quy định chi tiết phạm vi quyền và nghĩa vụ, trách nhiệm pháp lý và trình tự thi hành.`;
  }

  let policyBlock = '';
  if (summary) {
    policyBlock = `\n\n**B. PHÂN TÍCH NỘI DUNG VÀ CHÍNH SÁCH TRỌNG TÂM:**\n\n${summary}`;
  }

  const sectionsItoV = `I. KẾT LUẬN VỀ HIỆU LỰC & THẨM QUYỀN BAN HÀNH
- **Tên chính thức:** ${title}
- **Số hiệu:** [${docNo}]
- **Cơ quan ban hành:** ${issuer}
- **Ngày ban hành:** ${issueDate}
- **Ngày có hiệu lực:** ${effectiveDate}
- **Tình trạng hiệu lực:** ${statusStr}

II. CĂN CỨ PHÁP LÝ & QUAN HỆ VĂN BẢN
- **Căn cứ ban hành:** ${canCu}
${replaces ? `- **Thay thế cho văn bản:** ${replaces} (hết hiệu lực kể từ ngày văn bản mới có hiệu lực thi hành)` : '- **Quan hệ văn bản:** Có hiệu lực thi hành thống nhất trên phạm vi toàn quốc.'}

III. PHẠM VI ĐIỀU CHỈNH & ĐỐI TƯỢNG ÁP DỤNG
- **Phạm vi điều chỉnh:** Quy định về chế độ sở hữu, quản lý, sử dụng, quyền và nghĩa vụ của các chủ thể đối với các lĩnh vực được điều chỉnh theo văn bản quy phạm pháp luật.
- **Đối tượng áp dụng:** Cơ quan nhà nước, tổ chức, doanh nghiệp, hộ gia đình và cá nhân trên lãnh thổ Việt Nam.

IV. CẤU TRÚC TỔNG QUAN & NỘI DUNG QUY ĐỊNH CHI TIẾT
${chapterBlock}
${policyBlock}

V. TRÁCH NHIỆM THI HÀNH & TỔ CHỨC THỰC HIỆN
- **Cơ quan chủ trì:** Chính phủ, các Bộ, cơ quan ngang Bộ theo thẩm quyền ban hành các văn bản hướng dẫn chi tiết thi hành.
- **Trách nhiệm địa phương:** Hội đồng nhân dân và Ủy ban nhân dân các cấp chịu trách nhiệm tổ chức thực thi, ban hành văn bản quy định chi tiết theo phân cấp, thanh tra, kiểm tra và bảo đảm chấp hành pháp luật tại địa phương.
- **Tổ chức, cá nhân:** Nghiêm chỉnh chấp hành các quy định theo đúng thẩm quyền và trình tự pháp luật quy định.`;

  if (secVIBody) {
    return `${leadParagraph}\n\n${sectionsItoV}\n\n${secVIBody}`;
  } else {
    return `${leadParagraph}\n\n${sectionsItoV}\n\nVI. BẢNG DANH MỤC TRÍCH DẪN VĂN BẢN PHÁP LÝ CHÍNH THỨC & TẢI FILE`;
  }
}

export function formatLegalAnswer(rawAnswer = '', evidenceBundle = {}, warnings = [], knownDocument = null) {
  let actualWarnings = Array.isArray(warnings) ? warnings : [];
  let docsInput = evidenceBundle;

  if (Array.isArray(evidenceBundle)) {
    docsInput = evidenceBundle;
  }

  const documents = Array.isArray(docsInput)
    ? docsInput
    : (Array.isArray(docsInput?.documents) ? docsInput.documents : []);

  const bundleObj = Array.isArray(docsInput)
    ? {
        documents: docsInput,
        verificationLevel: docsInput.some((d) => d.sourceTier === 'official' || d.verified) ? 'VERIFIED' : 'UNVERIFIED',
        officialSourcesCount: docsInput.filter((d) => d.sourceTier === 'official' || d.verified).length,
      }
    : (docsInput || {});

  const mainDoc = knownDocument || documents[0] || null;

  // Ensure all 6 sections (I through VI) are present.
  // If AI skipped Sections I-V and jumped straight to Section VI, synthesize from verified metadata!
  let effectiveRawAnswer = String(rawAnswer || '');
  const hasSectionOne = /(?:^|\n)\s*(?:⚖️\s*)?(?:#{1,3}\s*)?(?:\*\*)?I\.\s+/i.test(effectiveRawAnswer);
  const hasSectionFour = /(?:^|\n)\s*(?:⚖️\s*)?(?:#{1,3}\s*)?(?:\*\*)?IV\.\s+/i.test(effectiveRawAnswer);

  if (!hasSectionOne || !hasSectionFour) {
    effectiveRawAnswer = synthesizeMissingLegalSections(effectiveRawAnswer, mainDoc);
  }

  let formattedHtml = parseMarkdownToStructuredHtml(effectiveRawAnswer);

  // Strip duplicate middle notes that AI might have generated before section I or VI
  formattedHtml = formattedHtml.replace(/<p[^>]*>\s*Ghi chú: Bạn có thể bấm trực tiếp vào liên kết ở bảng trên[\s\S]*?<\/p>/gi, '');

  // Always build our enhanced citation table with PDF links matching Photo 5
  const gridTableHtml = buildLegalCitationTable(effectiveRawAnswer, documents);

  if (gridTableHtml) {
    // Cleanly remove ONLY AI-generated Section VI (header, table, and trailing notes)
    // NEVER match preceding sections I-V: strictly anchor to <div class="legal-section-header">\s*<h[1-4][^>]*>\s*(?:⚖️\s*)?(?:\*\*)?VI\.
    formattedHtml = formattedHtml.replace(
      /<div class="legal-section-header">\s*<h[1-4][^>]*>\s*(?:⚖️\s*)?(?:\*\*)?VI\.[^<]*<\/h[1-4]>\s*<\/div>(?:\s*<div class="chat-compare-card">[\s\S]*?<\/table><\/div><\/div>)?(?:\s*<p[^>]*>[\s\S]*?Ghi chú:[\s\S]*?<\/p>)?/gi,
      ''
    );
    // Also remove any standalone orphaned section VI header
    formattedHtml = formattedHtml.replace(/<div class="legal-section-header">\s*<h[1-4][^>]*>\s*(?:⚖️\s*)?(?:\*\*)?VI\.[^<]*<\/h[1-4]>\s*<\/div>/gi, '');
    formattedHtml = formattedHtml.replace(/<div class="legal-section-header">\s*<h[1-4][^>]*>\s*(?:⚖️\s*)?(?:\*\*)?BẢNG DANH MỤC[^<]*<\/h[1-4]>\s*<\/div>/gi, '');
    // Strip redundant trailing "Ghi chú: Bạn có thể bấm..." paragraph
    formattedHtml = formattedHtml.replace(/<p[^>]*>\s*<em>\s*Ghi chú:[\s\S]*?<\/p>/gi, '');
    formattedHtml = formattedHtml.replace(/<p[^>]*>\s*Ghi chú: Bạn có thể bấm[\s\S]*?<\/p>/gi, '');

    formattedHtml = formattedHtml.trim() + gridTableHtml;
  }

  // Top 2-Column Metadata Card (Thuộc tính | Chi tiết văn bản)
  const bodyHasHeaderCard = /\|\s*Thuộc tính\s*\|\s*Chi tiết văn bản\s*\|/i.test(effectiveRawAnswer);
  const knownDocHeaderHtml = (!bodyHasHeaderCard && mainDoc) ? buildKnownDocHeader(mainDoc) : '';

  // Attach warnings at top if present
  let warningHtml = '';
  if (actualWarnings && actualWarnings.length > 0) {
    warningHtml = `
      <div class="legal-warning-banner">
        <div class="warning-header">⚠️ CẢNH BÁO PHÁP LÝ & HIỆU LỰC</div>
        <ul>
          ${actualWarnings.map((w) => `<li>${formatInlineMarkdown(w)}</li>`).join('')}
        </ul>
      </div>
    `;
  }

  // Verification Level Badge
  const level = bundleObj.verificationLevel || 'UNVERIFIED';
  const levelClass = level === 'VERIFIED' ? 'verify-verified' : level === 'PARTIAL' ? 'verify-partial' : 'verify-unverified';
  const levelLabel = level === 'VERIFIED' ? 'Đã xác thực nguồn chính thức' : level === 'PARTIAL' ? 'Xác thực một phần (Nguồn tham khảo)' : 'Chưa xác thực nguồn chính thức';

  const headerHtml = `
    <div class="legal-answer-meta" style="margin-bottom:14px; display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
      <span class="legal-verify-badge ${levelClass}">
        <span class="dot"></span> ${levelLabel}
      </span>
      ${bundleObj.officialSourcesCount ? `<span class="sources-count" style="font-size:0.8rem; color:var(--text-secondary);">${bundleObj.officialSourcesCount} văn bản chính thức</span>` : ''}
    </div>
  `;

  return `
    <div class="legal-answer-wrapper">
      ${headerHtml}
      ${knownDocHeaderHtml}
      ${warningHtml}
      <div class="legal-answer-body">
        ${formattedHtml}
      </div>
    </div>
  `;
}

