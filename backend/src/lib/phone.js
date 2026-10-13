// Server-side phone validation. Demo is restricted to Indian (+91) mobile numbers.
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { ALLOWED_COUNTRY } from '../config.js';

// Returns { valid, e164, reason }
export function validateIndianMobile(input) {
  if (!input || typeof input !== 'string') {
    return { valid: false, reason: 'Phone number is required.' };
  }
  const raw = input.trim();
  if (!raw.startsWith('+91')) {
    return { valid: false, reason: 'Number must start with +91 (India).' };
  }
  let parsed;
  try {
    parsed = parsePhoneNumberFromString(raw, ALLOWED_COUNTRY);
  } catch {
    return { valid: false, reason: 'Could not parse the phone number.' };
  }
  if (!parsed || !parsed.isValid()) {
    return { valid: false, reason: 'Not a valid Indian phone number.' };
  }
  if (parsed.country !== ALLOWED_COUNTRY) {
    return { valid: false, reason: 'Only Indian (+91) numbers are allowed.' };
  }
  // Reject only when the type is KNOWN and clearly not a mobile line. The default
  // (compact) metadata often returns undefined for getType(); in that case we rely
  // on isValid() + country + the +91 prefix rather than falsely rejecting.
  const type = typeof parsed.getType === 'function' ? parsed.getType() : undefined;
  const nonMobile = ['FIXED_LINE', 'TOLL_FREE', 'PREMIUM_RATE', 'VOIP', 'PAGER'];
  if (type && nonMobile.includes(type)) {
    return { valid: false, reason: 'Number does not appear to be a mobile line.' };
  }
  return { valid: true, e164: parsed.number };
}
