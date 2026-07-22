const fs = require('fs');

const nineRouterKey = 'sk-3b33cfc262a93b47-zcgoy4-31172ff9';
const nineRouterEndpoint = 'https://9router.tools.devgovietnam.io.vn/v1';

async function testTranscription() {
  console.log('Testing 9Router transcription...');
  
  // Create a tiny dummy file to test
  const dummyBuffer = Buffer.from('RIFF....WAVEfmt ....data....');
  const formData = new FormData();
  const blob = new Blob([dummyBuffer], { type: 'audio/wav' });
  formData.append('file', blob, 'test.wav');
  formData.append('model', 'whisper-1');

  try {
    const res = await fetch(`${nineRouterEndpoint}/audio/transcriptions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${nineRouterKey}`
      },
      body: formData
    });
    
    const text = await res.text();
    console.log(`Response status: ${res.status}`);
    console.log(`Response body: ${text}`);
  } catch (err) {
    console.error('Error during 9Router transcription test:', err);
  }
}

testTranscription();
