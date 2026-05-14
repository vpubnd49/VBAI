/* eslint-disable no-console */
const assert = require('assert');

const BASE_URL = String(process.env.VBAI_PROXY_BASE_URL || '').trim().replace(/\/+$/, '');
const ID_TOKEN = String(process.env.VBAI_TEST_ID_TOKEN || '').trim();

if (!BASE_URL || !ID_TOKEN) {
  console.error('Missing env: VBAI_PROXY_BASE_URL and/or VBAI_TEST_ID_TOKEN');
  process.exit(2);
}

async function postJson(path, payload) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ID_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload || {}),
  });
  const text = await res.text();
  let body = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  return { ok: res.ok, status: res.status, body };
}

function extractLinks(markdown = '') {
  const regex = /https?:\/\/[^\s)]+/gim;
  return Array.from(new Set(String(markdown || '').match(regex) || []));
}

async function runCase(label, query, expectedDocNumber = null) {
  const payload = {
    query,
    expectedDocNumber,
    forceFresh: true,
    freshnessLevel: 'high',
    recencyDays: 30,
  };
  const response = await postJson('/api/web-search', payload);
  assert.strictEqual(response.ok, true, `${label} /web-search failed: HTTP ${response.status}`);
  const results = String(response.body?.results || '');
  const meta = response.body?.meta || {};
  assert.ok(typeof meta === 'object', `${label} meta missing`);
  assert.ok(!/Meta strategy:/i.test(results), `${label} leaked meta strategy in results`);
  return { results, meta };
}

async function run() {
  const cases = [
    {
      label: 'Case1-NewLaw',
      query: 'luật tổ chức chính quyền địa phương mới nhất có gì',
      expectedDocNumber: '72/2025/QH15',
      mustContain: ['72/2025/QH15'],
    },
    {
      label: 'Case2-StrictExtract',
      query: 'trích khoản 2 điều 14 luật số 72/2025/qh15',
      expectedDocNumber: '72/2025/QH15',
      mustContain: ['72/2025/QH15'],
    },
    {
      label: 'Case3-CyberLaw',
      query: 'luật an ninh mạng số 116/2025/qh15 điểm mới',
      expectedDocNumber: '116/2025/QH15',
      mustContain: ['116/2025/QH15'],
    },
  ];

  for (const c of cases) {
    const out = await runCase(c.label, c.query, c.expectedDocNumber);
    const hay = `${out.results}\n${JSON.stringify(out.meta)}`.toUpperCase();
    const hasAny = c.mustContain.some((x) => hay.includes(String(x).toUpperCase()));
    console.log(`[${c.label}] meta=`, JSON.stringify(out.meta));
    if (!hasAny) {
      console.warn(`[${c.label}] expected markers not found in results/meta: ${c.mustContain.join(', ')}`);
    }

    if (c.label === 'Case2-StrictExtract') {
      const links = extractLinks(out.results).slice(0, 4);
      assert.ok(links.length > 0, `${c.label} no links to extract`);
      let strictHit = false;
      for (const link of links) {
        const extracted = await postJson('/api/web-extract', {
          url: link,
          strict: true,
          target_article: 14,
          target_clause: 2,
          keywords: ['Điều 14', 'Khoản 2', 'ủy quyền'],
        });
        if (!extracted.ok) continue;
        if (extracted.body?.strict_match === true && String(extracted.body?.text || '').trim()) {
          strictHit = true;
          break;
        }
      }
      assert.ok(strictHit, `${c.label} strict extract not found from top links`);
    }
  }

  console.log('\nIntegration runtime checks passed.');
}

run().catch((err) => {
  console.error('Integration runtime checks failed:', err?.message || err);
  process.exit(1);
});
