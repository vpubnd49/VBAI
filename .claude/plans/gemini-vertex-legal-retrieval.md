# Implementation Plan: Gemini Chat + Vertex AI Search + Official-First Legal Retrieval

## Context

User wants the legal assistant to:
- **Always retrieve the freshest data from official legal sources**
- **Use Gemini API key for chat/answer generation**
- **Use Vertex AI Search for web retrieval**
- **Guarantee official sources (vbpl.vn, vanban.chinhphu.vn, quochoi.vn, etc.) are prioritized**
- **Backend validator is the source of truth; frontend must not override backend validation**
- **Strict citation for article/clause/point queries**
- **Force fresh retrieval for time-sensitive legal queries**

Current issues to fix:
- Encoding/entity decoding issues in legal snippets
- Early strict-reject for general legal queries like "luật an ninh mạng mới nhất"
- Cache/hot-index may serve stale data for time-sensitive queries
- Frontend has some duplicate logic for encoding/formatting that should live in backend
- Clarification policy needs alignment with prompt spec

## Files to Modify

### Critical Backend Files
- `proxy/server.js` - Core changes for search provider routing, validation, metadata
- `proxy/lib/legal-extract.js` - Text normalization and strict extraction

### Critical Frontend Files
- `webapp/modules/chat-assistant.js` - Query routing, legal formatting, doc-number memory
- `webapp/modules/ai-proxy.js` - Request flags for freshness/search provider

### Test Files
- `proxy/tests/*.cjs` - Update/extend tests
- `webapp/tests/*.mjs` - Update/extend tests

---

## Phase 1: Backend Search Provider & Freshness Control

### 1.1 Force Fresh Policy for Time-Sensitive Queries
**Location:** `proxy/server.js` around web-search handler (line ~794+)

**Changes:**
- When user query contains time-sensitive keywords (mới nhất, hiện hành, hiệu lực, sửa đổi, thay thế, hôm nay, hiện nay):
  - Force `forceFresh=true`
  - Bypass or short-circuit hot index if index is stale
  - Bypass or invalidate cache for time-sensitive queries
  - Set recency window (7 days, 30 days, 365 days) based on query indicators

**New environment variable options:**
```
WEB_SEARCH_TIME_SENSITIVE_TTL_MS=60000          // 1 minute TTL for time-sensitive cache
WEB_SEARCH_NORMAL_TTL_MS=90000                  // 1.5 minute normal TTL (existing)
WEB_SEARCH_HOT_INDEX_MAX_AGE_MS=21600000        // 6 hour max hot index age (existing)
```

**Logic change:**
```javascript
// Detect time-sensitive query
function isTimeSensitiveQuery(query) {
  const n = normalizeVietnamese(query);
  return /(moi nhat|hien hanh|hieu luc|sua doi|bo sung|thay the|bai bo|hom nay|hien tai|ngay nay)/.test(n);
}

// In web-search handler:
const isTimeSensitive = isTimeSensitiveQuery(query);
const effectiveCacheTTL = isTimeSensitive ? WEB_SEARCH_TIME_SENSITIVE_TTL_MS : WEB_SEARCH_RESULT_CACHE_TTL_MS;
```

### 1.2 Official-First Search Ranking
**Location:** `proxy/server.js` around source tier logic (line ~138-158, 885-995)

**Changes:**
- When building search query for Vertex AI Search:
  - Prioritize official domains in query clauses
  - Rank results by source tier: official > reference > unknown
  - Ensure official sources are always considered before reference sources

**Search query building logic:**
```javascript
// Official-first query
const officialDomainClause = [
  'site:vbpl.vn',
  'site:vanban.chinhphu.vn',
  'site:congbao.chinhphu.vn',
  'site:chinhphu.vn',
  'site:quochoi.vn',
  'site:moj.gov.vn',
  'site:dangcongsan.vn',
  'site:baochinhphu.vn',
].join(' OR ');

// For time-sensitive legal queries, prefer official-only first pass
const preferOfficialOnly = isTimeSensitive || hasDocNumber;
const searchClause = preferOfficialOnly
  ? `${query} ${officialDomainClause}`
  : `${query} (${officialDomainClause} OR (${referenceDomainClause}))`;
```

### 1.3 Vertex AI Search Provider Routing
**Location:** `proxy/server.js` around provider resolution (line ~933+)

