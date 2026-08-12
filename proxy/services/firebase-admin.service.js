/**
 * Firebase Admin modular runtime boundary.
 *
 * firebase-admin 14 exposes service clients through modular subpaths. Keep all
 * application initialization and client lookup in this module so callers do
 * not depend on removed namespace-style service accessors.
 */
'use strict';

const {
  applicationDefault,
  cert,
  getApp,
  getApps,
  initializeApp,
} = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const {
  FieldPath,
  FieldValue,
  Timestamp,
  getFirestore,
} = require('firebase-admin/firestore');

let firebaseApp = null;

function parseServiceAccount(rawValue) {
  const raw = String(rawValue || '').trim();
  if (!raw) return null;

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`FIREBASE_SERVICE_ACCOUNT is invalid JSON: ${error.message}`);
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT must contain a JSON object');
  }
  return parsed;
}

function initializeFirebaseApp(options = {}) {
  if (firebaseApp) return firebaseApp;

  const existingApps = getApps();
  if (existingApps.length > 0) {
    firebaseApp = getApp();
    return firebaseApp;
  }

  const projectId = options.projectId
    || process.env.FIREBASE_PROJECT_ID
    || 'gen-lang-client-0462350485';
  const serviceAccount = options.serviceAccount === undefined
    ? parseServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT)
    : options.serviceAccount;
  const credential = serviceAccount ? cert(serviceAccount) : applicationDefault();

  firebaseApp = initializeApp({
    credential,
    projectId,
    ...(serviceAccount ? { databaseURL: `https://${projectId}.firebaseio.com` } : {}),
  });
  return firebaseApp;
}

function initFirebase() {
  return initializeFirebaseApp();
}

function getFirebaseApp() {
  return initFirebase();
}

function getFirebaseAuth() {
  return getAuth(initFirebase());
}

function getFirebaseFirestore() {
  return getFirestore(initFirebase());
}

module.exports = {
  FieldPath,
  FieldValue,
  Timestamp,
  applicationDefault,
  getFirebaseApp,
  getFirebaseAuth,
  getFirebaseFirestore,
  initFirebase,
  initializeFirebaseApp,
  parseServiceAccount,
};
