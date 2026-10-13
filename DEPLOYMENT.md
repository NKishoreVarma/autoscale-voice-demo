# Deployment Guide

Two services deploy **separately**:

- **Frontend** (`frontend/`) → Vercel (static Vite SPA)
- **Backend** (`backend/`) → a Node host (Render recommended)

> Both are needed for a working demo: sign-in requires the backend to verify Firebase
> tokens, and the mock/TEST call lifecycle runs **in the backend**. The frontend alone
> will load but cannot place (even simulated) calls.

Repository: `https://github.com/NKishoreVarma/autoscale-voice-demo` (private).

---

## Phase A — Firebase (needed for admin sign-in, even in TEST mode)

1. Create a Firebase project; enable **Authentication → Email/Password** and/or **Google**.
2. Create your admin user (the email you will sign in with).
3. Get the **Web app config** (public) for the frontend.
4. Create a **service account** (Project Settings → Service accounts → Generate key) for the
   backend Admin SDK. **This JSON is a secret — never commit it, never put it in the frontend.**

---

## Phase B — Backend on Render

- **Root directory:** `backend`
- **Build command:** `npm install`
- **Start command:** `npm start`  (runs `node src/server.js`)
- **Health check path:** `/health`
- Render provides `PORT` automatically; the server reads it.

### Backend environment variables (NAMES only — set values in Render dashboard)

Required for the demo (TEST mode):
- `ADMIN_ALLOWLIST` — comma-separated admin emails allowed to sign in
- `FIREBASE_PROJECT_ID`
- `FIREBASE_SERVICE_ACCOUNT_PATH` — path to the mounted service-account JSON (see below)
- `CORS_ORIGINS` — your Vercel frontend origin, e.g. `https://<frontend>.vercel.app`
- `VOICE_PROVIDER` — leave `mock` (default) until going live

Recommended:
- `CALL_STORE` — `memory` (default) or `firestore` (see persistence note)
- `DEMO_BUSINESS_NAME`, `DEMO_AGENT_NAME`, `DEMO_CALL_PURPOSE`
- `RATE_LIMIT_PER_MINUTE`, `DAILY_CALL_LIMIT`, `MAX_CONCURRENT_CALLS`, `MAX_DAILY_SPEND_USD`
- `DATA_RETENTION_DAYS`

For LIVE Retell calls (leave unset until authorized — see "Blockers" in README/TELEPHONY.md):
- `RETELL_API_KEY` (secret), `RETELL_AGENT_ID`, `RETELL_FROM_NUMBER`,
  `RETELL_WEBHOOK_API_KEY` (secret), `RETELL_BASE_URL`

### Service-account file on Render
Render → your service → **Environment → Secret Files**: add a file (e.g. `serviceAccount.json`)
with the JSON contents, then set `FIREBASE_SERVICE_ACCOUNT_PATH=/etc/secrets/serviceAccount.json`.
Do **not** paste the JSON into a normal env var or the repo.

### Persistence note (honest)
`CALL_STORE=memory` is **process-local** and is wiped on restart/redeploy — fine for a
single live demo session, **not** real persistence. For call history that survives restarts,
set `CALL_STORE=firestore` (uses the same Firebase project via the Admin SDK) and deploy
`backend/firestore.rules` with the Firebase CLI.

---

## Phase C — Frontend on Vercel

- **Git repository:** `NKishoreVarma/autoscale-voice-demo`
- **Root directory:** `frontend`  ← fixes the previous blank page (serves the built `dist/`, not raw source)
- **Framework preset:** Vite
- **Build command:** `npm run build`
- **Output directory:** `dist`
- SPA deep links survive refresh via `frontend/vercel.json` (included).

### Frontend environment variables (NAMES only — all PUBLIC web config)
- `VITE_API_BASE_URL` — the Render backend URL, e.g. `https://<backend>.onrender.com`
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_APP_ID`

> Never put `RETELL_*` or Firebase **Admin**/service-account values in `VITE_*` — those ship to the browser.

If an existing Vercel project named `autoscale-voice-demo` is currently blank, it was built
from the repo root / unbuilt source. **Fix it** by setting its **Root Directory to `frontend`**
and redeploying (or create a fresh project pointed at `frontend`).

---

## Phase D — Firebase authorized domains
Firebase Console → Authentication → Settings → **Authorized domains**: add your Vercel domain
(`<frontend>.vercel.app` and any custom domain) or Google sign-in will fail in production.

---

## Phase E — Retell webhook (only when going LIVE)
After the backend has a public HTTPS URL, set the Retell agent's webhook to:
```
https://<backend>.onrender.com/api/webhooks/retell
```
The endpoint verifies the `x-retell-signature` over the raw body; set `RETELL_WEBHOOK_API_KEY`
(or it falls back to `RETELL_API_KEY`). Keep `VOICE_PROVIDER=retell` only once all LIVE
prerequisites are met; otherwise the backend fails closed (503) rather than placing a call.

---

## Verify after deploy
1. `GET https://<backend>.onrender.com/health` → `{"ok":true}`
2. `GET https://<backend>.onrender.com/api/status` → `mode: test`, `providerConfigured: true`
3. Open the Vercel URL → sign in (email must be in `ADMIN_ALLOWLIST` **and** a Firebase user).
4. Create a call with a `+91` number → it progresses queued→in_progress→completed with
   transcript/summary/cost, labeled **TEST (mock)**. No real call is placed.
