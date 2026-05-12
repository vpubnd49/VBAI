const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const SERVICE_ACCOUNT_PATH = path.join(__dirname, 'service-account-alvb-app-83921.json');
const TARGET_EMAIL = 'haichau2404@gmail.com';

async function main() {
  try {
    if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
      console.error(`Missing service account file: ${SERVICE_ACCOUNT_PATH}`);
      console.error('Download it from Firebase Console > Project Settings > Service Accounts.');
      process.exit(1);
    }

    const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });

    const user = await admin.auth().getUserByEmail(TARGET_EMAIL);
    const existingClaims = user.customClaims || {};
    const updatedClaims = { ...existingClaims, admin: true };

    await admin.auth().setCustomUserClaims(user.uid, updatedClaims);

    console.log(`Granted admin to ${TARGET_EMAIL}`);
    console.log(`UID: ${user.uid}`);
    console.log('Claims:', updatedClaims);
    console.log('User must sign out and sign back in for the new claim to take effect.');
  } catch (error) {
    console.error('Failed to set admin claim:', error.message);
    process.exit(1);
  }
}

main();
