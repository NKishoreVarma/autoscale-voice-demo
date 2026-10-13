// Per-admin rate limiting for call initiation. Keyed by authenticated admin email
// (set by requireAdmin), falling back to IP. This is defense-in-depth on top of the
// daily/concurrency/spend limits enforced in callService.
import rateLimit from 'express-rate-limit';
import { config } from '../config.js';

export const initiateCallLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: config.limits.perMinute,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.admin?.email || req.ip,
  message: { error: 'Rate limit exceeded. Please wait a moment.' },
});
