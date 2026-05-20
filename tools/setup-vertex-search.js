/**
 * VBAI Vertex AI Search Setup Helper
 * This script automates the creation of the Unstructured Data Store on Vertex AI Search (Discovery Engine)
 * and imports the metadata.jsonl containing legal documents mapped with 'so_hieu'.
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

async function main() {
  console.log('==================================================');
  console.log('    Khởi Tạo Unstructured Data Store trên Vertex    ');
  console.log('==================================================\n');

  // 1. Load Service Account Credentials
  const os = require('os');
  const localSaPath = path.join(__dirname, '../proxy/service-account.json');
  const tempSaPath = path.join(os.tmpdir(), 'vbai-service-account.json');
  const saPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || 
                 (fs.existsSync(localSaPath) ? localSaPath : tempSaPath);

  if (!fs.existsSync(saPath)) {
    console.error(`[Error] Không tìm thấy file Service Account tại: ${saPath}`);
    process.exit(1);
  }

  console.log(`[Info] Đang nạp thông tin Service Account từ: ${saPath}`);
  const serviceAccount = JSON.parse(fs.readFileSync(saPath, 'utf8'));
  const projectId = serviceAccount.project_id || 'gen-lang-client-0462350485';
  console.log(`[Info] Project ID active: ${projectId}`);

  // 2. Initialize Firebase Admin
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: projectId,
  });

  // 3. Get Google OAuth 2.0 Access Token
  console.log('[Info] Đang sinh mã truy cập Google Access Token...');
  const credential = admin.app().options?.credential;
  const tokenObj = await credential.getAccessToken();
  const accessToken = tokenObj.access_token;
  if (!accessToken) {
    console.error('[Error] Không thể tạo Google Access Token.');
    process.exit(1);
  }
  console.log('[OK] Sinh mã Access Token thành công.');

  const location = 'global';
  const collection = 'default_collection';
  const dataStoreId = 'vbai-legal-unstructured';
  const bucketName = 'vbai-legal-documents-0462350485';
  
  // 4. Create Unstructured Data Store via Discovery Engine REST API
  console.log(`\n[1/2] Đang tạo Unstructured Data Store '${dataStoreId}'...`);
  const createEndpoint = `https://discoveryengine.googleapis.com/v1beta/projects/${projectId}/locations/${location}/collections/${collection}/dataStores?dataStoreId=${dataStoreId}`;
  
  const datastoreBody = {
    displayName: 'VBAI Legal Unstructured Data Store',
    industryVertical: 'GENERIC',
    solutionTypes: ['SOLUTION_TYPE_SEARCH'],
    contentConfig: 'CONTENT_REQUIRED'
  };

  const createResponse = await fetch(createEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify(datastoreBody),
  });

  const createResult = await createResponse.json();
  if (createResponse.ok) {
    console.log('[OK] Tạo/Kiểm tra Data Store thành công! Đang chờ hoàn thành thao tác.');
  } else {
    // Check if it already exists (HTTP 409 Conflict)
    if (createResponse.status === 409 || (createResult.error && createResult.error.status === 'ALREADY_EXISTS')) {
      console.log('[Info] Data Store đã tồn tại từ trước (Không cần tạo mới).');
    } else {
      console.error('[Error] Không thể tạo Data Store:', JSON.stringify(createResult));
      process.exit(1);
    }
  }

  // 5. Import documents from Google Cloud Storage with metadata
  console.log(`\n[2/2] Đang kích hoạt Ingest tài liệu pháp luật từ: gs://${bucketName}/metadata.jsonl...`);
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
    console.log('[OK] Đã kích hoạt tiến trình nạp (Ingestion Job) thành công!');
    console.log('[Info] ID tiến trình (Operation ID):', importResult.name);
    console.log('\n==================================================');
    console.log('               KHỞI TẠO HOÀN TẤT                  ');
    console.log('==================================================');
    console.log(`\nHướng dẫn cấu hình nâng cao trên GCP Console:`);
    console.log(`1. Truy cập GCP Console -> Agent Builder -> Data Stores.`);
    console.log(`2. Chọn Data Store: 'vbai-legal-unstructured'.`);
    console.log(`3. Chuyển sang tab "Processing config":`);
    console.log(`   - Tại "Document parsing settings", bật "Layout Parser" (Advanced Parser)`);
    console.log(`     để trích xuất các đoạn Extractive Segments dài đúng chuẩn.`);
    console.log(`4. Trong tab "Schema":`);
    console.log(`   - Xác nhận thuộc tính 'so_hieu' đã được ánh xạ tự động từ 'metadata.jsonl'.`);
    console.log(`5. Cập nhật mã nguồn hoặc cài đặt Admin Panel:`);
    console.log(`   - vertex_data_store_id: 'vbai-legal-unstructured'`);
  } else {
    console.error('[Error] Lỗi khi kích hoạt Ingestion Job:', JSON.stringify(importResult));
    process.exit(1);
  }
}

main().catch(err => {
  console.error('[Fatal Error] Có lỗi xảy ra trong tiến trình:', err);
});
