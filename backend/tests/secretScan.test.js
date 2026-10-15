import { jest } from '@jest/globals';
import { scanText } from '../../scripts/secret-scan.mjs';

// All secrets below are SYNTHETIC dummies — not real credentials.
const DUMMY_SARVAM = 'sk_samvaad_' + 'DUMMY0000testtesttest';
const DUMMY_OPENAI = 'sk-' + 'DUMMYopenaikeyvalue1234567890';
const DUMMY_AWS = 'AKIA' + 'ABCDEFGHIJKLMNOP';
const DUMMY_GOOGLE = 'AIza' + 'A'.repeat(35);

describe('secret scanner — detects synthetic secrets', () => {
  test('flags a Sarvam sk_samvaad key', () => {
    const f = scanText(`SARVAM_API_KEY=${DUMMY_SARVAM}`, '.env.example');
    expect(f.length).toBeGreaterThan(0);
    expect(f.some((x) => x.rule === 'sarvam-api-key')).toBe(true);
  });

  test('flags OpenAI, AWS, Google style keys', () => {
    expect(scanText(`x=${DUMMY_OPENAI}`).some((x) => x.rule === 'openai-key')).toBe(true);
    expect(scanText(`x=${DUMMY_AWS}`).some((x) => x.rule === 'aws-access-key')).toBe(true);
    expect(scanText(`x=${DUMMY_GOOGLE}`).some((x) => x.rule === 'google-api-key')).toBe(true);
  });

  test('flags a non-empty secret in a dotenv assignment', () => {
    const f = scanText('MY_SERVICE_SECRET=supersecretvalue1234567', 'backend/.env');
    expect(f.some((x) => x.rule === 'dotenv-secret-value' || x.rule === 'openai-key')).toBe(true);
  });

  test('flags a private key block', () => {
    // Built by concatenation so the full literal marker isn't present in this
    // source file (otherwise the scanner would flag its own test fixture).
    const pk = '-----BEGIN RSA ' + 'PRIVATE KEY-----';
    expect(scanText(pk).some((x) => x.rule === 'private-key-block')).toBe(true);
  });
});

describe('secret scanner — passes safe content', () => {
  test('empty placeholder SARVAM_API_KEY= passes', () => {
    expect(scanText('SARVAM_API_KEY=', '.env.example')).toHaveLength(0);
  });

  test('other empty env placeholders pass', () => {
    const safe = [
      'RETELL_API_KEY=',
      'FIREBASE_SERVICE_ACCOUNT_PATH=',
      'SARVAM_ORG_ID=01a13ef1-e00d-7269-ada5-a4c04d28ca74',
      'SARVAM_AGENT_PHONE_NUMBER=+917965480920',
      'VOICE_PROVIDER=mock',
      'DEMO_AGENT_NAME=Aria',
    ].join('\n');
    expect(scanText(safe, '.env.example')).toHaveLength(0);
  });

  test('Firebase web API key (public client config) is allowlisted', () => {
    const line = 'VITE_FIREBASE_API_KEY=AIza' + 'B'.repeat(35);
    expect(scanText(line, 'frontend/.env.example')).toHaveLength(0);
  });

  test('ordinary source code with an idempotencyKey variable does not false-positive', () => {
    const code = "const idempotencyKey = `${phone}-${Date.now()}`;\napp.get('/health', (req,res)=>res.json({ok:true}));";
    expect(scanText(code, 'src/app.js')).toHaveLength(0);
  });

  test('findings never contain the raw secret value', () => {
    const f = scanText(`SARVAM_API_KEY=${DUMMY_SARVAM}`, '.env.example');
    const serialized = JSON.stringify(f);
    expect(serialized).not.toContain(DUMMY_SARVAM);
    expect(serialized).toMatch(/REDACTED/);
  });
});
