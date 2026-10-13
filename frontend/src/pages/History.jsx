import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { api, describeError } from '../lib/api.js';
import { fmtDuration, fmtCost, fmtDateTime } from '../lib/format.js';
import {
  Card, CardHeader, StatusBadge, TestBadge, Input, Select, Icon, Button,
  EmptyState, ErrorState, Skeleton, cn,
} from '../components/ui.jsx';

const STATUSES = ['all', 'queued', 'initiated', 'ringing', 'in_progress', 'completed', 'no_answer', 'busy', 'failed', 'canceled', 'unavailable'];

export default function History() {
  const [calls, setCalls] = useState(null);
  const [error, setError] = useState(null);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

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
  const filtered = useMemo(() => {
    let list = calls || [];
    if (statusFilter !== 'all') list = list.filter((c) => c.status === statusFilter);
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      list = list.filter(
        (c) => c.destination?.toLowerCase().includes(needle) || c.id.toLowerCase().includes(needle)
      );
    }
    return list;
  }, [calls, statusFilter, q]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Call history</h1>
          <p className="text-sm text-slate-400">All calls, newest first. Recipient numbers are masked.</p>
        </div>
        <Link to="/start"><Button><Icon name="plus" className="h-4 w-4" /> Start a call</Button></Link>
      </div>

      <Card>
        <div className="flex flex-col gap-3 border-b border-ink-800 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
              <Icon name="search" className="h-4 w-4" />
            </span>
            <Input className="pl-9" placeholder="Search by number or call ID" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search calls" />
          </div>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter by status" className="sm:w-52">
            {STATUSES.map((s) => <option key={s} value={s}>{s === 'all' ? 'All statuses' : s.replace(/_/g, ' ')}</option>)}
          </Select>
        </div>

        {error ? (
          <ErrorState message={error} onRetry={load} />
        ) : loading ? (
          <div className="space-y-2 p-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : filtered.length === 0 ? (
          (calls || []).length === 0 ? (
            <EmptyState icon="phone" title="No calls yet"
              action={<Link to="/start"><Button size="sm"><Icon name="plus" className="h-4 w-4" /> Start your first call</Button></Link>}>
              Calls you place will appear here with their status, duration, and cost.
            </EmptyState>
          ) : (
            <EmptyState icon="search" title="No matching calls">Try a different search or status filter.</EmptyState>
          )
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-800 text-left text-[11px] uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-2.5 font-medium">Recipient</th>
                    <th className="px-5 py-2.5 font-medium">Status</th>
                    <th className="px-5 py-2.5 font-medium">Created</th>
                    <th className="px-5 py-2.5 font-medium">Duration</th>
                    <th className="px-5 py-2.5 font-medium">Cost</th>
                    <th className="px-5 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr key={c.id} className="border-b border-ink-800/60 hover:bg-ink-850">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-slate-200">{c.destination}</span>
                          {c.isTest && <TestBadge />}
                        </div>
                      </td>
                      <td className="px-5 py-3"><StatusBadge status={c.status} /></td>
                      <td className="px-5 py-3 text-slate-400">{fmtDateTime(c.timestamps?.createdAt)}</td>
                      <td className="px-5 py-3 text-slate-300 tabular-nums">{fmtDuration(c.durationSec)}</td>
                      <td className="px-5 py-3 text-slate-300 tabular-nums">{fmtCost(c.cost)}</td>
                      <td className="px-5 py-3 text-right">
                        <Link to={`/calls/${c.id}`} className="text-xs font-medium text-indigo-300 hover:text-indigo-200">Details</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile cards */}
            <ul className="divide-y divide-ink-800 md:hidden">
              {filtered.map((c) => (
                <li key={c.id}>
                  <Link to={`/calls/${c.id}`} className="block px-4 py-3 hover:bg-ink-850">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-sm text-slate-200">{c.destination}</span>
                      <StatusBadge status={c.status} />
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                      {c.isTest && <TestBadge />}
                      <span>{fmtDateTime(c.timestamps?.createdAt)}</span>
                      <span>· {fmtDuration(c.durationSec)}</span>
                      <span>· {fmtCost(c.cost)}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
    </div>
  );
}
