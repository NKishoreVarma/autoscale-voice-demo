import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Button, Card, Field, Input, Icon, Spinner } from '../components/ui.jsx';

export default function Login() {
  const { user, loading, configured, loginWithEmail, loginWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  if (!loading && user) return <Navigate to="/" replace />;

  const run = async (fn) => {
    setErr(null);
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setErr(mapFirebaseError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-accent-strong text-white">
            <Icon name="phone" className="h-5 w-5" />
          </div>
          <h1 className="text-lg font-semibold text-slate-100">AutoScale Voice AI</h1>
          <p className="text-sm text-slate-400">Administrator sign-in</p>
        </div>

        {!configured && (
          <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
            Firebase is not configured. Set the <code>VITE_FIREBASE_*</code> variables.
          </div>
        )}

        <Card className="p-6">
          <Button
            variant="secondary"
            className="w-full"
            disabled={!configured || busy}
            onClick={() => run(loginWithGoogle)}
          >
            <GoogleGlyph /> Continue with Google
          </Button>
          <p className="mt-2 text-center text-[11px] text-slate-500">Recommended — Google emails are pre-verified</p>

          <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-wide text-slate-600">
            <span className="h-px flex-1 bg-ink-800" /> or email <span className="h-px flex-1 bg-ink-800" />
          </div>

          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => loginWithEmail(email, password));
            }}
          >
            <Field label="Email" htmlFor="email">
              <Input id="email" type="email" autoComplete="email" value={email}
                onChange={(e) => setEmail(e.target.value)} required />
            </Field>
            <Field label="Password" htmlFor="password">
              <Input id="password" type="password" autoComplete="current-password" value={password}
                onChange={(e) => setPassword(e.target.value)} required />
            </Field>
            {err && <p className="text-sm text-rose-400" role="alert">{err}</p>}
            <Button type="submit" className="w-full" disabled={!configured || busy}>
              {busy ? <Spinner className="h-4 w-4" /> : 'Sign in'}
            </Button>
          </form>
        </Card>
        <p className="mt-4 text-center text-xs text-slate-500">
          Access is restricted to administrators on the server-side allowlist.
        </p>
      </div>
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z" />
    </svg>
  );
}

function mapFirebaseError(e) {
  const code = e?.code || '';
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found'))
    return 'Incorrect email or password.';
  if (code.includes('too-many-requests')) return 'Too many attempts. Please wait and try again.';
  if (code.includes('popup-closed') || code.includes('cancelled-popup')) return 'Sign-in was cancelled.';
  if (code.includes('network')) return 'Network error. Check your connection.';
  return e?.message || 'Sign-in failed.';
}
