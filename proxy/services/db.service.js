/**
 * VBAI Local MongoDB Database Service
 * Provides local high-performance MongoDB access for application data.
 */
'use strict';

let MongoClient;
let ObjectId;
try {
  ({ MongoClient, ObjectId } = require('mongodb'));
} catch (error) {
  MongoClient = null;
}

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const DB_NAME = process.env.MONGODB_DB_NAME || 'vbai_db';

let client = null;
let db = null;
let isConnecting = false;

async function getDb() {
  if (db) return db;
  if (isConnecting) {
    await new Promise(resolve => setTimeout(resolve, 200));
    if (db) return db;
  }

  isConnecting = true;
  try {
    if (!client) {
      client = new MongoClient(MONGODB_URI, {
        maxPoolSize: 20,
        serverSelectionTimeoutMS: 5000,
      });
      await client.connect();
      console.log(`[DB] Connected to MongoDB database: ${DB_NAME}`);
    }
    db = client.db(DB_NAME);
    
    // Ensure essential indexes
    await db.collection('users').createIndex({ email: 1 }, { unique: true, sparse: true }).catch(() => {});
    await db.collection('users').createIndex({ uid: 1 }, { unique: true, sparse: true }).catch(() => {});
    await db.collection('search_logs').createIndex({ timestamp: -1 }).catch(() => {});
    await db.collection('search_logs').createIndex({ user_id: 1, timestamp: -1 }).catch(() => {});
    await db.collection('rate_limits').createIndex({ key: 1 }, { unique: true }).catch(() => {});
    await db.collection('rate_limits').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }).catch(() => {});
    await db.collection('stats').createIndex({ _id: 1 }, { unique: true }).catch(() => {});
    await db.collection('config').createIndex({ _id: 1 }, { unique: true }).catch(() => {});
    await db.collection('known_documents').createIndex({ document_number: 1 }, { unique: true, sparse: true }).catch(() => {});
    await db.collection('known_documents').createIndex({ normalized_document_number: 1 }, { unique: true, sparse: true }).catch(() => {});
    await db.collection('known_documents').createIndex({ issue_date: -1, _id: -1 }).catch(() => {});
    await db.collection('crawler_logs').createIndex({ started_at: -1 }).catch(() => {});
    await db.collection('training_datasets').createIndex({ createdAt: -1, _id: -1 }).catch(() => {});
    await db.collection('ai_tuning_jobs').createIndex({ createdAt: -1, _id: -1 }).catch(() => {});
    await db.collection('nq57_tasks').createIndex({ due_date: 1, status: 1 }).catch(() => {});
    await db.collection('nq57_tasks').createIndex({ lead_unit: 1, updated_at: -1 }).catch(() => {});
    await db.collection('pakn_cases').createIndex({ status: 1, updated_at: -1 }).catch(() => {});

    isConnecting = false;
    return db;
  } catch (error) {
    isConnecting = false;
    console.error('[DB] MongoDB Connection Error:', error.message);
    throw error;
  }
}

