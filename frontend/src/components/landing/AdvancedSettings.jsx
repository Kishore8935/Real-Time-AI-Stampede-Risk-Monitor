import { useState } from 'react'

export default function AdvancedSettings({ config, onUpdate }) {
  const [open, setOpen] = useState(false)
  const { thresh, highThr, critThr, hyst } = config

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-card)] p-5">
      {/* Accordion toggle */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-1.5 bg-none border-none text-[var(--color-text-dim)]
                   text-[0.72rem] font-semibold cursor-pointer text-left hover:text-[var(--color-text)] transition-colors"
      >
        <span className={`transition-transform duration-200 ${open ? 'rotate-90' : ''}`}>▶</span>
        Advanced Sensitivity Settings
      </button>

      {open && (
        <div className="pt-3.5">
          <div className="text-[0.72rem] font-bold text-[var(--color-text-dim)] uppercase tracking-[0.08em] mb-3">
            🔬 Sensitivity Thresholds
          </div>

          {/* Critical Density Limit */}
          <div className="flex items-center gap-2.5 mb-2.5">
            <div className="flex-1">
              <div className="text-[0.78rem] font-semibold">Critical Density Limit</div>
              <div className="text-[0.60rem] text-[var(--color-text-dim)]">People per cell = 100% density</div>
            </div>
            <input
              type="number" min="2" max="30" value={thresh}
              onChange={e => onUpdate('thresh', parseInt(e.target.value))}
              className="w-[70px] px-2.5 py-1.5 text-center bg-[var(--color-surface2)]
                         border border-[var(--color-border)] rounded-lg text-[var(--color-text)]
                         font-mono text-[0.82rem] outline-none focus:border-[var(--color-blue)] transition-colors"
            />
          </div>

          {/* High Alert Threshold */}
          <div className="mb-3">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-[0.78rem] font-semibold">🟠 High Alert Trigger</span>
              <span className="text-[0.72rem] font-bold font-mono text-[var(--color-blue-b)]">{highThr}%</span>
            </div>
            <input
              type="range" min="20" max="80" value={highThr}
              style={{ '--pct': `${((highThr - 20) / 60 * 100).toFixed(0)}%` }}
              onChange={e => onUpdate('highThr', parseInt(e.target.value))}
              className="w-full"
            />
          </div>

          {/* Critical Alert Threshold */}
          <div className="mb-3">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-[0.78rem] font-semibold">🔴 Critical Alert Trigger</span>
              <span className="text-[0.72rem] font-bold font-mono text-[var(--color-blue-b)]">{critThr}%</span>
            </div>
            <input
              type="range" min="40" max="95" value={critThr}
              style={{ '--pct': `${((critThr - 40) / 55 * 100).toFixed(0)}%` }}
              onChange={e => onUpdate('critThr', parseInt(e.target.value))}
              className="w-full"
            />
          </div>

          {/* Hysteresis */}
          <div className="flex items-center gap-2.5">
            <div className="flex-1">
              <div className="text-[0.78rem] font-semibold">Alert Stickiness</div>
              <div className="text-[0.60rem] text-[var(--color-text-dim)]">Frames alert stays on after crowd clears</div>
            </div>
            <input
              type="number" min="0" max="60" value={hyst}
              onChange={e => onUpdate('hyst', parseInt(e.target.value))}
              className="w-[70px] px-2.5 py-1.5 text-center bg-[var(--color-surface2)]
                         border border-[var(--color-border)] rounded-lg text-[var(--color-text)]
                         font-mono text-[0.82rem] outline-none focus:border-[var(--color-blue)] transition-colors"
            />
          </div>
        </div>
      )}
    </div>
  )
}
