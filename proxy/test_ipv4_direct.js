const fetch = globalThis.fetch.bind(globalThis);

async function testDirect() {
  const apiKey = process.env.GEMINI_API_KEY || '';
  const endpoint = 'https://generativelanguage.googleapis.com/v1beta/openai';
  const modelName = 'gemini-3.5-flash-lite';
  
  const payload = {
    model: modelName,
    messages: [{ role: 'user', content: 'Xin chào' }],
    stream: false,
    temperature: 0.7,
    max_tokens: 10,
  };

  try {
    console.log('Sending direct request to Gemini...');
    const res = await fetch(`${endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
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
