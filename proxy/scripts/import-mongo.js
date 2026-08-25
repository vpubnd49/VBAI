const fs = require('fs');
const path = require('path');
const dbService = require('../services/db.service');

async function runImport() {
  console.log('=== BAT DAU IMPORT DU LIEU VAO MONGODB ===');
  const backupDir = path.join(__dirname, '../../backup_database');

  const authFile = path.join(backupDir, 'firebase_auth_users.json');
  const firestoreFile = path.join(backupDir, 'firestore_collections.json');

  if (!fs.existsSync(authFile) || !fs.existsSync(firestoreFile)) {
    console.error('Khong tim thay tep backup trong:', backupDir);
    process.exit(1);
  }

  const authUsers = JSON.parse(fs.readFileSync(authFile, 'utf8'));
  const firestoreData = JSON.parse(fs.readFileSync(firestoreFile, 'utf8'));

  const db = await dbService.getDb();

  // Drop existing indexes to rebuild cleanly
  try {
    await db.collection('users').dropIndexes();
  } catch (_) {}

  // 1. Import Users
  console.log(`1. Dang import ${authUsers.length} Users...`);
  const firestoreUsersMap = new Map();
  if (Array.isArray(firestoreData.users)) {
    firestoreData.users.forEach(u => firestoreUsersMap.set(u._id, u));
  }

  let userCount = 0;
  for (const u of authUsers) {
    const fsProfile = firestoreUsersMap.get(u.uid) || {};
    const isAdmin = u.isAdmin || u.customClaims?.admin === true || fsProfile.role === 'admin';
    const email = u.email ? u.email.trim().toLowerCase() : (fsProfile.email ? fsProfile.email.trim().toLowerCase() : `${u.uid}@local.vbai`);
    
    const userDoc = {
      _id: u.uid,
      uid: u.uid,
      email: email,
      displayName: u.displayName || fsProfile.displayName || fsProfile.name || (email ? email.split('@')[0] : 'Nguoi dung'),
      photoURL: u.photoURL || null,
      role: isAdmin ? 'admin' : (fsProfile.role || 'user'),
      isAdmin: isAdmin,
      disabled: u.disabled || false,
      created_at: u.creationTime ? new Date(u.creationTime) : new Date(),
      last_login_at: u.lastSignInTime ? new Date(u.lastSignInTime) : null,
      updated_at: new Date()
    };
    await db.collection('users').updateOne(
      { _id: userDoc._id },
      { $set: userDoc },
      { upsert: true }
    );
    userCount++;
  }

  await db.collection('users').createIndex({ email: 1 }, { unique: true });
  await db.collection('users').createIndex({ uid: 1 }, { unique: true });
  console.log(`-> Da import thanh cong ${userCount} users vao MongoDB.`);

  // 2. Import System Config
  console.log('2. Dang import System Config...');
  if (Array.isArray(firestoreData.config)) {
    for (const c of firestoreData.config) {
      await db.collection('config').updateOne(
        { _id: c._id },
        { $set: c },
        { upsert: true }
      );
      console.log(`-> Da import config document: ${c._id}`);
    }
  }

  // 3. Import Search Logs
  console.log('3. Dang import Search Logs...');
  if (Array.isArray(firestoreData.search_logs)) {
    for (const log of firestoreData.search_logs) {
      const doc = {
        ...log,
        timestamp: log.timestamp ? new Date(log.timestamp) : new Date()
      };
      await db.collection('search_logs').updateOne(
        { _id: doc._id },
        { $set: doc },
        { upsert: true }
      );
    }
    console.log(`-> Da import ${firestoreData.search_logs.length} search logs.`);
  }

  // 4. Import Stats
  console.log('4. Dang import Stats...');
  if (Array.isArray(firestoreData.stats)) {
    for (const s of firestoreData.stats) {
      await db.collection('stats').updateOne(
        { _id: s._id },
        { $set: s },
        { upsert: true }
      );
    }
    console.log(`-> Da import ${firestoreData.stats.length} stats documents.`);
  }

  console.log('==================================================');
  console.log('🎉 DA IMPORT HOAN TAT TOAN BO DU LIEU VAO MONGODB!');
  console.log('==================================================');
}

runImport().catch(console.error).finally(() => process.exit());
