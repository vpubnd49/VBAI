// Quick test: count documents in search_logs collection
const admin = require('firebase-admin');
const path = require('path');

const saPath = path.join(__dirname, 'service-account.json');
admin.initializeApp({
  credential: admin.credential.cert(require(saPath)),
  projectId: 'gen-lang-client-0462350485'
});

const db = admin.firestore();

async function main() {
  const snapshot = await db.collection('search_logs').limit(1000).get();
  console.log(`Total search_logs documents: ${snapshot.size}`);
  if (snapshot.size > 0) {
    console.log('First 3 docs:');
    snapshot.docs.slice(0, 3).forEach(doc => {
      const d = doc.data();
      console.log(`  - ${doc.id}: user=${d.userEmail || 'N/A'}, query=${(d.query || '').substring(0, 50)}`);
    });
  }
}

main().catch(e => console.error(e)).finally(() => process.exit());
