// Core call-initiation business logic. Enforces consent, validation, authorization
// context, rate/concurrency/spend limits, idempotency, and honest failure handling.
import { config } from '../config.js';
import { validateIndianMobile } from '../lib/phone.js';
import { redactPhone } from '../lib/redact.js';
import { logger } from '../lib/logger.js';
import { getStore } from '../store/index.js';
import { getProvider } from '../providers/index.js';

export class CallError extends Error {
  constructor(code, httpStatus, safeMessage) {
    super(safeMessage);
    this.code = code;
    this.httpStatus = httpStatus;
    this.safeMessage = safeMessage;
  }
}

function retentionDeleteAfter() {
  return Date.now() + config.retention.days * 24 * 60 * 60 * 1000;
}

export async function initiateCall({ admin, phone, consent, idempotencyKey, testScenario }) {
  const store = await getStore();

  // Fail closed: if LIVE provider is selected but not fully configured, refuse the
  // call with a clear error rather than crashing or silently falling back to mock.
  let provider;
  try {
    provider = getProvider();
  } catch (err) {
    if (err.code === 'PROVIDER_NOT_CONFIGURED') {
      throw new CallError(
        'PROVIDER_NOT_CONFIGURED',
        503,
        'Live provider is not fully configured. Call refused.'
      );
    }
    throw err;
  }

  // 1. Consent is mandatory and explicit.
  if (!consent || consent.confirmed !== true) {
    throw new CallError(
      'CONSENT_REQUIRED',
      422,
      'Explicit consent confirmation is required before placing a call.'
    );
  }

  // 2. Server-side phone validation (+91 India mobile only).
  const v = validateIndianMobile(phone);
  if (!v.valid) {
    throw new CallError('INVALID_PHONE', 422, v.reason);
  }
  const e164 = v.e164;

  // 3. Idempotency — a repeated submission returns the existing record, never dials twice.
  if (idempotencyKey) {
    const existing = await store.findByIdempotencyKey(idempotencyKey);
    if (existing) {
      return { record: existing, deduped: true };
    }
  }

  // 4. Spend + volume + concurrency controls.
  const [countToday, inFlight, spendToday] = await Promise.all([
    store.countCallsToday(),
    store.countInFlight(),
    store.sumSpendTodayUsd(),
  ]);

  if (countToday >= config.limits.dailyCallLimit) {
    throw new CallError('DAILY_LIMIT', 429, 'Daily call limit reached.');
  }
  if (inFlight >= config.limits.maxConcurrent) {
    throw new CallError('CONCURRENCY_LIMIT', 429, 'Too many calls in progress. Try again shortly.');
  }
  const estimatePerCall =
    config.limits.estimatedUsdPerMinute * config.limits.estimatedMinutesPerCall;
  if (spendToday + estimatePerCall > config.limits.maxDailySpendUsd) {
    throw new CallError('SPEND_LIMIT', 429, 'Daily spend threshold would be exceeded.');
  }

  // 5. Persist the record FIRST (status 'queued') so nothing is lost on provider failure.
  const dynamicVariables = {
    business_name: config.demo.businessName,
    agent_name: config.demo.agentName,
    call_purpose: config.demo.callPurpose,
  };

  let record = await store.createCall({
    provider: provider.name,
    providerCallId: null,
    status: 'queued',
    isTest: provider.isTest === true,
    destination: { e164, redacted: redactPhone(e164) },
    initiatedBy: { uid: admin.uid, email: admin.email },
    consent: {
      confirmed: true,
      timestamp: Date.now(),
      note: consent.note || null,
    },
    idempotencyKey: idempotencyKey || null,
    timestamps: { createdAt: Date.now(), connectedAt: null, completedAt: null },
    durationSec: null,
    transcript: { available: false, data: null },
    summary: null,
    error: null,
    // Pre-call projection — explicitly an ESTIMATE, not a provider-reported charge.
    estimatedCost: { amountUsd: estimatePerCall, source: 'estimate' },
    cost: null,
    recording: { enabled: false },
    retention: { deleteAfter: retentionDeleteAfter() },
    dynamicVariables,
  });

  await store.recordAudit({
    action: 'call.initiate',
    actor: admin.email,
    callId: record.id,
    destination: redactPhone(e164),
    provider: provider.name,
    isTest: record.isTest,
  });

  // 6. Submit to provider. On failure, mark the record failed — never falsely successful.
  try {
    const result = await provider.createPhoneCall({
      toNumber: e164,
      dynamicVariables,
      // Only meaningful for the mock provider; the Retell adapter ignores it.
      testScenario: provider.isTest ? testScenario : undefined,
    });
    record = await store.updateCall(record.id, {
      providerCallId: result.providerCallId || null,
      status: result.status || 'initiated',
      providerMeta: result.raw || null,
      testScenario: provider.isTest ? testScenario || 'completed' : null,
    });
    logger.info('call.initiated', {
      callId: record.id,
      provider: provider.name,
      isTest: record.isTest,
      destination: redactPhone(e164),
    });

    // TEST MODE ONLY: drive a visible, deterministic lifecycle through the real
    // webhook pipeline so the dashboard shows status/transcript/summary updates.
    if (provider.isTest && result.providerCallId) {
      const { scheduleMockLifecycle } = await import('../providers/mockSimulator.js');
      scheduleMockLifecycle({
        providerCallId: result.providerCallId,
        scenario: testScenario || 'completed',
      });
    }

    return { record, deduped: false };
  } catch (err) {
    const category =
      err.code === 'PROVIDER_REJECTED'
        ? 'provider_rejected'
        : err.name === 'AbortError'
          ? 'provider_timeout'
          : 'provider_error';
    record = await store.updateCall(record.id, {
      status: 'failed',
      error: {
        category,
        // Safe message only — no payloads/secrets.
        message: err.safeMessage || err.providerMessage || 'Call could not be placed.',
      },
    });
    await store.recordAudit({
      action: 'call.failed',
      actor: admin.email,
      callId: record.id,
      category,
    });
    logger.error('call.failed', { callId: record.id, category });
    throw new CallError(category.toUpperCase(), 502, 'The call could not be placed. See call record for details.');
  }
}

// Status values the system understands.
export const CALL_STATUSES = [
  'queued',
  'initiated',
  'ringing',
  'in_progress',
  'completed',
  'no_answer',
  'busy',
  'failed',
  'canceled',
  'unavailable',
];
