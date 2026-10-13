import express from 'express';
import { config, isMockProvider } from '../config.js';

export const statusRouter = express.Router();

// GET /api/status — non-sensitive configuration & integration status for the
// dashboard. NEVER returns secrets, only whether they are present.
statusRouter.get('/', (req, res) => {
  const provider = config.provider;
  const retellReady =
    provider === 'retell' &&
    !!config.retell.apiKey &&
    !!config.retell.agentId &&
    !!config.retell.fromNumber;

  res.json({
    env: config.env,
    provider,
    mode: isMockProvider() ? 'test' : 'live',
    providerConfigured: isMockProvider() ? true : retellReady,
    store: config.store,
    demo: {
      businessName: config.demo.businessName,
      agentName: config.demo.agentName,
      callPurpose: config.demo.callPurpose,
    },
    limits: {
      perMinute: config.limits.perMinute,
      dailyCallLimit: config.limits.dailyCallLimit,
      maxConcurrent: config.limits.maxConcurrent,
      maxDailySpendUsd: config.limits.maxDailySpendUsd,
    },
    retentionDays: config.retention.days,
    recordingEnabled: false,
    // Flags the operator must still resolve before a real call is possible.
    outstanding: isMockProvider()
      ? ['Using MOCK provider — no real calls are placed.']
      : [
          !config.retell.apiKey && 'RETELL_API_KEY missing',
          !config.retell.agentId && 'RETELL_AGENT_ID missing',
          !config.retell.fromNumber && 'RETELL_FROM_NUMBER (verified +91 route) missing',
        ].filter(Boolean),
  });
});
