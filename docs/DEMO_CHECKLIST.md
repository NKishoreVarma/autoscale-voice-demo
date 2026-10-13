# Client Demonstration Checklist

Use this before showing the demo to a client.

## A. One-time setup

- [ ] Backend deps installed (`cd backend && npm install`).
- [ ] Frontend deps installed (`cd frontend && npm install`).
- [ ] Firebase project created; Email/Password and/or Google sign-in enabled.
- [ ] `frontend/.env` has `VITE_FIREBASE_*` (public web config) + `VITE_API_BASE_URL`.
- [ ] `backend/.env` has `ADMIN_ALLOWLIST` = the admin's email.
- [ ] Admin email exists as a Firebase user.

## B. Decide the mode

- [ ] **TEST mode** (default): `VOICE_PROVIDER=mock`. No real calls. Safe to rehearse.
- [ ] **LIVE mode**: `VOICE_PROVIDER=retell` + Retell key/agent/from-number + a verified
      +91 route. **Only after the outstanding items below are resolved.**

## C. Outstanding before a REAL call (operator action — see audit §4.4)

- [ ] Retell AI account created and funded; API key issued (server-side only).
- [ ] Retell agent configured (voice, prompt, dynamic variables).
- [ ] **Verified outbound route to +91 with compliant caller ID** (SIP trunk + local
      Indian carrier / DLT as required — Retell does not sell +91 numbers).
- [ ] KYC / account verification completed with Retell and the carrier.
- [ ] Webhook configured to `POST /api/webhooks/retell`; signature key set.
- [ ] Compliance confirmed: AI disclosure, recording consent (recording stays OFF unless
      fully addressed), DLT/TCCCPR obligations reviewed with counsel.
- [ ] `backend/firestore.rules` deployed if `CALL_STORE=firestore`.

## D. Pre-demo smoke test

- [ ] `cd backend && npm test` → all green.
- [ ] Backend `/api/status` shows the expected mode and no unexpected `outstanding` items.
- [ ] Sign in to the dashboard; the admin email is accepted.
- [ ] In TEST mode: place a call → appears in history labeled `TEST (mock)`.
- [ ] In LIVE mode: place ONE call to a consenting test phone you control; confirm it
      rings, the agent speaks, and the dashboard updates status → transcript → summary.

## E. During the demo

- [ ] Explain this is a consent-based, manual, single-call demo (not bulk calling).
- [ ] Enter the consenting recipient's +91 number; tick the consent confirmation.
- [ ] Confirm in the modal; show the call progressing in the dashboard.
- [ ] Open the call detail to show transcript, AI summary, duration, and cost.
- [ ] Point out the Integration Status panel and the test-vs-live labeling.

## F. After the demo

- [ ] Run `node backend/src/scripts/retention.js` or rely on the retention window.
- [ ] Rotate the Retell key if it was shared on a shared machine.
