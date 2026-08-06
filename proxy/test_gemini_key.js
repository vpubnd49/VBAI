const candidateKeys = [
  process.env.GEMINI_API_KEY || '',
].filter(Boolean);

async function testKeys() {
  if (candidateKeys.length === 0) {
    console.log('No GEMINI_API_KEY provided in environment.');
    return;
  }
  for (const key of candidateKeys) {
    console.log(`Testing key: ${key.slice(0, 10)}...`);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${encodeURIComponent(key)}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Hello' }] }]
        })
      });
      const data = await res.json();
      if (res.ok) {
        console.log(`-> SUCCESS for key! Response:`, JSON.stringify(data.candidates[0].content.parts[0].text));
      } else {
        console.log(`-> FAILED with status ${res.status}:`, JSON.stringify(data.error || data));
      }
    } catch (err) {
      console.log(`-> ERROR:`, err.message);
    }
  }
}

testKeys();
