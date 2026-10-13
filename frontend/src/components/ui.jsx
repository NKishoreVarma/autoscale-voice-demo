// Design system — dependency-free primitives for the AutoScale Voice AI dashboard.
// Deep navy/slate surfaces, restrained indigo accent, accessible states.
import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

export function cn(...parts) {
  return parts.filter(Boolean).join(' ');
}

/* ---------------------------------- Icons --------------------------------- */
// Minimal inline SVG set (no icon dependency). 1.5 stroke, currentColor.
const paths = {
  dashboard: 'M3 13h8V3H3v10Zm0 8h8v-6H3v6Zm10 0h8V11h-8v10Zm0-18v6h8V3h-8Z',
  phone:
    'M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106a1.125 1.125 0 0 0-1.173.417l-.97 1.293a16.5 16.5 0 0 1-6.312-6.312l1.293-.97a1.125 1.125 0 0 0 .417-1.173L8.344 4.476A1.125 1.125 0 0 0 7.252 3.625H5.88A2.25 2.25 0 0 0 3.63 5.875Z',
  list: 'M8.25 6.75h12M8.25 12h12M8.25 17.25h12M3.75 6.75h.008v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.008v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 17.25h.008v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z',
  plus: 'M12 4.5v15m7.5-7.5h-15',
  logout: 'M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9',
  check: 'm4.5 12.75 6 6 9-13.5',
  x: 'M6 18 18 6M6 6l12 12',
  alert: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z',
  search: 'm21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z',
  refresh: 'M16.023 9.348h4.992V4.356M4.5 15.75h4.992v4.993m-.001-4.992-3.181 3.183a8.25 8.25 0 0 1-11.667 0l-3.181-3.183m0 0h4.992',
  clock: 'M12 6v6l4 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  spark: 'M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z',
  back: 'M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18',
};

export function Icon({ name, className = 'w-5 h-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={paths[name] || ''} />
    </svg>
  );
}

/* --------------------------------- Button --------------------------------- */
export function Button({ variant = 'primary', size = 'md', className, children, ...props }) {
  const base =
    'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition focus-visible:outline-none disabled:opacity-50 disabled:pointer-events-none';
  const sizes = { sm: 'text-xs px-3 py-1.5', md: 'text-sm px-4 py-2.5', lg: 'text-sm px-5 py-3' };
  const variants = {
    primary: 'bg-accent-strong hover:bg-accent text-white shadow-sm',
    secondary: 'bg-ink-800 hover:bg-ink-700 text-slate-100 border border-ink-700',
    ghost: 'text-slate-300 hover:text-white hover:bg-ink-800',
    danger: 'bg-rose-600 hover:bg-rose-500 text-white',
  };
  return (
    <button className={cn(base, sizes[size], variants[variant], className)} {...props}>
      {children}
    </button>
  );
}

/* ---------------------------------- Card ---------------------------------- */
export function Card({ className, children }) {
  return (
    <div className={cn('rounded-2xl border border-ink-800 bg-ink-900 shadow-card', className)}>{children}</div>
  );
}
export function CardHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-ink-800 px-5 py-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/* --------------------------------- Badges --------------------------------- */
const STATUS_TONE = {
  queued: 'bg-slate-500/15 text-slate-300 ring-slate-500/30',
  initiated: 'bg-sky-500/15 text-sky-300 ring-sky-500/30',
  ringing: 'bg-amber-500/15 text-amber-300 ring-amber-500/30',
  in_progress: 'bg-indigo-500/15 text-indigo-300 ring-indigo-500/30',
  completed: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
  no_answer: 'bg-orange-500/15 text-orange-300 ring-orange-500/30',
  busy: 'bg-orange-500/15 text-orange-300 ring-orange-500/30',
  failed: 'bg-rose-500/15 text-rose-300 ring-rose-500/30',
  canceled: 'bg-slate-500/15 text-slate-400 ring-slate-500/30',
  unavailable: 'bg-rose-500/15 text-rose-300 ring-rose-500/30',
};
export function StatusBadge({ status }) {
  const tone = STATUS_TONE[status] || STATUS_TONE.queued;
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset', tone)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {String(status || 'unknown').replace(/_/g, ' ')}
    </span>
  );
}
export function TestBadge() {
  return (
    <span className="inline-flex items-center rounded-md bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-300 ring-1 ring-inset ring-amber-400/30">
      Test
    </span>
  );
}

