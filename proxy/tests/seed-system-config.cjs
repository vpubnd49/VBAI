#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

function getEnv(name, fallback = '') {
  return String(process.env[name] || fallback).trim();
}

function mustGetEnv(name) {
  const value = getEnv(name);
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

function loadServiceAccount() {
  const rawInline = getEnv('FIREBASE_SERVICE_ACCOUNT');
  if (rawInline) {
    return JSON.parse(rawInline);
  }

  const credentialPath = getEnv('GOOGLE_APPLICATION_CREDENTIALS');
  if (!credentialPath) {
    throw new Error('Missing GOOGLE_APPLICATION_CREDENTIALS (path to service account json).');
  }
  const absPath = path.resolve(credentialPath);
  return JSON.parse(fs.readFileSync(absPath, 'utf8'));
}

async function main() {
  const projectId = mustGetEnv('FIREBASE_PROJECT_ID');
  const geminiApiKey = mustGetEnv('GEMINI_API_KEY');
  const webSearchProvider = getEnv('WEB_SEARCH_PROVIDER', 'vertex_search');
  const googleSearchKey = getEnv('GOOGLE_SEARCH_KEY');
  const googleSearchCx = getEnv('GOOGLE_SEARCH_CX');
  const vertexProjectId = getEnv('VERTEX_PROJECT_ID', projectId);
  const vertexLocation = getEnv('VERTEX_LOCATION', 'global');
  const vertexDataStoreId = getEnv('VERTEX_DATA_STORE_ID');
  const vertexServingConfig = getEnv('VERTEX_SERVING_CONFIG');

  const geminiModel = getEnv('GEMINI_MODEL', 'gemini-2.5-flash');
  const transcribeModel = getEnv('TRANSCRIBE_MODEL', 'gemini-2.5-flash');
  const webSearchMode = getEnv('WEB_SEARCH_MODE', 'cse_fast');

  if (webSearchProvider === 'cse') {
    if (!googleSearchKey || !googleSearchCx) {
      throw new Error('WEB_SEARCH_PROVIDER=cse requires GOOGLE_SEARCH_KEY and GOOGLE_SEARCH_CX');
    }
  } else if (webSearchProvider === 'vertex_search') {
    if (!vertexProjectId) throw new Error('WEB_SEARCH_PROVIDER=vertex_search requires VERTEX_PROJECT_ID');
    if (!vertexServingConfig && !vertexDataStoreId) {
      throw new Error('WEB_SEARCH_PROVIDER=vertex_search requires VERTEX_SERVING_CONFIG or VERTEX_DATA_STORE_ID');
    }
  } else {
    throw new Error('WEB_SEARCH_PROVIDER must be cse or vertex_search');
  }

  const serviceAccount = loadServiceAccount();

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId,
  });

  const db = admin.firestore();
  const ref = db.doc('config/system');

  const now = new Date().toISOString();
  await ref.set({
    active_provider: 'gemini',
    gemini_api_key: geminiApiKey,
    gemini_model: geminiModel,
    transcribe_model: transcribeModel,
    web_search_provider: webSearchProvider,
    web_search_mode: webSearchMode,
    google_search_key: googleSearchKey || admin.firestore.FieldValue.delete(),
    google_search_cx: googleSearchCx || admin.firestore.FieldValue.delete(),
    google_search_configured: !!(googleSearchKey && googleSearchCx),
    vertex_project_id: vertexProjectId || admin.firestore.FieldValue.delete(),
    vertex_location: vertexLocation || 'global',
    vertex_data_store_id: vertexDataStoreId || admin.firestore.FieldValue.delete(),
    vertex_serving_config: vertexServingConfig || admin.firestore.FieldValue.delete(),
    vertex_search_configured: !!(vertexProjectId && (vertexServingConfig || vertexDataStoreId)),
    web_search_fallback_sources: {
      vbpl: true,
      chinhphu: true,
      quochoi: true,
      thuvienphapluat: true,
      luatvietnam: true,
    },
    updated_at: now,
    updated_by: getEnv('UPDATED_BY', 'seed-system-config.cjs'),
  }, { merge: true });

  const snap = await ref.get();
  const data = snap.data() || {};
  const maskedGemini = data.gemini_api_key ? `${String(data.gemini_api_key).slice(0, 6)}...` : '';
  const maskedGoogle = data.google_search_key ? `${String(data.google_search_key).slice(0, 6)}...` : '';

  console.log('Seed completed:');
  console.log(`- project_id: ${projectId}`);
  console.log(`- doc_path: config/system`);
  console.log(`- active_provider: ${data.active_provider}`);
  console.log(`- gemini_model: ${data.gemini_model}`);
  console.log(`- web_search_provider: ${data.web_search_provider}`);
  console.log(`- web_search_mode: ${data.web_search_mode}`);
  console.log(`- google_search_cx: ${data.google_search_cx ? 'set' : 'missing'}`);
  console.log(`- vertex_project_id: ${data.vertex_project_id ? data.vertex_project_id : 'missing'}`);
  console.log(`- vertex_serving_config: ${data.vertex_serving_config ? 'set' : 'missing'}`);
  console.log(`- gemini_api_key: ${maskedGemini || 'missing'}`);
  console.log(`- google_search_key: ${maskedGoogle || 'missing'}`);
}

main().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
