// Small, honest formatting helpers. They render "—" for missing values rather
// than inventing data.

export function fmtDateTime(ts) {
  if (ts == null) return '—';
  // Accept epoch ms or seconds.
  const ms = typeof ts === 'number' && ts < 1e12 ? ts * 1000 : ts;
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

export function fmtDuration(sec) {
  if (sec == null || Number.isNaN(sec)) return '—';
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}m ${r}s` : `${r}s`;
}

export function fmtCost(cost) {
  if (!cost || cost.amountUsd == null) return '—';
  return `$${Number(cost.amountUsd).toFixed(2)}`;
}

export function titleCase(s) {
  return String(s || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
