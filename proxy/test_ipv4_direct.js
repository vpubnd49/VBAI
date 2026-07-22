const fetch = globalThis.fetch.bind(globalThis);

async function testDirect() {
  const apiKey = 'sk-3b33cfc262a93b47-zcgoy4-31172ff9';
  
  // Replace hostname with Cloudflare IPv4 address, set Host header
  const endpoint = 'https://172.67.181.158/v1';
  const modelName = 'DevGOVietnam-Elite';
  
  const payload = {
    model: modelName,
    messages: [{ role: 'user', content: 'Xin chào' }],
    stream: false,
    temperature: 0.7,
    max_tokens: 10,
  };

  try {
    console.log('Sending direct request to 172.67.181.158...');
    const res = await fetch(`${endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Host': '9router.tools.devgovietnam.io.vn',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });
    
    console.log('Status:', res.status);
    const text = await res.text();
    console.log('Response:', text);
  } catch (e) {
    console.error('Error:', e);
  }
}

testDirect().finally(() => process.exit());
