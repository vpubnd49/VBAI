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
  console.log('Firebase initialized. Fetching the absolute LATEST search log...');

  const snapshot = await db.collection('search_logs')
    .orderBy('timestamp', 'desc')
    .limit(1)
    .get();

  if (snapshot.empty) {
    console.log('No search logs found.');
    return;
  }

  const doc = snapshot.docs[0];
  const data = doc.data();
  console.log('==================================================');
  console.log(`LATEST LOG ID: ${doc.id}`);
  console.log(`Timestamp: ${data.timestamp ? data.timestamp.toDate().toISOString() : 'N/A'}`);
  console.log(`Query: "${data.query}"`);
  console.log(`User: ${data.userEmail}`);
  console.log(`Model: ${data.model}`);
  
  if (data.webSearchMeta || data.meta || data.searchMeta || data.search_metadata) {
    console.log('--- Search Metadata ---');
    console.log(JSON.stringify(data.webSearchMeta || data.meta || data.searchMeta || data.search_metadata, null, 2));
  }

  console.log('--- Assistant Reply ---');
  console.log(data.assistantReply);
  console.log('==================================================');
}

main().catch(err => {
  console.error('Error running view_latest_log:', err);
});
