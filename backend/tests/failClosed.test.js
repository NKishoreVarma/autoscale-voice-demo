import { jest } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { config } from '../src/config.js';
import { setStore } from '../src/store/index.js';
import { setProvider } from '../src/providers/index.js';
import { createMemoryStore } from '../src/store/memoryStore.js';
import { setTokenVerifier } from '../src/middleware/auth.js';

// Verifies LIVE mode fails closed when credentials are missing — no crash, no
// silent fallback to mock, no call placed.
describe('LIVE mode fails closed without credentials', () => {
  test('returns 503 PROVIDER_NOT_CONFIGURED and places no call', async () => {
    const saved = {
      provider: config.provider,
      apiKey: config.retell.apiKey,
      agentId: config.retell.agentId,
      fromNumber: config.retell.fromNumber,
    };
    const store = createMemoryStore();
    setStore(store);
    setProvider(null); // force re-evaluation from config
    setTokenVerifier(async (t) => ({ uid: 'u', email: t, email_verified: true }));

    config.provider = 'retell';
    config.retell.apiKey = '';
    config.retell.agentId = '';
    config.retell.fromNumber = '';

    try {
      const res = await request(createApp())
        .post('/api/voice/calls')
        .set('Authorization', 'Bearer admin@example.com')
        .send({ phone: '+919876543210', consent: { confirmed: true } });
      expect(res.status).toBe(503);
      expect(res.body.code).toBe('PROVIDER_NOT_CONFIGURED');
      expect(await store.listCalls({})).toHaveLength(0);
    } finally {
      config.provider = saved.provider;
      config.retell.apiKey = saved.apiKey;
      config.retell.agentId = saved.agentId;
      config.retell.fromNumber = saved.fromNumber;
      setProvider(null);
    }
  });
});
