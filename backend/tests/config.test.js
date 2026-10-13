import { jest } from '@jest/globals';
import { config, assertProviderConfigured } from '../src/config.js';

describe('provider configuration validation', () => {
  test('retell provider without credentials throws PROVIDER_NOT_CONFIGURED', () => {
    const saved = { ...config.retell, provider: config.provider };
    config.provider = 'retell';
    config.retell.apiKey = '';
    config.retell.agentId = '';
    config.retell.fromNumber = '';
    try {
      expect(() => assertProviderConfigured()).toThrow(/missing/i);
      try {
        assertProviderConfigured();
      } catch (e) {
        expect(e.code).toBe('PROVIDER_NOT_CONFIGURED');
      }
    } finally {
      config.provider = saved.provider;
      config.retell.apiKey = saved.apiKey;
      config.retell.agentId = saved.agentId;
      config.retell.fromNumber = saved.fromNumber;
    }
  });

  test('mock provider requires no credentials', () => {
    const saved = config.provider;
    config.provider = 'mock';
    expect(() => assertProviderConfigured()).not.toThrow();
    config.provider = saved;
  });
});