**Changes:**
- Make `vertex_ai_search` the default/primary provider for web search
- Keep Vertex Answer API as optional mode but NOT the default for strict legal queries
- Route based on `web_search_mode` config:
  - `fast_primary` -> Vertex AI Search candidates
  - `vertex_answer` -> Vertex Answer API (optional, less transparent)
  - `cse_fallback` -> Google CSE if Vertex unavailable

**New config validation:**
```javascript
function sanitizeWebSearchMode(mode) {
  const validModes = ['fast_primary', 'vertex_answer', 'cse_fallback'];
  return validModes.includes(mode) ? mode : 'fast_primary';
}

function sanitizeWebSearchProvider(provider) {
  const validProviders = ['vertex_ai_search', 'google_cse'];
  return validProviders.includes(provider) ? provider : 'vertex_ai_search';
}
```

### 1.4 Enhanced Validation Metadata
**Location:** `proxy/server.js` around meta building (line ~900+, 950+)

**Changes:**
Add these metadata fields to all web-search responses:
- `answer_mode` - "strict_legal" | "grounded_general" | "evidence_only" | "reject_with_alternative"
- `validation_mode` - "full_match" | "partial_match" | "topic_match"
- `source_tier_summary` - count of results per tier
- `confidence` - 0-1 confidence score
- `effective_status` - "active" | "superseded" | "invalidated" | "unknown"
- `superseded_by` - doc number if known
- `best_alternative` - best candidate when exact match fails
- `extract_mode` - "strict" | "keyword_fallback"
- `cache_hit` - boolean
- `served_in_ms` - response time
- `freshness_forced` - boolean

**Example meta structure:**
```javascript
const meta = {
  strategy: 'vertex_search',
  webSearchProvider: 'vertex_ai_search',
  webSearchMode: 'fast_primary',
  answer_mode: detectedMode,  // strict_legal, grounded_general, etc.
  query: query,
  refinedQuery: refinedQuery || query,
  expectedDocNumber: normalizedExpectedDocNumber,
  exactMatch: validation.ok && validation.docNumberMatchLevel === 'full',
  docNumberMatchLevel: validation.docNumberMatchLevel,
  requestedDocType: validation.requestedDocType,
  typeMatch: validation.typeMatch,
  sourceTierSummary: validation.sourceTierSummary,
  confidence: validation.confidence,
  effective_status: effectiveStatus,
  superseded_by: supersededBy,
  best_alternative: bestAlternative,
  cacheHit: cacheHit,
  freshness_forced: isTimeSensitive,
  servedInMs: Date.now() - requestStartMs,
};
```

---

## Phase 2: Backend Text Normalization & Strict Extraction

### 2.1 Complete Entity Decoding in Backend
**Location:** `proxy/lib/legal-extract.js`

**Current state:** Only `cleanText` exists, no full entity decode.

**Changes:**
Add comprehensive entity decode function:
```javascript
function decodeHtmlEntities(text) {
  let decoded = String(text || '');
  // Decode multiple times to handle double-encoded entities
  for (let i = 0; i < 3; i++) {
    decoded = decoded
      // Decode double-encoded named entities (&#x...; -> &#x...;)
      .replace(/&#x([0-9a-fA-F]+);/g, '&#x$1;')
      .replace(/&#(\d+);/g, '&#$1;')
      // Decode hex entities
      .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
        const code = parseInt(hex, 16);
        return Number.isFinite(code) ? String.fromCodePoint(code) : '';
      })
      // Decode decimal entities
      .replace(/&#(\d+);/g, (_, dec) => {
        const code = parseInt(dec, 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : '';
      })
      // Decode named entities
      .replace(/&/g, '&')
      .replace(/</g, '<')
      .replace(/>/g, '>')
      .replace(/"/g, '"')
      .replace(/'/g, "'")
      .replace(/&nbsp;/g, ' ');
  }
  return decoded;
}
```

**Update `extractStrictLegalText` to decode before extraction:**
```javascript
function extractStrictLegalText(plain = '', target = {}) {
  // Decode entities first
  const source = decodeHtmlEntities(String(plain || ''));
  // ... rest of existing logic
}
```

### 2.2 Boilerplate Filtering in Extract
**Location:** `proxy/lib/legal-extract.js`

