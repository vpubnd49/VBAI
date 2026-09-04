/**
 * Continuous Telemetry & Ingestion Service for vbaibot (Zalo AI Agent)
 * Handles automatic data collection, PII masking, quality filtering,
 * and seamless injection into the training dataset.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const dbService = require('./db.service');

const SYNC_SECRET = String(process.env.VBAIBOT_SYNC_SECRET || '').trim();
const MAX_TELEMETRY_FIELD_LENGTH = 100 * 1024;
const IS_PRODUCTION = ['production', 'prod'].includes(String(process.env.NODE_ENV || process.env.APP_ENV || '').trim().toLowerCase());
if (IS_PRODUCTION && !SYNC_SECRET) {
  throw new Error('VBAIBOT_SYNC_SECRET is required in production');
}

function hasValidSyncSecret(candidate) {
  if (!SYNC_SECRET || typeof candidate !== 'string' || candidate.length !== SYNC_SECRET.length) return false;
  return crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(SYNC_SECRET));
}

// Casual noise phrases to filter out
const NOISE_PHRASES = [
  'alo', 'hi', 'hello', 'chào', 'chào bạn', 'chào bot', 'ok', 'oke', 'oki',
  'cảm ơn', 'cam on', 'thanks', 'thank you', 'tạm biệt', 'bye', 'test', '123'
];

/**
 * Anonymize PII (Personal Identifiable Information) per Nghị định 13/2023/NĐ-CP
 */
function maskPII(text = '') {
  let str = String(text || '');
  // Phone numbers (03x, 05x, 07x, 08x, 09x, +84)
  str = str.replace(/(?:\+84|0)(?:3[2-9]|5[25689]|7[06-9]|8[1-9]|9[0-9])[0-9]{7}/g, '[SỐ_ĐIỆN_THOẠI]');
  // CCCD / CMND (9 or 12 digits)
  str = str.replace(/\b[0-9]{9}\b/g, '[SỐ_CMND]');
  str = str.replace(/\b[0-9]{12}\b/g, '[SỐ_CCCD]');
  // Email addresses
  str = str.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]');
  return str;
}

/**
 * Quality Gate: Validates whether a conversation turn is valuable for AI training
 */
function isQualitySample(userPrompt = '', modelResponse = '') {
  const normUser = String(userPrompt || '').trim().toLowerCase();
  const normModel = String(modelResponse || '').trim();

  // Length checks
  if (normUser.length < 8 || normModel.length < 40) return false;

  // Filter casual noise
  if (NOISE_PHRASES.includes(normUser)) return false;

  // Check if model responded with an error or generic failure
  if (normModel.includes('Lỗi hệ thống') || normModel.includes('Internal Error') || normModel.includes('không thể kết nối')) {
    return false;
  }

  return true;
}

/**
 * Categorize query based on content
 */
function detectCategory(prompt = '') {
  const p = String(prompt || '').toLowerCase();
  if (p.includes('nghị định') || p.includes('luật') || p.includes('thông tư') || p.includes('quyết định') || p.includes('xử phạt')) {
    return 'legal-search';
  }
  if (p.includes('xã') || p.includes('phường') || p.includes('tỉnh') || p.includes('huyện') || p.includes('sáp nhập') || p.includes('địa giới')) {
    return 'administrative';
  }
  if (p.includes('căn lề') || p.includes('soạn thảo') || p.includes('thể thức') || p.includes('văn bản')) {
    return 'nd30-standard';
  }
  return 'general-qa';
}

/**
 * Ingest conversation turn from vbaibot
 */
async function ingestVbaibotTurn({ userPrompt, modelResponse, sourceUserId, timestamp, authSecret }) {
  if (!hasValidSyncSecret(authSecret)) {
    throw { status: 401, message: 'Invalid sync secret key' };
  }
  if (String(userPrompt || '').length > MAX_TELEMETRY_FIELD_LENGTH || String(modelResponse || '').length > MAX_TELEMETRY_FIELD_LENGTH) {
    throw { status: 413, message: 'Telemetry payload is too large' };
  }

  const cleanUser = maskPII(userPrompt).trim();
  const cleanModel = maskPII(modelResponse).trim();

  if (!isQualitySample(cleanUser, cleanModel)) {
    return { accepted: false, reason: 'Filtered by Quality Gate (Short/Casual/Error)' };
  }

  const category = detectCategory(cleanUser);
  const sampleDoc = {
    messages: [
      { role: 'user', content: cleanUser },
      { role: 'model', content: cleanModel }
    ],
    category,
    tags: ['vbaibot-live-sync', category],
    source: 'vbaibot-zalo',
    sourceUserId: maskPII(sourceUserId || 'anonymous'),
    createdAt: timestamp ? new Date(timestamp) : new Date(),
    ingestedAt: new Date()
  };

  // 1. Save to MongoDB
  let sampleId = null;
  const db = await dbService.getDb();
  if (db) {
    const res = await db.collection('training_datasets').insertOne(sampleDoc);
    sampleId = res.insertedId;
  }

  // 2. Append to local JSONL for immediate training readiness
  try {
    const jsonlPath = path.join(__dirname, '..', 'data', 'vbai_tuning_dataset.jsonl');
    const jsonLine = JSON.stringify({
      messages: sampleDoc.messages,
      category: sampleDoc.category,
      source: sampleDoc.source
    }) + '\n';
    fs.appendFileSync(jsonlPath, jsonLine, 'utf-8');
  } catch (err) {
    console.error('[IngestService] Failed to append to JSONL:', err);
  }

  console.log(`[IngestService] Successfully ingested sample from vbaibot (Category: ${category})`);

  return {
    accepted: true,
    sampleId,
    category,
    message: 'Sample accepted and added to training dataset.'
  };
}

module.exports = {
  SYNC_SECRET,
  MAX_TELEMETRY_FIELD_LENGTH,
  hasValidSyncSecret,
  maskPII,
  isQualitySample,
  ingestVbaibotTurn
};
