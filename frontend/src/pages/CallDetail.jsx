import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, describeError } from '../lib/api.js';
import { fmtDateTime, fmtDuration, fmtCost, titleCase } from '../lib/format.js';
import {
  Card, CardHeader, StatusBadge, TestBadge, Icon, Spinner, ErrorState, Button, cn,
} from '../components/ui.jsx';

const LIFECYCLE = ['queued', 'initiated', 'ringing', 'in_progress', 'completed'];

function Row({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 text-sm">
      <span className="text-slate-400">{label}</span>
      <span className="text-right text-slate-200">{children ?? '—'}</span>
    </div>
  );
}

export default function CallDetail() {
  const { id } = useParams();
  const [call, setCall] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await api.getCall(id);
      setCall(res.call);
      setError(null);
    } catch (e) {
      setError(describeError(e));
    }
  }, [id]);

  useEffect(() => {
    load();
    // Poll while the call is still active; stop once terminal.
    const t = setInterval(() => {
      setCall((c) => {
        if (c && !['queued', 'initiated', 'ringing', 'in_progress'].includes(c.status)) return c;
        load();
        return c;
      });
    }, 3000);
    return () => clearInterval(t);
  }, [load]);

  if (error) {
    return (
      <div className="mx-auto max-w-3xl">
        <BackLink />
        <Card className="mt-4"><ErrorState message={error} onRetry={load} /></Card>
      </div>
    );
  }
  if (!call) {
    return (
      <div className="mx-auto flex max-w-3xl items-center gap-3 py-16 text-slate-400">
        <Spinner className="h-5 w-5" /> Loading call…
      </div>
    );
  }

  const terminal = !['queued', 'initiated', 'ringing', 'in_progress'].includes(call.status);
  const costSource = call.cost ? 'Provider-reported' : call.estimatedCost ? 'Estimate only' : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <BackLink />

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold text-slate-100">Call details</h1>
        <StatusBadge status={call.status} />
        {call.isTest && <TestBadge />}
      </div>

      {/* Lifecycle timeline */}
      <Card className="p-5">
        <div className="flex items-center gap-2">
          {LIFECYCLE.map((step, i) => {
            const idx = LIFECYCLE.indexOf(call.status);
            const reached = terminal || (idx >= 0 && i <= idx);
            const isFailish = terminal && call.status !== 'completed';
            return (
              <div key={step} className="flex flex-1 items-center gap-2">
                <div className={cn('flex h-7 w-7 items-center justify-center rounded-full text-xs',
                  reached ? (isFailish && i === LIFECYCLE.length - 1 ? 'bg-rose-500/20 text-rose-300' : 'bg-indigo-500/20 text-indigo-300') : 'bg-ink-800 text-slate-500')}>
                  {reached ? <Icon name="check" className="h-4 w-4" /> : i + 1}
                </div>
                {i < LIFECYCLE.length - 1 && <div className={cn('h-px flex-1', reached ? 'bg-indigo-500/40' : 'bg-ink-800')} />}
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex justify-between text-[11px] text-slate-500">
          {LIFECYCLE.map((s) => <span key={s} className="capitalize">{s.replace(/_/g, ' ')}</span>)}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader title="Overview" />
          <div className="divide-y divide-ink-800 px-5 py-1">
            <Row label="Recipient"><span className="font-mono">{call.destination}</span></Row>
            <Row label="Provider">{call.provider}</Row>
            <Row label="Provider call ID"><span className="font-mono text-xs">{call.providerCallId || '—'}</span></Row>
            <Row label="Initiated by">{call.initiatedBy}</Row>
            <Row label="Consent">{call.consent?.confirmed ? `Confirmed · ${fmtDateTime(call.consent.timestamp)}` : 'Not confirmed'}</Row>
          </div>
        </Card>
        <Card>
          <CardHeader title="Timing & usage" />
          <div className="divide-y divide-ink-800 px-5 py-1">
            <Row label="Created">{fmtDateTime(call.timestamps?.createdAt)}</Row>
            <Row label="Connected">{fmtDateTime(call.timestamps?.connectedAt)}</Row>
            <Row label="Completed">{fmtDateTime(call.timestamps?.completedAt)}</Row>
            <Row label="Duration">{fmtDuration(call.durationSec)}</Row>
            <Row label="Cost">
              {call.cost ? fmtCost(call.cost) : call.estimatedCost ? `~${fmtCost(call.estimatedCost)}` : '—'}
              {costSource && <span className="ml-2 text-[11px] text-slate-500">({costSource})</span>}
            </Row>
            <Row label="Recording">{call.recording?.enabled ? 'Enabled' : 'Disabled'}</Row>
          </div>
        </Card>
      </div>

      {call.error && (
        <Card className="border-rose-500/30">
          <CardHeader title="Failure diagnostics" />
          <div className="px-5 py-4 text-sm">
            <div className="font-medium text-rose-300">{titleCase(call.error.category)}</div>
            <p className="mt-1 text-slate-300">{call.error.message}</p>
            {call.disconnectReason && <p className="mt-1 text-xs text-slate-500">Disconnect reason: {call.disconnectReason}</p>}
          </div>
        </Card>
      )}

      <Card>
        <CardHeader title="AI summary" />
        <div className="px-5 py-4 text-sm text-slate-300">
          {call.summary || <span className="text-slate-500">No summary available{terminal ? '' : ' yet'}.</span>}
        </div>
      </Card>

      <Card>
        <CardHeader title="Transcript" subtitle={call.transcriptAvailable ? undefined : 'Not available'} />
        <div className="px-5 py-4">
          {call.transcriptAvailable && call.transcript ? (
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-ink-950 p-4 text-xs leading-relaxed text-slate-300">
              {typeof call.transcript === 'string' ? call.transcript : JSON.stringify(call.transcript, null, 2)}
            </pre>
          ) : (
            <p className="text-sm text-slate-500">No transcript available{terminal ? '' : ' yet'}.</p>
          )}
        </div>
      </Card>
    </div>
  );
}

function BackLink() {
  return (
    <Link to="/calls" className="inline-flex items-center gap-1.5 text-sm text-indigo-300 hover:text-indigo-200">
      <Icon name="back" className="h-4 w-4" /> Back to call history
    </Link>
  );
}