**Changes:**
Add function to filter out footer/navigation/menu content:
```javascript
function filterBoilerplate(text = '') {
  const patterns = [
    // Phone numbers / hotline
    /hotline:\s*[\d\s-]+/gi,
    /Tổng đài:\s*[\d\s-]+/gi,
    /Đường dây nóng:\s*[\d\s-]+/gi,
    // Copyright
    /©\s*\d{4}\s*.+Все rights reserved/i,
    /Copyright\s*[©©]\s*\d{4}/i,
    // Navigation
    /menu\s*:|danh\s*mares|trang\s*ch[uú]/gi,
    // Footer links
    /giả i pháp|dịch vụ|liên hệ/gi,
  ];

  let filtered = text;
  for (const pattern of patterns) {
    filtered = filtered.replace(pattern, ' ');
  }

  // Remove excessive whitespace
  return filtered.replace(/\s+/g, ' ').trim();
}
```

### 2.3 Export New Functions
**Location:** `proxy/lib/legal-extract.js`

```javascript
module.exports = {
  cleanText,
  parsePositiveInt,
  parsePointToken,
  extractStrictLegalText,
  decodeHtmlEntities,
  filterBoilerplate,
};
```

---

## Phase 3: Backend Validation Logic Enhancement

### 3.1 Query Mode Detection
**Location:** `proxy/server.js` in web-search handler

**Changes:**
Add function to detect query mode:
```javascript
function detectQueryMode(query, docNumberMatchLevel, hasDocType) {
  const n = normalizeVietnamese(query);

  // Strict legal: has full doc number or specific article/clause/point
  if (docNumberMatchLevel === 'full' || hasDocType) {
    return 'strict_legal';
  }

  // Evidence only: checking if document exists
  if (/(tồn tại|có tồn tại|đã ban hành|so hieu)/.test(n)) {
    return 'evidence_only';
  }

  // Grounded general: general queries like "luật X mới nhất"
  if (/(luat|nghi dinh|thong tu|quyet dinh|van ban|moi nhat|hien hanh)/.test(n)) {
    return 'grounded_general';
  }

  // Default to grounded general for legal topics
  return 'grounded_general';
}
```

### 3.2 Effective Status Detection
**Location:** `proxy/server.js` after search results validation

**Changes:**
Add function to detect effective status from search results:
```javascript
function detectEffectiveStatus(items, query) {
  const n = normalizeVietnamese(query);

  for (const item of items) {
    const title = normalizeVietnamese(item.title || '');
    const snippet = normalizeVietnamese(item.snippet || '');

    // Check for active status indicators
    if (/(văn bản hiện hành|văn bản có hiệu lực|còn hiệu lực|văn bản mới nhất)/.test(title + snippet)) {
      return 'active';
    }

    // Check for superseded indicators
    if (/(bị thay thế|bị bãi bỏ|hết hiệu lực|không còn hiệu lực|được thay thế)/.test(title + snippet)) {
      // Try to extract superseding document number
      const supersedeMatch = (title + snippet).match(/thay\s*thế\s*bởi?\s*(\d+\/\d{4}\/[A-Z0-9-]+)/i);
      if (supersedeMatch) {
        return {
          status: 'superseded',
          superseded_by: supersedeMatch[1],
        };
      }
      return 'superseded';
    }

    // Check for invalidated indicators
    if (/(bị hủy|vô hiệu|không còn giá trị|bị hủy bỏ)/.test(title + snippet)) {
      return 'invalidated';
    }
  }

  return 'unknown';
}
```

### 3.3 Best Alternative Selection
**Location:** `proxy/server.js` in validation logic

**Changes:**
Add function to select best alternative when exact match fails:
```javascript
function selectBestAlternative(items, requestedDocType, docNumberMatchLevel) {
  // Filter items by requested doc type if specified
  const typeFiltered = requestedDocType
    ? items.filter(item => isDocTypeMatch(item, requestedDocType))
    : items;

  // Sort by source tier first, then by title match
  const sorted = typeFiltered.sort((a, b) => {
    const tierA = detectSourceTier(a);
    const tierB = detectSourceTier(b);

    // Official > Reference > Unknown
    const tierOrder = { official: 0, reference: 1, unknown: 2 };
    if (tierOrder[tierA] !== tierOrder[tierB]) {
      return tierOrder[tierA] - tierOrder[tierB];
    }

    // Same tier: prefer title match
    const scoreA = calculateMatchScore(a);
    const scoreB = calculateMatchScore(b);
    return scoreB - scoreA;
  });

  return sorted.length > 0 ? sorted[0] : null;
}

function calculateMatchScore(item, query) {
  let score = 0;

  const title = normalizeVietnamese(item.title || '');
  const snippet = normalizeVietnamese(item.snippet || '');
  const text = title + ' ' + snippet;

  // Doc number match
  if (query.expectedDocNumber && text.includes(query.expectedDocNumber)) {
    score += 100;
  }

  // Partial doc number match
  if (query.partialDocNumber && text.includes(query.partialDocNumber)) {
    score += 50;
  }

  // Title contains main keywords
  const keywords = query.query.split(' ').filter(w => w.length > 3);
  for (const keyword of keywords.slice(0, 5)) {
    if (title.includes(keyword)) {
      score += 10;
    }
  }

  // Source tier bonus
  const tier = detectSourceTier(item);
  if (tier === 'official') score += 30;
  if (tier === 'reference') score += 15;

  return score;
}
```

