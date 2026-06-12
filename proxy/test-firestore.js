const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./service-account.json');

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function test() {
  try {
    const usersSnapshot = await db.collection('users').orderBy('createdAt', 'desc').limit(2).get();
    console.log('Users:');
    usersSnapshot.forEach(doc => console.log(doc.id, doc.data()));
    
    const logsSnapshot = await db.collection('search_logs').orderBy('timestamp', 'desc').limit(2).get();
    console.log('Logs:');
    logsSnapshot.forEach(doc => console.log(doc.id, doc.data()));
  } catch (err) {
    console.error('Error:', err);
  }
}

test();
