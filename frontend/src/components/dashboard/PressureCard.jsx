// SVG arc gauge for crowd pressure (P = ρ × σᵥ)
const CIRCUMFERENCE = 188 // 2π × r=30

function pressureLevel(p) {
  if (p >= 65) return 'high'
  if (p >= 35) return 'mod'
  return 'low'
}

const STROKE = { low: '#22c55e', mod: '#f97316', high: '#ef4444' }
const STATUS_STYLE = {
  low:  'bg-[rgba(34,197,94,0.15)] text-[#22c55e]',
  mod:  'bg-[rgba(249,115,22,0.15)] text-[#f97316]',
  high: 'bg-[rgba(239,68,68,0.15)] text-[#ef4444]',
}
const STATUS_LABEL = { low: 'Safe', mod: 'Moderate', high: 'High Pressure' }
const STATUS_DESC  = {
  low:  'Low density & chaos — no crush risk detected.',
  mod:  'Elevated pressure — monitor closely.',
  high: 'High crowd pressure — crush risk elevated!',
}

export default function PressureCard({ pressure }) {
  const p     = Math.min(100, Math.max(0, pressure || 0))
  const level = pressureLevel(p)
  const dashOffset = CIRCUMFERENCE - (p / 100) * CIRCUMFERENCE

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-card)] p-4">
      <div className="text-[0.66rem] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-dim)] mb-2.5">
        Crowd Pressure <span className="opacity-60 font-normal normal-case tracking-normal text-[0.58rem]">(P = ρ × σᵥ)</span>
      </div>

      <div className="flex items-center gap-4 mt-1.5">
        {/* Arc gauge */}
        <div className="relative w-[72px] h-[72px] flex-shrink-0">
          <svg width="72" height="72" viewBox="0 0 72 72" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="36" cy="36" r="30" fill="none" stroke="var(--color-border)" strokeWidth="7" />
            <circle cx="36" cy="36" r="30" fill="none"
              stroke={STROKE[level]} strokeWidth="7" strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
              style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.4s ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-mono text-[1.1rem] font-extrabold text-[var(--color-text)]">{p}</span>
            <span className="text-[0.56rem] text-[var(--color-text-dim)] uppercase tracking-[0.04em]">/100</span>
          </div>
        </div>

        {/* Info */}
        <div className="flex-1">
          <span className={`text-[0.72rem] font-bold px-2 py-0.5 rounded-xl inline-block mb-1 ${STATUS_STYLE[level]}`}>
            {STATUS_LABEL[level]}
          </span>
          <p className="text-[0.68rem] text-[var(--color-text-dim)] leading-snug">{STATUS_DESC[level]}</p>
        </div>
      </div>
    </div>
  )
}
