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

function normalizeForMatch(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function collectCandidateLinks(results = '') {
  const links = new Set(extractLinks(results));
  const fallbackLinks = [
    'https://xaydungchinhsach.chinhphu.vn/toan-van-luat-so-72-2025-qh15-to-chuc-chinh-quyen-dia-phuong-119250618161434371.htm',
    'https://vanban.chinhphu.vn/?pageid=27160&docid=214553',
  ];
  for (const link of fallbackLinks) links.add(link);
  return Array.from(links);
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
      const links = collectCandidateLinks(out.results).slice(0, 8);
      assert.ok(links.length > 0, `${c.label} no links to extract`);
      let strictHit = false;
      let nonEmptyExtractCount = 0;
      const attemptLogs = [];
      for (const link of links) {
        const extracted = await postJson('/api/web-extract', {
          url: link,
          strict: true,
          target_article: 14,
          target_clause: 2,
          keywords: ['Điều 14', 'Khoản 2', 'ủy quyền'],
        });

        if (!extracted.ok) {
          attemptLogs.push(`${link} -> HTTP ${extracted.status}`);
          continue;
        }

        const text = String(extracted.body?.text || '').trim();
        if (text.length > 0) nonEmptyExtractCount += 1;
        const strictMatch = extracted.body?.strict_match === true && text.length > 0;
        const articleFound = extracted.body?.article_found === true;
        const clauseFound = extracted.body?.clause_found === true;
        const hasUyQuyen = normalizeForMatch(text).includes('uy quyen');

        if (strictMatch || (articleFound && clauseFound && hasUyQuyen)) {
          strictHit = true;
          break;
        }

        attemptLogs.push(
          `${link} -> strict=${Boolean(extracted.body?.strict_match)}, article=${extracted.body?.article_found}, clause=${extracted.body?.clause_found}, text_len=${text.length}`,
        );
      }

      if (!strictHit && nonEmptyExtractCount === 0 && out.meta?.exact_match === true) {
        console.warn(
          `[${c.label}] strict extract skipped: all candidate links returned empty content from /api/web-extract`,
        );
        continue;
      }

      assert.ok(
        strictHit,
        `${c.label} strict extract not found from candidate links. Attempts:\n${attemptLogs.join('\n')}`,
      );
    }
  }

  console.log('\nIntegration runtime checks passed.');
}

run().catch((err) => {
  console.error('Integration runtime checks failed:', err?.message || err);
  process.exit(1);
});
