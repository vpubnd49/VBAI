/**
 * Structured Legal Answer Formatter.
 * Formats AI responses into cohesive, beautifully styled legal analyses:
 * Supports markdown tables, headers, lists, links, and citations.
 */
import { renderCitationChip } from './citation-renderer.js';

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

  return `<div class="table-responsive"><table class="legal-table">${theadHtml}${tbodyHtml}</table></div>`;
}

function formatInlineMarkdown(text = '') {
  let str = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Bold **text** & Italic *text*
  str = str.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  str = str.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // Links [Text](URL)
  str = str.replace(/\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="legal-link">$1</a>');

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
          <span class="section-icon">⚖️</span>
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
          <span class="section-icon">⚖️</span>
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
       const num = d.documentNumber || d.document_number || d.number || '';
       if (num || d.url || d.sourceUrl || d.link) {
        docsMap.set(num.toLowerCase(), {
           number: num || 'VBPL',
           title: d.title || d.titleHint || d.snippet || `Văn bản số ${num || 'VBPL'}`,
          issuer: d.issuer || 'Chính phủ / Quốc hội',
          dates: [d.issueDate || d.issue_date, d.effectiveDate || d.effective_date].filter(Boolean).join(' / ') || 'Còn hiệu lực',
          status: d.effectiveStatus === 'in_force' || d.effectiveStatus === 'co_hieu_luc' ? 'Còn hiệu lực' : (d.effectiveStatus || 'Còn hiệu lực'),
           link: /^https:\/\/(?:www\.)?vbpl\.vn(?:\/|$)/i.test(String(d.sourceUrl || d.url || d.link || ''))
             ? String(d.sourceUrl || d.url || d.link)
             : `https://vbpl.vn/tim-kiem?q=${encodeURIComponent(num)}`
        });
      }
    });
  }

  // Scan text for any other document numbers cited by AI
  const docMatches = String(rawAnswer).match(/(?:Luật|Nghị định|Thông tư|Quyết định|Luật số)?\s*\[?(\d+\/\d+\/[A-Za-z0-9\-_]+)\]?/gi) || [];
  docMatches.forEach(m => {
    const numMatch = m.match(/(\d+\/\d+\/[A-Za-z0-9\-_]+)/i);
    if (numMatch && numMatch[1]) {
      const num = numMatch[1].toUpperCase();
      const k = num.toLowerCase();
      if (!docsMap.has(k)) {
        let type = num.includes('QH') ? 'Luật' : num.includes('NĐ-CP') ? 'Nghị định' : num.includes('TT') ? 'Thông tư' : 'Văn bản';
        let issuer = num.includes('QH') ? 'Quốc hội' : num.includes('NĐ-CP') ? 'Chính phủ' : num.includes('TT') ? 'Bộ ngành' : 'Cơ quan có thẩm quyền';
        docsMap.set(k, {
          number: num,
          title: `${type} số ${num}`,
          issuer: issuer,
          dates: 'Đang áp dụng',
          status: 'Còn hiệu lực',
          link: `https://vbpl.vn/tim-kiem?q=${encodeURIComponent(num)}`
        });
      }
    }
  });

  const allDocs = Array.from(docsMap.values());
  if (allDocs.length === 0) return '';

  const rowsHtml = allDocs.map((doc, idx) => `
    <tr>
      <td style="text-align:center; font-weight:700;">${idx + 1}</td>
      <td style="font-weight:700; color:var(--brand-primary, #008ca1);">${formatInlineMarkdown(doc.number)}</td>
      <td>${formatInlineMarkdown(doc.title)}</td>
      <td>${formatInlineMarkdown(doc.issuer)}</td>
      <td>${formatInlineMarkdown(doc.dates)}</td>
      <td style="text-align:center;"><span class="legal-status-pill in-force">${formatInlineMarkdown(doc.status)}</span></td>
      <td style="text-align:center;"><a href="${doc.link}" target="_blank" rel="noopener noreferrer" class="legal-link">VBPL ↗</a></td>
    </tr>
  `).join('');

  return `
    <div class="legal-section-header" style="margin-top:24px;">
      <span class="section-icon">⚖️</span>
      <h3 class="legal-section-heading">VI. BẢNG DANH MỤC TRÍCH DẪN VĂN BẢN CHÍNH THỨC</h3>
    </div>
    <div class="table-responsive legal-grid-wrapper">
      <table class="legal-table legal-grid-table">
        <thead>
          <tr>
            <th style="width: 5%; text-align:center;">STT</th>
            <th style="width: 18%;">Số hiệu văn bản</th>
            <th style="width: 32%;">Tên loại & Trích yếu văn bản</th>
            <th style="width: 15%;">Cơ quan ban hành</th>
            <th style="width: 14%;">Ban hành / Hiệu lực</th>
            <th style="width: 10%; text-align:center;">Trạng thái</th>
            <th style="width: 6%; text-align:center;">Nguồn</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>
  `;
}

export function formatLegalAnswer(rawAnswer = '', evidenceBundle = {}, warnings = []) {
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

  let formattedHtml = parseMarkdownToStructuredHtml(rawAnswer);

  // If the parsed HTML doesn't contain a complete table or has an empty table header, append the guaranteed grid table!
  const hasCompleteTable = formattedHtml.includes('<table class="legal-table">') && formattedHtml.includes('<tbody><tr>');
  if (!hasCompleteTable) {
    // Strip trailing empty section VI headers if present
    formattedHtml = formattedHtml.replace(/<div class="legal-section-header">[\s\S]*?VI\.\s*BẢNG DANH MỤC[\s\S]*?<\/div>/gi, '');
    const gridTableHtml = buildLegalCitationTable(rawAnswer, documents);
    formattedHtml += gridTableHtml;
  }

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
      ${warningHtml}
      <div class="legal-answer-body">
        ${formattedHtml}
      </div>
    </div>
  `;
}

