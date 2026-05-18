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
  console.log('Firebase initialized. Updating configuration in Firestore...');

  const configRef = db.doc('config/system');
  const snap = await configRef.get();

  if (!snap.exists) {
    console.error('System config document does not exist!');
    process.exit(1);
  }

  const currentData = snap.data();
  console.log('Current Data Store ID:', currentData.vertex_data_store_id);

  // Update Data Store ID to vbai-legal-search
  await configRef.update({
    vertex_data_store_id: 'vbai-legal-search',
    google_search_key: 'AIzaSyBuqo2nl_wreM49nljuwZiCxb-1JzcWFuM', // Use the correctly generated key
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
    updated_by: 'Antigravity Auto-Fix'
  });

  console.log('==================================================');
  console.log('SUCCESS: System configuration updated successfully!');
  console.log('- Changed vertex_data_store_id to: "vbai-legal-search"');
  console.log('- Updated google_search_key to: "AIzaSyBuqo2nl_wreM49nljuwZiCxb-1JzcWFuM"');
  console.log('==================================================');
}

main().catch(err => {
  console.error('Fatal error:', err);
});
