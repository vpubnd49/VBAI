const fs = require('fs');
const readline = require('readline');

async function findKeys() {
  const fileStream = fs.createReadStream('C:/Users/Admin/.gemini/antigravity-ide/brain/2a036060-725d-4c78-a8ae-38a39a576bf7/.system_generated/logs/transcript.jsonl');
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    if (line.includes('gemini_api_key') || line.includes('google_search_key')) {
      const match = line.match(/(AIzaSy[A-Za-z0-9\-_]+)/g);
      if (match) {
        console.log('Found potential Google API Keys:', match);
      }
    }
  }
}

findKeys();
