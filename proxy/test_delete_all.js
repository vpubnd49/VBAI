// Seed test search_logs, then delete all to test the loop
const admin = require('firebase-admin');
const path = require('path');

const saPath = path.join(__dirname, 'service-account.json');
admin.initializeApp({
  credential: admin.credential.cert(require(saPath)),
  projectId: 'gen-lang-client-0462350485'
});

const db = admin.firestore();

async function main() {
  // Step 1: Seed 5 test documents
  console.log('Seeding 5 test documents...');
  const batch = db.batch();
  for (let i = 1; i <= 5; i++) {
    const ref = db.collection('search_logs').doc(`test_log_${i}`);
    batch.set(ref, {
      userEmail: `test${i}@example.com`,
      query: `Test query ${i} - delete all test`,
      model: 'gemini-test',
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
  }
  await batch.commit();
  console.log('Seeded 5 test documents.');

  // Step 2: Verify count
  const snap1 = await db.collection('search_logs').get();
  console.log(`Count before delete: ${snap1.size}`);

  // Step 3: Delete all in batches (same logic as admin-panel.js)
  console.log('Deleting all...');
  let totalDeleted = 0;
  let hasMore = true;
  while (hasMore) {
    const snapshot = await db.collection('search_logs').limit(500).get();
    if (snapshot.empty) {
      hasMore = false;
      break;
    }
    const deletePromises = snapshot.docs.map(doc => doc.ref.delete());
    await Promise.all(deletePromises);
    totalDeleted += snapshot.docs.length;
    console.log(`  Deleted batch: ${snapshot.docs.length}, total: ${totalDeleted}`);
    if (snapshot.docs.length < 500) {
      hasMore = false;
    }
  }

  // Step 4: Verify empty
  const snap2 = await db.collection('search_logs').get();
  console.log(`Count after delete: ${snap2.size}`);
  console.log(snap2.size === 0 ? '✅ DELETE ALL WORKS CORRECTLY' : '❌ STILL HAS DOCUMENTS');
}

main().catch(e => console.error(e)).finally(() => process.exit());
