/**
 * vbaibot-messages-sync.service.js
 * Đồng bộ hội thoại thực tế từ vbaibot messages table → MongoDB training_datasets
 *
 * Chiến lược:
 * - Mỗi cặp [user_turn → assistant_reply] = 1 training sample (single-turn)
 * - Thêm ngữ cảnh (2 turn trước) = multi-turn conversations
 * - Dùng externalId = 'vbaibot-msg:{account_id}:{assistant_msg_id}' để dedup
 * - Lưu lastSyncedId vào MongoDB metadata để tăng dần (incremental sync)
 * - Chạy tự động mỗi giờ qua cron
 */
'use strict';

const VBAIBOT_DB_PATH = process.env.VBAIBOT_DB_PATH || '/var/www/vbaibot/data/zalo-agent.db';

// Config chất lượng
const MIN_USER_LEN = 5;      // tin nhắn user tối thiểu
const MIN_BOT_LEN = 50;      // response bot tối thiểu (loại "ok", "dạ")
const MAX_BOT_LEN = 8000;    // giới hạn trên (loại response quá dài, thường là raw data)
const MAX_CONTEXT_TURNS = 3; // số turn ngữ cảnh trước đó

/**
 * Phân loại training sample theo nội dung
 */
function classifyCategory(userText, botText) {
  const text = (userText + ' ' + botText).toLowerCase();
  if (/nghị quyết|thông tư|nghị định|quyết định|luật|văn bản|pháp luật|pháp lý/.test(text)) return 'legal-search';
  if (/hành chính|công vụ|ubnd|ủy ban|sở|phòng|đơn vị|xã|huyện|phường/.test(text)) return 'administrative';
  if (/nd30|công văn|tờ trình|soạn|thể thức|ký hiệu/.test(text)) return 'nd30-standard';
  return 'general-qa';
}

/**
 * Kiểm tra chất lượng message
 */
function isQuality(userContent, botContent) {
  if (!userContent || !botContent) return false;
  const uLen = userContent.trim().length;
  const bLen = botContent.trim().length;
  if (uLen < MIN_USER_LEN) return false;
  if (bLen < MIN_BOT_LEN) return false;
  if (bLen > MAX_BOT_LEN) return false;
  // Bỏ qua bot chỉ nói "dạ", "ok", "..."
  if (/^(dạ|ok|oke|vâng|được|uhm|\.\.\.)\.?$/i.test(botContent.trim())) return false;
  return true;
}

/**
 * Đọc lastSyncedId từ MongoDB
 */
async function getLastSyncedId(db) {
  const meta = await db.collection('vbaibot_sync_metadata').findOne({ type: 'vbaibot-messages-sync' });
  return meta?.lastSyncedMessageId || 0;
}

/**
 * Lưu lastSyncedId vào MongoDB
 */
async function saveLastSyncedId(db, msgId) {
  await db.collection('vbaibot_sync_metadata').updateOne(
    { type: 'vbaibot-messages-sync' },
    {
      $set: {
        lastSyncedMessageId: msgId,
        updatedAt: new Date(),
      },
      $setOnInsert: { type: 'vbaibot-messages-sync', createdAt: new Date() },
    },
    { upsert: true }
  );
}

/**
 * Hàm chính: sync messages từ vbaibot → MongoDB
 * @param {import('mongodb').Db} mongoDb - MongoDB database instance
 * @param {{ limit?: number, verbose?: boolean }} options
 * @returns {{ ingested: number, skipped: number, lastId: number, errors: string[] }}
 */
