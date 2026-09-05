'use strict';

const dbService = require('./services/db.service');

async function main() {
  const documents = Array.from({ length: 20 }, (_, index) => {
    const number = index + 1;
    return {
      user_id: `mongo-seed-user-${number}`,
      query: `Tra cứu test ${number} - Nghị định ${100 + number}/2024/NĐ-CP`,
      model: 'gemini-3.5-flash-lite',
      timestamp: new Date(Date.now() - number * 3600000),
      seed: 'seed-mongo-logs.js',
    };
  });

  const db = await dbService.getDb();
  const result = await db.collection('search_logs').insertMany(documents);
  console.log(`Inserted ${result.insertedCount} MongoDB search_logs test documents.`);
}

main().catch((error) => {
  console.error('MongoDB log seed failed:', error.message);
  process.exitCode = 1;
});
