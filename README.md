# AutoScale — AI Voice Calling Demo

A **standalone**, client-demo-ready system that lets an authorized administrator place a
single, consent-based AI voice call to an Indian (+91) mobile number and inspect the real
result (status, transcript, AI summary, duration, provider-reported cost) in a dashboard.

This project is **independent** of the AutoScale marketing website. It does not modify,
import from, or deploy over that website. It introduces **no n8n runtime dependency**.

> **Default mode is a safe TEST mode.** With no provider credentials, the backend uses a
> **mock provider** that places **no real calls** and labels every record as `TEST`.
> Placing a real call requires configuring Retell AI + a verified +91 route (see
> [docs/standalone_ai_voice_calling_mvp_audit.md](docs/standalone_ai_voice_calling_mvp_audit.md) §4).

## Layout

```
autoscale-voice-demo/
├── backend/     Node.js + Express API (auth, call initiation, webhooks, data store)
│   ├── src/     config, middleware, lib, providers (mock|retell), services, routes, store
│   ├── tests/   automated tests (mocked provider, labeled)
│   └── firestore.rules   locked-down rules for the demo store
├── frontend/    Vite + React + Tailwind admin dashboard
├── docs/        audit, transfer manifest, schema, demo checklist
└── README.md
```

## Prerequisites

- Node.js 18+ (developed on Node 24).
- (For real sign-in) a Firebase project with Email/Password and/or Google auth enabled.
- (For real calls) a Retell AI account + a verified outbound route to +91 — **still outstanding**, see audit §4.4.

## Quick start (TEST mode — no credentials, no real calls)

**1. Backend**
```bash
cd backend
npm install
cp .env.example .env
# set ADMIN_ALLOWLIST to your admin email(s)
npm start                      # serves http://localhost:8080
```

**2. Frontend**
```bash
cd frontend
npm install
cp .env.example .env
# set VITE_FIREBASE_* (public web config) to enable sign-in,
# and VITE_API_BASE_URL=http://localhost:8080
npm run dev                    # serves http://localhost:5173
```

Sign in with an email that is **both** a Firebase user and present in the backend
`ADMIN_ALLOWLIST`. Create a call — in TEST mode it is accepted, stored, labeled
`TEST (mock)`, and then **automatically progresses through a realistic lifecycle**
(queued → in progress → completed, with transcript, AI summary, duration, and cost)
driven through the same webhook pipeline real calls use. No phone rings.

> **Choosing the simulated outcome:** in TEST mode the call form shows a **Test scenario**
> selector: `completed`, `no_answer`, `failed`, `timeout` (dispatch error),
> `no_transcript`, `no_cost`, `reject` (dispatch rejection). Use these to demo each UI
> state. All remain clearly labeled as simulated; a successful mock never implies a real
> phone call occurred.

## Going LIVE (real calls) — requires operator action

1. Create a Retell AI account; create an agent; note the `agent_id`.
2. Provision a **verified outbound route to +91** (see audit §4.2 — this is non-trivial:
   Retell sells US/CA numbers only; +91 caller ID needs a local SIP trunk/carrier + DLT).
3. In `backend/.env`:
   ```
   VOICE_PROVIDER=retell
   RETELL_API_KEY=...
   RETELL_AGENT_ID=...
   RETELL_FROM_NUMBER=+...        # the verified from-number
   CALL_STORE=firestore           # optional; otherwise in-memory
   FIREBASE_PROJECT_ID=...         # + service account for Admin SDK
   ```
4. Configure the Retell agent's webhook to `POST https://<your-backend>/api/webhooks/retell`.
5. Deploy `backend/firestore.rules` to the demo's Firebase project.
6. Confirm compliance (AI disclosure, recording consent, DLT if applicable).

The dashboard's **Integration Status** panel shows whether the live route is configured
and lists anything still outstanding.

## Scripts

| Location | Command | Purpose |
|---|---|---|
| backend | `npm start` | Run the API |
| backend | `npm test` | Run the automated test suite (mocked provider) |
| backend | `node src/scripts/retention.js` | Delete records past the retention window |
| frontend | `npm run dev` | Dev server |
| frontend | `npm run build` | Production build |

## Security model (summary)

- Authorization is enforced **server-side**: the backend verifies the Firebase ID token
  and checks `ADMIN_ALLOWLIST`. The client `isAdmin` is never trusted.
- Provider credentials live **only** in backend env vars.
- Webhooks are rejected unless the `x-retell-signature` verifies; processing is
  idempotent and tolerant of out-of-order delivery.
- Phone numbers and secrets are redacted in logs; transcripts/PII are restricted and
  retained for `DATA_RETENTION_DAYS` (default 30).
- Recording is **off by default**.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Sign-in button disabled / "Firebase is not configured" | Set `VITE_FIREBASE_*` in `frontend/.env`, restart `npm run dev` |
| Signed in but calls return 403 | Your email isn't in backend `ADMIN_ALLOWLIST` (and must match the Firebase account email) |
| Call stays "queued" and never advances | You're in LIVE mode without a webhook, or `NODE_ENV=test`; in TEST mode it auto-advances |
| POST returns 503 `PROVIDER_NOT_CONFIGURED` | `VOICE_PROVIDER=retell` but Retell creds missing — this is the intended fail-closed behavior |
| CORS error in browser | Set backend `CORS_ORIGINS` to your frontend origin |
| Port 8080 in use | Set `PORT` in `backend/.env` and `VITE_API_BASE_URL` to match |

**Stop the services:** `Ctrl-C` in each terminal (backend and frontend).

## Documentation

See [docs/standalone_ai_voice_calling_mvp_audit.md](docs/standalone_ai_voice_calling_mvp_audit.md),
[docs/SCHEMA.md](docs/SCHEMA.md), [docs/TRANSFER_MANIFEST.md](docs/TRANSFER_MANIFEST.md),
[docs/DEMO_CHECKLIST.md](docs/DEMO_CHECKLIST.md),
[docs/TELEPHONY.md](docs/TELEPHONY.md) (Indian +91 route verification),
and [docs/LIVE_READINESS.md](docs/LIVE_READINESS.md) (env matrix + real-call acceptance checklist).
