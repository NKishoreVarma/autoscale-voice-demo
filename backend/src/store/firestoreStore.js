// Firestore-backed call store, accessed via the Firebase Admin SDK (server-side only).
// Call records contain PII (recipient number, transcript) and are therefore NEVER
// exposed to the client directly — all reads go through the authenticated backend.
// The companion firestore.rules denies all direct client access to these collections.
import { randomUUID } from 'node:crypto';

const CALLS = 'voiceDemo_calls';
const AUDIT = 'voiceDemo_audit';
const EVENTS = 'voiceDemo_webhookEvents';

function startOfTodayUTC() {
  const d = new Date();
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function createFirestoreStore(db) {
  return {
    kind: 'firestore',

    async createCall(record) {
      const id = record.id || randomUUID();
      const now = Date.now();
      const full = { id, createdAt: now, updatedAt: now, ...record };
      await db.collection(CALLS).doc(id).set(full);
      return full;
    },

    async getCall(id) {
      const snap = await db.collection(CALLS).doc(id).get();
      return snap.exists ? snap.data() : null;
    },

    async findByIdempotencyKey(key) {
      if (!key) return null;
      const q = await db.collection(CALLS).where('idempotencyKey', '==', key).limit(1).get();
      return q.empty ? null : q.docs[0].data();
    },

    async findByProviderCallId(providerCallId) {
      if (!providerCallId) return null;
      const q = await db
        .collection(CALLS)
        .where('providerCallId', '==', providerCallId)
        .limit(1)
        .get();
      return q.empty ? null : q.docs[0].data();
    },

    async updateCall(id, patch) {
      const ref = db.collection(CALLS).doc(id);
      const updated = { ...patch, updatedAt: Date.now() };
      await ref.set(updated, { merge: true });
      const snap = await ref.get();
      return snap.exists ? snap.data() : null;
    },

    async listCalls({ limit = 100, includeTest = true } = {}) {
      let ref = db.collection(CALLS).orderBy('createdAt', 'desc').limit(limit);
      const q = await ref.get();
      let rows = q.docs.map((d) => d.data());
      if (!includeTest) rows = rows.filter((c) => !c.isTest);
      return rows;
    },

    async countCallsToday() {
      const q = await db.collection(CALLS).where('createdAt', '>=', startOfTodayUTC()).get();
      return q.size;
    },

    async countInFlight() {
      const active = ['queued', 'initiated', 'ringing', 'in_progress'];
      const q = await db.collection(CALLS).where('status', 'in', active).get();
      return q.size;
    },

    async sumSpendTodayUsd() {
      const q = await db.collection(CALLS).where('createdAt', '>=', startOfTodayUTC()).get();
      return q.docs.reduce((s, d) => s + (d.data().cost?.amountUsd || 0), 0);
    },

    async recordAudit(entry) {
      const id = randomUUID();
      await db.collection(AUDIT).doc(id).set({ id, ts: Date.now(), ...entry });
    },

    async listAudit({ limit = 200 } = {}) {
      const q = await db.collection(AUDIT).orderBy('ts', 'desc').limit(limit).get();
      return q.docs.map((d) => d.data());
    },

    async wasEventProcessed(eventId) {
      const snap = await db.collection(EVENTS).doc(eventId).get();
      return snap.exists;
    },
    async markEventProcessed(eventId) {
      await db.collection(EVENTS).doc(eventId).set({ ts: Date.now() });
    },

    async deleteExpired(cutoffMs) {
      const q = await db.collection(CALLS).where('createdAt', '<', cutoffMs).get();
      let removed = 0;
      const batch = db.batch();
      q.docs.forEach((d) => {
        batch.delete(d.ref);
        removed++;
      });
      if (removed) await batch.commit();
      return removed;
    },
  };
}
