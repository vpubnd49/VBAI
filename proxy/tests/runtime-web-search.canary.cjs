/* eslint-disable no-console */
const BASE_URL = String(process.env.VBAI_PROXY_BASE_URL || '').trim().replace(/\/+$/, '');
const ID_TOKEN = String(process.env.VBAI_TEST_ID_TOKEN || '').trim();

if (!BASE_URL || !ID_TOKEN) {
  console.error('Missing env: VBAI_PROXY_BASE_URL and/or VBAI_TEST_ID_TOKEN');
  process.exit(2);
}

const CANARY_QUERIES = [
  { q: 'luật tổ chức chính quyền địa phương mới nhất', doc: '72/2025/QH15' },
  { q: 'trích khoản 2 điều 14 luật số 72/2025/qh15', doc: '72/2025/QH15' },
  { q: 'luật an ninh mạng số 116/2025/qh15', doc: '116/2025/QH15' },
  { q: 'nghị định phân cấp phân quyền chính quyền địa phương 2 cấp mới nhất', doc: null },
  { q: 'thẩm quyền ubnd cấp xã trong mô hình 2 cấp', doc: null },
];

const ACCEPTABLE_EMPTY_REASONS = new Set([
  'partial_doc_number_requires_full',
  'no_type_match',
  'low_confidence',
  'metadata_incomplete',
  'no_exact_match',
  'no_exact_type_match',
  'no_results',
  'no_match',
  'none',
  'empty_query_result',
]);

async function postJson(path, payload) {
  const started = Date.now();
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ID_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload || {}),
  });
  const elapsedMs = Date.now() - started;
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, elapsedMs, body };
}

function percentile(values = [], p = 95) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

function isAcceptableEmpty(meta = {}, item = {}) {
  const reason = String(meta?.strict_reject_reason || '').trim().toLowerCase();
  if (reason && ACCEPTABLE_EMPTY_REASONS.has(reason)) return true;
  if (!item.doc && (meta?.cse_status === 200 || !reason)) return true;
  return false;
}

async function run() {
  const results = [];
  for (const item of CANARY_QUERIES) {
    const response = await postJson('/api/web-search', {
      query: item.q,
      expectedDocNumber: item.doc || null,
      forceFresh: true,
      freshnessLevel: 'high',
      recencyDays: 30,
    });
    const text = String(response.body?.results || '');
    const meta = response.body?.meta || {};
    const hasData = text.trim().length > 0;
    const hasSources = Array.isArray(meta.sources_used) ? meta.sources_used.length > 0 : false;
    const acceptableEmpty = !hasData && isAcceptableEmpty(meta, item);
    results.push({
      query: item.q,
      status: response.status,
      ok: response.ok,
      elapsedMs: response.elapsedMs,
      hasData,
      hasSources,
      acceptableEmpty,
      strictRejectReason: meta.strict_reject_reason || null,
      confidence: typeof meta.confidence === 'number' ? Number(meta.confidence) : null,
      cseStatus: meta.cse_status ?? null,
      fallbackUsed: meta.fallback_used === true,
    });
  }

  const okCount = results.filter((x) => x.ok).length;
  const dataCount = results.filter((x) => x.hasData).length;
  const acceptableEmptyCount = results.filter((x) => x.acceptableEmpty).length;
  const sourceCount = results.filter((x) => x.hasSources).length;
  const effectiveCoverageCount = results.filter((x) => x.hasData || x.acceptableEmpty).length;
  const p95 = percentile(results.map((x) => x.elapsedMs), 95);

  const summary = {
    timestamp: new Date().toISOString(),
    total: results.length,
    okCount,
    dataCount,
    acceptableEmptyCount,
    effectiveCoverageCount,
    sourceCount,
    latencyP95Ms: p95,
    pass: okCount === results.length && effectiveCoverageCount >= Math.ceil(results.length * 0.8) && p95 <= 15000,
    details: results,
  };

  console.log(JSON.stringify(summary, null, 2));

  if (!summary.pass) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Canary failed:', err?.message || err);
  process.exit(1);
});
