import ToggleSwitch from '../shared/ToggleSwitch'

export default function RiskWeightsPanel({ config, onUpdate }) {
  const { bias, calib, pressure } = config

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-card)] p-5">
      <div className="text-[0.78rem] font-bold text-[var(--color-text-dim)] uppercase tracking-[0.08em] mb-4">
        ⚖️ Risk Formula Weights
      </div>

      {/* Auto-Calibration */}
      <div className="mb-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[0.80rem] font-semibold">Auto-Calibration</div>
            <div className="text-[0.65rem] text-[var(--color-text-dim)]">Tunes weights from first 8s of video</div>
          </div>
          <ToggleSwitch checked={calib} onChange={v => onUpdate('calib', v)} />
        </div>
      </div>

      {/* Density ↔ Motion Bias */}
      <div className={`mb-5 transition-opacity ${calib ? 'opacity-40 pointer-events-none' : ''}`}>
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-[0.78rem] font-semibold">Density ↔ Motion Bias</span>
          <span className="text-[0.72rem] font-bold font-mono text-[var(--color-blue-b)]">
            {bias} / {100 - bias}
          </span>
        </div>
        <input type="range" min="10" max="90" value={bias}
          style={{ '--pct': `${((bias - 10) / 80 * 100).toFixed(0)}%` }}
          onChange={e => onUpdate('bias', parseInt(e.target.value))}
          className="w-full mb-1.5" />
        {/* Split bar */}
        <div className="flex h-5 rounded overflow-hidden text-[0.60rem] font-bold">
          <div className="flex items-center justify-center bg-[rgba(99,102,241,0.40)] text-[var(--color-blue-b)] transition-all"
            style={{ width: `${bias}%` }}>
            {bias >= 20 ? `Density ${bias}%` : ''}
          </div>
          <div className="flex items-center justify-center bg-[rgba(249,115,22,0.35)] text-[var(--color-orange)] flex-1">
            {(100 - bias) >= 20 ? `Motion ${100 - bias}%` : ''}
          </div>
        </div>
      </div>

      {/* Crowd Pressure */}
      <div>
        <div className="flex items-center justify-between gap-3 mb-1.5">
          <div>
            <div className="text-[0.80rem] font-semibold">Crowd Pressure Signal</div>
            <div className="text-[0.65rem] text-[var(--color-text-dim)]">P = ρ × σᵥ &nbsp;·&nbsp; Takes 25% of risk score when ON</div>
          </div>
          <ToggleSwitch checked={pressure} onChange={v => onUpdate('pressure', v)} green />
        </div>
        <div className={`flex items-center gap-2 text-[0.68rem] rounded-lg px-2.5 py-1.5 mt-1
                        ${pressure
                          ? 'text-[var(--color-text-dim)] bg-[rgba(34,197,94,0.07)] border border-[rgba(34,197,94,0.2)]'
                          : 'text-[var(--color-text-muted)] bg-[rgba(71,85,105,0.2)] border border-[var(--color-border)]'}`}>
          {pressure
            ? '🗜️ When ON: Density & Motion share 75%, Pressure takes 25%. Distinguishes calm queues from dangerous crushes.'
            : '⚡ When OFF: Full 100% shared between Density and Motion only.'}
        </div>
      </div>
    </div>
  )
}