---

## Phase 4: Frontend Query Routing & Memory

### 4.1 Document Number Memory
**Location:** `webapp/modules/chat-assistant.js` around line ~206, 944

**Changes:**
Ensure `lastResolvedDocNumber` is persisted and used for follow-up queries:
```javascript
// Already exists but ensure it's properly set and retrieved
let lastResolvedDocNumber = '';

function rememberResolvedDocNumber(searchContext = {}, text = '') {
  const fromContext = String(searchContext?.effectiveDocNumber || '').trim().toUpperCase();
  if (fromContext) {
    lastResolvedDocNumber = fromContext;
    // Also persist to sessionStorage for page reload persistence
    try {
      sessionStorage.setItem('vbai_last_resolved_doc', lastResolvedDocNumber);
    } catch {}
  } else {
    const extracted = extractPotentialDocNumber(text);
    if (extracted) {
      lastResolvedDocNumber = extracted;
      try {
        sessionStorage.setItem('vbai_last_resolved_doc', lastResolvedDocNumber);
      } catch {}
    }
  }
}

// Load on session init
function loadResolvedDocNumber() {
  try {
    const stored = sessionStorage.getItem('vbai_last_resolved_doc');
    if (stored) {
      lastResolvedDocNumber = stored;
    }
  } catch {}
  return lastResolvedDocNumber;
}
```

### 4.2 Query Time-Sensitivity Detection
**Location:** `webapp/modules/chat-assistant.js` around line ~250

**Changes:**
Enhance time-sensitive detection:
```javascript
function isTimeSensitiveQuery(text = '') {
  const t = normalizeVietnamese(text);
  const { current, next, prev } = getCurrentYearContext();
  const yearPattern = new RegExp(`nam (${current}|${next}|${prev}|200\\d|201\\d|202\\d|203\\d)`);

  // Time-sensitive keywords
  const hasTimeKeyword = /(moi nhat|hien hanh|hieu luc|sua doi|bo sung|thay the|bai bo|hom nay|hien tai|ngay nay|cap nhat)/.test(t);

  // Year reference
  const hasYearRef = yearPattern.test(t);

  // Legal document type mention
  const isLegal = /(luat|nghi dinh|thong tu|quyet dinh|quy dinh|van ban|chinh sach|huong dan|so hieu|ngay ban hanh|hieu luc)/.test(t);

  return hasTimeKeyword || hasYearRef || isLegal;
}
```

### 4.3 Force Fresh Request Options
**Location:** `webapp/modules/chat-assistant.js` around line ~270

**Changes:**
Enhance freshness options:
```javascript
function buildFreshWebSearchOptions(rawText = '') {
  const t = normalizeVietnamese(rawText);

  // Force fresh for time-sensitive queries
  if (isTimeSensitiveQuery(rawText)) {
    // Determine recency based on keywords
    if (/(hom nay|ngay nay|hien tai)/.test(t)) {
      return { forceFresh: true, freshnessLevel: 'day', recencyDays: 7, timeoutMs: 25000 };
    }
    if (/(tuan nay|7 ngay|7ngay)/.test(t)) {
      return { forceFresh: true, freshnessLevel: 'week', recencyDays: 30, timeoutMs: 25000 };
    }
    if (/(thang nay|30 ngay|30ngay)/.test(t)) {
      return { forceFresh: true, freshnessLevel: 'month', recencyDays: 90, timeoutMs: 25000 };
    }
    // Default time-sensitive
    return { forceFresh: true, freshnessLevel: 'month', recencyDays: 365, timeoutMs: 25000 };
  }

  // Normal queries
  return { forceFresh: false, freshnessLevel: 'month', recencyDays: 365, timeoutMs: 20000 };
}
```

