function CellRow({ color, label, count }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-[var(--color-border)] last:border-b-0">
      <div className="flex items-center gap-2.5 text-[0.80rem]">
        <span className="w-2.5 h-2.5 rounded-[3px] flex-shrink-0" style={{ background: color }} />
        {label}
      </div>
      <div className="font-mono text-base font-semibold">{count ?? '—'}</div>
    </div>
  )
}

export default function CellBreakdownCard({ stats }) {
  const total = (stats.grid_rows || 0) * (stats.grid_cols || 0)
  const safe  = Math.max(0, total - (stats.high_cells || 0) - (stats.critical_cells || 0))
  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-card)] p-4">
      <div className="text-[0.66rem] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-dim)] mb-1">
        Cell Breakdown
      </div>
      <CellRow color="var(--color-green)"  label="Safe"      count={safe} />
      <CellRow color="var(--color-orange)" label="High Risk"  count={stats.high_cells} />
      <CellRow color="var(--color-red)"    label="Critical"   count={stats.critical_cells} />
    </div>
  )
}
