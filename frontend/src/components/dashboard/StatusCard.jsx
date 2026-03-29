const ICONS = { Normal: '🟢', High: '🟠', Critical: '🔴' }
const CARD_CLASS = {
  Normal:   'border-[var(--color-green)] shadow-[0_0_18px_var(--color-green-glow)]',
  High:     'border-[var(--color-orange)] shadow-[0_0_18px_var(--color-orange-glow)]',
  Critical: 'border-[var(--color-red)] shadow-[0_0_28px_var(--color-red-glow)] animate-pulse-border',
}
const TEXT_CLASS = { Normal: 'text-[var(--color-green)]', High: 'text-[var(--color-orange)]', Critical: 'text-[var(--color-red)]' }

export default function StatusCard({ status }) {
  const level = ['Normal','High','Critical'].includes(status) ? status : 'Normal'
  return (
    <div className={`bg-[var(--color-surface)] border rounded-[var(--radius-card)] p-4 text-center
                     transition-all duration-400 ${CARD_CLASS[level]}`}>
      <div className="text-[0.66rem] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-dim)] mb-2">
        Alert Status
      </div>
      <div className="text-4xl mb-1.5">{ICONS[level]}</div>
      <div className={`text-[0.95rem] font-bold ${TEXT_CLASS[level]}`}>{level}</div>
    </div>
  )
}
