#!/usr/bin/env node

const dbService = require('../services/db.service');

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

async function main() {
  const projectId = mustGetEnv('VERTEX_PROJECT_ID');
  const webSearchProvider = getEnv('WEB_SEARCH_PROVIDER', 'vertex_search');
  const vertexProjectId = getEnv('VERTEX_PROJECT_ID', projectId);
  const vertexLocation = getEnv('VERTEX_LOCATION', 'global');
  const vertexDataStoreId = getEnv('VERTEX_DATA_STORE_ID');
  const vertexServingConfig = getEnv('VERTEX_SERVING_CONFIG');

  const geminiModel = getEnv('GEMINI_MODEL', 'gemini-3.5-flash-lite');
  const transcribeModel = getEnv('TRANSCRIBE_MODEL', 'gemini-3.5-flash-lite');
  const webSearchMode = getEnv('WEB_SEARCH_MODE', 'cse_fast');

  if (webSearchProvider === 'vertex_search') {
    if (!vertexProjectId) throw new Error('WEB_SEARCH_PROVIDER=vertex_search requires VERTEX_PROJECT_ID');
    if (!vertexServingConfig && !vertexDataStoreId) {
      throw new Error('WEB_SEARCH_PROVIDER=vertex_search requires VERTEX_SERVING_CONFIG or VERTEX_DATA_STORE_ID');
    }
  } else {
    throw new Error('WEB_SEARCH_PROVIDER must be vertex_search');
  }

  const now = new Date();
  await dbService.updateSystemConfig({
    active_provider: 'gemini',
    gemini_model: geminiModel,
    transcribe_model: transcribeModel,
    web_search_provider: webSearchProvider,
    web_search_mode: webSearchMode,
    google_search_configured: false,
    vertex_project_id: vertexProjectId,
    vertex_location: vertexLocation || 'global',
    vertex_data_store_id: vertexDataStoreId,
    vertex_serving_config: vertexServingConfig,
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
  });

  const data = await dbService.getSystemConfig(true);
  const maskedGemini = data.gemini_api_key ? `${String(data.gemini_api_key).slice(0, 6)}...` : '';
  const maskedGoogle = data.google_search_key ? `${String(data.google_search_key).slice(0, 6)}...` : '';


  console.log('Seed completed:');
  console.log(`- vertex_project_id: ${projectId}`);
  console.log('- storage: MongoDB config/system');
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
