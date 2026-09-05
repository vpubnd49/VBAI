'use strict';

const dbService = require('./services/db.service');

async function main() {
  const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
  await dbService.updateSystemConfig({ gemini_model: model });
  console.log(`MongoDB system config updated: gemini_model=${model}`);
}

main().catch((error) => {
  console.error('MongoDB config update failed:', error.message);
  process.exitCode = 1;
});
