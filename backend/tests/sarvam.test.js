import { jest } from '@jest/globals';
import { createSarvamProvider } from '../src/providers/sarvam.js';

const cfg = {
  apiKey: 'test-key-DO-NOT-USE',
  baseUrl: 'https://apps.sarvam.ai',
  orgId: 'org-1',
  workspaceId: 'ws-1',
  appId: 'autoscale-test',
  appVersion: 1,
  appType: 'agent',
  connectionId: 'conn-1',
  agentPhoneNumber: '+917965480920',
  initialBotMessage: '',
  initialStateName: '',
  timeoutMs: 1000,
};

function mockFetchOnce(impl) {
  global.fetch = jest.fn(impl);
}

afterEach(() => {
  delete global.fetch;
});

describe('Sarvam adapter — request construction', () => {
  test('posts to the correct endpoint with X-API-Key and exact body nesting', async () => {
    let captured;
    mockFetchOnce(async (url, opts) => {
      captured = { url, opts };
      return { ok: true, status: 200, text: async () => JSON.stringify({ outbound_id: 'ob_123', status: 'queued' }) };
    });

    const p = createSarvamProvider(cfg);
    const result = await p.createPhoneCall({
      toNumber: '+919876543210',
      dynamicVariables: { customer_name: 'Ravi' },
    });

    expect(captured.url).toBe(
      'https://apps.sarvam.ai/api/outbounds/v1/orgs/org-1/workspaces/ws-1/outbounds'
    );
    expect(captured.opts.method).toBe('POST');
    expect(captured.opts.headers['X-API-Key']).toBe('test-key-DO-NOT-USE');
    expect(captured.opts.headers['Content-Type']).toBe('application/json');

    const body = JSON.parse(captured.opts.body);
    // connection_config / agent_variables nested INSIDE app_config
    expect(body.app_config.app_id).toBe('autoscale-test');
    expect(body.app_config.app_version).toBe(1);
    expect(body.app_config.app_type).toBe('agent');
    expect(body.app_config.connection_config).toEqual({
      connection_id: 'conn-1',
      agent_phone_number: '+917965480920',
    });
    expect(body.app_config.agent_variables.user_name).toBe('Ravi');
    // destination is user_config.user_phone_number
    expect(body.user_config.user_phone_number).toBe('+919876543210');
    // app_overrides omitted when empty; webhook_config omitted (disabled)
    expect(body.app_config.app_overrides).toBeUndefined();
    expect(body.webhook_config).toBeUndefined();

    expect(result.providerCallId).toBe('ob_123');
    expect(result.status).toBe('queued');
    expect(p.isTest).toBe(false);
  });

  test('includes app_overrides only when configured', async () => {
    let body;
    mockFetchOnce(async (url, opts) => {
      body = JSON.parse(opts.body);
      return { ok: true, status: 200, text: async () => '{"outbound_id":"x"}' };
    });
    const p = createSarvamProvider({ ...cfg, initialBotMessage: 'Namaste', initialStateName: 'greet' });
    await p.createPhoneCall({ toNumber: '+919876543210', dynamicVariables: {} });
    expect(body.app_config.app_overrides).toEqual({
      initial_bot_message: 'Namaste',
      initial_state_name: 'greet',
    });
  });

  test('empty customer_name yields empty user_name (never fabricated)', async () => {
    let body;
    mockFetchOnce(async (url, opts) => {
      body = JSON.parse(opts.body);
      return { ok: true, status: 200, text: async () => '{"id":"x"}' };
    });
    const p = createSarvamProvider(cfg);
    await p.createPhoneCall({ toNumber: '+919876543210', dynamicVariables: {} });
    expect(body.app_config.agent_variables.user_name).toBe('');
  });
});

describe('Sarvam adapter — failures', () => {
  test('non-2xx → PROVIDER_REJECTED with safe message (no payload leak)', async () => {
    mockFetchOnce(async () => ({
      ok: false,
      status: 422,
      text: async () => JSON.stringify({ message: 'invalid connection' }),
    }));
    const p = createSarvamProvider(cfg);
    await expect(p.createPhoneCall({ toNumber: '+919876543210', dynamicVariables: {} }))
      .rejects.toMatchObject({ code: 'PROVIDER_REJECTED' });
  });

  test('timeout → AbortError (mapped to provider_timeout upstream)', async () => {
    mockFetchOnce((url, opts) => {
      return new Promise((_, reject) => {
        opts.signal.addEventListener('abort', () => {
          const e = new Error('aborted');
          e.name = 'AbortError';
          reject(e);
        });
      });
    });
    const p = createSarvamProvider({ ...cfg, timeoutMs: 20 });
    await expect(p.createPhoneCall({ toNumber: '+919876543210', dynamicVariables: {} }))
      .rejects.toMatchObject({ name: 'AbortError' });
  });

  test('webhooks disabled: verifyWebhook always false', () => {
    const p = createSarvamProvider(cfg);
    expect(p.verifyWebhook({ rawBody: '{}', signature: 'x' })).toBe(false);
  });
});
