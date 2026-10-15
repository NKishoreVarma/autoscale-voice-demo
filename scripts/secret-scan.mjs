#!/usr/bin/env node
// Secret-leak scanner for the autoscale-voice-demo repo.
//
// Usage:
//   node scripts/secret-scan.mjs --staged        # scan staged (git-added) content
//   node scripts/secret-scan.mjs <file> [file…]  # scan specific files
//   node scripts/secret-scan.mjs --tree          # scan all tracked text files
//
// Exits 1 when a likely secret is found. NEVER prints the secret value — findings
// are reported as rule + location + a redacted mask only.
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// High-signal patterns. Each: { id, re, desc }. `re` must be global.
const RULES = [
  { id: 'sarvam-api-key', re: /sk_samvaad[_a-zA-Z0-9]{6,}/g, desc: 'Sarvam API key' },
  { id: 'openai-key', re: /sk-(?:proj-)?[A-Za-z0-9_-]{20,}/g, desc: 'OpenAI-style sk- key' },
  { id: 'stripe-live', re: /sk_live_[A-Za-z0-9]{16,}/g, desc: 'Stripe live key' },
  { id: 'aws-access-key', re: /AKIA[0-9A-Z]{16}/g, desc: 'AWS access key id' },
  { id: 'google-api-key', re: /AIza[0-9A-Za-z_-]{35}/g, desc: 'Google API key' },
  { id: 'github-token', re: /gh[pousr]_[A-Za-z0-9]{20,}/g, desc: 'GitHub token' },
  { id: 'slack-token', re: /xox[baprs]-[A-Za-z0-9-]{10,}/g, desc: 'Slack token' },
  { id: 'private-key-block', re: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/g, desc: 'Private key block' },
];

// A dotenv assignment carrying a non-empty, non-placeholder secret value.
const DOTENV_SECRET = /^[A-Z0-9_]*(?:API[_-]?KEY|APIKEY|SECRET|TOKEN|PASSWORD|PRIVATE[_-]?KEY)\s*=\s*(.+)$/i;
const PLACEHOLDER = /^(?:<.*>|your[-_ ]|changeme|placeholder|example|xxx+|\.\.\.|\$\{.*\}|["']?["']?)$/i;

function mask(len) {
  return `[REDACTED len=${len}]`;
}

// Lines that are known-public and must NOT be flagged. Kept deliberately narrow.
const ALLOWLIST = [
  // Firebase WEB API key is public client config (Google ships it to the browser).
  // Only the VITE_FIREBASE_API_KEY assignment is exempt — not arbitrary AIza keys.
  /^\s*VITE_FIREBASE_API_KEY\s*=/,
];

// Scan a single logical text blob. Returns findings (no secret values).
export function scanText(text, source = '') {
  const findings = [];
  const lines = String(text).split(/\r?\n/);
  lines.forEach((line, i) => {
    if (ALLOWLIST.some((re) => re.test(line))) return;
    for (const rule of RULES) {
      rule.re.lastIndex = 0;
      const m = rule.re.exec(line);
      if (m) findings.push({ rule: rule.id, desc: rule.desc, source, line: i + 1, masked: mask(m[0].length) });
    }
    const dv = line.match(DOTENV_SECRET);
    if (dv) {
      const value = dv[1].trim().replace(/^["']|["']$/g, '');
      if (value && !PLACEHOLDER.test(value)) {
        // Avoid double-reporting if a high-signal rule already matched this line.
        if (!findings.some((f) => f.source === source && f.line === i + 1)) {
          findings.push({ rule: 'dotenv-secret-value', desc: 'Non-empty secret in env assignment', source, line: i + 1, masked: mask(value.length) });
        }
      }
    }
  });
  return findings;
}

function gitStagedAddedLinesByFile() {
  // -U0 so only changed lines; parse added lines grouped by file.
  const diff = execSync('git diff --cached --unified=0 --no-color', { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  const byFile = {};
  let file = '';
  let lineNo = 0;
  for (const raw of diff.split('\n')) {
    if (raw.startsWith('+++ ')) {
      file = raw.replace(/^\+\+\+ b\//, '').replace(/^\+\+\+ /, '');
      byFile[file] = byFile[file] || [];
    } else if (raw.startsWith('@@')) {
      const m = raw.match(/\+(\d+)/);
      lineNo = m ? parseInt(m[1], 10) : 0;
    } else if (raw.startsWith('+') && !raw.startsWith('+++')) {
      byFile[file] = byFile[file] || [];
      byFile[file].push(raw.slice(1));
    }
  }
  return byFile;
}

function trackedTextFiles() {
  const out = execSync('git ls-files', { encoding: 'utf8' });
  return out.split('\n').filter(Boolean).filter((f) => !/\.(png|jpg|jpeg|gif|webp|mp4|webm|pdf|ico|woff2?|ttf)$/i.test(f));
}

function run() {
  const args = process.argv.slice(2);
  const all = [];
  if (args.includes('--staged')) {
    const byFile = gitStagedAddedLinesByFile();
    for (const [file, lines] of Object.entries(byFile)) {
      if (/\.(png|jpg|jpeg|gif|webp|mp4|webm|pdf|ico|woff2?|ttf)$/i.test(file)) continue;
      all.push(...scanText(lines.join('\n'), file));
    }
  } else if (args.includes('--tree')) {
    for (const f of trackedTextFiles()) {
      try {
        all.push(...scanText(readFileSync(f, 'utf8'), f));
      } catch {
        /* unreadable/binary — skip */
      }
    }
  } else if (args.length) {
    for (const f of args) {
      try {
        all.push(...scanText(readFileSync(f, 'utf8'), f));
      } catch {
        process.stderr.write(`secret-scan: cannot read ${f}\n`);
      }
    }
  } else {
    process.stderr.write('Usage: secret-scan.mjs --staged | --tree | <file...>\n');
    process.exit(2);
  }

  if (all.length) {
    process.stderr.write('\n[31m✖ Potential secret(s) detected — commit blocked.[0m\n');
    for (const f of all) {
      process.stderr.write(`  • ${f.rule} (${f.desc}) in ${f.source || '<input>'}:${f.line} ${f.masked}\n`);
    }
    process.stderr.write('\nRemove the secret. Real keys belong in a gitignored .env or the host dashboard, never in the repo.\n');
    process.exit(1);
  }
  process.stdout.write('secret-scan: no secrets detected.\n');
  process.exit(0);
}

// Run as CLI only when invoked directly (not when imported by tests).
if (import.meta.url === `file://${process.argv[1]}`) run();
