// Firebase Admin SDK initialization (server-side only). Lazily initialized so the
// demo runs in 'memory' store + 'mock' provider mode with NO credentials.
import { config } from './config.js';

let app = null;
let adminMod = null;

async function loadAdmin() {
  if (!adminMod) {
    adminMod = await import('firebase-admin');
    adminMod = adminMod.default || adminMod;
  }
  return adminMod;
}

export async function getAdminApp() {
  if (app) return app;
  const admin = await loadAdmin();
  const opts = {};
  if (config.firebase.serviceAccountPath) {
    const { readFile } = await import('node:fs/promises');
    const json = JSON.parse(await readFile(config.firebase.serviceAccountPath, 'utf8'));
    opts.credential = admin.credential.cert(json);
  } else {
    // Falls back to GOOGLE_APPLICATION_CREDENTIALS / ADC.
    opts.credential = admin.credential.applicationDefault();
  }
  if (config.firebase.projectId) opts.projectId = config.firebase.projectId;
  app = admin.initializeApp(opts);
  return app;
}

// Verifies a Firebase ID token and returns the decoded token (with email).
export async function verifyIdToken(idToken) {
  const admin = await loadAdmin();
  await getAdminApp();
  return admin.auth().verifyIdToken(idToken);
}

export async function getFirestoreDb() {
  const admin = await loadAdmin();
  await getAdminApp();
  return admin.firestore();
}
