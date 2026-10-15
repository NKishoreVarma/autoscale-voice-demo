// Sarvam Voice Agents provider adapter (outbound).
//
// Request schema verified against the user-provided official "Deploy with code"
// example (2026-10):
//   POST {baseUrl}/api/outbounds/v1/orgs/{orgId}/workspaces/{workspaceId}/outbounds
//   Header: X-API-Key: <key>
//   Body: {
//     app_config: {
//       app_id, app_version, app_type,
//       connection_config: { connection_id, agent_phone_number },
//       agent_variables: { ... },              // keys must match the published agent
//       app_overrides: { initial_bot_message, initial_state_name }   // optional
//     },
//     user_config: { user_phone_number: <destination E.164> },
//     webhook_config: { url, metadata }         // optional; omitted unless configured
//   }
//
// RESPONSE SHAPE is not yet documented to us, so the id/status mapping below is
// DEFENSIVE (tries several likely fields) and preserves a redacted copy of the raw
// response for inspection after the first live call — we do not fabricate a field.
//
// Activated only when VOICE_PROVIDER=sarvam AND required env vars are present
// (see assertProviderConfigured); otherwise the demo stays on the mock provider.

export function createSarvamProvider(cfg) {
  const base = String(cfg.baseUrl).replace(/\/+$/, '');
  const endpoint = `${base}/api/outbounds/v1/orgs/${cfg.orgId}/workspaces/${cfg.workspaceId}/outbounds`;

  return {
    name: 'sarvam',
    isTest: false,

    async createPhoneCall({ toNumber, dynamicVariables }) {
      // agent_variables: only pass what we can map safely. Keys must match the
      // variables the published Aria agent declares (e.g. user_name). We do NOT
      // dump arbitrary business fields here — the agent's prompt/config in Sarvam
      // holds the verified business content.
      const agentVariables = {
        user_name: (dynamicVariables && dynamicVariables.customer_name) || '',
      };

      const appConfig = {
        app_id: cfg.appId,
        app_version: cfg.appVersion,
        app_type: cfg.appType,
        connection_config: {
          connection_id: cfg.connectionId,
          agent_phone_number: cfg.agentPhoneNumber,
        },
        agent_variables: agentVariables,
      };

      // app_overrides is optional — include only non-empty values (no placeholders).
      const overrides = {};
      if (cfg.initialBotMessage) overrides.initial_bot_message = cfg.initialBotMessage;
      if (cfg.initialStateName) overrides.initial_state_name = cfg.initialStateName;
      if (Object.keys(overrides).length) appConfig.app_overrides = overrides;

      const body = {
        app_config: appConfig,
        user_config: { user_phone_number: toNumber },
        // webhook_config intentionally omitted: Sarvam's webhook signature
        // verification is not yet documented to us, so inbound callbacks stay
        // disabled rather than trusting unverified events.
      };

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
      let res;
      try {
        res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-API-Key': cfg.apiKey },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
      } catch (err) {
        // AbortError → surfaced as provider_timeout by callService.
        if (err.name === 'AbortError') throw err;
        const e = new Error('Sarvam request failed');
        e.code = 'PROVIDER_REJECTED';
        e.providerMessage = 'Network error contacting provider';
        throw e;
      } finally {
        clearTimeout(timer);
      }

      const text = await res.text();
      let data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        /* non-JSON body */
      }

      if (!res.ok) {
        const e = new Error(`Sarvam outbound failed (${res.status})`);
        e.code = 'PROVIDER_REJECTED';
        e.providerStatus = res.status;
        e.providerMessage = data?.error?.message || data?.message || data?.detail || 'Provider error';
        throw e;
      }

      // Defensive id/status extraction (response schema not yet confirmed).
      const providerCallId =
        data.outbound_id || data.id || data.call_id || data.outbound?.id || data.data?.id || null;
      const status = data.status || data.outbound?.status || 'initiated';

      return {
        providerCallId,
        // 'initiated' = request accepted by Sarvam; NOT a connected/answered call.
        status,
        raw: { note: 'Sarvam outbound accepted', keys: Object.keys(data || {}) },
      };
    },

    // Webhooks disabled until Sarvam's signature-verification mechanism is documented.
    verifyWebhook() {
      return false;
    },

    normalizeEvent(body) {
      // Placeholder normalizer; not used while webhooks are disabled. Kept for
      // interface parity with the other providers.
      const call = body?.outbound || body || {};
      return {
        eventId: call.id ? `${call.id}:${body?.event || 'event'}` : undefined,
        providerCallId: call.id || call.outbound_id,
        type: body?.event,
        status: call.status,
      };
    },
  };
}
