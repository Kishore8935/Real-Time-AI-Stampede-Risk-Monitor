function StatItem({ label, value }) {
  return (
    <div className="bg-[rgba(255,255,255,0.03)] border border-[var(--color-border)] rounded-lg px-3 py-2.5">
      <div className="text-[0.62rem] uppercase tracking-[0.08em] text-[var(--color-text-dim)] mb-1">{label}</div>
      <div className="font-mono text-[1.25rem] font-semibold text-[var(--color-text)]">{value ?? '—'}</div>
    </div>
  )
}

export default function LiveMetricsCard({ stats }) {
  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-card)] p-4">
      <div className="text-[0.66rem] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-dim)] mb-2.5">
        Live Metrics
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <StatItem label="Persons"   value={stats.person_count} />
        <StatItem label="Proc FPS"  value={stats.fps} />
        <StatItem label="Grid Rows" value={stats.grid_rows} />
        <StatItem label="Grid Cols" value={stats.grid_cols} />
      </div>
    </div>
  )
}
