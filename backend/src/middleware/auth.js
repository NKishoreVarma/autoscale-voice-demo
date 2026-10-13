// Server-side authentication & authorization for every sensitive endpoint.
// NEVER trusts a client-provided "isAdmin" flag. The client sends a Firebase ID
// token (Authorization: Bearer <token>); we verify it server-side and check the
// email against the server-side ADMIN_ALLOWLIST.
import { config } from '../config.js';
import { logger } from '../lib/logger.js';

// Default verifier uses Firebase Admin. Overridable in tests via setTokenVerifier.
let tokenVerifier = async (idToken) => {
  const { verifyIdToken } = await import('../firebaseAdmin.js');
  return verifyIdToken(idToken);
};

export function setTokenVerifier(fn) {
  tokenVerifier = fn;
}

export async function requireAdmin(req, res, next) {
  try {
    const header = req.get('authorization') || '';
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      return res.status(401).json({ error: 'Missing bearer token.', code: 'AUTH_MISSING' });
    }
    let decoded;
    try {
      decoded = await tokenVerifier(match[1]);
    } catch {
      return res.status(401).json({ error: 'Invalid or expired token.', code: 'AUTH_INVALID' });
    }
    const email = (decoded.email || '').toLowerCase();
    if (!email || !decoded.email_verified) {
      return res
        .status(403)
        .json({ error: 'Your email address is not verified.', code: 'EMAIL_NOT_VERIFIED' });
    }
    if (!config.adminAllowlist.includes(email)) {
      logger.warn('authz.denied', { email });
      return res
        .status(403)
        .json({ error: 'This account is not authorized for the demo.', code: 'FORBIDDEN_ADMIN' });
    }
    req.admin = { uid: decoded.uid, email };
    return next();
  } catch (err) {
    logger.error('auth.middleware.error', { message: err.message });
    return res.status(500).json({ error: 'Authentication error.', code: 'AUTH_ERROR' });
  }
}
