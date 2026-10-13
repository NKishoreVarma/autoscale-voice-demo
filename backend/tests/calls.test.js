import { jest } from '@jest/globals';
import request from 'supertest';
import { freshApp, ADMIN, NON_ADMIN, bearer } from './helpers.js';
import { setProvider } from '../src/providers/index.js';

const VALID = '+919876543210';
const consent = { confirmed: true, note: 'Recipient agreed on WhatsApp' };

describe('POST /api/voice/calls — auth & authorization', () => {
  let app;
  beforeEach(() => ({ app } = freshApp()));

  test('401 when no bearer token (unauthenticated)', async () => {
    const res = await request(app).post('/api/voice/calls').send({ phone: VALID, consent });
    expect(res.status).toBe(401);
  });

  test('401 when token invalid', async () => {
    const res = await request(app)
      .post('/api/voice/calls')
      .set(bearer('BAD'))
      .send({ phone: VALID, consent });
    expect(res.status).toBe(401);
  });

  test('403 when authenticated but not on admin allowlist', async () => {
    const res = await request(app)
      .post('/api/voice/calls')
      .set(bearer(NON_ADMIN))
      .send({ phone: VALID, consent });
    expect(res.status).toBe(403);
  });
});

describe('POST /api/voice/calls — validation & consent', () => {
  let app;
  beforeEach(() => ({ app } = freshApp()));

  test('422 when consent missing', async () => {
    const res = await request(app)
      .post('/api/voice/calls')
      .set(bearer(ADMIN))
      .send({ phone: VALID });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('CONSENT_REQUIRED');
  });

  test('422 when phone invalid', async () => {
    const res = await request(app)
      .post('/api/voice/calls')
      .set(bearer(ADMIN))
      .send({ phone: '12345', consent });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('INVALID_PHONE');
  });
});

describe('POST /api/voice/calls — success & idempotency', () => {
  let app;
  beforeEach(() => ({ app } = freshApp()));

  test('201 creates a call, marked isTest with redacted destination', async () => {
    const res = await request(app)
      .post('/api/voice/calls')
      .set(bearer(ADMIN))
      .send({ phone: VALID, consent });
    expect(res.status).toBe(201);
    expect(res.body.call.isTest).toBe(true);
    expect(res.body.call.destination).toMatch(/\*/); // redacted
    expect(res.body.call.destination).not.toContain('9876543210');
    expect(res.body.call.providerCallId).toMatch(/^mock_/);
    expect(res.body.call.status).toBe('queued');
  });

  test('duplicate submission with same idempotencyKey does not place a second call', async () => {
    const key = 'idem-123';
    const first = await request(app)
      .post('/api/voice/calls')
      .set(bearer(ADMIN))
      .send({ phone: VALID, consent, idempotencyKey: key });
    const second = await request(app)
      .post('/api/voice/calls')
      .set(bearer(ADMIN))
      .send({ phone: VALID, consent, idempotencyKey: key });
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body.deduped).toBe(true);
    expect(second.body.call.id).toBe(first.body.call.id);
  });
});

describe('POST /api/voice/calls — provider failures recorded honestly', () => {
  test('provider rejection → 502, record marked failed (not falsely successful)', async () => {
    const { app, store } = freshApp();
    setProvider({
      name: 'retell',
      isTest: false,
      async createPhoneCall() {
        const e = new Error('rejected');
        e.code = 'PROVIDER_REJECTED';
        throw e;
      },
      verifyWebhook: () => false,
      normalizeEvent: (b) => b,
    });
    const res = await request(app)
      .post('/api/voice/calls')
      .set(bearer(ADMIN))
      .send({ phone: VALID, consent });
    expect(res.status).toBe(502);
    const all = await store.listCalls({});
    expect(all).toHaveLength(1);
    expect(all[0].status).toBe('failed');
    expect(all[0].error.category).toBe('provider_rejected');
    expect(all[0].providerCallId).toBeNull();
  });

  test('provider timeout → 502, category provider_timeout', async () => {
    const { app, store } = freshApp();
    setProvider({
      name: 'retell',
      isTest: false,
      async createPhoneCall() {
        const e = new Error('timeout');
        e.name = 'AbortError';
        throw e;
      },
      verifyWebhook: () => false,
      normalizeEvent: (b) => b,
    });
    const res = await request(app)
      .post('/api/voice/calls')
      .set(bearer(ADMIN))
      .send({ phone: VALID, consent });
    expect(res.status).toBe(502);
    const all = await store.listCalls({});
    expect(all[0].error.category).toBe('provider_timeout');
  });
});

describe('limits & spend controls', () => {
  test('daily call limit returns 429', async () => {
    const { app, store } = freshApp();
    // Pre-seed store at the daily limit (25).
    for (let i = 0; i < 25; i++) {
      await store.createCall({ status: 'completed', isTest: true });
    }
    const res = await request(app)
      .post('/api/voice/calls')
      .set(bearer(ADMIN))
      .send({ phone: VALID, consent });
    expect(res.status).toBe(429);
    expect(res.body.code).toBe('DAILY_LIMIT');
  });

  test('concurrency limit returns 429', async () => {
    const { app, store } = freshApp();
    await store.createCall({ status: 'in_progress', isTest: true });
    await store.createCall({ status: 'ringing', isTest: true });
    const res = await request(app)
      .post('/api/voice/calls')
      .set(bearer(ADMIN))
      .send({ phone: VALID, consent });
    expect(res.status).toBe(429);
    expect(res.body.code).toBe('CONCURRENCY_LIMIT');
  });

  test('daily spend threshold returns 429', async () => {
    const { app, store } = freshApp();
    // Seed near the $10 cap so the next estimate (0.12*5=0.6) exceeds it.
    await store.createCall({ status: 'completed', isTest: true, cost: { amountUsd: 9.8, source: 'provider' } });
    const res = await request(app)
      .post('/api/voice/calls')
      .set(bearer(ADMIN))
      .send({ phone: VALID, consent });
    expect(res.status).toBe(429);
    expect(res.body.code).toBe('SPEND_LIMIT');
  });
});

describe('record access control', () => {
  test('non-admin cannot read call records (list/detail)', async () => {
    const { app } = freshApp();
    const created = await request(app)
      .post('/api/voice/calls')
      .set(bearer(ADMIN))
      .send({ phone: VALID, consent });
    const id = created.body.call.id;

    const list = await request(app).get('/api/voice/calls').set(bearer(NON_ADMIN));
    const detail = await request(app).get(`/api/voice/calls/${id}`).set(bearer(NON_ADMIN));
    expect(list.status).toBe(403);
    expect(detail.status).toBe(403);
  });

  test('list view never exposes full number or transcript', async () => {
    const { app, store } = freshApp();
    await request(app).post('/api/voice/calls').set(bearer(ADMIN)).send({ phone: VALID, consent });
    // inject a transcript directly
    const [rec] = await store.listCalls({});
    await store.updateCall(rec.id, { transcript: { available: true, data: 'secret transcript' } });

    const list = await request(app).get('/api/voice/calls').set(bearer(ADMIN));
    expect(list.status).toBe(200);
    const row = list.body.calls[0];
    expect(row.destination).not.toContain('9876543210');
    expect(row.transcript).toBeUndefined(); // not included in list
    expect(row.transcriptAvailable).toBe(true);
  });
});
