const fs = require('fs');
const path = require('path');
const { initializeFirebaseApp } = require('./services/firebase-admin.service');

async function main() {
  console.log('==================================================');
  console.log('    Ingest Tài Liệu vào vbai-legal-search         ');
  console.log('==================================================\n');

  const saPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || 'E:/OneDrive/HSCV/Antigravity/VBAI/proxy/service-account.json';
  if (!fs.existsSync(saPath)) {
    console.error(`[Error] Không tìm thấy file Service Account tại: ${saPath}`);
    process.exit(1);
  }

  const serviceAccount = JSON.parse(fs.readFileSync(saPath, 'utf8'));
  const projectId = serviceAccount.project_id || 'gen-lang-client-0462350485';
  console.log(`[Info] Project ID active: ${projectId}`);

  // Initialize Firebase Admin
  const app = initializeFirebaseApp({ serviceAccount, projectId });

  // Get Access Token
  const credential = app.options?.credential;
  const tokenObj = await credential.getAccessToken();
  const accessToken = tokenObj.access_token;
  if (!accessToken) {
    console.error('[Error] Không thể tạo Google Access Token.');
    process.exit(1);
  }
  console.log('[OK] Sinh mã Access Token thành công.');

  const location = 'global';
  const collection = 'default_collection';
  const dataStoreId = 'vbai-legal-search';
  const bucketName = 'vbai-legal-documents-0462350485';
  
  console.log(`\nĐang kích hoạt Ingest tài liệu pháp luật từ: gs://${bucketName}/metadata.jsonl vào dataStore: ${dataStoreId}...`);
  const importEndpoint = `https://discoveryengine.googleapis.com/v1beta/projects/${projectId}/locations/${location}/collections/${collection}/dataStores/${dataStoreId}/branches/0/documents:import`;
  
  const importBody = {
    gcsSource: {
      inputUris: [`gs://${bucketName}/metadata.jsonl`],
      dataSchema: 'document'
    },
    reconciliationMode: 'INCREMENTAL'
  };

  const importResponse = await fetch(importEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify(importBody),
  });

  const importResult = await importResponse.json();
  if (importResponse.ok) {
    console.log('[OK] Đã kích hoạt tiến trình nạp thành công!');
    console.log('[Info] Operation ID:', importResult.name);
  } else {
    console.error('[Error] Lỗi khi kích hoạt Ingestion Job:', JSON.stringify(importResult, null, 2));
  }
}

main().catch(err => {
  console.error('[Fatal Error] Lỗi hệ thống:', err);
});
