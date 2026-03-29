import { useRef } from 'react'

export default function AIAssistant({
  aiStatus, aiError, aiLoading, explanation,
  imageBase64, onSelectImage, onClearImage,
  showKeyWarning,
  history, historyModalOpen, onOpenHistory, onCloseHistory,
  onAskAI, onRestoreFromHistory, timeAgo,
}) {
  const textareaRef = useRef(null)
  const fileInputRef = useRef(null)

  function handleSend() {
    onAskAI(textareaRef.current?.value || '')
  }

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-card)] p-5">
      <div className="text-[0.78rem] font-bold text-[var(--color-text-dim)] uppercase tracking-[0.08em] mb-3">
        🤖 AI Configuration Assistant
        <span className="text-[0.60rem] font-normal text-[var(--color-text-muted)] ml-1.5 normal-case tracking-normal">
          Powered by Gemini
        </span>
      </div>

      {showKeyWarning && (
        <div className="flex items-center gap-2 text-[0.68rem] text-[var(--color-orange)] 
                        bg-[rgba(249,115,22,0.07)] border border-[rgba(249,115,22,0.2)] 
                        rounded-lg px-2.5 py-1.5 mb-2.5">
          ⚠️ Set the <code className="text-[0.65rem] bg-black/20 px-1 rounded">GEMINI_API_KEY</code> environment variable to enable this feature.
        </div>
      )}

      <p className="text-[0.72rem] text-[var(--color-text-dim)] mb-2.5 leading-relaxed">
        Describe your deployment scenario in plain English. The AI will configure all sliders for optimal detection.
      </p>

      {/* Image preview */}
      {imageBase64 && (
        <div className="flex items-center gap-2 bg-[rgba(99,102,241,0.07)] border border-[rgba(99,102,241,0.2)] 
                        rounded-lg px-2.5 py-1.5 mb-2">
          <img src={imageBase64} alt="" className="w-12 h-9 object-cover rounded border border-[rgba(99,102,241,0.3)]" />
          <span className="text-[0.70rem] text-[var(--color-text-dim)] flex-1 truncate">Image attached</span>
          <button onClick={onClearImage} className="text-[var(--color-text-muted)] hover:text-[var(--color-red)] text-sm">✕</button>
        </div>
      )}

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        rows={4}
        placeholder="e.g. I am monitoring a narrow exit corridor of a football stadium after the match ends. The camera is fixed and angled downward."
        className="w-full resize-y min-h-[60px] px-3 py-2.5 font-sans text-[0.80rem] leading-relaxed
                   bg-[var(--color-surface2)] border border-[var(--color-border)] rounded-xl
                   text-[var(--color-text)] outline-none transition-colors
                   placeholder:text-[var(--color-text-muted)]
                   focus:border-[var(--color-blue)]"
      />

      {/* Buttons row */}
      <div className="flex justify-end gap-1.5 mt-2">
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
          onChange={e => onSelectImage(e.target.files[0])} />
        <button onClick={() => fileInputRef.current?.click()}
          className="bg-[var(--color-surface2)] border border-[var(--color-border)] rounded-lg
                     px-2.5 py-1.5 text-[0.75rem] text-[var(--color-text-dim)] cursor-pointer
                     hover:bg-[var(--color-border)] hover:border-[var(--color-blue)] transition-all whitespace-nowrap">
          🖼️ Attach Image
        </button>
        <button onClick={handleSend} disabled={aiLoading}
          className="px-4 py-2 border-none rounded-xl bg-gradient-to-br from-[var(--color-blue)] to-[var(--color-blue-b)]
                     text-white text-[0.82rem] font-bold cursor-pointer whitespace-nowrap
                     shadow-[0_3px_12px_rgba(99,102,241,0.35)] transition-all
                     disabled:opacity-40 disabled:cursor-not-allowed
                     enabled:hover:opacity-90 enabled:hover:-translate-y-px">
          {aiLoading ? 'Thinking…' : 'Ask AI →'}
        </button>
      </div>

      {/* Status */}
      {aiStatus && (
        <div className={`text-[0.72rem] mt-2.5 min-h-[14px] ${aiError ? 'text-[var(--color-red)]' : 'text-[var(--color-text-dim)]'}`}>
          {aiStatus}
        </div>
      )}

      {/* Explanation */}
      {explanation && (
        <div className="mt-2.5 bg-[rgba(99,102,241,0.07)] border border-[rgba(99,102,241,0.25)] rounded-[9px] px-3 py-2.5">
          <p className="text-[0.72rem] text-[var(--color-text-dim)] leading-relaxed">
            <strong className="text-[var(--color-blue-b)]">🤖 AI Reasoning:</strong> {explanation.text}
          </p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {explanation.chips.map(c => (
              <span key={c} className="text-[0.60rem] font-bold font-mono bg-[var(--color-surface)] 
                                       border border-[var(--color-border)] rounded px-1.5 py-0.5 text-[var(--color-text-dim)]">
                {c}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* History button */}
      <button onClick={onOpenHistory}
        className="w-full mt-2.5 py-2 bg-[var(--color-surface2)] border border-[var(--color-border)] 
                   rounded-lg text-[0.72rem] font-semibold text-[var(--color-text-dim)] cursor-pointer
                   hover:bg-[var(--color-border)] transition-colors">
        📂 View Prompt History
      </button>

      {/* History Modal */}
      {historyModalOpen && (
        <div className="fixed inset-0 z-[200] bg-[rgba(8,12,20,0.80)] backdrop-blur-[10px] 
                        flex items-center justify-center p-5"
          onClick={e => { if (e.target === e.currentTarget) onCloseHistory() }}>
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl 
                          w-full max-w-[680px] max-h-[82vh] flex flex-col shadow-[0_24px_60px_rgba(0,0,0,0.5)]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
              <span className="text-[0.95rem] font-bold">📂 Prompt History</span>
              <span className="text-[0.68rem] text-[var(--color-text-muted)]">
                {history.length ? `${history.length} saved` : ''}
              </span>
              <button onClick={onCloseHistory}
                className="w-7 h-7 bg-[var(--color-surface2)] border border-[var(--color-border)] rounded-lg
                           text-[var(--color-text-dim)] flex items-center justify-center
                           hover:bg-[rgba(239,68,68,0.15)] hover:text-[var(--color-red)] hover:border-[var(--color-red)] transition-all">
                ✕
              </button>
            </div>
            <div className="overflow-y-auto p-4 flex-1">
              {history.length === 0 && (
                <p className="text-center text-[var(--color-text-muted)] text-[0.80rem] py-8">
                  No saved prompts yet. Ask the AI assistant to get started.
                </p>
              )}
              {history.map((entry, i) => (
                <div key={i}
                  className="bg-[var(--color-surface2)] border border-[var(--color-border)] rounded-xl 
                             p-3.5 mb-3 hover:border-[rgba(99,102,241,0.4)] transition-colors">
                  <div className="flex gap-3 items-start mb-2.5">
                    {entry.image
                      ? <img src={entry.image} alt="" className="w-20 h-14 object-cover rounded-lg border border-[rgba(99,102,241,0.3)] flex-shrink-0" />
                      : <div className="w-20 h-14 rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] flex items-center justify-center text-xl flex-shrink-0 text-[var(--color-text-muted)]">🖼️</div>
                    }
                    <div className="flex-1 min-w-0">
                      <p className="text-[0.80rem] font-semibold leading-snug line-clamp-3">{entry.prompt}</p>
                      <p className="text-[0.62rem] text-[var(--color-text-muted)] mt-1">{timeAgo(entry.ts)}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-2.5">
                    {[
                      `Density ${entry.settings.bias}% / Motion ${100 - entry.settings.bias}%`,
                      `Pressure ${entry.settings.pressure ? 'ON' : 'OFF'}`,
                      `Grid: ${entry.settings.grid}`,
                      `Thresh: ${entry.settings.thresh} ppl/cell`,
                    ].map(c => <span key={c} className="text-[0.62rem] px-2 py-0.5 rounded-[10px] bg-[rgba(99,102,241,0.12)] text-[var(--color-blue-b)] font-medium">{c}</span>)}
                  </div>
                  <div className="flex justify-end">
                    <button onClick={() => onRestoreFromHistory(i)}
                      className="text-[0.75rem] font-bold px-3.5 py-1.5 rounded-lg border border-[var(--color-blue)]
                                 bg-[rgba(99,102,241,0.10)] text-[var(--color-blue-b)] cursor-pointer
                                 hover:bg-[rgba(99,102,241,0.22)] transition-colors">
                      Restore Settings →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
