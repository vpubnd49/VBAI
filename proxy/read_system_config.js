const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./service-account.json');

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function readConfig() {
  try {
    const doc = await db.collection('config').doc('system').get();
    if (doc.exists) {
      console.log('System Config Data:', JSON.stringify(doc.data(), null, 2));
    } else {
      console.log('No system config document found.');
    }
  } catch (err) {
    console.error('Error reading system config:', err);
  }
}

readConfig();
