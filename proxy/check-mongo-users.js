'use strict';

const dbService = require('./services/db.service');

async function main() {
  const users = await dbService.listUsers({}, 1000);
  console.log(`MongoDB users documents: ${users.length}`);
  users.forEach((user) => {
    console.log(`  - ${String(user._id)}: email=${user.email || 'N/A'}, name=${user.displayName || user.name || 'N/A'}, role=${user.role || 'N/A'}`);
  });
}

main().catch((error) => {
  console.error('MongoDB user check failed:', error.message);
  process.exitCode = 1;
});
