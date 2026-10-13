# Live Integration & Real-Call Acceptance

Nothing here activates a paid service or places a call. It documents exactly what must be
configured and verified **before** a first real call, using the env vars the code actually
reads (verified against `backend/src/config.js` and `frontend/src/lib/config.js`).

## 1. Environment variable matrix (code-verified)

### Backend

| Variable | Required in TEST | Required in LIVE | Secret? | Notes |
|---|---|---|---|---|
| `ADMIN_ALLOWLIST` | **Yes** | **Yes** | No (not secret, but access-control) | Comma-separated admin emails; server-side authz source of truth |
| `VOICE_PROVIDER` | optional (`mock` default) | **Yes** = `retell` | No | Selects provider; anything ≠ `retell` ⇒ mock/TEST |
| `CALL_STORE` | optional (`memory` default) | recommended `firestore` | No | `memory` is process-local only |
| `PORT` | optional (8080) | optional | No | |
| `FIREBASE_PROJECT_ID` | only if verifying real tokens / firestore | **Yes** | No | |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | only if firestore/real tokens | **Yes** (or ADC) | **path to a SECRET file** | Never commit the file |
| `RETELL_API_KEY` | No | **Yes** | **SECRET** | Server-side only |
| `RETELL_AGENT_ID` | No | **Yes** | No | |
| `RETELL_FROM_NUMBER` | No | **Yes** | No | The verified caller-ID/from number |
| `RETELL_WEBHOOK_API_KEY` | No | optional (defaults to `RETELL_API_KEY`) | **SECRET** | Used to verify `x-retell-signature` |
| `RETELL_BASE_URL` | No | optional | No | Defaults to `https://api.retellai.com` |
| `DEMO_BUSINESS_NAME` / `DEMO_AGENT_NAME` / `DEMO_CALL_PURPOSE` | optional | recommended | No | Injected into the agent as dynamic variables |
| `RATE_LIMIT_PER_MINUTE` | optional (5) | recommended | No | Per-admin call rate |
| `DAILY_CALL_LIMIT` | optional (25) | recommended | No | Hard daily cap |
| `MAX_CONCURRENT_CALLS` | optional (2) | recommended | No | |
| `MAX_DAILY_SPEND_USD` | optional (10) | **set deliberately** | No | Daily spend ceiling |
| `ESTIMATED_USD_PER_MINUTE` / `ESTIMATED_MINUTES_PER_CALL` | optional | set to match provider pricing | No | Pre-call spend **estimate** only |
| `DATA_RETENTION_DAYS` | optional (30) | set per policy | No | Used by `src/scripts/retention.js` |
| `CORS_ORIGINS` | optional | **set to your frontend origin** | No | Blank = allow all (dev only) |

### Frontend (all PUBLIC web config — not secrets)

| Variable | Required | Notes |
|---|---|---|
| `VITE_API_BASE_URL` | Yes | Backend origin |
| `VITE_FIREBASE_API_KEY` | for sign-in | Public Firebase web key |
| `VITE_FIREBASE_AUTH_DOMAIN` | for sign-in | |
| `VITE_FIREBASE_PROJECT_ID` | for sign-in | |
| `VITE_FIREBASE_APP_ID` | for sign-in | |

> **No secret ever belongs in a `VITE_*` variable** — those are bundled into the browser.

## 2. How the app behaves (verified in code)

- **Provider detection:** `config.provider`; `isMockProvider()` returns true unless `VOICE_PROVIDER=retell`. `/api/status` reports `mode` (`test`/`live`) and `providerConfigured`.
- **Accidental-live prevention:** default is mock/TEST; the UI shows a persistent amber TEST-MODE banner and every mock record is `isTest:true` + badged.
- **Fail-closed (verified by `tests/failClosed.test.js`):** if `VOICE_PROVIDER=retell` but `RETELL_API_KEY`/`RETELL_AGENT_ID`/`RETELL_FROM_NUMBER` are missing, call initiation returns **503 PROVIDER_NOT_CONFIGURED** and **no record is created**. It does **not** fall back to mock.
- **Provider failure display:** a rejected/timed-out provider call → record saved as `failed` with an `error.category`, and the API returns 502; the dashboard shows the failed row and detail.
- **Spend ceiling:** pre-call projection (`estimate`) + today's provider-reported spend is checked against `MAX_DAILY_SPEND_USD`; exceeding returns 429 and places no call.
- **Webhook security:** `/api/webhooks/retell` verifies `x-retell-signature` over the raw body before trusting anything; idempotent; out-of-order safe.

## 3. LIVE configuration steps (no call placed)

1. Create/fund Retell account; create an agent; copy `agent_id`.
2. Resolve the **+91 route** (see `TELEPHONY.md` — Option A fastest).
3. Set backend `.env`: `VOICE_PROVIDER=retell`, `RETELL_API_KEY`, `RETELL_AGENT_ID`, `RETELL_FROM_NUMBER`, `CALL_STORE=firestore`, Firebase Admin creds, `MAX_DAILY_SPEND_USD`, `CORS_ORIGINS`.
4. Deploy backend to public HTTPS; set the Retell agent webhook to `https://<host>/api/webhooks/retell`.
5. Deploy `backend/firestore.rules`.
6. Hit `/api/status` → confirm `mode: live`, `providerConfigured: true`, empty `outstanding`.

## 4. First real-call acceptance checklist

Mark each **VERIFIED / NOT CONFIGURED / BLOCKED** before dialing. Do not place the call until every item is VERIFIED and you have explicitly authorized it.

- [ ] Recipient is you or an explicitly consenting test contact.
- [ ] Consent recorded in the app (consent note + confirmation).
- [ ] Agent opens by identifying itself as an **AI** from the configured business.
- [ ] Call purpose disclosed in the agent prompt.
- [ ] Caller ID verified (know exactly what the recipient will see — see TELEPHONY.md §1).
- [ ] Route authorized for this use (Retell written confirmation received).
- [ ] Correct `RETELL_AGENT_ID` configured.
- [ ] Backend has valid `RETELL_API_KEY` (server-side only).
- [ ] Webhook URL reachable over public HTTPS; `x-retell-signature` verification on.
- [ ] A call record is created **before** dispatch (verified by code/tests).
- [ ] Rate, concurrency, and `MAX_DAILY_SPEND_USD` limits set sensibly.
- [ ] Recording **disabled** (default) unless consent+disclosure+storage configured.
- [ ] Stop/opt-out behavior tested (recipient can ask to end; agent complies).
- [ ] Expected per-minute cost understood (TELEPHONY.md §3).
- [ ] Outcome, transcript, summary will be stored in the restricted store with retention.
- [ ] India compliance reviewed with counsel (DLT/160-series/AI disclosure) — see TELEPHONY.md §2.

**Verification after the call** must capture the real provider `call_id`, real status,
duration, and any transcript/summary/usage — a 200/201 HTTP response alone is **not**
proof the call connected.
