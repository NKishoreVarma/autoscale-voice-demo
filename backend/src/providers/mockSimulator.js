// TEST-MODE ONLY. Drives a mock call through a realistic lifecycle by feeding
// synthetic events into the SAME webhook-processing pipeline used by real provider
// callbacks (processWebhook). This lets the dashboard visibly show
// queued → in_progress → completed (+ transcript/summary/cost), or alternate
// outcomes, without ever placing a real phone call.
//
// Every record driven here is already marked isTest:true by the mock provider, so
// the UI labels it TEST. Never active when VOICE_PROVIDER=retell.
import { processWebhook } from '../services/webhookService.js';
import { logger } from '../lib/logger.js';

const TRANSCRIPT =
  'Agent: Hi, this is Aria, an AI assistant calling from AutoScale Demo. ' +
  'Is now a good time for a short demonstration?\n' +
  'User: Sure, go ahead.\n' +
  'Agent: Great. I can answer general questions about the business and schedule a follow-up. ' +
  'Is there anything you would like to know?\n' +
  'User: What does this demo show?\n' +
  'Agent: It shows how an AI voice agent can handle a real conversation and log the outcome. ' +
  'Thank you for your time — goodbye!';

const SUMMARY =
  'AI assistant introduced itself, confirmed consent to proceed, explained the purpose of the ' +
  'demonstration, answered a general question, and ended the call politely.';

// Build the ordered event list for a scenario. Each step: { delayMs, body }.
// Exported so tests can drive the exact same sequences deterministically.
export function scenarioSteps(callId, scenario) {
  const started = {
    delayMs: 1200,
    body: { event: 'call_started', call: { call_id: callId, call_status: 'ongoing', start_timestamp: Date.now() } },
  };
  switch (scenario) {
    case 'no_answer':
      return [
        { delayMs: 1000, body: { event: 'call_started', call: { call_id: callId, call_status: 'ringing' } } },
        { delayMs: 3000, body: { event: 'call_ended', call: { call_id: callId, call_status: 'no_answer', disconnection_reason: 'no_answer' } } },
      ];
    case 'failed':
      return [
        { delayMs: 1000, body: { event: 'call_started', call: { call_id: callId, call_status: 'ringing' } } },
        { delayMs: 2800, body: { event: 'call_ended', call: { call_id: callId, call_status: 'error', disconnection_reason: 'dial_failed' } } },
      ];
    case 'no_transcript':
      return [
        started,
        { delayMs: 3000, body: { event: 'call_ended', call: { call_id: callId, call_status: 'ended', duration_ms: 41000, end_timestamp: Date.now() } } },
        // analysis arrives but WITHOUT a transcript
        { delayMs: 4500, body: { event: 'call_analyzed', call: { call_id: callId, call_status: 'ended', call_analysis: { call_summary: SUMMARY }, call_cost: { combined_cost: 58 } } } },
      ];
    case 'no_cost':
      return [
        started,
        { delayMs: 3000, body: { event: 'call_ended', call: { call_id: callId, call_status: 'ended', duration_ms: 47000, end_timestamp: Date.now() } } },
        // analysis arrives with transcript+summary but NO cost
        { delayMs: 4500, body: { event: 'call_analyzed', call: { call_id: callId, call_status: 'ended', transcript: TRANSCRIPT, call_analysis: { call_summary: SUMMARY } } } },
      ];
    case 'completed':
    default:
      return [
        started,
        { delayMs: 3000, body: { event: 'call_ended', call: { call_id: callId, call_status: 'ended', duration_ms: 62000, end_timestamp: Date.now() } } },
        { delayMs: 4500, body: { event: 'call_analyzed', call: { call_id: callId, call_status: 'ended', transcript: TRANSCRIPT, call_analysis: { call_summary: SUMMARY }, call_cost: { combined_cost: 74 } } } },
      ];
  }
}

// Scenarios whose failure happens at creation time (handled in mock.createPhoneCall),
// not via lifecycle events.
export const CREATE_TIME_SCENARIOS = new Set(['timeout', 'reject']);

export const LIFECYCLE_SCENARIOS = ['completed', 'no_answer', 'failed', 'no_transcript', 'no_cost'];

export function scheduleMockLifecycle({ providerCallId, scenario = 'completed' }) {
  if (process.env.NODE_ENV === 'test') return; // keep jest deterministic / no open handles
  if (!providerCallId) return;
  const steps = scenarioSteps(providerCallId, scenario);
  for (const step of steps) {
    const t = setTimeout(async () => {
      try {
        await processWebhook(step.body);
      } catch (err) {
        logger.warn('mock.lifecycle.error', { message: err.message });
      }
    }, step.delayMs);
    // Don't keep the event loop alive solely for simulated events.
    if (typeof t.unref === 'function') t.unref();
  }
  logger.info('mock.lifecycle.scheduled', { providerCallId, scenario });
}
