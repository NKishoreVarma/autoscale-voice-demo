// Public frontend configuration (no secrets). Recreated from the website's
// appConfig pattern but trimmed to only what the demo needs.
export const appConfig = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080',
  firebase: {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
    appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
  },
};

export function isFirebaseConfigured() {
  const f = appConfig.firebase;
  return !!(f.apiKey && f.authDomain && f.projectId);
}
