import ToggleSwitch from '../shared/ToggleSwitch'

const STATUS_STYLE = {
  off:         'bg-[rgba(100,116,139,0.15)] text-[var(--color-text-dim)]',
  calibrating: 'bg-[rgba(234,179,8,0.18)] text-[#eab308]',
  done:        'bg-[rgba(99,102,241,0.18)] text-[#818cf8]',
}
const STATUS_LABEL = { off: 'Preset weights', calibrating: '⏳ Calibrating…', done: '✅ Calibrated' }

export default function CalibrationCard({ stats, onToggle }) {
  const { calib_mode, calib_status, density_weight, motion_weight,
          calib_samples_collected, calib_sample_target } = stats

  const progress = calib_sample_target > 0
    ? Math.min(100, (calib_samples_collected / calib_sample_target) * 100)
    : 0

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-card)] p-4">
      {/* Header row */}
      <div className="flex justify-between items-center mb-2">
        <div className="text-[0.66rem] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-dim)]">
          Auto-Calibration
        </div>
        <ToggleSwitch
          checked={calib_mode}
          onChange={checked => onToggle(checked)}
        />
      </div>

      {/* Status badge */}
      <span className={`inline-flex items-center gap-1.5 text-[0.72rem] font-semibold px-2.5 py-0.5 rounded-full mb-2
                        ${STATUS_STYLE[calib_status] || STATUS_STYLE.off}`}>
        {STATUS_LABEL[calib_status] || 'Preset weights'}
      </span>

      {/* Weight chips */}
      <div className="flex gap-2 mb-2">
        {[['Density', density_weight], ['Motion', motion_weight]].map(([label, val]) => (
          <div key={label} className="flex-1 text-center bg-[rgba(99,102,241,0.10)] border border-[rgba(99,102,241,0.25)] rounded-lg py-1.5">
            <div className="text-[0.62rem] text-[var(--color-text-dim)] uppercase tracking-[0.05em]">{label}</div>
            <div className="text-[1.1rem] font-bold text-[#818cf8]">{val}%</div>
          </div>
        ))}
      </div>

      {/* Calibration progress bar (only while calibrating) */}
      {calib_status === 'calibrating' && (
        <div className="h-1 bg-[var(--color-border)] rounded overflow-hidden mt-1">
          <div className="h-full bg-gradient-to-r from-[var(--color-blue)] to-[var(--color-blue-b)] 
                          rounded transition-all duration-400"
            style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  )
}
