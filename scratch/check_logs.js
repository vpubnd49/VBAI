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

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: projectId,
  });

  const db = admin.firestore();
  console.log('Firebase initialized. Fetching latest search logs...');

  const snapshot = await db.collection('search_logs')
    .orderBy('timestamp', 'desc')
    .limit(5)
    .get();

  if (snapshot.empty) {
    console.log('No search logs found.');
    return;
  }

  snapshot.forEach(doc => {
    const data = doc.data();
    console.log('\n==================================================');
    console.log(`LOG ID: ${doc.id}`);
    console.log(`Timestamp: ${data.timestamp ? data.timestamp.toDate().toISOString() : 'N/A'}`);
    console.log(`Query: "${data.query}"`);
    console.log(`User: ${data.userEmail}`);
    console.log(`Model: ${data.model}`);
    
    // Output search metadata if available
    if (data.search_metadata || data.meta || data.searchMeta) {
      console.log('--- Search Metadata ---');
      console.log(JSON.stringify(data.search_metadata || data.meta || data.searchMeta, null, 2));
    } else {
      // Look for other fields
      const keys = Object.keys(data).filter(k => !['query', 'userEmail', 'timestamp', 'assistantReply', 'model'].includes(k));
      console.log('--- Other Fields ---');
      keys.forEach(k => {
        console.log(`${k}:`, typeof data[k] === 'object' ? JSON.stringify(data[k]) : data[k]);
      });
    }

    console.log('--- Assistant Reply Snippet ---');
    console.log(String(data.assistantReply).slice(0, 500));
  });
}

main().catch(err => {
  console.error('Error running check_logs:', err);
});
