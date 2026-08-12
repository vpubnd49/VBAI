// Check users collection
const path = require('path');
const {
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
  const snapshot = await db.collection('users').get();
  console.log(`Total users documents: ${snapshot.size}`);
  if (snapshot.size > 0) {
    snapshot.docs.forEach(doc => {
      const d = doc.data();
      console.log(`  - ${doc.id}: email=${d.email || 'N/A'}, name=${d.displayName || d.name || 'N/A'}, role=${d.role || 'N/A'}`);
    });
  } else {
    console.log('⚠️ Users collection is EMPTY!');
  }
}

main().catch(e => console.error(e)).finally(() => process.exit());