async function syncVbaibotMessages(mongoDb, options = {}) {
  const { limit = 2000, verbose = false } = options;

  // Mở vbaibot DB
  let vbaibotDb;
  try {
    const { DatabaseSync } = require('node:sqlite');
    vbaibotDb = new DatabaseSync(VBAIBOT_DB_PATH, { readOnly: true });
  } catch (e) {
    throw Object.assign(new Error('Không mở được vbaibot DB: ' + e.message), { status: 503, code: 'VBAIBOT_DB_UNAVAILABLE' });
  }

  const col = mongoDb.collection('training_datasets');
  const lastSyncedId = await getLastSyncedId(mongoDb);

  if (verbose) console.log('[messages-sync] lastSyncedId =', lastSyncedId);

  // Lấy danh sách assistant messages mới hơn lastSyncedId
  const assistantMsgs = vbaibotDb.prepare(
    'SELECT id, account_id, thread_id, content, created_at ' +
    'FROM messages WHERE role=\'assistant\' AND id > ? ORDER BY id ASC LIMIT ?'
  ).all(lastSyncedId, limit);

  if (assistantMsgs.length === 0) {
    vbaibotDb.close();
    return { ingested: 0, skipped: 0, lastId: lastSyncedId, errors: [] };
  }

  // Lấy tất cả messages trong các threads liên quan để build context
  const threadIds = [...new Set(assistantMsgs.map(m => m.thread_id))];
  const allMsgsByThread = {};

  for (const threadId of threadIds) {
    // Lấy tối đa 200 messages mỗi thread để build context
    const msgs = vbaibotDb.prepare(
      'SELECT id, role, content, created_at FROM messages WHERE thread_id=? ORDER BY id ASC LIMIT 200'
    ).all(threadId);
    allMsgsByThread[threadId] = msgs;
  }

  let ingested = 0;
  let skipped = 0;
  let maxId = lastSyncedId;
  const errors = [];

  // Process từng assistant message
  for (const aMsg of assistantMsgs) {
    try {
      if (aMsg.id > maxId) maxId = aMsg.id;

      const botContent = (aMsg.content || '').trim();
      if (!botContent || botContent.length < MIN_BOT_LEN) { skipped++; continue; }
      if (botContent.length > MAX_BOT_LEN) { skipped++; continue; }

      // Tìm vị trí của assistant message trong thread
      const threadMsgs = allMsgsByThread[aMsg.thread_id] || [];
      const myIdx = threadMsgs.findIndex(m => m.id === aMsg.id);
      if (myIdx === -1) { skipped++; continue; }

      // Tìm user message liền trước
      let userMsg = null;
      for (let i = myIdx - 1; i >= 0; i--) {
        if (threadMsgs[i].role === 'user') {
          userMsg = threadMsgs[i];
          break;
        }
      }

      if (!userMsg) { skipped++; continue; }

      const userContent = (userMsg.content || '').trim();
      if (!isQuality(userContent, botContent)) { skipped++; continue; }

      // Check dedup
      const externalId = 'vbaibot-msg:' + aMsg.account_id + ':' + aMsg.id;
      const exists = await col.countDocuments({ externalId });
      if (exists > 0) { skipped++; continue; }

      // Build conversation với ngữ cảnh (multi-turn)
      const messages = [];

      // Thêm context turns (tối đa MAX_CONTEXT_TURNS cặp trước)
      const contextPairs = [];
      let lookbackIdx = myIdx - 1;
      while (lookbackIdx > 0 && contextPairs.length < MAX_CONTEXT_TURNS) {
        const cm = threadMsgs[lookbackIdx];
        if (cm.role === 'assistant' && lookbackIdx > 0) {
          // Tìm user msg trước assistant này
          let cUserMsg = null;
          for (let i = lookbackIdx - 1; i >= 0; i--) {
            if (threadMsgs[i].role === 'user') { cUserMsg = threadMsgs[i]; break; }
          }
          if (cUserMsg && isQuality(cUserMsg.content, cm.content)) {
            contextPairs.unshift({ user: cUserMsg.content.trim(), bot: cm.content.trim() });
          }
        }
        lookbackIdx--;
      }

      // Ghép context pairs vào messages
      for (const cp of contextPairs) {
        messages.push({ role: 'user', content: cp.user });
        messages.push({ role: 'model', content: cp.bot });
      }

      // Thêm turn chính
      messages.push({ role: 'user', content: userContent });
      messages.push({ role: 'model', content: botContent });

      const category = classifyCategory(userContent, botContent);

      await col.insertOne({
        messages,
        category,
        source: 'vbaibot-messages',
        externalId,
        sourceUserId: aMsg.thread_id,
        accountId: aMsg.account_id,
        tags: ['vbaibot-messages', 'auto-sync', category],
        qualityScore: 0.8,
        contextTurns: contextPairs.length,
        createdAt: new Date(aMsg.created_at || Date.now()),
      });

      ingested++;

      if (verbose && ingested % 100 === 0) {
        console.log('[messages-sync] ingested', ingested, '/ processed', ingested + skipped);
      }
    } catch (e) {
      errors.push('msg#' + aMsg.id + ': ' + e.message);
    }
  }

  // Lưu checkpoint
  await saveLastSyncedId(mongoDb, maxId);

  try { vbaibotDb.close(); } catch (_) {}

  return { ingested, skipped, lastId: maxId, errors };
}

module.exports = { syncVbaibotMessages };
