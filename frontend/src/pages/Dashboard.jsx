import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { StatusBadge, TestBadge, StatsCard, Modal, Button } from '../components/ui.jsx';

function IntegrationStatus({ status }) {
  if (!status) return null;
  const live = status.mode === 'live' && status.providerConfigured;
  return (
    <div
      className={`rounded-xl border p-4 ${
        live ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-800">
            Provider: {status.provider} · Mode: {status.mode.toUpperCase()}
          </div>
          <div className="text-xs text-slate-600">
            Store: {status.store} · Agent: {status.demo.agentName} · Business: {status.demo.businessName}
          </div>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            live ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'
          }`}
        >
          {live ? 'Live route configured' : 'Test mode'}
        </span>
      </div>
      {status.outstanding?.length > 0 && (
        <ul className="mt-3 list-disc pl-5 text-xs text-amber-800">
          {status.outstanding.map((o) => (
            <li key={o}>{o}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

const TEST_SCENARIOS = [
  { value: 'completed', label: 'Successful completion' },
  { value: 'no_answer', label: 'Unanswered' },
  { value: 'failed', label: 'Failed call' },
  { value: 'timeout', label: 'Provider timeout (at dispatch)' },
  { value: 'no_transcript', label: 'Completed, missing transcript' },
  { value: 'no_cost', label: 'Completed, missing cost' },
  { value: 'reject', label: 'Provider rejection (at dispatch)' },
];

function CallForm({ status, onCreated }) {
  const [phone, setPhone] = useState('+91');
  const [note, setNote] = useState('');
  const [consentChecked, setConsentChecked] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [scenario, setScenario] = useState('completed');
  const isTest = status?.mode === 'test';

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      const idempotencyKey = `${phone}-${Date.now()}`;
      const res = await api.createCall({
        phone,
        consent: { confirmed: true, note },
        idempotencyKey,
        ...(isTest ? { testScenario: scenario } : {}),
      });
      setConfirmOpen(false);
      setConsentChecked(false);
      setNote('');
      onCreated(res.call);
    } catch (e) {
      setErr(e.message);
      setConfirmOpen(false);
      // A dispatch failure (e.g. timeout/reject) still persists a failed record —
      // refresh so it appears in history.
      onCreated(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-800">Start a call</h2>
      <p className="mt-1 text-xs text-slate-500">
        Enter a consenting recipient's Indian mobile number. {status?.mode === 'test' && 'Test mode places no real call.'}
      </p>

      <label className="mt-4 block text-sm font-medium text-slate-700">Recipient number (+91)</label>
      <input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="+91 98765 43210"
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />

      <label className="mt-4 block text-sm font-medium text-slate-700">Consent note (optional)</label>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="e.g. Agreed on WhatsApp at 3:40pm"
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />

      {isTest && (
        <>
          <label className="mt-4 block text-sm font-medium text-slate-700">
            Test scenario <span className="font-normal text-slate-400">(simulated outcome)</span>
          </label>
          <select
            value={scenario}
            onChange={(e) => setScenario(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            {TEST_SCENARIOS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </>
      )}

      <label className="mt-4 flex items-start gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={consentChecked}
          onChange={(e) => setConsentChecked(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          I confirm this recipient has <strong>consented</strong> to receive this AI demonstration call.
        </span>
      </label>

      {err && <div className="mt-3 text-sm text-rose-600">{err}</div>}

      <div className="mt-4">
        <Button disabled={!consentChecked || phone.trim().length < 5} onClick={() => setConfirmOpen(true)}>
          Place call
        </Button>
      </div>

      <Modal open={confirmOpen} title="Confirm outbound call" onClose={() => setConfirmOpen(false)}>
        <p className="text-sm text-slate-600">
          You are about to initiate an AI voice call to <strong>{phone}</strong>.
          {status?.mode === 'live'
            ? ' This will place a REAL call and may incur provider charges.'
            : ' This is TEST mode — no real call will be placed.'}
        </p>
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? 'Placing…' : 'Confirm & call'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

export default function Dashboard() {
  const [status, setStatus] = useState(null);
  const [calls, setCalls] = useState([]);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const [s, c] = await Promise.all([api.status(), api.listCalls()]);
      setStatus(s);
      setCalls(c.calls);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 3000); // poll so webhook/lifecycle updates appear
    return () => clearInterval(t);
  }, [refresh]);

  const completed = calls.filter((c) => c.status === 'completed').length;
  const providerCost = calls.reduce((s, c) => s + (c.cost?.amountUsd || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500">Manual outbound AI voice calls to consenting recipients.</p>
      </div>

      <IntegrationStatus status={status} />

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatsCard label="Total calls" value={calls.length} />
        <StatsCard label="Completed" value={completed} />
        <StatsCard
          label="Provider cost (reported)"
          value={`$${providerCost.toFixed(2)}`}
          hint="Provider-reported only; excludes estimates"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <CallForm status={status} onCreated={() => refresh()} />
        </div>

        <div className="lg:col-span-2">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-800">
              Call history
            </div>
            {calls.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-400">No calls yet.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-5 py-2">Recipient</th>
                    <th className="px-5 py-2">Status</th>
                    <th className="px-5 py-2">Duration</th>
                    <th className="px-5 py-2">Cost</th>
                    <th className="px-5 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {calls.map((c) => (
                    <tr key={c.id} className="border-t border-slate-100">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-slate-700">{c.destination}</span>
                          {c.isTest && <TestBadge />}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge status={c.status} />
                      </td>
                      <td className="px-5 py-3 text-slate-600">
                        {c.durationSec != null ? `${c.durationSec}s` : '—'}
                      </td>
                      <td className="px-5 py-3 text-slate-600">
                        {c.cost?.amountUsd != null ? `$${c.cost.amountUsd.toFixed(2)}` : '—'}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Link to={`/calls/${c.id}`} className="text-indigo-600 hover:underline">
                          Details
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