/* --------------------------------- Fields --------------------------------- */
export function Field({ label, htmlFor, hint, error, children }) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={htmlFor} className="block text-xs font-medium text-slate-300">
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-xs text-rose-400">{error}</p>
      ) : hint ? (
        <p className="text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}
const fieldCls =
  'w-full rounded-lg border border-ink-700 bg-ink-850 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus-visible:border-accent-soft focus-visible:outline-none';
export function Input(props) {
  return <input className={cn(fieldCls, props.className)} {...props} />;
}
export function Textarea(props) {
  return <textarea className={cn(fieldCls, 'resize-none', props.className)} {...props} />;
}
export function Select({ className, children, ...props }) {
  return (
    <select className={cn(fieldCls, 'appearance-none', className)} {...props}>
      {children}
    </select>
  );
}

/* ------------------------------ Status helpers ---------------------------- */
export function Spinner({ className = 'w-5 h-5' }) {
  return (
    <svg className={cn('animate-spin text-slate-400', className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-90" d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
export function Skeleton({ className }) {
  return <div className={cn('skeleton rounded-md', className)} />;
}
export function EmptyState({ icon = 'spark', title, children, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-ink-800 text-slate-400">
        <Icon name={icon} className="h-6 w-6" />
      </div>
      <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
      {children && <p className="mt-1 max-w-sm text-sm text-slate-400">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
export function ErrorState({ title = 'Something went wrong', message, onRetry }) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400">
        <Icon name="alert" className="h-6 w-6" />
      </div>
      <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
      {message && <p className="mt-1 max-w-md text-sm text-slate-400">{message}</p>}
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-5" onClick={onRetry}>
          <Icon name="refresh" className="h-4 w-4" /> Retry
        </Button>
      )}
    </div>
  );
}

/* -------------------------------- StatCard -------------------------------- */
export function StatCard({ label, value, hint, tone = 'default', loading }) {
  const tones = {
    default: 'text-slate-100',
    good: 'text-emerald-300',
    warn: 'text-amber-300',
    bad: 'text-rose-300',
    accent: 'text-indigo-300',
  };
  return (
    <Card className="p-5">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</div>
      {loading ? (
        <Skeleton className="mt-3 h-7 w-16" />
      ) : (
        <div className={cn('mt-2 text-2xl font-semibold tabular-nums', tones[tone])}>{value}</div>
      )}
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </Card>
  );
}

/* --------------------------------- Dialog --------------------------------- */
export function Dialog({ open, title, children, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    ref.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full max-w-md animate-rise rounded-2xl border border-ink-700 bg-ink-900 p-6 shadow-pop focus-visible:outline-none"
      >
        <div className="flex items-start justify-between">
          <h3 className="text-base font-semibold text-slate-100">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-200">
            <Icon name="x" className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

/* ---------------------------------- Toast --------------------------------- */
const ToastCtx = createContext(null);
export function useToast() {
  return useContext(ToastCtx);
}
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback(
    (tone, message) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((t) => [...t, { id, tone, message }]);
      setTimeout(() => dismiss(id), 5000);
    },
    [dismiss]
  );
  const toast = {
    success: (m) => push('success', m),
    error: (m) => push('error', m),
    info: (m) => push('info', m),
  };
  const toneCls = {
    success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
    error: 'border-rose-500/30 bg-rose-500/10 text-rose-200',
    info: 'border-ink-700 bg-ink-800 text-slate-200',
  };
  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className="fixed bottom-4 right-4 z-[60] flex w-80 flex-col gap-2" aria-live="polite" aria-atomic="true">
        {toasts.map((t) => (
          <div key={t.id} className={cn('animate-rise rounded-lg border px-4 py-3 text-sm shadow-pop', toneCls[t.tone])}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
