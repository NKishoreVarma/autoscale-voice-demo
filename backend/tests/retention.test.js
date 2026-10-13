import { jest } from '@jest/globals';
import { freshApp } from './helpers.js';
import { runRetention } from '../src/scripts/retention.js';

describe('data retention / deletion', () => {
  test('deletes records older than retention window, keeps recent ones', async () => {
    const { store } = freshApp();
    const old = await store.createCall({ status: 'completed', isTest: true });
    const recent = await store.createCall({ status: 'completed', isTest: true });

    // Age the first record beyond 30 days.
    const days31 = Date.now() - 31 * 24 * 60 * 60 * 1000;
    await store.updateCall(old.id, {});
    // memory store uses createdAt; set it directly via re-create pattern:
    const rec = await store.getCall(old.id);
    rec.createdAt = days31;
    await store.updateCall(old.id, { createdAt: days31 });

    const removed = await runRetention();
    expect(removed).toBe(1);
    expect(await store.getCall(old.id)).toBeNull();
    expect(await store.getCall(recent.id)).not.toBeNull();
  });
});
