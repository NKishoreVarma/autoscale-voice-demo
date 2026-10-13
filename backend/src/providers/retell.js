// Retell AI provider adapter. Integration boundary verified against:
//   - POST https://api.retellai.com/v2/create-phone-call  (from n8n reference workflow
//     and https://docs.retellai.com/api-references/create-phone-call)
//   - Webhook signing via x-retell-signature + API key
//     (https://docs.retellai.com/features/secure-webhook)
//
// This adapter is only activated when VOICE_PROVIDER=retell AND the required env
// vars are present. Without a real key/agent/number, the demo uses the mock provider.
import { createHmac, timingSafeEqual } from 'node:crypto';

export function createRetellProvider(cfg) {
  const { apiKey, baseUrl, agentId, fromNumber, webhookApiKey } = cfg;

  return {
    name: 'retell',
    isTest: false,

    async createPhoneCall({ toNumber, dynamicVariables }) {
      const res = await fetch(`${baseUrl}/v2/create-phone-call`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from_number: fromNumber,
          to_number: toNumber,
          override_agent_id: agentId,
          retell_llm_dynamic_variables: dynamicVariables || {},
        }),
      });

      const text = await res.text();
      let data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        /* non-JSON error body */
      }

      if (!res.ok) {
        const err = new Error(
          `Retell create-phone-call failed (${res.status})`
        );
        err.code = 'PROVIDER_REJECTED';
        err.providerStatus = res.status;
        // Do not leak full payloads; keep a short provider message.
        err.providerMessage = data?.error_message || data?.message || 'Provider error';
        throw err;
      }

      return {
        providerCallId: data.call_id,
        status: data.call_status || 'queued',
        raw: { agent_id: data.agent_id, call_type: data.call_type },
      };
    },

    // Verifies x-retell-signature. Retell computes an HMAC-SHA256 of the raw request
    // body keyed by the API key. We compare in constant time.
    // NOTE: in production prefer the official `retell-sdk` Retell.verify() which
    // tracks any scheme changes; this mirrors the documented HMAC approach.
    verifyWebhook({ rawBody, signature }) {
      if (!signature || !webhookApiKey) return false;
      const expected = createHmac('sha256', webhookApiKey).update(rawBody).digest('hex');
      const provided = String(signature).replace(/^v=|^sha256=/, '');
      try {
        const a = Buffer.from(provided);
        const b = Buffer.from(expected);
        return a.length === b.length && timingSafeEqual(a, b);
      } catch {
        return false;
      }
    },

    // Retell webhook body: { event, call: { call_id, call_status, transcript,
    //   call_analysis: { call_summary }, call_cost: { combined_cost }, ... } }
    normalizeEvent(body) {
      const call = body.call || {};
      return {
        eventId: `${call.call_id}:${body.event}`,
        providerCallId: call.call_id,
        type: body.event,
        status: call.call_status,
        timestamps: {
          startedAt: call.start_timestamp,
          endedAt: call.end_timestamp,
        },
        durationSec: call.duration_ms ? Math.round(call.duration_ms / 1000) : undefined,
        transcript: call.transcript,
        summary: call.call_analysis?.call_summary,
        // Retell reports cost in cents (combined_cost). Mark source as provider.
        cost:
          call.call_cost && typeof call.call_cost.combined_cost === 'number'
            ? { amountUsd: call.call_cost.combined_cost / 100, source: 'provider' }
            : undefined,
        disconnectReason: call.disconnection_reason,
      };
    },
  };
}
