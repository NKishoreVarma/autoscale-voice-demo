// Route gate. UI gate only — the backend independently authorizes every request.
// Adds a clear email-verification step, because the backend REQUIRES a verified
// email (returns 403 EMAIL_NOT_VERIFIED otherwise). We never bypass that server check.
import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Button, Card, Icon, Spinner, useToast } from './ui.jsx';

export default function ProtectedRoute({ children }) {
  const { user, loading, emailVerified, sendVerification, refreshVerification, logout } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-950">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <Spinner className="h-6 w-6" />
          <span className="text-xs font-medium uppercase tracking-widest">Verifying credentials…</span>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (!emailVerified) {
    const resend = async () => {
      setBusy(true);
      try {
        await sendVerification();
        toast.success('Verification email sent. Check your inbox, then click “I’ve verified”.');
      } catch (e) {
        toast.error(e.message || 'Could not send verification email.');
      } finally {
        setBusy(false);
      }
    };
    const recheck = async () => {
      setBusy(true);
      try {
        const ok = await refreshVerification();
        if (!ok) toast.error('Still not verified. Click the link in the email, then try again.');
      } finally {
        setBusy(false);
      }
    };
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-950 p-4">
        <Card className="w-full max-w-md p-7 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
            <Icon name="alert" className="h-6 w-6" />
          </div>
          <h1 className="text-base font-semibold text-slate-100">Verify your email to continue</h1>
          <p className="mt-2 text-sm text-slate-400">
            For security, the backend only accepts verified accounts. We’ve sent (or can resend) a
            verification link to <span className="text-slate-200">{user.email}</span>.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Button onClick={recheck} disabled={busy}>I’ve verified — continue</Button>
            <Button variant="secondary" onClick={resend} disabled={busy}>Resend verification email</Button>
            <Button variant="ghost" size="sm" onClick={logout}>Sign in with a different account</Button>
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Tip: signing in with Google uses a pre-verified email and skips this step.
          </p>
        </Card>
      </div>
    );
  }

  return children;
}
