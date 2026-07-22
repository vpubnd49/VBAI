const fs = require('fs');
const lines = fs.readFileSync('proxy/server.js', 'utf8').split('\n');
lines.forEach((line, idx) => {
  if (line.includes('getGoogleAccessToken') || line.includes('accessToken')) {
    console.log(`${idx + 1}: ${line}`);
  }
});
