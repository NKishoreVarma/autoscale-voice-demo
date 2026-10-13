import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { StatusBadge, TestBadge } from '../components/ui.jsx';

function Row({ label, children }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 py-2 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-right text-slate-800">{children}</span>
    </div>
  );
}

function fmt(ts) {
  if (!ts) return '—';
  const n = typeof ts === 'number' && ts < 1e12 ? ts * 1000 : ts; // handle sec vs ms
  return new Date(n).toLocaleString();
}

export default function CallDetail() {
  const { id } = useParams();
  const [call, setCall] = useState(null);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const res = await api.getCall(id);
      setCall(res.call);
    } catch (e) {
      setError(e.message);
    }
  }, [id]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, [refresh]);

  if (error) return <div className="text-sm text-rose-600">{error}</div>;
  if (!call) return <div className="text-sm text-slate-400">Loading…</div>;

  return (
    <div className="space-y-6">
      <Link to="/" className="text-sm text-indigo-600 hover:underline">
        ← Back to dashboard
      </Link>

      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold text-slate-900">Call details</h1>
        <StatusBadge status={call.status} />
        {call.isTest && <TestBadge />}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Overview</h2>
          <Row label="Recipient">{call.destination}</Row>
          <Row label="Provider">{call.provider}</Row>
          <Row label="Provider call ID">{call.providerCallId || '—'}</Row>
          <Row label="Initiated by">{call.initiatedBy}</Row>
          <Row label="Consent confirmed">
            {call.consent?.confirmed ? `Yes · ${fmt(call.consent.timestamp)}` : 'No'}
          </Row>
          <Row label="Created">{fmt(call.timestamps?.createdAt)}</Row>
          <Row label="Connected">{fmt(call.timestamps?.connectedAt)}</Row>
          <Row label="Completed">{fmt(call.timestamps?.completedAt)}</Row>
          <Row label="Duration">{call.durationSec != null ? `${call.durationSec}s` : '—'}</Row>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Usage & diagnostics</h2>
          <Row label="Provider-reported cost">
            {call.cost?.amountUsd != null ? `$${call.cost.amountUsd.toFixed(2)}` : 'Not reported'}
          </Row>
          <Row label="Pre-call estimate">
            {call.estimatedCost?.amountUsd != null
              ? `~$${call.estimatedCost.amountUsd.toFixed(2)} (estimate)`
              : '—'}
          </Row>
          <Row label="Recording">{call.recording?.enabled ? 'Enabled' : 'Disabled'}</Row>
          <Row label="Disconnect reason">{call.disconnectReason || '—'}</Row>
          {call.error && (
            <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              <div className="font-semibold">Error: {call.error.category}</div>
              <div>{call.error.message}</div>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold text-slate-800">AI summary</h2>
        <p className="text-sm text-slate-600">{call.summary || 'No summary yet.'}</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold text-slate-800">Transcript</h2>
        {call.transcriptAvailable ? (
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-xs text-slate-700">
            {typeof call.transcript === 'string'
              ? call.transcript
              : JSON.stringify(call.transcript, null, 2)}
          </pre>
        ) : (
          <p className="text-sm text-slate-400">No transcript available yet.</p>
        )}
      </div>
    </div>
  );
}
