const fetch = globalThis.fetch.bind(globalThis);

async function listModels() {
  const apiKey = 'sk-3b33cfc262a93b47-zcgoy4-31172ff9';
  const endpoint = 'https://9router.tools.devgovietnam.io.vn/v1';

  try {
    console.log('Fetching models list from 9Router...');
    const res = await fetch(`${endpoint}/models`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });
    
    console.log('Status:', res.status);
    const data = await res.json();
    console.log('Models:', JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Error:', e);
  }
}

listModels().finally(() => process.exit());
