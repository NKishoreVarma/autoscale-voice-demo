import express from 'express';
import { requireAdmin } from '../middleware/auth.js';
import { initiateCallLimiter } from '../middleware/rateLimit.js';
import { initiateCall, CallError } from '../services/callService.js';
import { getStore } from '../store/index.js';
import { logger } from '../lib/logger.js';

export const callsRouter = express.Router();

// Shape a record for the client. The requested destination number is restricted:
// only the redacted form is returned in list/detail views.
function toClientView(record, { includeTranscript = false } = {}) {
  if (!record) return null;
  return {
    id: record.id,
    provider: record.provider,
    providerCallId: record.providerCallId,
    status: record.status,
    isTest: record.isTest === true,
    destination: record.destination?.redacted || '[redacted]',
    initiatedBy: record.initiatedBy?.email,
    consent: record.consent
      ? { confirmed: record.consent.confirmed, timestamp: record.consent.timestamp }
      : null,
    timestamps: record.timestamps,
    durationSec: record.durationSec,
    summary: record.summary || null,
    transcriptAvailable: !!record.transcript?.available,
    transcript: includeTranscript ? record.transcript?.data || null : undefined,
    error: record.error || null,
    disconnectReason: record.disconnectReason || null,
    estimatedCost: record.estimatedCost || null,
    cost: record.cost || null, // provider-reported only; null if provider gave none
    recording: record.recording || { enabled: false },
    retention: record.retention || null,
  };
}

// POST /api/voice/calls — initiate a single outbound call.
callsRouter.post('/', requireAdmin, initiateCallLimiter, async (req, res) => {
  const { phone, consent, idempotencyKey, testScenario } = req.body || {};
  try {
    const { record, deduped } = await initiateCall({
      admin: req.admin,
      phone,
      consent,
      idempotencyKey,
      testScenario,
    });
    return res.status(deduped ? 200 : 201).json({
      deduped: !!deduped,
      call: toClientView(record),
    });
  } catch (err) {
    if (err instanceof CallError) {
      return res.status(err.httpStatus).json({ error: err.safeMessage, code: err.code });
    }
    logger.error('calls.post.error', { message: err.message });
    return res.status(500).json({ error: 'Internal error placing call.' });
  }
});

// GET /api/voice/calls — list call history (restricted fields, no transcript).
callsRouter.get('/', requireAdmin, async (req, res) => {
  const store = await getStore();
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const rows = await store.listCalls({ limit });
  return res.json({ calls: rows.map((r) => toClientView(r)) });
});

// GET /api/voice/calls/:id — detail, including transcript (admin only).
callsRouter.get('/:id', requireAdmin, async (req, res) => {
  const store = await getStore();
  const record = await store.getCall(req.params.id);
  if (!record) return res.status(404).json({ error: 'Call not found.' });
  return res.json({ call: toClientView(record, { includeTranscript: true }) });
});

export { toClientView };
