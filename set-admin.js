const admin = require('firebase-admin');
const fs = require('fs');

const TARGET_EMAIL = process.env.TARGET_EMAIL || 'haichau2404@gmail.com';
const SERVICE_ACCOUNT_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS || '';
const FIREBASE_SERVICE_ACCOUNT_JSON = process.env.FIREBASE_SERVICE_ACCOUNT || '';

async function main() {
  try {
    let credentialConfig = null;

    if (FIREBASE_SERVICE_ACCOUNT_JSON) {
      credentialConfig = JSON.parse(FIREBASE_SERVICE_ACCOUNT_JSON);
    } else if (SERVICE_ACCOUNT_PATH) {
      if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
        console.error(`Missing service account file: ${SERVICE_ACCOUNT_PATH}`);
        process.exit(1);
      }
      credentialConfig = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
    } else {
      console.error('Missing credentials. Set FIREBASE_SERVICE_ACCOUNT or GOOGLE_APPLICATION_CREDENTIALS.');
      process.exit(1);
    }

    admin.initializeApp({
      credential: admin.credential.cert(credentialConfig)
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
