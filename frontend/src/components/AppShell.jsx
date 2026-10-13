import { useEffect, useState, useCallback } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../lib/api.js';
import { Button, Icon, cn } from './ui.jsx';

const NAV = [
  { to: '/', label: 'Dashboard', icon: 'dashboard', end: true },
  { to: '/start', label: 'Start a call', icon: 'phone' },
  { to: '/calls', label: 'Call history', icon: 'list' },
];

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-strong text-white">
        <Icon name="phone" className="h-4 w-4" />
      </div>
      <div className="leading-tight">
        <div className="text-sm font-semibold text-slate-100">AutoScale</div>
        <div className="text-[10px] font-medium uppercase tracking-widest text-indigo-300/80">Voice AI Demo</div>
      </div>
    </div>
  );
}

function SidebarLinks({ onNavigate }) {
  return (
    <nav className="flex-1 space-y-1 px-3 py-4">
      {NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
              isActive ? 'bg-ink-800 text-white ring-1 ring-inset ring-ink-700' : 'text-slate-400 hover:bg-ink-850 hover:text-slate-200'
            )
          }
        >
          <Icon name={item.icon} className="h-5 w-5" />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

export default function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const loadStatus = useCallback(() => {
    api.status().then(setStatus).catch(() => setStatus(null));
  }, []);
  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const onLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isTest = status?.mode === 'test';

  return (
    <div className="min-h-screen bg-ink-950">
      {/* Persistent, impossible-to-miss TEST MODE banner */}
      {isTest && (
        <div className="sticky top-0 z-40 flex items-center justify-center gap-2 bg-amber-500 px-4 py-1.5 text-center text-xs font-semibold text-amber-950">
          <Icon name="alert" className="h-4 w-4" />
          TEST MODE — simulated calls only. No real phone calls are placed and no charges apply.
        </div>
      )}

      <div className="mx-auto flex max-w-[1400px]">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-ink-800 bg-ink-900 lg:flex">
          <div className="px-5 py-4">
            <Brand />
          </div>
          <SidebarLinks />
          <ConnectionCard status={status} />
        </aside>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
            <aside className="relative flex h-full w-64 flex-col border-r border-ink-800 bg-ink-900">
              <div className="flex items-center justify-between px-5 py-4">
                <Brand />
                <button onClick={() => setMobileOpen(false)} aria-label="Close menu" className="text-slate-400">
                  <Icon name="x" />
                </button>
              </div>
              <SidebarLinks onNavigate={() => setMobileOpen(false)} />
              <ConnectionCard status={status} />
            </aside>
          </div>
        )}

        {/* Main column */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-ink-800 bg-ink-950/80 px-4 py-3 backdrop-blur sm:px-6"
            style={{ top: isTest ? '28px' : '0' }}>
            <div className="flex items-center gap-3">
              <button
                className="rounded-lg p-2 text-slate-300 hover:bg-ink-800 lg:hidden"
                onClick={() => setMobileOpen(true)}
                aria-label="Open menu"
              >
                <Icon name="list" />
              </button>
              <div className="lg:hidden">
                <Brand />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <div className="text-xs font-medium text-slate-200">{user?.email}</div>
                <div className="text-[10px] uppercase tracking-wide text-slate-500">Administrator</div>
              </div>
              <Button variant="secondary" size="sm" onClick={onLogout}>
                <Icon name="logout" className="h-4 w-4" /> Sign out
              </Button>
            </div>
          </header>

          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <Outlet context={{ status, reloadStatus: loadStatus }} />
          </main>
        </div>
      </div>
    </div>
  );
}

function ConnectionCard({ status }) {
  const live = status?.mode === 'live';
  const ok = !!status;
  return (
    <div className="border-t border-ink-800 p-4">
      <div className="rounded-lg border border-ink-800 bg-ink-850 p-3">
        <div className="flex items-center gap-2 text-xs">
          <span className={cn('h-2 w-2 rounded-full', ok ? (live ? 'bg-emerald-400' : 'bg-amber-400') : 'bg-rose-400')} />
          <span className="font-medium text-slate-200">
            {ok ? (live ? 'Live provider' : 'Test mode') : 'Backend unreachable'}
          </span>
        </div>
        {status && (
          <div className="mt-1 text-[11px] text-slate-500">
            Provider: {status.provider} · Store: {status.store}
          </div>
        )}
      </div>
    </div>
  );
}
