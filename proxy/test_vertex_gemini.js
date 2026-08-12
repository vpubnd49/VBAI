const serviceAccount = require('./service-account.json');
const { initializeFirebaseApp } = require('./services/firebase-admin.service');

const app = initializeFirebaseApp({
  serviceAccount,
  projectId: serviceAccount.project_id,
});

async function getGoogleAccessToken() {
  const credential = app.options?.credential;
  if (!credential || typeof credential.getAccessToken !== 'function') {
    throw new Error('vertex_auth_not_available');
  }
  const token = await credential.getAccessToken();
  return token.access_token;
}

async function testVertexGemini() {
  try {
    const token = await getGoogleAccessToken();
    console.log('Acquired OAuth Token.');

    const projectId = serviceAccount.project_id;
    // Vertex AI Gemini is typically supported in asia-southeast1 (where our Cloud Run runs) or us-central1
    const location = 'asia-southeast1'; 
    const model = 'gemini-3.5-flash-lite';
    
    const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:generateContent`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'Hello, respond with OK' }] }]
      })
    });

    const data = await res.json();
    console.log('Status:', res.status);
    console.log('Response:', JSON.stringify(data));
  } catch (err) {
    console.error('Error:', err);
  }
}

testVertexGemini();
