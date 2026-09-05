/**
 * VBAI Local MongoDB Database Service
 * Replaces Firestore with local high-performance MongoDB on VPS.
 */
'use strict';

let MongoClient;
try {
  ({ MongoClient } = require('mongodb'));
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
  return await database.collection('users').findOne({
    $or: [{ _id: idOrUid }, { uid: idOrUid }, { id: idOrUid }]
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

async function getSystemConfig(forceReload = false) {
  const now = Date.now();
  if (!forceReload && localConfigCache && now < localConfigExpiresAt) {
    return localConfigCache;
  }

  const database = await getDb();
  const configDoc = await database.collection('config').findOne({ _id: 'system' });
  if (configDoc) {
    localConfigCache = configDoc;
    localConfigExpiresAt = now + CACHE_TTL_MS;
    return configDoc;
  }

  const defaultConfig = {
    _id: 'system',
    gemini_model: '',
    gemini_endpoint: '',
    transcribe_model: '',
    meeting_model: '',
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
    if (!Number.isNaN(cursorTime.getTime())) {
      query.$and = [
        ...(query.$and || []),
        cursorId
          ? { $or: [{ timestamp: { $lt: cursorTime } }, { timestamp: cursorTime, _id: { $lt: cursorId } }] }
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
  getWebSearchHotIndex,
  updateWebSearchHotIndex,
};
