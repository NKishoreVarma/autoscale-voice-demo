# Call Record Schema

Store collections (Firestore, backend-only via Admin SDK): `voiceDemo_calls`, `voiceDemo_audit`, `voiceDemo_webhookEvents`. In `memory` mode the same shapes live in process memory. Timestamps are stored consistently as **epoch milliseconds (UTC)**.

## `voiceDemo_calls` document

| Field | Type | Notes |
|---|---|---|
| `id` | string (uuid) | Internal call ID |
| `provider` | string | `mock` or `retell` |
| `providerCallId` | string\|null | Real provider call ID; null until provider accepts |
| `status` | enum | `queued`→`initiated`→`ringing`→`in_progress`→ terminal (`completed`/`no_answer`/`busy`/`failed`/`canceled`/`unavailable`) |
| `isTest` | boolean | `true` for mock-provider calls; dashboard labels these as TEST |
| `destination.e164` | string | Full +91 number — **restricted, backend only** |
| `destination.redacted` | string | e.g. `+91******10` — safe for list/detail views |
| `initiatedBy.uid` / `.email` | string | Administrator who initiated the call |
| `consent.confirmed` | boolean | Must be `true` to place a call |
| `consent.timestamp` | number | When consent was confirmed (audit) |
| `consent.note` | string\|null | Optional operator note |
| `idempotencyKey` | string\|null | Prevents duplicate submissions placing two calls |
| `timestamps.createdAt` | number | Record creation |
| `timestamps.connectedAt` | number\|null | Call connected (from provider) |
| `timestamps.completedAt` | number\|null | Call ended (from provider) |
| `durationSec` | number\|null | From provider |
| `transcript.available` | boolean | Whether transcript exists |
| `transcript.data` | any\|null | Transcript — **restricted, admin detail view only** |
| `summary` | string\|null | AI-generated summary from provider |
| `error.category` | enum\|null | `provider_rejected`/`provider_timeout`/`provider_error` |
| `error.message` | string\|null | Safe diagnostic — no payloads/secrets |
| `disconnectReason` | string\|null | Provider-reported hangup reason |
| `estimatedCost.amountUsd` | number | Pre-call projection — **source: `estimate`** |
| `cost.amountUsd` | number\|null | **Provider-reported only**; null when provider gives none (never faked) |
| `cost.source` | `provider` | Distinguishes real charge from estimate |
| `recording.enabled` | boolean | **`false` by default** (disclosure/consent not configured) |
| `retention.deleteAfter` | number | Eligible-for-deletion timestamp |
| `dynamicVariables` | object | Demo identity injected into the agent |

## `voiceDemo_audit` document

`{ id, ts, action, actor, callId?, destination?(redacted), provider?, category?, type?, status? }`
Actions: `call.initiate`, `call.failed`, `webhook.processed`.

## `voiceDemo_webhookEvents` document

`{ <eventId>: { ts } }` — idempotency ledger; presence means the event was already applied.

## Access & retention policy

- Full destination number and transcript are **never** returned to list views; transcript only in the single-call admin detail endpoint.
- Direct client access to all three collections is **denied** by `backend/firestore.rules`; the authenticated backend is the only reader/writer.
- Records past `retention.deleteAfter` (default 30 days) are removed by `src/scripts/retention.js`.
- Recording is disabled; enabling requires addressing disclosure, consent, storage, and retention first (see audit §6).
