// Check users collection
const admin = require('firebase-admin');
const path = require('path');

const saPath = path.join(__dirname, 'service-account.json');
admin.initializeApp({
  credential: admin.credential.cert(require(saPath)),
  projectId: 'gen-lang-client-0462350485'
});

const db = admin.firestore();

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
