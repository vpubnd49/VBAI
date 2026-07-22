const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function updateModel() {
  try {
    const docRef = db.collection('config').doc('system');
    await docRef.update({
      gemini_model: 'gemini-3.5-flash-lite'
    });
    console.log('Successfully updated gemini_model to gemini-3.5-flash-lite in Firestore!');
  } catch (err) {
    console.error('Error updating config:', err);
  }
}

updateModel();
