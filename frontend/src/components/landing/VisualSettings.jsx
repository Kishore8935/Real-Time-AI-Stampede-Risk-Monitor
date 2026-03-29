export default function VisualSettings({ config, onUpdate }) {
  const { alpha, grid } = config
  const alphaLabel = alpha <= 15 ? 'Low' : alpha <= 30 ? 'Medium' : 'High'

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-card)] p-5">
      <div className="text-[0.78rem] font-bold text-[var(--color-text-dim)] uppercase tracking-[0.08em] mb-4">
        🎨 Visual Settings
      </div>

      {/* Overlay Transparency */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-[0.78rem] font-semibold">Overlay Transparency</span>
          <span className="text-[0.72rem] font-bold font-mono text-[var(--color-blue-b)]">
            {alphaLabel} ({(alpha / 100).toFixed(2)})
          </span>
        </div>
        <input
          type="range" min="5" max="60" value={alpha}
          style={{ '--pct': `${((alpha - 5) / 55 * 100).toFixed(0)}%` }}
          onChange={e => onUpdate('alpha', parseInt(e.target.value))}
          className="w-full"
        />
      </div>

      {/* Grid Resolution */}
      <div>
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-[0.78rem] font-semibold">Grid Resolution</span>
        </div>
        <select
          value={grid}
          onChange={e => onUpdate('grid', e.target.value)}
          className="w-full px-3 py-2 bg-[var(--color-surface2)] border border-[var(--color-border)]
                     rounded-lg text-[var(--color-text)] text-[0.80rem] cursor-pointer outline-none
                     focus:border-[var(--color-blue)] transition-colors"
        >
          <option value="coarse">Coarse — Large cells (fast, less detail)</option>
          <option value="standard">Standard — Balanced (default)</option>
          <option value="detailed">Detailed — Small cells (precise, slower)</option>
        </select>
      </div>
    </div>
  )
}
