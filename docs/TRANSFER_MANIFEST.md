# Transfer Manifest — autoscale-voice-demo

How each candidate file from the original AutoScale repo (`/Users/kishorevarma/Desktop/Autoscale`) was handled. **Nothing was moved, renamed, or deleted from the original.** Default posture: **recreate** small pieces to avoid coupling; copy **no** secrets.

Legend for **Decision**: `COPIED` (byte-for-byte) · `RECREATED` (new minimal equivalent inspired by original) · `NOT TRANSFERRED`.

| # | Original path | Destination | Purpose | Dependencies of original | Decision & required changes | Sensitive? | Verification |
|---|---|---|---|---|---|---|---|
| 1 | `src/firebase.js` | `frontend/src/lib/firebase.js` | Firebase Web SDK init for admin sign-in | `firebase/app,auth` + logs config | **RECREATED** — minimal init, **removed `console.log` of config/auth** (security). Auth only (no Firestore/Storage on client). | Reads public web config from env; no secrets in code | Frontend builds; no secret literals (`grep` clean) |
| 2 | `src/config/appConfig.js` | `frontend/src/lib/config.js` | Centralize `VITE_*` env | `import.meta.env` | **RECREATED** — Firebase web keys + `VITE_API_BASE_URL` only; dropped Gemini/Sentry/LogRocket | Public web config only | Build-time env resolution verified |
| 3 | `src/context/AuthContext.jsx` (395 LoC) | `frontend/src/context/AuthContext.jsx` | Admin auth state | Firebase auth, Firestore `users/clients`, audit logger, insecure super_admin fallback | **RECREATED** — minimal email/password + Google sign-in, exposes `getIdToken()`. **Dropped** client-side allowlist as an authz source, Firestore role reads, and the insecure error→super_admin fallback (authz now server-side). | No | Sign-in flow drives dashboard; token sent to backend |
| 4 | `src/components/ProtectedRoute.jsx` (79 LoC) | `frontend/src/components/ProtectedRoute.jsx` | Gate dashboard routes | website AuthContext, verbose logs | **RECREATED** — minimal gate on `user`+`loading`; no console spam. UI gate only; real authz is server-side. | No | Unauthenticated redirect to `/login` verified |
| 5 | `src/components/admin/ui/DataTable.jsx` (252) | `frontend/src/components/DataTable.jsx` | Table for call history | `framer-motion`, `lucide-react`, `Skeletons`, `EmptyState` | **RECREATED** — inspected imports; copying pulls in framer-motion + 2 extra files → unnecessary coupling. Rebuilt a lean table (React + minimal CSS). | No | Renders call history from API |
| 6 | `src/components/admin/ui/{Modal,SlidePanel,StatsCard,StatusBadge}.jsx` | `frontend/src/components/*` | UI primitives | `framer-motion`, `lucide-react` | **RECREATED** — same coupling reason; rebuilt dependency-free equivalents (`StatusBadge`, `StatsCard`, confirm `Modal`). | No | Used by dashboard pages |
| 7 | `tailwind.config.js`, `postcss.config.js` | `frontend/{tailwind,postcss}.config.js` | Styling | tailwind, autoprefixer | **RECREATED** — fresh clean theme for the demo (not the website's black theme); trivial to author. | No | Tailwind classes compile in build |
| 8 | `firestore.rules` (313 LoC) | `backend/firestore.rules` (new, locked) | Data store rules | n/a | **RECREATED** — demo store denies ALL direct client access; call records reachable only via Admin SDK on the backend. Opposite of website's permissive public-create rules. | No | Rules documented in `SCHEMA.md` |
| 9 | n8n `...AI_Phone_Agent_with_RetellAI.json`, `...RetellAI...qualify_outbound...json` | — (reference only) | API shape reference | n8n runtime | **NOT TRANSFERRED** — used only to learn `POST /v2/create-phone-call` + `from_number/to_number/dynamic_variables`. n8n is **not** a runtime dependency. | No | Shape mirrored in `backend/src/providers/retell.js` |
| 10 | `.env`, `.env.*` | — | secrets | — | **NOT TRANSFERRED** — never copy secrets. `.env.example` authored fresh with placeholders. | **YES** | Confirmed no `.env` copied; `.gitignore` excludes it |
| 11 | `src/pages/admin/Simulator.jsx`, `src/utils/*` (gemini, email, whatsapp, pdf, loggers) | — | website-specific | Firestore, Gemini | **NOT TRANSFERRED** — website business logic, irrelevant to telephony demo. | mixed | n/a |

## Rationale summary

- **Recreate over copy** was chosen wherever the original coupled to `framer-motion`, website-specific Firestore collections, verbose logging, or the insecure client-side authorization model. The brief explicitly permits recreating a small component when copying would introduce unnecessary coupling.
- **No secrets** (`.env`, service-account JSON, Firebase private keys) were copied. All credentials are supplied at runtime via environment variables documented in `.env.example`.
- The **original repository was not modified** — verified via `git status` (clean) before and after.
