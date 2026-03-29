function formatDuration(s) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`
}

const STATUS_COLOR = {
  Normal:   'var(--color-green)',
  High:     'var(--color-orange)',
  Critical: 'var(--color-red)',
}

export default function SessionSummaryModal({ summary, onGoHome }) {
  if (!summary) return null

  const { peak_risk, peak_status, duration_s, frames, density_weight, motion_weight } = summary
  const level = peak_risk >= 75 ? 'Critical' : peak_risk >= 50 ? 'High' : 'Normal'
  const icon  = level === 'Critical' ? '🚨' : level === 'High' ? '⚠️' : '✅'

  // Distribution bars (approximate from peak_risk)
  const critPct = peak_risk >= 75 ? Math.round(peak_risk * 0.4) : 0
  const highPct = peak_risk >= 50 ? Math.round(peak_risk * 0.35) : Math.round(peak_risk * 0.3)
  const safePct = 100 - critPct - highPct

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center
                    bg-[rgba(10,13,20,0.92)] backdrop-blur-[12px]">
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[18px]
                      px-[52px] py-10 text-center w-[880px] max-w-[96vw] animate-modal-in">

        <div className="text-5xl mb-3.5">{icon}</div>
        <h2 className="text-[1.4rem] font-bold mb-1.5">Analysis Session Complete</h2>
        <p className="text-[0.86rem] text-[var(--color-text-dim)] leading-relaxed mb-7">
          The analysis has been stopped. Here's a summary of what was detected during this session.
        </p>

        {/* Top stat row */}
        <div className="flex border border-[var(--color-border)] rounded-xl overflow-hidden mb-7">
          {[
            { label: 'Peak Risk',    value: `${peak_risk}/100`, color: STATUS_COLOR[peak_status] || STATUS_COLOR.Normal },
            { label: 'Peak Status',  value: peak_status || 'Normal', color: STATUS_COLOR[peak_status] || STATUS_COLOR.Normal },
            { label: 'Duration',     value: formatDuration(duration_s || 0), color: null },
            { label: 'Frames Proc.', value: frames || 0, color: null },
            { label: 'Density W.',   value: `${density_weight}%`, color: null },
            { label: 'Motion W.',    value: `${motion_weight}%`, color: null },
          ].map(({ label, value, color }, i, arr) => (
            <div key={label}
              className={`flex-1 px-2.5 py-4 ${i < arr.length - 1 ? 'border-r border-[var(--color-border)]' : ''}`}>
              <div className="text-[0.62rem] uppercase tracking-[0.08em] text-[var(--color-text-dim)] mb-1.5">{label}</div>
              <div className="font-mono text-[1.65rem] font-semibold"
                style={{ color: color || 'var(--color-text)' }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Risk distribution */}
        <div className="text-left mb-7">
          <div className="text-[0.62rem] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-dim)] mb-3">
            Risk Distribution (estimated)
          </div>
          <div className="h-3 rounded-full overflow-hidden flex mb-2.5">
            <div className="h-full transition-all" style={{ width: `${safePct}%`,  background: 'var(--color-green)' }} />
            <div className="h-full transition-all" style={{ width: `${highPct}%`,  background: 'var(--color-orange)' }} />
            <div className="h-full transition-all" style={{ width: `${critPct}%`,  background: 'var(--color-red)' }} />
          </div>
          <div className="flex justify-around">
            {[['var(--color-green)', `Normal ${safePct}%`], ['var(--color-orange)', `High ${highPct}%`], ['var(--color-red)', `Critical ${critPct}%`]].map(([color, label]) => (
              <div key={label} className="flex items-center gap-1.5 text-[0.78rem]">
                <span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: color }} />
                {label}
              </div>
            ))}
          </div>
        </div>

        <div className="h-px bg-[var(--color-border)] mb-5" />

        <button onClick={onGoHome}
          className="inline-flex items-center gap-2 px-9 py-3 rounded-xl border-none
                     bg-gradient-to-br from-[var(--color-blue)] to-[var(--color-blue-b)]
                     text-white font-semibold text-[0.92rem] cursor-pointer
                     hover:opacity-85 hover:-translate-y-0.5 transition-all">
          🏠 Go Home
        </button>
      </div>
    </div>
  )
}
