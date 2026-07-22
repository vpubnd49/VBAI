const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function setConfig() {
  try {
    const docRef = db.collection('config').doc('system');
    await docRef.update({
      active_provider: '9router',
      active_chat_provider: '9router',
      nine_router_model: 'DevGOVietnam-Frontier',
      gemini_model: 'gemini-3.5-flash-lite'
    });
    console.log('Successfully set config: 9router / DevGOVietnam-Frontier / gemini-3.5-flash-lite');
  } catch (err) {
    console.error('Error updating config:', err);
  }
}

setConfig();