---

## Phase 5: Frontend Format & Response Handling

### 5.1 Unified Legal Response Format
**Location:** `webapp/modules/chat-assistant.js` around line ~484

**Changes:**
Ensure all response types use the same format:
```javascript
function enforceLegalMarkdownEnvelope(answer = '', query = '', meta = {}) {
  const text = String(answer || '').trim();
  if (!text) return text;

  // Check if already formatted
  if (/^##\s*T[oố]m\s*t[aá]t/im.test(text) && /Checklist\s*\(?\s*5\s*m[uú]c\)?/i.test(text)) {
    return text;
  }

  // Extract summary (first 120 words)
  const summary = extractSummaryText(text, query);

  // Add metadata-based information if available
  const metaInfo = [];
  if (meta.source_tier_summary) {
    metaInfo.push(`Nguồn: ${formatSourceTierSummary(meta.source_tier_summary)}`);
  }
  if (meta.effective_status && meta.effective_status !== 'unknown') {
    metaInfo.push(`Tình trạng hiệu lực: ${formatEffectiveStatus(meta.effective_status, meta.superseded_by)}`);
  }
  if (meta.confidence !== undefined) {
    metaInfo.push(`Mức độ chắc chắn: ${formatConfidence(meta.confidence)}`);
  }

  const metaBlock = metaInfo.length > 0 ? ['\n**Thông tin tra cứu**:', ...metaInfo.map(i => `- ${i}`), ''].join('\n') : '';

  return [
    '## Tóm tắt',
    summary,
    metaBlock,
    '',
    '### Thông tin chi tiết / Phân tích',
    text,
    '',
    '### Giải thích / Hướng dẫn thêm nếu cần',
    '- Nếu cần kết luận chính thức, vui lòng đối chiếu thêm trên nguồn chính thức.',
    '',
    '---',
    'Checklist (5 mục): Trích dẫn đầy đủ; hiệu lực đúng; nguồn chính thống; tóm tắt chuẩn; không suy đoán.',
  ].join('\n');
}

function formatEffectiveStatus(status, supersededBy) {
  const statusMap = {
    active: 'Còn hiệu lực',
    superseded: supersededBy ? `Đã bị thay thế bởi ${supersededBy}` : 'Đã bị thay thế',
    invalidated: 'Đã bị hủy bỏ',
    unknown: 'Chưa xác minh được',
  };
  return statusMap[status] || status;
}

function formatConfidence(confidence) {
  if (confidence >= 0.95) return 'Rất cao';
  if (confidence >= 0.85) return 'Cao';
  if (confidence >= 0.70) return 'Trung bình';
  return 'Thấp';
}
```

### 5.2 Clarification Policy
**Location:** `webapp/modules/chat-assistant.js` around line ~507

**Changes:**
Update clarification to only ask when truly necessary:
```javascript
function shouldAskClarification(answer = '', query = '', meta = {}) {
  // Don't ask if we have sufficient data
  if (meta.confidence && meta.confidence >= 0.85) {
    return false;
  }

  // Check for indicators that clarification is needed
  const hay = normalizeVietnamese(`${answer}\n${query}`);
  return /(vui lòng cung cấp|chưa đủ căn cứ|chưa tìm thấy|không tìm thấy|thiếu dữ liệu|can lam ro|partial_doc_number)/.test(hay);
}
```

### 5.3 Decode Entity for Display (Defense Layer)
**Location:** `webapp/modules/chat-assistant.js` around line ~681

**Note:** Backend should do primary decoding, but frontend keeps this as defense layer.

**Changes:**
Ensure the decode function handles all cases:
```javascript
function decodeNumericHtmlEntities(raw = '') {
  let text = String(raw || '');
  // Decode multiple times to handle double-encoded entities
  for (let i = 0; i < 3; i++) {
    text = text
      .replace(/&#x([0-9a-fA-F]+);/gi, '&#x$1;')
      .replace(/&#(\d+);/gi, '&#$1;')
      .replace(/&#x([0-9a-fA-F]+);/gi, (_, hex) => {
        const code = parseInt(hex, 16);
        return Number.isFinite(code) ? String.fromCodePoint(code) : '';
      })
      .replace(/&#(\d+);/g, (_, dec) => {
        const code = parseInt(dec, 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : '';
      })
      .replace(/&/g, '&')
      .replace(/</g, '<')
      .replace(/>/g, '>')
      .replace(/"/g, '"')
      .replace(/'/g, "'")
      .replace(/&nbsp;/g, ' ');
  }
  return text;
}
```

