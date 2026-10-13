import { jest } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { setStore } from '../src/store/index.js';
import { setProvider } from '../src/providers/index.js';
import { createMemoryStore } from '../src/store/memoryStore.js';
import { createMockProvider } from '../src/providers/mock.js';
import { setTokenVerifier } from '../src/middleware/auth.js';

function appWithVerifier(verifier) {
  setStore(createMemoryStore());
  setProvider(createMockProvider());
  setTokenVerifier(verifier);
  return createApp();
}

const VALID = '+919876543210';
const consent = { confirmed: true };

describe('auth error taxonomy (codes)', () => {
  test('missing token → 401 AUTH_MISSING', async () => {
    const app = appWithVerifier(async () => ({}));
    const res = await request(app).get('/api/voice/calls');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('AUTH_MISSING');
  });

  test('invalid token → 401 AUTH_INVALID', async () => {
    const app = appWithVerifier(async () => {
      throw new Error('bad');
    });
    const res = await request(app).get('/api/voice/calls').set('Authorization', 'Bearer x');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('AUTH_INVALID');
  });

  test('unverified email → 403 EMAIL_NOT_VERIFIED (requirement preserved)', async () => {
    const app = appWithVerifier(async () => ({
      uid: 'u',
      email: 'admin@example.com',
      email_verified: false,
    }));
    const res = await request(app)
      .post('/api/voice/calls')
      .set('Authorization', 'Bearer t')
      .send({ phone: VALID, consent });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('EMAIL_NOT_VERIFIED');
  });

  test('verified but not allowlisted → 403 FORBIDDEN_ADMIN', async () => {
    const app = appWithVerifier(async () => ({
      uid: 'u',
      email: 'intruder@example.com',
      email_verified: true,
    }));
    const res = await request(app).get('/api/voice/calls').set('Authorization', 'Bearer t');
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN_ADMIN');
  });

  test('verified + allowlisted → allowed', async () => {
    const app = appWithVerifier(async () => ({
      uid: 'u',
      email: 'admin@example.com',
      email_verified: true,
    }));
    const res = await request(app).get('/api/voice/calls').set('Authorization', 'Bearer t');
    expect(res.status).toBe(200);
  });
});
