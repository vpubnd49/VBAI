const admin = require('firebase-admin');
const fs = require('fs');

async function main() {
  const saPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || 'C:/Users/user/AppData/Local/Temp/vbai-service-account.json';
  if (!fs.existsSync(saPath)) {
    console.error(`Missing service account file at: ${saPath}`);
    process.exit(1);
  }

  const serviceAccount = JSON.parse(fs.readFileSync(saPath, 'utf8'));
  const projectId = serviceAccount.project_id || 'gen-lang-client-0462350485';

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: projectId,
    });
  }

  const db = admin.firestore();
  console.log('Firebase initialized. Fetching system configuration from config/system...');

  const configRef = db.doc('config/system');
  const doc = await configRef.get();

  if (!doc.exists) {
    console.log('No document found at config/system.');
    return;
  }

  const data = doc.data();
  console.log('==================================================');
  console.log('CONFIG/SYSTEM DATA:');
  console.log('Google Search Key (raw):', data.google_search_key || 'MISSING');
  console.log('Google Search CX (raw):', data.google_search_cx || 'MISSING');
  console.log('Vertex Search Project ID:', data.vertex_project_id || 'MISSING');
  console.log('Vertex Search Data Store ID:', data.vertex_data_store_id || 'MISSING');
  console.log('Web Search Provider:', data.web_search_provider || 'MISSING');
  console.log('Web Search Mode:', data.web_search_mode || 'MISSING');
  console.log('==================================================');
}

main().catch(err => {
  console.error('Error running check_config:', err);
});
