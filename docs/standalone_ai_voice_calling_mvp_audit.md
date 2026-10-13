# Standalone AI Voice Calling MVP — Audit

**Status:** Fresh audit, generated from direct inspection on 2026-10-12.
**Author:** Claude Code (automated analysis).
**Important:** The originally-referenced file `standalone_ai_voice_calling_mvp_audit.md` did **not** exist anywhere on disk (searched `~/Desktop`, `~/Documents`, `~/Downloads`, and git history). This document is **new analysis**, not a reconstruction of a prior audit. Every claim below is grounded in a file path or a cited source. Where something is an assumption rather than a verified fact, it is labeled **[ASSUMPTION]**.

---

## 1. Scope and objective

Build a **separate, standalone AI Voice Calling Demo** (`autoscale-voice-demo`) that lets an authorized administrator:

1. Sign in securely.
2. Enter a consenting customer's Indian `+91` mobile number.
3. Manually initiate a single AI voice call.
4. Converse with the recipient via an AI agent.
5. Inspect real results (status, transcript, summary, duration, cost) in a dashboard.

**Explicit non-goals:** not a redesign of the AutoScale website; not integrated into it; no lead generation; no bulk/auto dialing; no contact scraping.

---

## 2. Existing repository — verified findings

Repository root: `/Users/kishorevarma/Desktop/Autoscale` (git, branch `main`, clean).

### 2.1 Architecture (verified)

| Finding | Evidence |
|---|---|
| Client-side React SPA, Vite build | `package.json` scripts (`vite`, `vite build`); `src/main.jsx`, `src/App.jsx` |
| Firebase/Firestore as the only backend | deps: `firebase@^12`; `src/firebase.js` initializes `auth`, `getFirestore`, `getStorage` |
| **No server / API routes exist** | No `express`/`fastify`/`server/` dir anywhere in the repo; all logic runs in the browser |
| React Router v7 SPA routing | `src/App.jsx` `<Routes>` block (lines 276–334) |
| Tailwind v3 + PostCSS + autoprefixer | `tailwind.config.js`, `postcss.config.js` |

**Confirmed:** the audit summary's claim "no existing backend API routes" is accurate. There is nowhere today to safely hold a provider API key or verify a webhook — both require a server that does not yet exist.

### 2.2 "Voice agent" code is marketing only (verified)

`grep` for `voice` in `src/` returns only marketing/copy files (`data/solutions.js`, `components/Section2.jsx`, `Footer.jsx`) and unrelated utilities. There is **no telephony integration** — no Retell, Vapi, Twilio, or Plivo code. `src/pages/admin/Simulator.jsx` (577 lines) is a **Firestore sandbox** that fabricates fake leads/proposals/invoices (e.g. hardcoded "Dr. Amit Patel"); it is not a call simulator and must not be mistaken for one.

**Confirmed:** existing voice-agent material is content, not a functioning integration.

### 2.3 Authentication & authorization (verified — and a key risk)

- `src/context/AuthContext.jsx` (395 lines): Firebase Auth (email/password, Google popup+redirect, phone OTP). Authorization is a **hardcoded client-side allowlist**:
  ```
  const ALLOWED_ADMINS = ["nkishore.varma.s81@kalvium.community", "kishorevarma2205@gmail.com"];
  ```
  A matching email becomes `super_admin`. Non-matching emails are checked against the `clients` Firestore collection.
- `src/components/ProtectedRoute.jsx` (79 lines): gates `/admin/*` on `isAdmin` + optional role hierarchy. **Client-side only** — it controls rendering, not data access.
- **Risk — insecure fallback:** `AuthContext.jsx` lines 270–293 grant `super_admin` *by default* if a Firestore read throws. Acceptable-ish for a client UI gate; **unacceptable** as a model for backend authorization.
- **Risk — credential logging:** `src/firebase.js` does `console.log("Active Firebase Config", ...)` and logs the auth instance. Must **not** be carried into the new project.

**Conclusion (directly relevant to the brief):** a client-side admin check is **not** sufficient to authorize backend calls. The demo backend must independently verify a Firebase ID token server-side and check an allowlist/claims there.

### 2.4 Firestore security rules (verified)

`firestore.rules` (313 lines) implements role helpers (`isSuperAdmin`/`isAdmin`/`isManager`/`isViewer`/`isClient`) keyed off `users/{uid}.role`. Notable:

