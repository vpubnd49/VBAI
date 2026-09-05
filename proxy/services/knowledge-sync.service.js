/**
 * knowledge-sync.service.js
 * Đồng bộ memories + correction knowledge từ vbaibot SQLite → MongoDB training_datasets
 * Được gọi từ route POST /api/admin/training-datasets/sync-vbaibot-knowledge
 */
'use strict';

const VBAIBOT_DB_PATH = process.env.VBAIBOT_DB_PATH || '/var/www/vbaibot/data/zalo-agent.db';

/**
 * Chạy đồng bộ knowledge từ vbaibot DB vào MongoDB training_datasets
 * @param {import('mongodb').Collection} col - MongoDB collection training_datasets
 * @returns {{ ingested: number, skipped: number, total: number, errors: string[] }}
 */
async function syncVbaibotKnowledge(col) {
  let vbaibotDb;
  try {
    const { DatabaseSync } = require('node:sqlite');
    vbaibotDb = new DatabaseSync(VBAIBOT_DB_PATH, { readOnly: true });
  } catch (dbErr) {
    throw Object.assign(new Error('Không thể mở vbaibot DB: ' + dbErr.message), { status: 503, code: 'VBAIBOT_DB_UNAVAILABLE' });
  }

  let ingested = 0;
  let skipped = 0;
  const errors = [];

  // ── 1. Memories: thông tin cá nhân / preference người dùng ────────────────
  try {
    const memories = vbaibotDb.prepare(
      "SELECT id, account_id, subject_id, content, created_at FROM memories WHERE LENGTH(content) >= 20 ORDER BY ROWID DESC"
    ).all();

    for (const mem of memories) {
      const content = String(mem.content || '').trim();
      if (!content || content.length < 20) { skipped++; continue; }
      // Bỏ qua tool-result raw
      if (content.startsWith('[Tra cuu:') || content.includes('"type":"tool-result"')) { skipped++; continue; }

      const sourceKey = 'vbaibot-knowledge:memory:' + mem.id + ':' + mem.account_id;
      const exists = await col.countDocuments({ externalId: sourceKey });
      if (exists > 0) { skipped++; continue; }

      const userPrompt = 'Ghi nho thong tin ve nguoi dung: ' + content;
      const modelResponse = 'Da ghi nho: ' + content + '. Toi se ap dung thong tin nay trong cac cuoc tro chuyen tiep theo.';

      await col.insertOne({
        messages: [
          { role: 'user', content: userPrompt },
          { role: 'model', content: modelResponse },
        ],
        category: 'memory-fact',
        source: 'vbaibot-knowledge',
        externalId: sourceKey,
        tags: ['vbaibot-knowledge', 'memory'],
        qualityScore: 0.7,
        createdAt: new Date(mem.created_at || Date.now()),
      });
      ingested++;
    }
  } catch (e) {
    errors.push('memories: ' + e.message);
  }

  // ── 2. Correction / Policy / Procedure / General knowledge ────────────────
  try {
    const corrections = vbaibotDb.prepare(
      "SELECT id, account_id, category, content, source, created_at FROM shared_knowledge " +
      "WHERE status='approved' AND category IN ('correction','policy','procedure','general') " +
      "AND LENGTH(content) >= 30 ORDER BY ROWID DESC"
    ).all();

    for (const k of corrections) {
      const content = String(k.content || '').trim();
      if (!content || content.length < 30) { skipped++; continue; }
      if (content.startsWith('[Tra cuu:') || content.includes('"type":"tool-result"')) { skipped++; continue; }

      const sourceKey = 'vbaibot-knowledge:' + k.category + ':' + k.id;
      const exists = await col.countDocuments({ externalId: sourceKey });
      if (exists > 0) { skipped++; continue; }

      let userPrompt, modelResponse;
      if (k.category === 'correction') {
        userPrompt = 'Cap nhat dinh chinh: ' + content;
        modelResponse = 'Da ghi nhan dinh chinh: ' + content + '. Se dung thong tin chinh xac nay.';
      } else if (k.category === 'policy') {
        userPrompt = 'Quy dinh ap dung: ' + content;
        modelResponse = 'Da nam quy dinh: ' + content;
      } else {
        userPrompt = 'Thong tin tham khao: ' + content;
        modelResponse = 'Da ghi nhan: ' + content;
      }

      await col.insertOne({
        messages: [
          { role: 'user', content: userPrompt },
          { role: 'model', content: modelResponse },
        ],
        category: 'vbaibot-' + k.category,
        source: 'vbaibot-knowledge',
        externalId: sourceKey,
        tags: ['vbaibot-knowledge', k.category],
        qualityScore: k.category === 'correction' ? 0.9 : 0.75,
        createdAt: new Date(k.created_at || Date.now()),
      });
      ingested++;
    }
  } catch (e) {
    errors.push('corrections: ' + e.message);
  }

  try { vbaibotDb.close(); } catch (_) {}

  return { ingested, skipped, errors };
}

module.exports = { syncVbaibotKnowledge };