---

## Phase 6: Test Plan

### 6.1 Backend Tests
**Location:** `proxy/tests/`

**Test cases:**
1. **Time-sensitive query freshness**
   - Query: "luật an ninh mạng mới nhất"
   - Expect: forceFresh=true, bypass cache if stale

2. **Official-first ranking**
   - Query: "luật đất đai"
   - Expect: official sources ranked higher than reference

3. **Document number validation**
   - Query: "72/2025/QH15"
   - Expect: strict mode, full match required

4. **Entity decoding**
   - Input: text with `&#x...;` and `&#...;`
   - Expect: properly decoded Vietnamese characters

5. **Effective status detection**
   - Input: results with "đã bị thay thế"
   - Expect: effective_status='superseded'

6. **Best alternative selection**
   - Query without full doc number
   - Expect: best alternative from official sources

### 6.2 Frontend Tests
**Location:** `webapp/tests/`

**Test cases:**
1. **Query time-sensitivity detection**
   - "luật mới nhất" -> isTimeSensitiveQuery=true
   - "tóm tắt" -> isTimeSensitiveQuery=false

2. **Document number memory**
   - First query identifies doc number
   - Second query uses remembered doc number

3. **Markdown format enforcement**
   - All legal responses have correct format

4. **Clarification limit**
   - Track clarification count per query
   - Max 3 clarifications

---

## Phase 7: Verification & Testing

### 7.1 Manual Test Cases

| # | Query | Expected Behavior |
|---|-------|-------------------|
| 1 | "luật an ninh mạng mới nhất" | Force fresh, official-first, return best candidate with confidence |
| 2 | "72/2025/QH15" | Strict mode, full doc number validation |
| 3 | "trích Điều 5 Khoản 2 Luật 72/2025/QH15" | Strict extraction from official source |
| 4 | "Luật an ninh mạng có còn hiệu lực không" | Check effective status, report if superseded |
| 5 | "điều ủy quyền trong luật trên" | Use remembered doc number, extract from same document |

### 7.2 Automated Tests

Run after deployment:
```bash
# Backend tests
npm test -- proxy/tests/

# Frontend tests  
npm test -- webapp/tests/

# Integration tests
npm test -- proxy/tests/runtime-web-search.integration.cjs
```

---

## Tradeoffs

### Why Backend as Source of Truth?
- Backend has access to raw search results and metadata
- Frontend cannot reliably validate source tiers
- Single validation logic prevents drift

### Why Not Vertex Answer API as Default?
- Answer API is less transparent (black-box citation)
- Legal queries need auditable validation
- We want control over ranking and filtering

### Why Force Fresh for Time-Sensitive?
- Legal status can change
- Cache staleness could serve outdated information
- Small performance cost is worth accuracy

---

## Environment Variables Summary

| Variable | Default | Description |
|----------|---------|-------------|
| `WEB_SEARCH_TIME_SENSITIVE_TTL_MS` | 60000 | Cache TTL for time-sensitive queries |
| `WEB_SEARCH_NORMAL_TTL_MS` | 90000 | Normal cache TTL |
| `WEB_SEARCH_HOT_INDEX_MAX_AGE_MS` | 21600000 | Max hot index age before revalidation |
| `WEB_SEARCH_FAST_PRIMARY_TOTAL_BUDGET_MS` | 5200 | Vertex search timeout |
| `GEMINI_API_KEY` | (required) | Gemini API key for chat |
| `VERTEX_PROJECT_ID` | (required) | Vertex AI project ID |
| `VERTEX_DATA_STORE_ID` | (required) | Vertex search data store ID |

---

## Migration Notes

- No breaking changes to existing APIs
- All new metadata fields are additive
- Frontend will gracefully ignore metadata it doesn't use
- Backend validation is backward compatible

## Next Steps

1. Implement Phase 1: Backend search provider and freshness control
2. Implement Phase 2: Backend text normalization
3. Implement Phase 3: Backend validation logic
4. Implement Phase 4: Frontend query routing
5. Implement Phase 5: Frontend format handling
6. Run test suite
7. Deploy and verify manually