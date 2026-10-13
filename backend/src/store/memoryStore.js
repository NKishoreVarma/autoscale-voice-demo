// In-memory call store. Default store — lets the demo run and tests execute with
// NO external credentials. Not for production persistence (process-local only).
import { randomUUID } from 'node:crypto';

function startOfTodayUTC() {
  const d = new Date();
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function createMemoryStore() {
  const calls = new Map(); // id -> record
  const audits = []; // audit log entries
  const processedWebhookEvents = new Set(); // idempotency for webhooks

  return {
    kind: 'memory',

    async createCall(record) {
      const id = record.id || randomUUID();
      const now = Date.now();
      const full = {
        id,
        createdAt: now,
        updatedAt: now,
        ...record,
      };
      calls.set(id, full);
      return { ...full };
    },

    async getCall(id) {
      const c = calls.get(id);
      return c ? { ...c } : null;
    },

    async findByIdempotencyKey(key) {
      if (!key) return null;
      for (const c of calls.values()) {
        if (c.idempotencyKey === key) return { ...c };
      }
      return null;
    },

    async findByProviderCallId(providerCallId) {
      if (!providerCallId) return null;
      for (const c of calls.values()) {
        if (c.providerCallId === providerCallId) return { ...c };
      }
      return null;
    },

    async updateCall(id, patch) {
      const c = calls.get(id);
      if (!c) return null;
      const updated = { ...c, ...patch, updatedAt: Date.now() };
      calls.set(id, updated);
      return { ...updated };
    },

    async listCalls({ limit = 100, includeTest = true } = {}) {
      let all = [...calls.values()];
      if (!includeTest) all = all.filter((c) => !c.isTest);
      all.sort((a, b) => b.createdAt - a.createdAt);
      return all.slice(0, limit).map((c) => ({ ...c }));
    },

    async countCallsToday() {
      const start = startOfTodayUTC();
      return [...calls.values()].filter((c) => c.createdAt >= start).length;
    },

    async countInFlight() {
      const active = new Set(['queued', 'initiated', 'ringing', 'in_progress']);
      return [...calls.values()].filter((c) => active.has(c.status)).length;
    },

    async sumSpendTodayUsd() {
      const start = startOfTodayUTC();
      return [...calls.values()]
        .filter((c) => c.createdAt >= start)
        .reduce((sum, c) => sum + (c.cost?.amountUsd || 0), 0);
    },

    async recordAudit(entry) {
      audits.push({ id: randomUUID(), ts: Date.now(), ...entry });
    },

    async listAudit({ limit = 200 } = {}) {
      return audits.slice(-limit).reverse();
    },

    // Webhook idempotency
    async wasEventProcessed(eventId) {
      return processedWebhookEvents.has(eventId);
    },
    async markEventProcessed(eventId) {
      processedWebhookEvents.add(eventId);
    },

    // Retention: delete records older than cutoff; returns count removed.
    async deleteExpired(cutoffMs) {
      let removed = 0;
      for (const [id, c] of calls.entries()) {
        if (c.createdAt < cutoffMs) {
          calls.delete(id);
          removed++;
        }
      }
      return removed;
    },

    // test helper
    _reset() {
      calls.clear();
      audits.length = 0;
      processedWebhookEvents.clear();
    },
  };
}
