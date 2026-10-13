import { useEffect, useState, useCallback } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { api, describeError } from '../lib/api.js';
import { fmtDuration, fmtCost, fmtDateTime } from '../lib/format.js';
import {
  Card, CardHeader, StatCard, StatusBadge, TestBadge, Button, Icon,
  EmptyState, ErrorState, Skeleton,
} from '../components/ui.jsx';

export default function Overview() {
  const { status } = useOutletContext();
  const [calls, setCalls] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await api.listCalls();
      setCalls(res.calls);
      setError(null);
    } catch (e) {
      setError(describeError(e));
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  const loading = calls === null && !error;
  const list = calls || [];
  const count = (f) => list.filter(f).length;
  const inProgress = count((c) => ['queued', 'initiated', 'ringing', 'in_progress'].includes(c.status));
  const totalDuration = list.reduce((s, c) => s + (c.durationSec || 0), 0);
  const providerCost = list.reduce((s, c) => s + (c.cost?.amountUsd || 0), 0);
  const recent = list.slice(0, 6);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Dashboard</h1>
          <p className="text-sm text-slate-400">Manual, consent-based outbound AI voice calls.</p>
        </div>
        <Link to="/start">
          <Button><Icon name="plus" className="h-4 w-4" /> Start a call</Button>
        </Link>
      </div>

      {error ? (
        <Card><ErrorState message={error} onRetry={load} /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Total calls" value={list.length} loading={loading} />
            <StatCard label="Completed" value={count((c) => c.status === 'completed')} tone="good" loading={loading} />
            <StatCard label="In progress" value={inProgress} tone="accent" loading={loading} />
            <StatCard label="Failed" value={count((c) => ['failed', 'unavailable'].includes(c.status))} tone="bad" loading={loading} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <StatCard label="Total talk time" value={fmtDuration(totalDuration)} loading={loading} hint="Sum of completed-call durations" />
            <StatCard
              label="Provider-reported cost"
              value={`$${providerCost.toFixed(2)}`}
              loading={loading}
              hint="Actual provider charges only — excludes pre-call estimates"
            />
          </div>

          <Card>
            <CardHeader
              title="Recent activity"
              subtitle={status?.mode === 'test' ? 'Simulated calls (test mode)' : 'Live calls'}
              action={<Link to="/calls" className="text-xs font-medium text-indigo-300 hover:text-indigo-200">View all</Link>}
            />
            {loading ? (
              <div className="space-y-2 p-4">
                {[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : recent.length === 0 ? (
              <EmptyState icon="phone" title="No calls yet"
                action={<Link to="/start"><Button size="sm"><Icon name="plus" className="h-4 w-4" /> Start your first call</Button></Link>}>
                Place a consent-based demo call to see its full lifecycle, transcript, and summary here.
              </EmptyState>
            ) : (
              <ul className="divide-y divide-ink-800">
                {recent.map((c) => (
                  <li key={c.id}>
                    <Link to={`/calls/${c.id}`} className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-ink-850">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="font-mono text-sm text-slate-200">{c.destination}</span>
                        {c.isTest && <TestBadge />}
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="hidden text-xs text-slate-500 sm:block">{fmtDateTime(c.timestamps?.createdAt)}</span>
                        <span className="w-16 text-right text-xs text-slate-400">{fmtDuration(c.durationSec)}</span>
                        <StatusBadge status={c.status} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
