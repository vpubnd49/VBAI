const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./service-account.json');

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function searchFirestoreForKeys() {
  try {
    const collections = await db.listCollections();
    for (const col of collections) {
      console.log(`Scanning collection: ${col.id}...`);
      const snap = await col.limit(100).get();
      snap.forEach(doc => {
        const data = doc.data();
        const str = JSON.stringify(data);
        const match = str.match(/(AIzaSy[A-Za-z0-9\-_]+)/g);
        if (match) {
          console.log(`Found Key in collection ${col.id}, doc ${doc.id}:`, match);
        }
      });
    }
    console.log('Scan complete.');
  } catch (err) {
    console.error('Scan error:', err);
  }
}

searchFirestoreForKeys();
