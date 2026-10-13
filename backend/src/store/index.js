import { config } from '../config.js';
import { createMemoryStore } from './memoryStore.js';

let instance = null;

export async function getStore() {
  if (instance) return instance;
  if (config.store === 'firestore') {
    const { getFirestoreDb } = await import('../firebaseAdmin.js');
    const { createFirestoreStore } = await import('./firestoreStore.js');
    instance = createFirestoreStore(await getFirestoreDb());
  } else {
    instance = createMemoryStore();
  }
  return instance;
}

// Test/di helper.
export function setStore(s) {
  instance = s;
}
