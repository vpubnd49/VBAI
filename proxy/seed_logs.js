// Seed 20 test search_logs for UI testing
const admin = require('firebase-admin');
const path = require('path');

const saPath = path.join(__dirname, 'service-account.json');
admin.initializeApp({
  credential: admin.credential.cert(require(saPath)),
  projectId: 'gen-lang-client-0462350485'
});

const db = admin.firestore();

async function main() {
  console.log('Seeding 20 test documents...');
  const batch = db.batch();
  for (let i = 1; i <= 20; i++) {
    const ref = db.collection('search_logs').doc();
    batch.set(ref, {
      userEmail: `testuser${i}@example.com`,
      query: `Tra cứu test ${i} - Nghị định ${100 + i}/2024/NĐ-CP`,
      model: 'gemini-3.5-flash-lite',
      timestamp: admin.firestore.Timestamp.fromDate(new Date(Date.now() - i * 3600000))
    });
  }
  await batch.commit();
  
  const snap = await db.collection('search_logs').get();
  console.log(`Done. Total documents: ${snap.size}`);
}

main().catch(e => console.error(e)).finally(() => process.exit());
