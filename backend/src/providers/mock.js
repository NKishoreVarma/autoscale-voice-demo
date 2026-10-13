// Mock voice provider. Default when VOICE_PROVIDER !== 'retell'.
// Produces clearly-labeled TEST calls. NEVER places a real phone call.
// Every record created through this provider is marked isTest: true so the
// dashboard can visibly distinguish test data from real provider calls.
import { randomUUID } from 'node:crypto';
import { createHmac, timingSafeEqual } from 'node:crypto';

export function createMockProvider() {
  // A shared secret used only to sign simulated webhooks in local testing.
  const secret = 'mock-webhook-secret';

  return {
    name: 'mock',
    isTest: true,

    // Mirrors the shape of a real create-phone-call response. The optional
    // testScenario lets the demo exercise create-time failure paths.
    async createPhoneCall({ toNumber, testScenario }) {
      if (testScenario === 'timeout') {
        const e = new Error('Simulated provider timeout');
        e.name = 'AbortError';
        throw e;
      }
      if (testScenario === 'reject') {
        const e = new Error('Simulated provider rejection');
        e.code = 'PROVIDER_REJECTED';
        e.providerMessage = 'Simulated rejection (test scenario)';
        throw e;
      }
      return {
        providerCallId: `mock_${randomUUID()}`,
        status: 'queued',
        // Mock never dials; it simply acknowledges acceptance.
        raw: { note: 'MOCK provider — no real call placed', toAccepted: !!toNumber },
      };
    },

    // Signs a payload the same way verifyWebhook checks it (for local/testing).
    signWebhook(rawBody) {
      return createHmac('sha256', secret).update(rawBody).digest('hex');
    },

    verifyWebhook({ rawBody, signature }) {
      if (!signature) return false;
      const expected = this.signWebhook(rawBody);
      try {
        const a = Buffer.from(signature);
        const b = Buffer.from(expected);
        return a.length === b.length && timingSafeEqual(a, b);
      } catch {
        return false;
      }
    },

    // Normalizes a provider event into our internal shape.
    normalizeEvent(body) {
      // Mock events mimic Retell's { event, call: {...} } structure.
      const call = body.call || {};
      return {
        // Per-event-type id so distinct lifecycle events aren't wrongly deduped,
        // while a genuine duplicate delivery of the same event is idempotent.
        eventId: body.eventId || `${call.call_id}:${body.event}`,
        providerCallId: call.call_id,
        type: body.event, // call_started | call_ended | call_analyzed
        status: call.call_status,
        timestamps: {
          startedAt: call.start_timestamp,
          endedAt: call.end_timestamp,
        },
        durationSec: call.duration_ms ? Math.round(call.duration_ms / 1000) : undefined,
        transcript: call.transcript,
        summary: call.call_analysis?.call_summary,
        cost: call.call_cost
          ? { amountUsd: (call.call_cost.combined_cost || 0) / 100, source: 'provider' }
          : undefined,
        disconnectReason: call.disconnection_reason,
      };
    },
  };
}
