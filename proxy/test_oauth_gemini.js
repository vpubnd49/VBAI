const { google } = require('googleapis');
const serviceAccount = require('./service-account.json');

async function getAccessToken() {
  const jwtClient = new google.auth.JWT(
    serviceAccount.client_email,
    null,
    serviceAccount.private_key,
    ['https://www.googleapis.com/auth/cloud-platform']
  );
  const creds = await jwtClient.authorize();
  return creds.access_token;
}

async function testOAuthGemini() {
  try {
    const token = await getAccessToken();
    console.log('OAuth Access Token acquired.');

    // Test calling official Gemini API using OAuth token
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Hello' }] }]
      })
    });
    
    const data = await res.json();
    console.log('Gemini API status:', res.status);
    console.log('Gemini API response:', JSON.stringify(data));
  } catch (err) {
    console.error('Error in OAuth Gemini test:', err);
  }
}

testOAuthGemini();
