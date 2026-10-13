import { jest } from '@jest/globals';
import request from 'supertest';
import { freshApp, ADMIN, bearer } from './helpers.js';
import { processWebhook } from '../src/services/webhookService.js';
import { scenarioSteps } from '../src/providers/mockSimulator.js';

const VALID = '+919876543210';
const consent = { confirmed: true };

// The scheduler itself is a no-op under NODE_ENV=test (by design, to avoid open
// handles). Here we verify the SCENARIO EVENT SEQUENCES produce the right final
// state when fed through the real processWebhook pipeline — i.e. exactly what the
// live scheduler will do, but synchronously and deterministically.

async function drive(app, scenario) {
  const created = await request(app)
    .post('/api/voice/calls')
    .set(bearer(ADMIN))
    .send({ phone: VALID, consent, testScenario: scenario });
  const call = created.body.call;
  for (const step of scenarioSteps(call.providerCallId, scenario)) {
    await processWebhook(step.body);
  }
  const detail = await request(app).get(`/api/voice/calls/${call.id}`).set(bearer(ADMIN));
  return detail.body.call;
}

describe('mock lifecycle scenarios (driven through real webhook pipeline)', () => {
  let app;
  beforeEach(() => ({ app } = freshApp()));

  test('completed → status completed with transcript, summary, duration, cost', async () => {
    const c = await drive(app, 'completed');
    expect(c.status).toBe('completed');
    expect(c.transcriptAvailable).toBe(true);
    expect(c.summary).toBeTruthy();
    expect(c.durationSec).toBeGreaterThan(0);
    expect(c.cost.source).toBe('provider');
  });

  test('no_answer → status no_answer, no transcript', async () => {
    const c = await drive(app, 'no_answer');
    expect(c.status).toBe('no_answer');
    expect(c.transcriptAvailable).toBe(false);
  });

  test('failed → status failed with disconnect reason', async () => {
    const c = await drive(app, 'failed');
    expect(c.status).toBe('failed');
    expect(c.disconnectReason).toBe('dial_failed');
  });

  test('no_transcript → completed but transcript absent, cost present', async () => {
    const c = await drive(app, 'no_transcript');
    expect(c.status).toBe('completed');
    expect(c.transcriptAvailable).toBe(false);
    expect(c.summary).toBeTruthy();
    expect(c.cost).not.toBeNull();
  });

  test('no_cost → completed with transcript but cost not reported', async () => {
    const c = await drive(app, 'no_cost');
    expect(c.status).toBe('completed');
    expect(c.transcriptAvailable).toBe(true);
    expect(c.cost).toBeNull();
  });
});

describe('create-time failure scenarios', () => {
  test('timeout scenario → 502 and failed record (provider_timeout)', async () => {
    const { app, store } = freshApp();
    const res = await request(app)
      .post('/api/voice/calls')
      .set(bearer(ADMIN))
      .send({ phone: VALID, consent, testScenario: 'timeout' });
    expect(res.status).toBe(502);
    const [rec] = await store.listCalls({});
    expect(rec.status).toBe('failed');
    expect(rec.error.category).toBe('provider_timeout');
  });

  test('reject scenario → 502 and failed record (provider_rejected)', async () => {
    const { app, store } = freshApp();
    const res = await request(app)
      .post('/api/voice/calls')
      .set(bearer(ADMIN))
      .send({ phone: VALID, consent, testScenario: 'reject' });
    expect(res.status).toBe(502);
    const [rec] = await store.listCalls({});
    expect(rec.error.category).toBe('provider_rejected');
  });
});
