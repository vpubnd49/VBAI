const serviceAccount = require('./service-account.json');
const {
  getFirebaseFirestore,
  initializeFirebaseApp,
} = require('./services/firebase-admin.service');

initializeFirebaseApp({
  serviceAccount,
  projectId: serviceAccount.project_id,
});

const db = getFirebaseFirestore();

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
