// Firebase Web SDK init — admin sign-in ONLY. Recreated from the website's
// src/firebase.js but DELIBERATELY WITHOUT the console.log of config/auth that
// the original contained (security). Initializes lazily so the app still loads
// (showing an integration-status notice) when Firebase is not yet configured.
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { appConfig, isFirebaseConfigured } from './config.js';

let auth = null;

export function getFirebaseAuth() {
  if (auth) return auth;
  if (!isFirebaseConfigured()) return null;
  const app = initializeApp({
    apiKey: appConfig.firebase.apiKey,
    authDomain: appConfig.firebase.authDomain,
    projectId: appConfig.firebase.projectId,
    appId: appConfig.firebase.appId,
  });
  auth = getAuth(app);
  return auth;
}
