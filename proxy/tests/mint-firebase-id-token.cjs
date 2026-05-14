/* eslint-disable no-console */
const admin = require('firebase-admin');

async function main() {
  const serviceAccountJson = String(process.env.FIREBASE_SERVICE_ACCOUNT || '').trim();
  const apiKey = String(process.env.FIREBASE_WEB_API_KEY || '').trim();
  const uid = String(process.env.FIREBASE_CANARY_UID || 'canary-bot').trim();

  if (!serviceAccountJson) {
    throw new Error('Missing FIREBASE_SERVICE_ACCOUNT');
  }
  if (!apiKey) {
    throw new Error('Missing FIREBASE_WEB_API_KEY');
  }

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(serviceAccountJson);
  } catch (err) {
    throw new Error(`Invalid FIREBASE_SERVICE_ACCOUNT JSON: ${err.message}`);
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id,
  });

  const customToken = await admin.auth().createCustomToken(uid, {
    canary: true,
    source: 'github-actions',
  });

  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: customToken,
      returnSecureToken: true,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.idToken) {
    const msg = data?.error?.message || `HTTP ${response.status}`;
    throw new Error(`Failed to exchange custom token: ${msg}`);
  }

  process.stdout.write(String(data.idToken));
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
