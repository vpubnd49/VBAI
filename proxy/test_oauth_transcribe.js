const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

async function getGoogleAccessToken() {
  const credential = admin.app().options?.credential;
  if (!credential || typeof credential.getAccessToken !== 'function') {
    throw new Error('vertex_auth_not_available');
  }
  const token = await credential.getAccessToken();
  return token.access_token;
}

async function testOAuth() {
  try {
    const token = await getGoogleAccessToken();
    console.log('Acquired OAuth Token.');

    const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent';
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Hello, please respond with OK' }] }]
      })
    });

    const data = await res.json();
    console.log('Status:', res.status);
    console.log('Response:', JSON.stringify(data));
  } catch (err) {
    console.error('Error:', err);
  }
}

testOAuth();
