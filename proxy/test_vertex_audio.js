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

// Generate a tiny valid silent WAV file (1 second, 8kHz, 16-bit mono)
function createSilentWav() {
  const sampleRate = 8000;
  const numSamples = sampleRate;
  const dataSize = numSamples * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  
  return buffer;
}

async function testVertexAudio() {
  try {
    const token = await getGoogleAccessToken();
    console.log('Acquired OAuth Token.');

    const wavBuffer = createSilentWav();
    const base64Data = wavBuffer.toString('base64');

    const projectId = serviceAccount.project_id;
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
        contents: [{
          role: 'user',
          parts: [
            { text: 'Hãy chuyển toàn bộ lời nói trong tệp âm thanh này thành văn bản, nếu không nghe thấy gì hãy trả về chuỗi rỗng.' },
            { inline_data: { mime_type: 'audio/wav', data: base64Data } }
          ]
        }],
        generationConfig: {
          temperature: 0,
        }
      })
    });

    const data = await res.json();
    console.log('Status:', res.status);
    console.log('Response:', JSON.stringify(data));
  } catch (err) {
    console.error('Error:', err);
  }
}

testVertexAudio();