// ==================== USER OPERATIONS ====================
async function getUserByEmail(email) {
  if (!email) return null;
  const database = await getDb();
  return await database.collection('users').findOne({ 
    email: { $regex: new RegExp(`^${email.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } 
  });
}

async function getUserById(idOrUid) {
  if (!idOrUid) return null;
  const database = await getDb();
  const value = String(idOrUid);
  const ids = ObjectId && ObjectId.isValid(value) ? [idOrUid, new ObjectId(value)] : [idOrUid];
  return await database.collection('users').findOne({
    $or: [{ _id: { $in: ids } }, { uid: value }, { id: value }]
  });
}

async function createUser(userData) {
  const database = await getDb();
  const now = new Date();
  const doc = {
    ...userData,
    _id: userData.uid || userData._id || `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    uid: userData.uid || userData._id,
    created_at: userData.created_at || now,
    updated_at: now
  };
  await database.collection('users').updateOne(
    { _id: doc._id },
    { $set: doc },
    { upsert: true }
  );
  return doc;
}

async function updateUser(idOrUid, updateData) {
  const database = await getDb();
  const now = new Date();
  const update = {
    ...updateData,
    updated_at: now
  };
  delete update._id;

  const res = await database.collection('users').findOneAndUpdate(
    { $or: [{ _id: idOrUid }, { uid: idOrUid }, { id: idOrUid }] },
    { $set: update },
    { returnDocument: 'after' }
  );
  return res;
}

async function deleteUser(idOrUid) {
  const database = await getDb();
  return await database.collection('users').deleteOne({
    $or: [{ _id: idOrUid }, { uid: idOrUid }, { id: idOrUid }]
  });
}

async function listUsers(query = {}, limit = 100, skip = 0) {
  const database = await getDb();
  return await database.collection('users')
    .find(query)
    .sort({ created_at: -1 })
    .skip(skip)
    .limit(limit)
    .toArray();
}

async function countUsers() {
  const database = await getDb();
  return await database.collection('users').countDocuments();
}

// ==================== SYSTEM CONFIG OPERATIONS ====================
let localConfigCache = null;
let localConfigExpiresAt = 0;
const CACHE_TTL_MS = 3 * 60 * 1000;
const LEGACY_PROVIDER_FIELDS = [
  'active_provider', 'active_chat_provider', 'provider', 'provider_id',
  'ai_provider', 'api_key', 'anthropic_api_key', 'anthropic_endpoint',
  'anthropic_model', 'credentials', 'provider_credentials',
];

function normalizeSystemConfig(config = {}) {
  const normalized = { ...config, provider: 'gemini' };
  LEGACY_PROVIDER_FIELDS.forEach((field) => {
    if (field !== 'provider') delete normalized[field];
  });
  return normalized;
}

async function getSystemConfig(forceReload = false) {
  const now = Date.now();
  if (!forceReload && localConfigCache && now < localConfigExpiresAt) {
    return localConfigCache;
  }

  const database = await getDb();
  const configDoc = await database.collection('config').findOne({ _id: 'system' });
  if (configDoc) {
    const normalizedConfig = normalizeSystemConfig(configDoc);
    const hadLegacyFields = LEGACY_PROVIDER_FIELDS.some((field) => field !== 'provider' && Object.hasOwn(configDoc, field));
    if (hadLegacyFields || configDoc.provider !== 'gemini') {
      await database.collection('config').updateOne(
        { _id: 'system' },
        {
          $set: { ...normalizedConfig, updated_at: new Date() },
          $unset: Object.fromEntries(LEGACY_PROVIDER_FIELDS.filter((field) => field !== 'provider').map((field) => [field, ''])),
        }
      );
    }
    localConfigCache = normalizedConfig;
    localConfigExpiresAt = now + CACHE_TTL_MS;
    return normalizedConfig;
  }

  const defaultConfig = {
    _id: 'system',
    gemini_model: '',
    gemini_endpoint: '',
    transcribe_model: '',
    meeting_model: '',
    meeting_endpoint: '',
    meeting_api_key: '',
    web_search_mode: 'cse_with_fallback',
    web_search_fallback_sources: {
      chinhphu: true,
      thuvienphapluat: true,
      luatvietnam: true,
      quochoi: true,
      vbpl: true
    },
    updated_at: new Date()
  };

  await database.collection('config').updateOne(
    { _id: 'system' },
    { $set: defaultConfig },
    { upsert: true }
  );
  localConfigCache = defaultConfig;
  localConfigExpiresAt = now + CACHE_TTL_MS;
  return defaultConfig;
}

async function updateSystemConfig(updateData) {
  const database = await getDb();
  const now = new Date();
  const update = {
    ...updateData,
    updated_at: now
  };
  delete update._id;

  await database.collection('config').updateOne(
    { _id: 'system' },
    { $set: update },
    { upsert: true }
  );
  localConfigCache = null;
  localConfigExpiresAt = 0;
  return await getSystemConfig(true);
}

// ==================== SEARCH LOGS OPERATIONS ====================
async function addSearchLog(logData) {
  const database = await getDb();
  const doc = {
    ...logData,
    timestamp: logData.timestamp ? new Date(logData.timestamp) : new Date()
  };
  const result = await database.collection('search_logs').insertOne(doc);
  return { id: result.insertedId, ...doc };
}

async function getSearchLogs(filter = {}, limit = 50, cursor = null) {
  const database = await getDb();
  const query = { ...filter };
  if (cursor) {
    const cursorTime = new Date(cursor.createdAt || cursor);
    const cursorId = cursor.docId ? String(cursor.docId) : null;
    const cursorObjectId = cursorId && ObjectId.isValid(cursorId) ? new ObjectId(cursorId) : cursorId;
    if (!Number.isNaN(cursorTime.getTime())) {
      query.$and = [
        ...(query.$and || []),
        cursorId
          ? { $or: [{ timestamp: { $lt: cursorTime } }, { timestamp: cursorTime, _id: { $lt: cursorObjectId } }] }
          : { timestamp: { $lt: cursorTime } },
      ];
    }
  }
  return database.collection('search_logs')
    .find(query)
    .sort({ timestamp: -1, _id: -1 })
    .limit(limit + 1)
    .toArray();
}

async function countSearchLogs(filter = {}) {
  const database = await getDb();
  return database.collection('search_logs').countDocuments(filter);
}

async function deleteSearchLogById(id, filter = {}) {
  const database = await getDb();
  const { ObjectId } = require('mongodb');
  const ids = [id];
  if (ObjectId.isValid(String(id))) ids.push(new ObjectId(String(id)));
  const result = await database.collection('search_logs').deleteOne({ ...filter, _id: { $in: ids } });
  return result.deletedCount > 0;
}

async function deleteSearchLogs(filter = {}, limit = 500) {
  const database = await getDb();
  const collection = database.collection('search_logs');
  let deleted = 0;
  while (deleted < limit) {
    const docs = await collection.find(filter, { projection: { _id: 1 } }).limit(Math.min(500, limit - deleted)).toArray();
    if (!docs.length) break;
    const result = await collection.deleteMany({ _id: { $in: docs.map(doc => doc._id) } });
    deleted += result.deletedCount || 0;
    if (docs.length < 500) break;
  }
  return deleted;
}

// ==================== STATS OPERATIONS ====================
async function getVisitStats() {
  const database = await getDb();
  const stats = await database.collection('stats').findOne({ _id: 'visits' });
  return Number(stats?.count || 0);
}

async function checkAndIncrementRateLimit({ key, type, limit }) {
  if (!key || !type || !Number.isFinite(Number(limit))) throw new Error('Invalid rate-limit parameters');
  const database = await getDb();
  const now = new Date();
  const result = await database.collection('rate_limits').findOneAndUpdate(
    { _id: key },
    { $inc: { count: 1 }, $setOnInsert: { key, type, createdAt: now, expiresAt: new Date(now.getTime() + 172800000) } },
    { upsert: true, returnDocument: 'after' }
  );
  const count = Number(result?.count || 0);
  if (count > Number(limit)) {
    await database.collection('rate_limits').updateOne({ _id: key }, { $inc: { count: -1 } });
    return { allowed: false, count: count - 1 };
  }
  return { allowed: true, count };
}

async function incrementVisitStats() {
  const database = await getDb();
  const res = await database.collection('stats').findOneAndUpdate(
    { _id: 'visits' },
    { $inc: { count: 1 }, $set: { updated_at: new Date() } },
    { upsert: true, returnDocument: 'after' }
  );
  return Number(res?.count || 1);
}

// ==================== HOT INDEX OPERATIONS ====================
async function getWebSearchHotIndex() {
  const database = await getDb();
  const hotIndex = await database.collection('config').findOne({ _id: 'web_search_hot_index' });
  return hotIndex || null;
}

async function updateWebSearchHotIndex(data) {
  const database = await getDb();
  await database.collection('config').updateOne(
    { _id: 'web_search_hot_index' },
    { $set: { ...data, updated_at: new Date() } },
    { upsert: true }
  );
}

// ==================== NQ57 TASK TRACKER OPERATIONS ====================
function computeTaskEffectiveStatus(task, now = new Date()) {
  if (task.status === 'hoan_thanh') return 'hoan_thanh';
  if (!task.due_date) return task.status || 'dang_thuc_hien';
  const due = new Date(`${task.due_date}T23:59:59+07:00`);
  if (Number.isNaN(due.getTime())) return task.status || 'dang_thuc_hien';
  const diffDays = Math.ceil((due.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays < 0) return 'qua_han';
  if (diffDays <= 3) return 'sap_qua_han';
  return 'dang_thuc_hien';
}

async function listNq57Tasks({ status = '', lead_unit = '', pillar = '', search = '', limit = 200 } = {}) {
  const database = await getDb();
  const filter = {};
  if (lead_unit) filter.lead_unit = { $regex: new RegExp(String(lead_unit).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') };
  if (pillar) filter.pillar = String(pillar).trim();
  if (search) {
    const rx = new RegExp(String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ title: rx }, { source_doc: rx }, { lead_unit: rx }, { notes: rx }];
  }
  const rows = await database
    .collection('nq57_tasks')
    .find(filter)
    .sort({ due_date: 1, updated_at: -1 })
    .limit(Math.min(500, Math.max(1, Number(limit) || 200)))
    .toArray();
  const now = new Date();
  const mapped = rows.map((row) => ({
    ...row,
    id: String(row._id),
    effective_status: computeTaskEffectiveStatus(row, now),
  }));
  if (status && status !== 'all') {
    return mapped.filter((t) => t.effective_status === status || t.status === status);
  }
  return mapped;
}

async function createNq57Task(payload = {}, actor = {}) {
  const database = await getDb();
  const now = new Date();
  const doc = {
    title: String(payload.title || '').trim(),
    source_doc: String(payload.source_doc || '').trim(),
    source_date: String(payload.source_date || '').trim(),
    lead_unit: String(payload.lead_unit || 'Chưa phân công').trim(),
    coord_units: Array.isArray(payload.coord_units)
      ? payload.coord_units.map((u) => String(u).trim()).filter(Boolean)
      : String(payload.coord_units || '').split(/[,;]/).map((u) => u.trim()).filter(Boolean),
    due_date: String(payload.due_date || '').trim(),
    status: payload.status === 'hoan_thanh' ? 'hoan_thanh' : 'dang_thuc_hien',
    pillar: String(payload.pillar || 'Chuyển đổi số').trim(),
    notes: String(payload.notes || '').trim(),
    created_by: actor.email || actor.uid || 'system',
    created_at: now,
    updated_at: now,
  };
  const res = await database.collection('nq57_tasks').insertOne(doc);
  return { ...doc, _id: res.insertedId, id: String(res.insertedId), effective_status: computeTaskEffectiveStatus(doc, now) };
}

async function bulkCreateNq57Tasks(items = [], actor = {}) {
  const results = [];
  for (const item of items) {
    if (!item || !String(item.title || '').trim()) continue;
    results.push(await createNq57Task(item, actor));
  }
  return results;
}

async function updateNq57Task(id, updates = {}) {
  const database = await getDb();
  const oid = ObjectId && ObjectId.isValid(String(id)) ? new ObjectId(String(id)) : String(id);
  const allowed = ['title', 'source_doc', 'source_date', 'lead_unit', 'coord_units', 'due_date', 'status', 'pillar', 'notes'];
  const $set = { updated_at: new Date() };
  for (const key of allowed) {
    if (updates[key] !== undefined) {
      if (key === 'coord_units' && typeof updates[key] === 'string') {
        $set[key] = updates[key].split(/[,;]/).map((u) => u.trim()).filter(Boolean);
      } else {
        $set[key] = updates[key];
      }
    }
  }
  const res = await database.collection('nq57_tasks').findOneAndUpdate(
    { _id: oid },
    { $set },
    { returnDocument: 'after' }
  );
  if (!res) return null;
  return { ...res, id: String(res._id), effective_status: computeTaskEffectiveStatus(res) };
}

async function deleteNq57Task(id) {
  const database = await getDb();
  const oid = ObjectId && ObjectId.isValid(String(id)) ? new ObjectId(String(id)) : String(id);
  const res = await database.collection('nq57_tasks').deleteOne({ _id: oid });
  return res.deletedCount > 0;
}

async function getNq57TasksSummary() {
  const tasks = await listNq57Tasks({ limit: 500 });
  const summary = {
    total: tasks.length,
    hoan_thanh: 0,
    dang_thuc_hien: 0,
    sap_qua_han: 0,
    qua_han: 0,
    by_unit: {},
  };
  for (const t of tasks) {
    const st = t.effective_status || 'dang_thuc_hien';
    if (summary[st] !== undefined) summary[st] += 1;
    const unit = t.lead_unit || 'Khác';
    if (!summary.by_unit[unit]) summary.by_unit[unit] = { total: 0, hoan_thanh: 0, qua_han: 0, sap_qua_han: 0 };
    summary.by_unit[unit].total += 1;
    if (st === 'hoan_thanh') summary.by_unit[unit].hoan_thanh += 1;
    if (st === 'qua_han') summary.by_unit[unit].qua_han += 1;
    if (st === 'sap_qua_han') summary.by_unit[unit].sap_qua_han += 1;
  }
  return summary;
}

// ==================== PAKN (pakn.nq57.vn) OPERATIONS ====================
async function listPaknCases({ status = '', search = '', limit = 100 } = {}) {
  const database = await getDb();
  const filter = {};
  if (status && status !== 'all') filter.status = String(status).trim();
  if (search) {
    const rx = new RegExp(String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ code: rx }, { title: rx }, { content: rx }, { assigned_unit: rx }, { field: rx }];
  }
  const rows = await database
    .collection('pakn_cases')
    .find(filter)
    .sort({ updated_at: -1 })
    .limit(Math.min(300, Math.max(1, Number(limit) || 100)))
    .toArray();
  return rows.map((r) => ({ ...r, id: String(r._id) }));
}

async function createPaknCase(payload = {}, actor = {}) {
  const database = await getDb();
  const now = new Date();
  const doc = {
    code: String(payload.code || `PAKN-${Date.now().toString().slice(-6)}`).trim(),
    title: String(payload.title || '').trim(),
    content: String(payload.content || '').trim(),
    citizen_info: String(payload.citizen_info || '').trim(),
    field: String(payload.field || 'Thủ tục hành chính / CĐS').trim(),
    assigned_unit: String(payload.assigned_unit || '').trim(),
    coord_units: Array.isArray(payload.coord_units) ? payload.coord_units : [],
    due_date: String(payload.due_date || '').trim(),
    legal_basis: Array.isArray(payload.legal_basis) ? payload.legal_basis : [],
    draft_type: payload.draft_type === 'tra_loi' ? 'tra_loi' : 'chuyen_xu_ly',
    draft_content: String(payload.draft_content || '').trim(),
    status: payload.status || 'dang_xu_ly',
    created_by: actor.email || actor.uid || 'system',
    created_at: now,
    updated_at: now,
  };
  const res = await database.collection('pakn_cases').insertOne(doc);
  return { ...doc, _id: res.insertedId, id: String(res.insertedId) };
}

async function updatePaknCase(id, updates = {}) {
  const database = await getDb();
  const oid = ObjectId && ObjectId.isValid(String(id)) ? new ObjectId(String(id)) : String(id);
  const allowed = ['title', 'field', 'assigned_unit', 'coord_units', 'due_date', 'draft_type', 'draft_content', 'status'];
  const $set = { updated_at: new Date() };
  for (const key of allowed) {
    if (updates[key] !== undefined) $set[key] = updates[key];
  }
  const res = await database.collection('pakn_cases').findOneAndUpdate(
    { _id: oid },
    { $set },
    { returnDocument: 'after' }
  );
  return res ? { ...res, id: String(res._id) } : null;
}

async function deletePaknCase(id) {
  const database = await getDb();
  const oid = ObjectId && ObjectId.isValid(String(id)) ? new ObjectId(String(id)) : String(id);
  const res = await database.collection('pakn_cases').deleteOne({ _id: oid });
  return res.deletedCount > 0;
}

module.exports = {
  getDb,
  getUserByEmail,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  listUsers,
  countUsers,
  getSystemConfig,
  updateSystemConfig,
  addSearchLog,
  getSearchLogs,
  countSearchLogs,
  deleteSearchLogById,
  deleteSearchLogs,
  getVisitStats,
  incrementVisitStats,
  checkAndIncrementRateLimit,
  getWebSearchHotIndex,
  updateWebSearchHotIndex,
  listNq57Tasks,
  createNq57Task,
  bulkCreateNq57Tasks,
  updateNq57Task,
  deleteNq57Task,
  getNq57TasksSummary,
  listPaknCases,
  createPaknCase,
  updatePaknCase,
  deletePaknCase,
};
