# Indian Outbound Telephony — Route Verification

**Verified:** 2026-10-12 against current official docs + authoritative Indian telecom sources.
**Rule of evidence:** each row is tagged — **[DOC]** stated in official documentation · **[COMMUNITY]** from Retell support/community (needs written confirmation) · **[REG]** Indian regulatory source · **[ASSUMPTION]** inference · **[APPROVAL]** needs your decision.

---

## 1. Can Retell call Indian +91 mobiles?

**Yes — reaching the number is supported. The hard part is the caller ID and compliance, not connectivity.**

- **[DOC]** India (+91) is on Retell's supported international destination list for Retell-managed numbers. International surcharge: **Twilio $0.15/min, Telnyx $0.25/min** (on top of base). (https://docs.retellai.com/deploy/international-call)
- **[DOC]** Outbound requires: a configured **agent**, a `from_number` in E.164 that is "your Retell-managed or imported number", and the **API key**. (https://docs.retellai.com/deploy/outbound-call)
- **[DOC]** Retell sells **US/Canada** numbers directly. (https://docs.retellai.com/deploy/purchase-number — referenced)
- **[COMMUNITY]** An **Indian +91 caller ID** cannot be bought from Retell; it must be brought via your **own SIP trunk + a local Indian carrier**, and (per TRAI) terminate on **India-based infrastructure** (Retell references Cloudonix SBC in India). (https://community.retellai.com/t/enable-verified-caller-id-indian-airtel-number-for-outbound-calls/789 , https://community.retellai.com/t/needed-to-add-indian-number-to-make-call-to-indian-candidate/981)

**What the recipient sees:** with a Retell-managed number, an Indian recipient sees a **US/Canada caller ID** (likely flagged "international"). A genuine Indian caller ID requires the SIP-trunk/carrier path above.

## 2. India regulatory requirements (do NOT ignore because caller ID is foreign)

- **[REG]** TCCCPR 2018 (+2025 amendments) applies to **AI voice calls the same as human calls** — no exemption for automation. (squadstack.ai, vyora.ai, tabbly.io)
- **[REG]** Commercial callers must **register on the DLT platform**, use a registered **160-series** number for commercial calling, scrub against **DND**, keep **documented consent**, and **disclose on every call that it is AI-generated**. (caller.digital, frejun.com)
- **[REG]** TRAI is moving toward **verified caller-ID display** (entity name), increasing scrutiny of foreign/spoofed IDs.
- **[ASSUMPTION]** A single, consent-based, 1:1 **demo** to a person who explicitly agreed is materially lower-risk than a campaign — but there is **no clean statutory exemption**. Treat DLT/160-series + AI disclosure + documented consent as **required until counsel says otherwise**.
- The app already enforces **explicit consent** and the agent config **discloses it is an AI**; recording is **off by default**.

## 3. Option comparison

| Option | Technical requirements | Caller ID to recipient | +91 feasibility | Est. cost (source) | Setup complexity | Compliance deps | Known blockers | Recommended next action |
|---|---|---|---|---|---|---|---|---|
| **A. Retell-managed US/CA number → India** | Retell account, agent, buy US/CA number, API key | **US/CA number** (foreign, may be flagged) | **High** — supported destination [DOC] | base ~$0.07–0.31/min **+ $0.15–0.25/min intl** [DOC]; number ~$2/mo | **Low** | AI disclosure; consent; DLT applicability **unclear for foreign CID** [REG] | Foreign CID may lower answer rates / raise scrutiny | **Fastest path to one demo call.** Confirm with Retell that foreign-CID → +91 is permitted for a consented demo. |
| **B. Imported Indian +91 number via SIP trunk + local carrier** | Own SIP trunk, Indian carrier, number import, India-based termination (Cloudonix SBC), Retell custom telephony | **Indian +91** (local) | **Medium** — requires integration [COMMUNITY] | A-costs **+ carrier/SIP fees** (varies) [ASSUMPTION] | **High** | DLT registration, 160-series, KYC with carrier [REG] | Carrier onboarding + DLT lead time (days–weeks) | Pursue only if a local CID is required for the client. Start carrier + DLT early. |
| **C. Indian-native CPaaS (Plivo / Exotel / Ozonetel)** | Indian provider account, their voice-bot or SIP bridge to Retell | **Indian +91** | **Medium/High** (India-first) | India domestic rates [ASSUMPTION] | **Medium** | DLT built into provider onboarding [REG] | Integration with Retell agent less turnkey than A | Fallback if Retell's +91 path stalls. |

## 4. Simplest route to ONE compliant demo call

**Option A**, to a phone **you or a consenting colleague controls**, with: a Retell agent that opens by stating it's an AI from "AutoScale Demo", explicit consent recorded in the app, recording off, and a publicly reachable HTTPS webhook. Confirm Option A's permissibility in writing (inquiry below) before spending.

## 5. Draft support inquiry to Retell (send only with your approval — do not send automatically)

> Subject: Consent-based outbound AI demo call to an Indian (+91) mobile — route & compliance
>
> Hello Retell team,
>
> We are building a consent-based demonstration where an administrator manually places a **single** outbound AI voice call to an **Indian +91 mobile** belonging to a person who has explicitly consented. This is **not** bulk/marketing dialing. Could you confirm:
>
> 1. Using a **Retell-managed US/Canada number**, can we place an outbound call to a +91 mobile today, and what **caller ID** does the Indian recipient see?
> 2. Are there account-level **verification/KYC** steps required before international (+91) outbound is enabled on our account?
> 3. If we need an **Indian +91 caller ID**, what exactly is required (local SIP trunk, Indian carrier, number import, India-based termination / Cloudonix SBC), and what is the typical lead time?
> 4. What are the **exact per-minute charges** for a +91 call (voice infra + LLM + voice + international surcharge) and any **minimum balance / monthly** fees?
> 5. For the **webhook**, confirm the current **signature scheme** (`x-retell-signature`) and the recommended SDK verification function.
> 6. Any **India-specific compliance** prerequisites you enforce (DLT, 160-series, AI disclosure) for this use case?
>
> Thank you.

## 6. Public HTTPS deployment (for webhooks)

Retell must reach `POST https://<host>/api/webhooks/retell` over public HTTPS. For a demo: a tunnel (e.g. a reverse-tunnel service) to the local backend, or a small cloud deploy. The webhook route already verifies `x-retell-signature` and rejects unsigned/invalid events.
