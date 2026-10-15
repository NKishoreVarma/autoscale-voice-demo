# Secret-leak prevention

This repo has three layers that stop API keys and other secrets from being committed.
Real secrets belong **only** in a gitignored `.env` or the host dashboard (Render) — never
in the repo, example files, docs, fixtures, or logs.

## 1. Local pre-commit hook (enable once)

The hook lives in `.githooks/` (version-controlled). Enable it on your machine:

```bash
git config core.hooksPath .githooks
```

From then on, every `git commit` runs `scripts/secret-scan.mjs --staged` and **aborts the
commit** if a likely secret is found in the staged changes. It requires Node (already used
by the project) and never prints the secret value — only the rule, file, line, and a
`[REDACTED len=N]` marker.

To verify it's active:
```bash
git config --get core.hooksPath   # should print: .githooks
```

## 2. The scanner (also usable by hand)

```bash
node scripts/secret-scan.mjs --staged     # scan staged changes (used by the hook)
node scripts/secret-scan.mjs --tree       # scan every tracked text file
node scripts/secret-scan.mjs <file...>    # scan specific files
```
Exit code `1` = a likely secret was found. Detects Sarvam (`sk_samvaad…`), OpenAI-style
`sk-`, Stripe `sk_live_`, AWS `AKIA…`, Google `AIza…`, GitHub/Slack tokens, PEM private-key
blocks, and any non-empty secret in a `*_API_KEY` / `*_SECRET` / `*_TOKEN` env assignment.

**Allowlist (narrow, documented):** empty env placeholders (`KEY=`), the non-secret Sarvam
sample identifiers in the supplied endpoint, and `VITE_FIREBASE_API_KEY` — the Firebase
**web** API key is public client config by design (shipped to the browser), so it is not
treated as a secret. See `scripts/secret-scan.mjs` and `.gitleaks.toml`.

## 3. CI secret scanning (GitHub Actions)

`.github/workflows/secret-scan.yml` runs on every push to `main` and every PR, with two
independent gates:
- **Gitleaks** (`gitleaks/gitleaks-action@v2`) using `.gitleaks.toml` (full history).
- The repo's own scanner over all tracked files (`--tree`).

No license is needed for a personal repo. If you later move the repo into a GitHub
**organization**, set the `GITLEAKS_LICENSE` secret (see the Gitleaks action docs).

## If a secret is ever committed
1. **Rotate it immediately** at the provider — assume it is compromised.
2. Remove it from the working tree and commit the fix.
3. If it reached shared history, purge it (e.g. `git filter-repo`) and force-push **only
   after coordinating** — do not rewrite shared history unilaterally.

## Notes for this project
- `*.env.example` files contain placeholders / known-public values only.
- Real `.env` files are gitignored (`.env`, `.env.*`, except `.env.example`).
- `SARVAM_API_KEY` must stay empty in `.env.example`; set the real key only in Render.