- `users` and `admins` are readable by **any authenticated user** (`allow read: if request.auth != null`).
- `analytics/{doc}` is **fully public** read+write.
- Many collections allow public `create` (leads, bookings, contactForms, auditReports) — appropriate for a marketing site, **inappropriate** as a template for call records.

**Implication for the demo:** call records contain a recipient's phone number, transcript, and consent audit data — personal data that must be **server-only**. These should live in a **dedicated, access-restricted store** with rules that deny all direct client access (reads go through the authenticated backend), not reuse the website's permissive patterns.

### 2.5 Reusable assets (verified, with caveats)

| Asset | Reuse verdict |
|---|---|
| Tailwind + PostCSS config | **Recreate** (tiny; copying is trivial and avoids coupling) |
| `ProtectedRoute.jsx` pattern | **Recreate** small version (original logs verbosely, couples to website AuthContext) |
| `AuthContext.jsx` | **Do not copy wholesale** (395 lines, website-specific collections, insecure fallback). Recreate a minimal auth context. |
| Admin UI primitives (`DataTable` 252 LoC, `Modal`, `SlidePanel`, `StatsCard`, `StatusBadge`) | **Candidate copy** — inspect imports first; copy only if deps are limited to React + lucide + Tailwind |
| `src/firebase.js` | **Recreate** without the `console.log` of config/secrets |
| `.env`, any keys | **Never copy** (see §6) |

---

## 3. n8n archives — verified reference material

Archives on `~/Desktop`: `N8N Templates Part 1.zip`, `N8N Templates Part 2.zip`, `10000+ n8n templates.zip`. **Not** a runtime dependency — reference only.

**Found (verified by extraction):**
- `29P4X9mTSmplnjlJ_AI_Phone_Agent_with_RetellAI.json`
- `QO4Mg23JvVfNCICy_Build_a_Phone_Agent_to_qualify_outbound_leads_and_inbound_calls_with_RetellAI...json`

The second workflow calls **`POST https://api.retellai.com/v2/create-phone-call`** with fields `from_number`, `to_number`, and `dynamic_variables` (and references `override_agent_id`). This matches Retell's current public API and is the concrete integration shape the demo will mirror server-side.

**No Vapi workflows exist in the archives** (grep for `vapi` returned nothing). Twilio SMS/voice templates exist but are not AI-telephony references.

---

## 4. Provider verification (Phase 4) — Retell AI

Evaluated Retell first (archive evidence). Findings verified against current sources (Oct 2026):

### 4.1 Verified facts

