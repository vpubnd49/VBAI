/**
 * One-time Firestore Migration Script: Remove 9Router Legacy Configuration Fields.
 * 
 * Usage:
 *   Dry-run mode (default, no changes written):
 *     node proxy/scripts/migrate-remove-9router-config.cjs --dry-run
 * 
 *   Apply changes to Firestore:
 *     node proxy/scripts/migrate-remove-9router-config.cjs --apply
 */
const admin = require('firebase-admin');

async function runMigration() {
  const args = process.argv.slice(2);
  const isApply = args.includes('--apply');
  const isDryRun = !isApply || args.includes('--dry-run');

  console.log(`[Firestore Migration] Starting 9Router Removal Cleanup`);
  console.log(`[Mode]: ${isDryRun ? 'DRY-RUN (Safe mode, no changes will be written)' : 'APPLY (Writing changes to Firestore)'}\n`);

  const projectArg = args.find((a) => a.startsWith('--project='));
  const projectId = projectArg
    ? projectArg.split('=')[1].trim()
    : (process.env.FIREBASE_PROJECT_ID || process.env.GCP_PROJECT || 'gen-lang-client-0462350485');

  console.log(`[Target Project ID]: ${projectId}`);

  if (!admin.apps.length) {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      admin.initializeApp({ credential: admin.credential.cert(sa), projectId });
    } else {
      admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId });
    }
  }

  const db = admin.firestore();
  const configRef = db.collection('config').doc('system');

  const snap = await configRef.get();
  if (!snap.exists) {
    console.log('[Firestore Migration] Document config/system does not exist.');
    process.exit(0);
  }

  const data = snap.data() || {};
  console.log('[Current Fields in config/system]:', Object.keys(data));

  const legacyFieldsToRemove = [
    'active_provider',
    'active_chat_provider',
    'nine_router_api_key',
    'nine_router_endpoint',
    'nine_router_model',
    'nine_router_models',
    'has_nine_router_key',
    'openai_api_key',
    'openai_endpoint',
    'openai_models',
    'router_model',
  ];

  const fieldsToDelete = [];
  for (const field of legacyFieldsToRemove) {
    if (data[field] !== undefined) {
      fieldsToDelete.push(field);
    }
  }

  console.log(`\n[Legacy Fields to be deleted] (${fieldsToDelete.length}):`, fieldsToDelete);

  const updates = {};
  for (const field of fieldsToDelete) {
    updates[field] = admin.firestore.FieldValue.delete();
  }

  // Ensure Gemini fields are valid
  if (!data.gemini_model) {
    updates.gemini_model = 'gemini-3.5-flash-lite';
  }
  if (!data.transcribe_model) {
    updates.transcribe_model = 'gemini-3.5-flash-lite';
  }

  if (isDryRun) {
    console.log('\n[DRY-RUN Complete] No changes were written to Firestore.');
    console.log('To apply these changes, run with: node proxy/scripts/migrate-remove-9router-config.cjs --apply');
    process.exit(0);
  }

  if (fieldsToDelete.length === 0 && Object.keys(updates).length === 0) {
    console.log('\n[APPLY Complete] Document config/system is already clean. No changes needed.');
    process.exit(0);
  }

  updates.updated_at = admin.firestore.FieldValue.serverTimestamp();
  updates.updated_by = 'migration_script_gemini_only_v1';

  await configRef.update(updates);
  console.log('\n[APPLY Complete] Successfully updated config/system in Firestore. Legacy 9Router fields removed.');
}

runMigration().catch((err) => {
  console.error('[Firestore Migration ERROR]:', err);
  process.exit(1);
});
