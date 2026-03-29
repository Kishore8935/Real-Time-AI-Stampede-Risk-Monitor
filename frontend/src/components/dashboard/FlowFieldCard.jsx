function FlowBar({ label, formula, value }) {
  // value is a float (can be negative for divergence)
  // Map to 0–100% bar: 50%=neutral, negative=left of center
  const pct = Math.min(100, Math.max(0, 50 + value * 25))
  const isNegative = value < -0.5
  const isPositive = value > 0.5
  const barColor = isNegative ? 'var(--color-red)' : isPositive ? 'var(--color-orange)' : 'var(--color-green)'
  const badge = label === 'Divergence'
    ? (isNegative ? 'Squeezing' : 'Dispersing')
    : (isPositive ? 'Swirling' : 'Calm')
  const badgeStyle = isNegative || (label === 'Curl' && isPositive)
    ? 'bg-[rgba(239,68,68,0.15)] text-[var(--color-red)]'
    : isPositive
      ? 'bg-[rgba(249,115,22,0.15)] text-[var(--color-orange)]'
      : 'bg-[rgba(34,197,94,0.15)] text-[var(--color-green)]'

  return (
    <div className="mb-2.5">
      <div className="flex justify-between items-center mb-1">
        <span className="text-[0.68rem] text-[var(--color-text-dim)] font-semibold uppercase tracking-[0.05em]">{label}</span>
        <span className="text-[0.60rem] text-[var(--color-text-muted)]">{formula}</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-[var(--color-surface2)] rounded overflow-hidden">
          <div className="h-full rounded transition-all duration-400"
            style={{ width: `${pct}%`, background: barColor }} />
        </div>
        <span className={`text-[0.60rem] font-bold px-1.5 py-px rounded-[10px] ${badgeStyle}`}>{badge}</span>
      </div>
    </div>
  )
}

export default function FlowFieldCard({ divergence, curl }) {
  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-card)] p-4">
      <div className="text-[0.66rem] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-dim)] mb-2.5">
        🌊 Flow Field Physics
      </div>
      <FlowBar label="Divergence" formula="∂vx/∂x + ∂vy/∂y" value={divergence} />
      <FlowBar label="Curl"       formula="∂vy/∂x − ∂vx/∂y" value={curl} />
    </div>
  )
}
