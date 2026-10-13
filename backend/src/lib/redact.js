// Redaction helpers — never let phone numbers or secrets reach logs or client errors.

// Keep country code + last 2 digits: +919876543210 -> +91******10
export function redactPhone(phone) {
  if (!phone || typeof phone !== 'string') return '[no-number]';
  const digits = phone.replace(/[^\d]/g, '');
  if (digits.length < 4) return '[redacted]';
  const last2 = digits.slice(-2);
  const cc = phone.startsWith('+') ? '+' + digits.slice(0, 2) : '';
  return `${cc}${'*'.repeat(Math.max(0, digits.length - (cc ? 4 : 2)))}${last2}`;
}

const SECRET_KEYS = /(api[_-]?key|secret|authorization|token|password|signature|service[_-]?account)/i;

// Keys whose string values are phone numbers. Anchored alternatives so we don't
// falsely match substrings like "to" inside "store".
const PHONE_KEYS = /^(phone|to|from|caller|callerid|e164|msisdn|mobile|destination|to_?number|from_?number)$/i;

// Deep-clone with secrets and phone-like values masked. Use before logging objects.
export function redactObject(obj, depth = 0) {
  if (depth > 6 || obj == null) return obj;
  if (typeof obj === 'string') {
    // Mask anything that looks like an E.164 phone number.
    return obj.replace(/\+?\d[\d\s().-]{7,}\d/g, (m) => redactPhone(m));
  }
  if (Array.isArray(obj)) return obj.map((v) => redactObject(v, depth + 1));
  if (typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      if (SECRET_KEYS.test(k)) out[k] = '[redacted]';
      else if (PHONE_KEYS.test(k) && typeof v === 'string') out[k] = redactPhone(v);
      else out[k] = redactObject(v, depth + 1);
    }
    return out;
  }
  return obj;
}