- **API:** `POST https://api.retellai.com/v2/create-phone-call`, Bearer API key; params `from_number`, `to_number`, `override_agent_id`, `retell_llm_dynamic_variables`/`dynamic_variables`. ([docs](https://docs.retellai.com/api-references/create-phone-call))
- **Webhooks:** signed with an `x-retell-signature` header, verified using your Retell API key; SDKs provide a `verify()` helper. Only the API key bearing the webhook badge verifies. ([secure-webhook](https://docs.retellai.com/features/secure-webhook), [webhook-overview](https://docs.retellai.com/features/webhook-overview))
- **Pricing (2026):** roughly **$0.07–$0.31/min** all-in; Retell voice infra ≈$0.055/min; dedicated number ≈$2.00/month. ([cekura](https://www.cekura.ai/blogs/retell-ai-pricing-per-minute), [ringg](https://www.ringg.ai/blog/retell-ai-pricing))
- Retell can **place calls that reach** Indian recipients; it sells **US/Canada numbers only** directly. ([international-call](https://docs.retellai.com/deploy/international-call))

### 4.2 The India `+91` constraint (critical — verified)

Using an **actual Indian +91 number as caller ID** is **not** a simple API setting:
- Per TRAI, an Indian number must terminate on **India-based infrastructure**; Retell supports connecting a local Indian SIP trunk via **Cloudonix SBC** in India. ([community: verified Indian caller ID](https://community.retellai.com/t/enable-verified-caller-id-indian-airtel-number-for-outbound-calls/789))
- An Indian number must be brought via **your own SIP trunk + a local Indian carrier**; Retell does not sell +91 numbers. ([community: add Indian number](https://community.retellai.com/t/needed-to-add-indian-number-to-make-call-to-indian-candidate/981))
- Transfers to +91 via the default Retell-Twilio number have known permission issues. ([community](https://community.retellai.com/t/call-transfer-to-india-91-failing-retell-twilio-number-permission-issue/2363))

**Do not** interpret "the API accepts `+91`" as proof the call connects with a valid Indian caller ID. That is the single biggest unverified risk.

### 4.3 Regulatory prerequisites (India) — **[PARTIALLY ASSUMPTION — must confirm with counsel/provider]**

Indian commercial/automated calling is governed by TRAI's TCCCPR; DLT registration and 140-series/consent rules typically apply to promotional/transactional traffic. A **consent-based 1:1 demo to a person who agreed** is lower-risk, but is **not automatically exempt**. AI and recording disclosure should be assumed required. **This must be confirmed; do not rely on an international caller ID to waive obligations.**

### 4.4 Outstanding provider prerequisites (blockers for a *real* call)

1. Retell account + API key (server-side only).
2. A usable outbound route to +91 **with a compliant caller ID** — either (a) Retell-managed number calling into India, caller-ID limitations accepted, or (b) a local Indian SIP trunk/carrier + DLT, integrated via Cloudonix SBC.
3. Account verification / KYC as required by Retell and the Indian carrier.
4. A configured Retell **agent** (voice, prompt, dynamic variables).
5. Billing/balance; confirmed per-minute + number costs.
6. Compliance sign-off (AI disclosure, recording consent, DLT if applicable).

**Per the brief, none of these paid/again-external steps will be performed without the operator's explicit approval.** The build will therefore implement a **clean provider boundary + mocked tests**, and the real call remains **gated** on the above.

### 4.5 Alternative

If Retell's +91 caller-ID path proves too heavy for the demo, **Vapi** or **Plivo/Exotel (Indian-native)** are fallbacks. No Vapi reference exists in the archives, so Retell remains the primary target. Decision deferred to operator.

---

## 5. Target architecture (smallest reliable)

```
autoscale-voice-demo/
  backend/     Node.js + Express. Firebase Admin SDK (verify ID token server-side).
               Firestore (Admin) for call records. Retell integration + webhook.
  frontend/    Vite + React + Tailwind. Firebase Web SDK for admin sign-in only.
  tests/       (or backend/tests) Automated tests, mocked provider, labeled.
  docs/        This audit, transfer manifest, schema, demo checklist.
  .env.example .gitignore  README.md
```

- **No** n8n, Redis, queues, or microservices (requirements don't justify them).
- Firestore is reused **as a store only**, in a **separate Firebase project** (or a dedicated, locked-down ruleset), accessed via the **Admin SDK server-side** so call records are never world-readable like the website's `users`/`analytics`.
- Provider calls and webhook verification happen **only** in `backend/`.

---

## 6. Isolation & security guardrails (from the brief, confirmed applicable)

- Do not modify/move/rename anything in `/Users/kishorevarma/Desktop/Autoscale`. (This audit is written to the **parent** dir to honor that.)
- Never copy `.env` (gitignored `.env`, `.env.*`) or any Firebase/service-account secret.
- Recreate `firebase.js` **without** logging config.
- Backend authorizes **every** sensitive endpoint via verified Firebase ID token + server-side allowlist — never trusting the client `isAdmin`.
- Webhook endpoint verifies `x-retell-signature` before trusting any event; idempotent; tolerant of out-of-order/duplicate delivery.
- Redact phone numbers and secrets in logs; restrict transcript/PII access; define retention/deletion.
- Recording **off by default** until disclosure/consent/retention are addressed.

---

## 7. What is safe to build now vs. blocked

**Safe to build now (no external paid action):** project scaffold; backend with server-side auth, phone validation, consent gating, rate/spend limits, call-record schema, a Retell integration module behind an interface, signature-verifying webhook, audit logging, redaction; the full dashboard; automated tests against a mocked provider; docs.

**Blocked on operator action (real live call):** Retell account/API key, the verified +91 outbound route + caller ID, KYC, DLT/compliance confirmation, billing. These are listed in §4.4.

**A working dashboard wired to mocks is explicitly NOT a completed real-call demo** — it will be labeled as such in the UI.

---

## 8. Transfer manifest

See `docs/TRANSFER_MANIFEST.md` (created in the standalone project). Default posture: **recreate small components**; copy only UI primitives whose dependency footprint is verified minimal; copy **no** secrets.
