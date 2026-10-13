import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Button } from '../components/ui.jsx';

export default function Login() {
  const { user, loading, configured, loginWithEmail, loginWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  if (!loading && user) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await loginWithEmail(email, password);
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="text-xl font-bold text-slate-900">AutoScale</div>
          <div className="text-sm text-slate-500">AI Voice Calling Demo — Admin</div>
        </div>

        {!configured && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Firebase is not configured. Set the <code>VITE_FIREBASE_*</code> values in
            <code> frontend/.env</code> to enable secure sign-in.
          </div>
        )}

        <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <label className="block text-sm font-medium text-slate-700">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            required
          />
          <label className="mt-4 block text-sm font-medium text-slate-700">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            required
          />
          {err && <div className="mt-3 text-sm text-rose-600">{err}</div>}
          <div className="mt-5">
            <Button type="submit" disabled={busy || !configured} style={{ width: '100%' }}>
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
          </div>
          <div className="my-4 text-center text-xs text-slate-400">or</div>
          <Button
            type="button"
            variant="secondary"
            onClick={loginWithGoogle}
            disabled={!configured}
            style={{ width: '100%' }}
          >
            Continue with Google
          </Button>
        </form>
        <p className="mt-4 text-center text-xs text-slate-400">
          Access is restricted to administrators on the server-side allowlist.
        </p>
      </div>
    </div>
  );
}
