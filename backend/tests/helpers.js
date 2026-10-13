import { createApp } from '../src/app.js';
import { setStore } from '../src/store/index.js';
import { setProvider, getProvider } from '../src/providers/index.js';
import { createMemoryStore } from '../src/store/memoryStore.js';
import { createMockProvider } from '../src/providers/mock.js';
import { setTokenVerifier } from '../src/middleware/auth.js';

export function freshApp() {
  const store = createMemoryStore();
  setStore(store);
  setProvider(createMockProvider());
  // Fake Firebase token verifier: token string IS the email, verified.
  setTokenVerifier(async (token) => {
    if (token === 'BAD') throw new Error('invalid');
    return { uid: `uid_${token}`, email: token, email_verified: true };
  });
  return { app: createApp(), store, provider: getProvider() };
}

export const ADMIN = 'admin@example.com';
export const NON_ADMIN = 'intruder@example.com';

export function bearer(token) {
  return { Authorization: `Bearer ${token}` };
}

// Build a signed mock webhook request body + signature header.
export function signedWebhook(provider, payload) {
  const raw = JSON.stringify(payload);
  return { raw, signature: provider.signWebhook(raw) };
}
