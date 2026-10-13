import { jest } from '@jest/globals';
import request from 'supertest';
import { freshApp, ADMIN, bearer } from './helpers.js';

const VALID = '+919876543210';
const consent = { confirmed: true };

async function createCall(app) {
  const res = await request(app)
    .post('/api/voice/calls')
    .set(bearer(ADMIN))
    .send({ phone: VALID, consent });
  return res.body.call; // has providerCallId mock_...
}

function postWebhook(app, provider, payload) {
  const raw = JSON.stringify(payload);
  return request(app)
    .post('/api/webhooks/retell')
    .set('x-retell-signature', provider.signWebhook(raw))
    .set('content-type', 'application/json')
    .send(raw);
}

describe('webhook signature verification', () => {
  test('rejects invalid signature with 401', async () => {
    const { app } = freshApp();
    const res = await request(app)
      .post('/api/webhooks/retell')
      .set('x-retell-signature', 'deadbeef')
      .set('content-type', 'application/json')
      .send(JSON.stringify({ event: 'call_started', call: { call_id: 'x' } }));
    expect(res.status).toBe(401);
  });

  test('rejects when signature header missing', async () => {
    const { app } = freshApp();
    const res = await request(app)
      .post('/api/webhooks/retell')
      .set('content-type', 'application/json')
      .send(JSON.stringify({ event: 'call_started', call: { call_id: 'x' } }));
    expect(res.status).toBe(401);
  });
});

describe('webhook processing', () => {
  test('associates event with correct call and advances status', async () => {
    const { app, provider, store } = freshApp();
    const call = await createCall(app);
    const res = await postWebhook(app, provider, {
      event: 'call_started',
      call: { call_id: call.providerCallId, call_status: 'ongoing' },
    });
    expect(res.status).toBe(200);
    const rec = await store.getCall(call.id);
    expect(rec.status).toBe('in_progress');
  });

  test('duplicate delivery is idempotent', async () => {
    const { app, provider } = freshApp();
    const call = await createCall(app);
    const payload = {
      event: 'call_ended',
      call: { call_id: call.providerCallId, call_status: 'ended', duration_ms: 42000 },
    };
    const a = await postWebhook(app, provider, payload);
    const b = await postWebhook(app, provider, payload);
    expect(a.status).toBe(200);
    expect(b.body.deduped).toBe(true);
  });

  test('out-of-order events do not regress a terminal status', async () => {
    const { app, provider, store } = freshApp();
    const call = await createCall(app);
    // Ended arrives first
    await postWebhook(app, provider, {
      event: 'call_ended',
      call: { call_id: call.providerCallId, call_status: 'ended', duration_ms: 30000 },
    });
    // A late "started" arrives afterwards
    await postWebhook(app, provider, {
      event: 'call_started',
      call: { call_id: call.providerCallId, call_status: 'ongoing' },
    });
    const rec = await store.getCall(call.id);
    expect(rec.status).toBe('completed'); // not downgraded to in_progress
  });

  test('persists transcript and summary', async () => {
    const { app, provider } = freshApp();
    const call = await createCall(app);
    await postWebhook(app, provider, {
      event: 'call_analyzed',
      call: {
        call_id: call.providerCallId,
        call_status: 'ended',
        transcript: 'Agent: Hello. User: Hi.',
        call_analysis: { call_summary: 'Friendly demo chat.' },
      },
    });
    const detail = await request(app).get(`/api/voice/calls/${call.id}`).set(bearer(ADMIN));
    expect(detail.body.call.transcriptAvailable).toBe(true);
    expect(detail.body.call.transcript).toContain('Hello');
    expect(detail.body.call.summary).toBe('Friendly demo chat.');
  });

  test('cost: missing provider cost stays null; present cost is provider-sourced', async () => {
    const { app, provider, store } = freshApp();
    const call = await createCall(app);
    // Event with no cost
    await postWebhook(app, provider, {
      event: 'call_ended',
      call: { call_id: call.providerCallId, call_status: 'ended' },
    });
    let rec = await store.getCall(call.id);
    expect(rec.cost).toBeNull();
    // Later analysis event carrying cost (cents)
    await postWebhook(app, provider, {
      event: 'call_analyzed',
      call: { call_id: call.providerCallId, call_status: 'ended', call_cost: { combined_cost: 73 } },
    });
    rec = await store.getCall(call.id);
    expect(rec.cost.source).toBe('provider');
    expect(rec.cost.amountUsd).toBeCloseTo(0.73, 2);
  });

  test('maps failed / no_answer style statuses', async () => {
    const { app, provider, store } = freshApp();
    const call = await createCall(app);
    await postWebhook(app, provider, {
      event: 'call_ended',
      call: { call_id: call.providerCallId, call_status: 'no_answer' },
    });
    const rec = await store.getCall(call.id);
    expect(rec.status).toBe('no_answer');
  });

  test('unknown call id is rejected (not trusted) without creating a record', async () => {
    const { app, provider, store } = freshApp();
    const res = await postWebhook(app, provider, {
      event: 'call_started',
      call: { call_id: 'never_seen', call_status: 'ongoing' },
    });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(false);
    expect(res.body.reason).toBe('unknown_call');
    expect(await store.listCalls({})).toHaveLength(0);
  });
});
