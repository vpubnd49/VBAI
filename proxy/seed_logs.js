// Seed 20 test search_logs for UI testing
const path = require('path');
const {
  Timestamp,
  getFirebaseFirestore,
  initializeFirebaseApp,
} = require('./services/firebase-admin.service');

const saPath = path.join(__dirname, 'service-account.json');
initializeFirebaseApp({
  serviceAccount: require(saPath),
  projectId: 'gen-lang-client-0462350485',
});

const db = getFirebaseFirestore();

async function main() {
  console.log('Seeding 20 test documents...');
  const batch = db.batch();
  for (let i = 1; i <= 20; i++) {
    const ref = db.collection('search_logs').doc();
    batch.set(ref, {
      userEmail: `testuser${i}@example.com`,
      query: `Tra cứu test ${i} - Nghị định ${100 + i}/2024/NĐ-CP`,
      model: 'gemini-3.5-flash-lite',
      timestamp: Timestamp.fromDate(new Date(Date.now() - i * 3600000))
    });
  }
  await batch.commit();
  
  const snap = await db.collection('search_logs').get();
  console.log(`Done. Total documents: ${snap.size}`);
}

main().catch(e => console.error(e)).finally(() => process.exit());
