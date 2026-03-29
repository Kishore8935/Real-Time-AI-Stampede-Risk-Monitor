export default function DashboardHeader({ videoName, flowOverlay, onToggleFlow, onStop }) {
  return (
    <header className="flex items-center justify-between px-6 py-3 flex-shrink-0
                       bg-[var(--color-surface)] border-b border-[var(--color-border)]">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-[7px] flex items-center justify-center text-base
                        bg-gradient-to-br from-[var(--color-orange)] to-[var(--color-red)]">🚦</div>
        <div>
          <h1 className="text-base font-semibold text-[var(--color-text)]">Crowd Risk Monitor</h1>
          {videoName && (
            <div className="text-[0.72rem] text-[var(--color-text-dim)] font-mono mt-0.5">{videoName}</div>
          )}
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-3">
        {/* LIVE badge */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[0.74rem] font-semibold
                        text-[var(--color-green)] bg-[rgba(34,197,94,0.10)] border border-[rgba(34,197,94,0.3)]">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-green)] animate-pulse-dot" />
          LIVE
        </div>

        {/* Flow Vectors toggle */}
        <button
          onClick={onToggleFlow}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[0.76rem] font-semibold
                      border transition-all cursor-pointer
                      ${flowOverlay
                        ? 'bg-[rgba(99,102,241,0.25)] border-[#818cf8] text-[#818cf8] shadow-[0_0_12px_rgba(99,102,241,0.35)]'
                        : 'bg-[rgba(99,102,241,0.10)] border-[rgba(99,102,241,0.30)] text-[#818cf8] hover:bg-[rgba(99,102,241,0.20)]'}`}
        >
          🌊 Flow Vectors
        </button>

        {/* Stop button */}
        <button
          onClick={onStop}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[0.76rem] font-semibold
                     text-[var(--color-red)] bg-[rgba(239,68,68,0.12)] border border-[rgba(239,68,68,0.35)]
                     cursor-pointer hover:bg-[rgba(239,68,68,0.22)] transition-colors"
        >
          ⏹ Stop Analysis
        </button>
      </div>
    </header>
  )
}
