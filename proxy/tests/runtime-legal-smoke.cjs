/* eslint-disable no-console */
const assert = require('assert');

const BASE_URL = String(process.env.VBAI_PROXY_BASE_URL || '').trim().replace(/\/+$/, '');
const ID_TOKEN = String(process.env.VBAI_TEST_ID_TOKEN || '').trim();

if (!BASE_URL || !ID_TOKEN) {
  console.error('Missing env: VBAI_PROXY_BASE_URL and/or VBAI_TEST_ID_TOKEN');
  process.exit(2);
}

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
  const text = await res.text();
  let body = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  return { ok: res.ok, status: res.status, elapsedMs, body };
}

function normalizeForMatch(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

function parseMarkdownItems(searchResults = '') {
  const lines = String(searchResults || '').split('\n');
  const items = [];
  for (const line of lines) {
    const m = line.match(/^\s*-\s*\[(.*?)\]\((.*?)\)\s*:\s*(.*)$/);
    if (!m) continue;
    items.push({
      title: String(m[1] || '').trim(),
      link: String(m[2] || '').trim(),
      snippet: String(m[3] || '').trim(),
    });
  }
  return items;
}

function getHost(url = '') {
  try {
    return new URL(String(url || '')).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

function isOfficialHost(host = '') {
  return [
    'quochoi.vn',
    'vbpl.vn',
    'vanban.chinhphu.vn',
    'congbao.chinhphu.vn',
    'chinhphu.vn',
  ].includes(String(host || '').toLowerCase());
}

function collectOfficialLinks(items = []) {
  return items
    .map((item) => String(item.link || '').trim())
    .filter(Boolean)
    .filter((link) => isOfficialHost(getHost(link)));
}

async function runWebSearchCase({ label, query, expectedDocNumber, expectedOfficialHosts = [] }) {
  const response = await postJson('/api/web-search', {
    query,
    expectedDocNumber: expectedDocNumber || null,
    forceFresh: true,
    freshnessLevel: 'high',
    recencyDays: 30,
  });

  assert.strictEqual(response.ok, true, `${label} /api/web-search failed: HTTP ${response.status}`);

  const results = String(response.body?.results || '');
  const meta = response.body?.meta || {};
  const items = parseMarkdownItems(results);
  const officialLinks = collectOfficialLinks(items);
  const officialHosts = officialLinks.map(getHost);

  assert.ok(typeof meta === 'object', `${label} meta missing`);
  assert.ok(!/Meta strategy:/i.test(results), `${label} leaked internal meta text`);

  if (expectedDocNumber) {
    const hay = `${results}\n${JSON.stringify(meta)}`.toUpperCase();
    assert.ok(
      hay.includes(String(expectedDocNumber).toUpperCase()),
      `${label} expected doc number not found: ${expectedDocNumber}`,
    );
  }

  assert.ok(
    officialLinks.length > 0 || Number(meta.official_count_top5 || 0) > 0,
    `${label} expected at least one official source in results/meta`,
  );

  if (expectedOfficialHosts.length > 0) {
    const matched = officialHosts.some((host) => expectedOfficialHosts.includes(host));
    assert.ok(
      matched || expectedOfficialHosts.includes(String(meta?.best_alternative?.nguon || '').toLowerCase()),
      `${label} expected one of official hosts: ${expectedOfficialHosts.join(', ')}; got: ${officialHosts.join(', ') || 'none'}`,
    );
  }

  console.log(`[${label}] web-search ok`, JSON.stringify({
    officialHosts,
    sources_used: meta.sources_used,
    official_count_top5: meta.official_count_top5,
    exact_match: meta.exact_match,
    confidence: meta.confidence,
    served_in_ms: response.elapsedMs,
  }));

  return { results, meta, items, officialLinks };
}

async function runLegalRetrieveCase({ label, links, keywords, minLength = 500 }) {
  assert.ok(Array.isArray(links) && links.length > 0, `${label} has no official links to retrieve`);

  const attempts = [];
  for (const link of links.slice(0, 3)) {
    const response = await postJson('/api/legal-agent-retrieve', {
      url: link,
      keywords,
      strict: false,
      max_chars: 12000,
    });

    if (!response.ok) {
      attempts.push(`${link} -> HTTP ${response.status}`);
      continue;
    }

    const text = String(response.body?.text || '').trim();
    const extractMode = String(response.body?.extract_mode || '').trim();
    const sourceTier = String(response.body?.source_tier || '').trim();

    attempts.push(`${link} -> mode=${extractMode}, tier=${sourceTier}, text_len=${text.length}`);

    if (text.length >= minLength) {
      assert.ok(
        ['official', 'reference', 'unknown'].includes(sourceTier),
        `${label} unexpected source tier: ${sourceTier}`,
      );
      console.log(`[${label}] legal-agent ok`, JSON.stringify({
        link,
        extract_mode: extractMode,
        source_tier: sourceTier,
        text_len: text.length,
      }));
      return { link, text, body: response.body };
    }
  }

  assert.fail(`${label} could not retrieve enough content.\nAttempts:\n${attempts.join('\n')}`);
}

async function runStrictExtractCase({ label, links, targetArticle, targetClause, keywords, mustIncludeAny = [] }) {
  assert.ok(Array.isArray(links) && links.length > 0, `${label} has no official links to extract`);

  const attempts = [];
  for (const link of links.slice(0, 5)) {
    const response = await postJson('/api/web-extract', {
      url: link,
      strict: true,
      target_article: targetArticle,
      target_clause: targetClause,
      keywords,
    });

    if (!response.ok) {
      attempts.push(`${link} -> HTTP ${response.status}`);
      continue;
    }

    const text = String(response.body?.text || '').trim();
    const strictMatch = response.body?.strict_match === true;
    const articleFound = response.body?.article_found === true;
    const clauseFound = response.body?.clause_found === true;
    const normalized = normalizeForMatch(text);
    const hasExpected = mustIncludeAny.length === 0
      ? text.length > 0
      : mustIncludeAny.some((token) => normalized.includes(normalizeForMatch(token)));

    attempts.push(
      `${link} -> strict=${strictMatch}, article=${articleFound}, clause=${clauseFound}, text_len=${text.length}`,
    );

    if ((strictMatch || (articleFound && clauseFound)) && hasExpected) {
      console.log(`[${label}] strict extract ok`, JSON.stringify({
        link,
        strict_match: strictMatch,
        article_found: articleFound,
        clause_found: clauseFound,
        text_len: text.length,
      }));
      return { link, text, body: response.body };
    }
  }

  assert.fail(`${label} strict extract failed.\nAttempts:\n${attempts.join('\n')}`);
}

async function run() {
  const latestLaw = await runWebSearchCase({
    label: 'LatestLocalGovLaw',
    query: 'luật tổ chức chính quyền địa phương mới nhất số bao nhiêu',
    expectedDocNumber: '72/2025/QH15',
    expectedOfficialHosts: ['quochoi.vn', 'vbpl.vn', 'vanban.chinhphu.vn'],
  });

  const latestOfficials = latestLaw.officialLinks.length > 0
    ? latestLaw.officialLinks
    : latestLaw.items.map((item) => item.link).filter(Boolean);

  await runLegalRetrieveCase({
    label: 'LatestLocalGovLaw-FullRetrieve',
    links: latestOfficials,
    keywords: ['72/2025/QH15', 'toàn văn', 'Điều'],
    minLength: 800,
  });

  await runStrictExtractCase({
    label: 'LatestLocalGovLaw-StrictArticle',
    links: latestOfficials,
    targetArticle: 14,
    targetClause: 2,
    keywords: ['Điều 14', 'Khoản 2', 'ủy quyền'],
    mustIncludeAny: ['ủy quyền', 'thực hiện bằng văn bản', 'không được ủy quyền lại'],
  });

  const civilServants = await runWebSearchCase({
    label: 'LatestCivilServantsLaw',
    query: 'luật cán bộ công chức mới nhất số bao nhiêu',
    expectedOfficialHosts: ['quochoi.vn', 'vbpl.vn', 'vanban.chinhphu.vn'],
  });

  const civilOfficials = civilServants.officialLinks.length > 0
    ? civilServants.officialLinks
    : civilServants.items.map((item) => item.link).filter(Boolean);

  await runLegalRetrieveCase({
    label: 'LatestCivilServantsLaw-FullRetrieve',
    links: civilOfficials,
    keywords: ['luật cán bộ công chức', 'toàn văn', 'Điều'],
    minLength: 800,
  });

  console.log('\nRuntime legal smoke checks passed.');
}

run().catch((err) => {
  console.error('Runtime legal smoke checks failed:', err?.message || err);
  process.exit(1);
});
