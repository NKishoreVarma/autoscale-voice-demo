import { jest } from '@jest/globals';
import { validateIndianMobile } from '../src/lib/phone.js';

describe('phone validation (+91 India mobile)', () => {
  test('accepts a valid +91 mobile', () => {
    const r = validateIndianMobile('+919876543210');
    expect(r.valid).toBe(true);
    expect(r.e164).toBe('+919876543210');
  });

  test('accepts spaced/formatted +91 mobile', () => {
    const r = validateIndianMobile('+91 98765 43210');
    expect(r.valid).toBe(true);
  });

  test('rejects missing +91 prefix', () => {
    expect(validateIndianMobile('9876543210').valid).toBe(false);
  });

  test('rejects non-Indian number', () => {
    expect(validateIndianMobile('+14155552671').valid).toBe(false);
  });

  test('rejects too-short number', () => {
    expect(validateIndianMobile('+9112').valid).toBe(false);
  });

  test('rejects empty / undefined', () => {
    expect(validateIndianMobile('').valid).toBe(false);
    expect(validateIndianMobile(undefined).valid).toBe(false);
  });
});
