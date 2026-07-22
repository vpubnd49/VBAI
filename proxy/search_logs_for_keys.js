const fs = require('fs');
const path = require('path');

const logDir = 'C:/Users/Admin/.gemini/antigravity-ide/brain/2a036060-725d-4c78-a8ae-38a39a576bf7/.system_generated/tasks/';

function searchLogs() {
  if (!fs.existsSync(logDir)) {
    console.log('Log directory does not exist.');
    return;
  }
  const files = fs.readdirSync(logDir);
  for (const file of files) {
    if (file.endsWith('.log')) {
      const p = path.join(logDir, file);
      const content = fs.readFileSync(p, 'utf8');
      const match = content.match(/(AIzaSy[A-Za-z0-9\-_]+)/g);
      if (match) {
        console.log(`Found in log file ${file}:`, match);
      }
      
      const m9 = content.match(/(sk-[A-Za-z0-9\-]+)/g);
      if (m9) {
        console.log(`Found in log file ${file} (sk-):`, m9);
      }
    }
  }
}

searchLogs();
