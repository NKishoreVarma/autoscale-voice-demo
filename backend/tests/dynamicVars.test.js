import { jest } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { setStore } from '../src/store/index.js';
import { setProvider } from '../src/providers/index.js';
import { createMemoryStore } from '../src/store/memoryStore.js';
import { setTokenVerifier } from '../src/middleware/auth.js';

// Captures the dynamic variables the backend forwards to the provider, so we can
// assert the full "Aria" prompt contract is satisfied.
function capturingProvider(captured) {
  return {
    name: 'mock',
    isTest: true,
    async createPhoneCall({ dynamicVariables }) {
      captured.vars = dynamicVariables;
      return { providerCallId: 'cap_1', status: 'queued', raw: {} };
    },
    verifyWebhook: () => false,
    normalizeEvent: (b) => b,
  };
}

const EXPECTED_KEYS = [
  'business_name',
  'agent_name',
  'call_purpose',
  'business_description',
  'product_details',
  'business_faqs',
  'verified_offers_and_prices',
  'business_contact_details',
  'additional_instructions',
  'customer_name',
];

describe('Aria dynamic-variable contract', () => {
  let app;
  let captured;
  beforeEach(() => {
    captured = {};
    setStore(createMemoryStore());
    setProvider(capturingProvider(captured));
    setTokenVerifier(async (t) => ({ uid: 'u', email: t, email_verified: true }));
    app = createApp();
  });

  test('all prompt variables are injected (empty strings by default)', async () => {
    await request(app)
      .post('/api/voice/calls')
      .set('Authorization', 'Bearer admin@example.com')
      .send({ phone: '+919876543210', consent: { confirmed: true } });
    for (const key of EXPECTED_KEYS) {
      expect(captured.vars).toHaveProperty(key);
      expect(typeof captured.vars[key]).toBe('string'); // never undefined/null
    }
    // Content fields default to empty — the agent must not invent facts.
    expect(captured.vars.product_details).toBe('');
    expect(captured.vars.customer_name).toBe('');
  });

  test('optional customerName flows through, trimmed', async () => {
    await request(app)
      .post('/api/voice/calls')
      .set('Authorization', 'Bearer admin@example.com')
      .send({ phone: '+919876543210', consent: { confirmed: true }, customerName: '  Ravi  ' });
    expect(captured.vars.customer_name).toBe('Ravi');
  });
});
