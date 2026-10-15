import { config, isMockProvider, assertProviderConfigured } from '../config.js';
import { createMockProvider } from './mock.js';
import { createRetellProvider } from './retell.js';
import { createSarvamProvider } from './sarvam.js';

let instance = null;

export function getProvider() {
  if (instance) return instance;
  if (isMockProvider()) {
    instance = createMockProvider();
  } else {
    assertProviderConfigured();
    if (config.provider === 'sarvam') {
      instance = createSarvamProvider(config.sarvam);
    } else {
      instance = createRetellProvider(config.retell);
    }
  }
  return instance;
}

// Test/di helper to override the provider.
export function setProvider(p) {
  instance = p;
}
