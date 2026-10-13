// Processes verified provider webhook events. Verification of the signature happens
// in the route BEFORE this runs — we never trust an event just because it carries a
// familiar call ID. Handles idempotency and out-of-order delivery.
import { getStore } from '../store/index.js';
import { getProvider } from '../providers/index.js';
import { logger } from '../lib/logger.js';

// Monotonic ordering so a late 'ringing' can't clobber a terminal 'completed'.
const STATUS_RANK = {
  queued: 0,
  initiated: 1,
  ringing: 2,
  in_progress: 3,
  // terminal states share the top rank
  completed: 10,
  no_answer: 10,
  busy: 10,
  failed: 10,
  canceled: 10,
  unavailable: 10,
};

// Map provider-native statuses/events onto our internal status vocabulary.
function mapStatus(evt) {
  const s = (evt.status || '').toLowerCase();
  if (s === 'ongoing' || s === 'in-progress') return 'in_progress';
  if (s === 'registered' || s === 'queued') return 'initiated';
  if (s === 'ended' || s === 'completed') return 'completed';
  if (s === 'error') return 'failed';
  if (['completed', 'no_answer', 'busy', 'failed', 'canceled', 'unavailable', 'ringing', 'in_progress', 'initiated'].includes(s)) {
    return s;
  }
  // Fall back on the event type.
  if (evt.type === 'call_started') return 'in_progress';
  if (evt.type === 'call_ended' || evt.type === 'call_analyzed') return 'completed';
  return null;
}

export async function processWebhook(body) {
  const store = await getStore();
  const provider = getProvider();

  const evt = provider.normalizeEvent(body);
  if (!evt.providerCallId) {
    return { ok: false, reason: 'missing_call_id' };
  }

  // Idempotency: skip events we've already applied.
  const eventId = evt.eventId || `${evt.providerCallId}:${evt.type}`;
  if (await store.wasEventProcessed(eventId)) {
    return { ok: true, deduped: true };
  }

  // Associate with the correct internal record by provider call ID.
  const record = await store.findByProviderCallId(evt.providerCallId);
  if (!record) {
    logger.warn('webhook.unknown_call', { providerCallId: evt.providerCallId });
    // Mark processed to avoid reprocessing noise, but do not create a record.
    await store.markEventProcessed(eventId);
    return { ok: false, reason: 'unknown_call' };
  }

  const patch = {};
  const newStatus = mapStatus(evt);

  // Out-of-order safety: only advance status forward.
  if (newStatus) {
    const curRank = STATUS_RANK[record.status] ?? 0;
    const newRank = STATUS_RANK[newStatus] ?? 0;
    if (newRank >= curRank) patch.status = newStatus;
  }

  // Timestamps — set once, never regress.
  const ts = { ...(record.timestamps || {}) };
  if (evt.timestamps?.startedAt && !ts.connectedAt) ts.connectedAt = evt.timestamps.startedAt;
  if (evt.timestamps?.endedAt && !ts.completedAt) ts.completedAt = evt.timestamps.endedAt;
  patch.timestamps = ts;

  if (typeof evt.durationSec === 'number') patch.durationSec = evt.durationSec;

  if (evt.transcript) {
    patch.transcript = { available: true, data: evt.transcript };
  }
  if (evt.summary) patch.summary = evt.summary;
  if (evt.disconnectReason) {
    patch.error = record.error && record.error.category
      ? record.error
      : null;
    patch.disconnectReason = evt.disconnectReason;
  }

  // Cost — only store provider-reported amounts here, clearly sourced.
  if (evt.cost && typeof evt.cost.amountUsd === 'number') {
    patch.cost = { amountUsd: evt.cost.amountUsd, source: 'provider' };
  }

  const updated = await store.updateCall(record.id, patch);
  await store.markEventProcessed(eventId);
  await store.recordAudit({
    action: 'webhook.processed',
    callId: record.id,
    type: evt.type,
    status: patch.status || record.status,
  });

  logger.info('webhook.processed', {
    callId: record.id,
    type: evt.type,
    status: updated?.status,
  });
  return { ok: true, record: updated };
}
