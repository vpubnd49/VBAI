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
const {
  FieldValue,
  getFirebaseFirestore,
  initializeFirebaseApp,
} = require('../services/firebase-admin.service');

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

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
    : null;
  initializeFirebaseApp({ projectId, serviceAccount });
  const db = getFirebaseFirestore();
  const configRef = db.collection('config').doc('system');

  const snap = await configRef.get();
  if (!snap.exists) {
    console.log('[Firestore Migration] Document config/system does not exist.');
    process.exit(0);
  }

  const data = snap.data() || {};
  console.log('[Current Fields in config/system]:', Object.keys(data));

  const legacyFieldsToRemove = [
    'nine_router_api_key',
    'nine_router_endpoint',
    'nine_router_model',
    'nine_router_models',
    'has_nine_router_key',
  ];

  const PROTECTED_FIELDS = [
    'gemini_api_key',
    'gemini_endpoint',
    'gemini_model',
    'transcribe_model',
    'vertex_project_id',
    'vertex_location',
    'search_engine_id',
    'system_prompt',
  ];

  const beforeSnapshot = {};
  for (const pf of PROTECTED_FIELDS) {
    beforeSnapshot[pf] = data[pf];
  }

  const fieldsToDelete = [];
  for (const field of legacyFieldsToRemove) {
    if (data[field] !== undefined) {
      fieldsToDelete.push(field);
    }
  }

  console.log(`\n[Legacy 9Router Fields to be deleted] (${fieldsToDelete.length}):`, fieldsToDelete);

  const updates = {};
  for (const field of fieldsToDelete) {
    updates[field] = FieldValue.delete();
  }

  // Handle provider transition if active provider was 9router
  if (data.active_provider === '9router') {
    updates.active_provider = 'gemini';
    console.log('[Provider Migration] Active provider set from 9router -> gemini');
  }
  if (data.active_chat_provider === '9router') {
    updates.active_chat_provider = 'gemini';
    console.log('[Provider Migration] Active chat provider set from 9router -> gemini');
  }

  // Protected fields integrity check
  for (const pf of PROTECTED_FIELDS) {
    if (updates[pf] !== undefined) {
      throw new Error(`[CRITICAL SECURITY FAILURE] Migration attempted to mutate protected field: ${pf}`);
    }
    if (beforeSnapshot[pf] !== data[pf]) {
      throw new Error(`[CRITICAL SECURITY FAILURE] Protected field ${pf} mutated during snapshot inspection`);
    }
  }

  if (isDryRun) {
    console.log('\n[DRY-RUN Complete] Verified 0 writes executed to Firestore.');
    console.log('To apply these changes, run with: node proxy/scripts/migrate-remove-9router-config.cjs --apply');
    process.exit(0);
  }

  if (fieldsToDelete.length === 0 && Object.keys(updates).length === 0) {
    console.log('\n[APPLY Complete] Document config/system is already clean. No changes needed.');
    process.exit(0);
  }

  updates.updated_at = FieldValue.serverTimestamp();
  updates.updated_by = 'migration_script_gemini_only_v1';

  await configRef.update(updates);
  console.log('\n[APPLY Complete] Successfully updated config/system in Firestore. Legacy 9Router fields removed.');
}

runMigration().catch((err) => {
  console.error('[Firestore Migration ERROR]:', err);
  process.exit(1);
});
