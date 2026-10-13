import { useEffect, useState } from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Button } from '../components/ui.jsx';
import { api } from '../lib/api.js';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState(null);

  useEffect(() => {
    api
      .status()
      .then((s) => setMode(s.mode))
      .catch(() => setMode(null));
  }, []);

  const onLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen">
      {mode === 'test' && (
        <div className="bg-amber-500 px-4 py-1.5 text-center text-xs font-semibold text-white">
          TEST MODE — simulated calls only. No real phone calls are placed and no telephony charges apply.
        </div>
      )}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-base font-bold text-slate-900">AutoScale</span>
            <span className="rounded bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600">
              Voice Demo
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-500">{user?.email}</span>
            <Button variant="secondary" onClick={onLogout}>
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
