export default function VideoPanel({ fps }) {
  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-card)]
                    overflow-hidden flex items-center justify-center relative">
      <img
        src="/video_feed"
        alt="Live crowd feed"
        className="w-full h-full object-contain block"
      />
      <div className="absolute top-3 right-3 bg-[rgba(0,0,0,0.55)] backdrop-blur-[6px]
                      border border-[var(--color-border)] rounded-[7px] px-2.5 py-1
                      text-[0.7rem] text-[var(--color-text-dim)] font-mono">
        FPS: {fps ? fps.toFixed(1) : '—'}
      </div>
    </div>
  )
}
