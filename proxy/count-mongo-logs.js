'use strict';

const dbService = require('./services/db.service');

async function main() {
  const count = await dbService.countSearchLogs();
  const logs = await dbService.getSearchLogs({}, 3);
  console.log(`MongoDB search_logs documents: ${count}`);
  if (logs.length) {
    console.log('First 3 documents:');
    logs.slice(0, 3).forEach((log) => {
      console.log(`  - ${String(log._id)}: user=${log.userEmail || log.user_id || 'N/A'}, query=${String(log.query || '').slice(0, 50)}`);
    });
  }
}

main().catch((error) => {
  console.error('MongoDB log count failed:', error.message);
  process.exitCode = 1;
});
