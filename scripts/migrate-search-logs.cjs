/**
 * Firestore Migration Script (Corrective V2)
 *
 * Migrates search_logs collection to standardize field names.
 * Default mode: DRY-RUN (reads and reports, no writes).
 * Use --apply to execute actual Firestore batch writes.
 *
 * Usage:
 *   node scripts/migrate-search-logs.cjs           # dry-run
 *   node scripts/migrate-search-logs.cjs --apply    # live migration
 */
'use strict';

const path = require('path');

const IS_APPLY = process.argv.includes('--apply');

console.log('=== Firestore Migration: search_logs ===');
console.log(`Mode: ${IS_APPLY ? 'APPLY (live writes)' : 'DRY-RUN (read-only)'}`);
console.log('');

async function run() {
  let admin;
  try {
    admin = require('firebase-admin');
  } catch (err) {
    console.error('firebase-admin not installed. Run npm ci first.');
    process.exit(1);
  }

  // Initialize Firebase Admin
  const saPath = path.join(__dirname, '..', 'proxy', 'service-account.json');
  const fs = require('fs');
  if (!fs.existsSync(saPath)) {
    console.error(`Service account not found at ${saPath}`);
    console.log('Migration cannot proceed without Firebase credentials.');
    process.exit(1);
  }

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(require(saPath)),
    });
  }

  const db = admin.firestore();
  const COLLECTION = 'search_logs';
  const BATCH_SIZE = 500;

  let examined = 0;
  let changed = 0;
  let skipped = 0;
  let failed = 0;

  const snapshot = await db.collection(COLLECTION).get();
  console.log(`Total documents in ${COLLECTION}: ${snapshot.size}`);
  console.log('');

  let batch = IS_APPLY ? db.batch() : null;
  let batchCount = 0;

  for (const doc of snapshot.docs) {
    examined++;
    const data = doc.data();
    const updates = {};
    let needsUpdate = false;

    // Standardize: user_email -> only keep user_id
    if (data.user_email && !data.user_id) {
      // Old docs had user_email but no user_id
      skipped++;
      continue; // Cannot migrate without UID
    }

    // Standardize: ensure created_at exists
    if (!data.created_at && data.timestamp) {
      updates.created_at = data.timestamp;
      needsUpdate = true;
    }

    // Remove deprecated fields
    const deprecatedFields = ['ip_address', 'raw_provider_response', 'userEmail'];
    for (const field of deprecatedFields) {
      if (data[field] !== undefined) {
        updates[field] = admin.firestore.FieldValue.delete();
        needsUpdate = true;
      }
    }

    if (!needsUpdate) {
      skipped++;
      continue;
    }

    changed++;
    if (IS_APPLY) {
      batch.update(doc.ref, updates);
      batchCount++;

      if (batchCount >= BATCH_SIZE) {
        try {
          await batch.commit();
          console.log(`  Committed batch of ${batchCount} updates`);
        } catch (err) {
          console.error(`  Batch commit failed: ${err.message}`);
          failed += batchCount;
        }
        batch = db.batch();
        batchCount = 0;
      }
    } else {
      console.log(`  [DRY-RUN] Would update ${doc.id}: ${JSON.stringify(updates)}`);
    }
  }

  // Commit remaining
  if (IS_APPLY && batchCount > 0) {
    try {
      await batch.commit();
      console.log(`  Committed final batch of ${batchCount} updates`);
    } catch (err) {
      console.error(`  Final batch commit failed: ${err.message}`);
      failed += batchCount;
    }
  }

  console.log('');
  console.log('=== Migration Summary ===');
  console.log(`Examined: ${examined}`);
  console.log(`Changed:  ${changed}`);
  console.log(`Skipped:  ${skipped}`);
  console.log(`Failed:   ${failed}`);
  console.log(`Mode:     ${IS_APPLY ? 'APPLIED' : 'DRY-RUN'}`);

  if (!IS_APPLY && changed > 0) {
    console.log('\nRe-run with --apply to execute these changes.');
  }

  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
