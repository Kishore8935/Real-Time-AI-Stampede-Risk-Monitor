import { PRESETS, PRESET_LABELS } from '../../hooks/usePresets'

const PRESET_ICONS = {
  concert: '🎤', pilgrimage: '🕌', subway: '🚇',
  mall: '🛒', stadium: '🏟️', drone: '🎬',
}
const PRESET_SUBS = {
  concert: 'High chaos · Pressure ON',
  pilgrimage: 'Open space · Coarse grid',
  subway: 'Density-heavy · Pressure OFF',
  mall: 'Multidirectional · Coarse',
  stadium: 'Bottleneck · Low thresholds',
  drone: 'High altitude · Coarse grid',
}

export default function QuickPresets({ activePreset, appliedLabel, onApplyPreset }) {
  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-card)]" style={{ padding: '32px' }}>
      <div className="text-[0.78rem] font-bold text-[var(--color-text-dim)] uppercase tracking-[0.08em] mb-3.5">
        ⚡ Quick Setup Presets
      </div>

      <div className="grid grid-cols-2 gap-2">
        {Object.keys(PRESETS).map(name => (
          <button
            key={name}
            onClick={() => onApplyPreset(name)}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer text-left
                        border font-semibold text-[0.78rem] text-[var(--color-text)]
                        transition-all hover:-translate-y-px
                        hover:border-[var(--color-blue)] hover:bg-[rgba(99,102,241,0.08)]
                        hover:shadow-[0_4px_12px_rgba(99,102,241,0.2)]
                        ${activePreset === name
                          ? 'border-[var(--color-blue)] bg-[rgba(99,102,241,0.12)] shadow-[0_0_0_2px_rgba(99,102,241,0.25)]'
                          : 'border-[var(--color-border)] bg-[var(--color-surface2)]'}`}
          >
            <span className="text-lg flex-shrink-0">{PRESET_ICONS[name]}</span>
            <div>
              <div className="text-[0.76rem] font-bold">{PRESET_LABELS[name]}</div>
              <div className="text-[0.60rem] text-[var(--color-text-dim)] font-normal mt-0.5">{PRESET_SUBS[name]}</div>
            </div>
          </button>
        ))}
      </div>

      {appliedLabel && (
        <div className="flex items-center gap-2 text-[0.70rem] text-[var(--color-green)] mt-2.5
                        bg-[rgba(34,197,94,0.07)] border border-[rgba(34,197,94,0.2)] rounded-lg px-2.5 py-1.5">
          ✅ {appliedLabel}
        </div>
      )}
    </div>
  )
}
