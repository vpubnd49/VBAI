const candidateKeys = [
  'AIzaSyBuqo2nl_wreM49nljuwZiCxb-1JzcWFuM', // google_search_key
  'sk-3b33cfc262a93b47-zcgoy4-31172ff9'      // 9router_key
];

async function testKeys() {
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
