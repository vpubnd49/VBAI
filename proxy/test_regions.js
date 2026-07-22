const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

async function getGoogleAccessToken() {
  const credential = admin.app().options?.credential;
  const token = await credential.getAccessToken();
  return token.access_token;
}

async function test(location, model) {
  try {
    const token = await getGoogleAccessToken();
    const projectId = serviceAccount.project_id;
    const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:generateContent`;
    
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'Hello' }] }]
      })
    });
    
    const data = await res.json();
    console.log(`Region: ${location}, Model: ${model} -> Status: ${res.status}`);
    if (!res.ok) {
      console.log(`  Error:`, data.error?.message || JSON.stringify(data));
    }
  } catch (err) {
    console.log(`Region: ${location}, Model: ${model} -> Exception:`, err.message);
  }
}

async function runTests() {
  await test('asia-southeast1', 'gemini-2.0-flash-lite');
  await test('us-central1', 'gemini-2.0-flash-lite');
  await test('asia-southeast1', 'gemini-3.5-flash-lite');
  await test('us-central1', 'gemini-3.5-flash-lite');
}

runTests();
