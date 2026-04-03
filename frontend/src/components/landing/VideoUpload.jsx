import { useState, useRef } from 'react'

export default function VideoUpload({
  selectedFile, onSelectFile, onUpload,
  uploading, uploadLabel,
  onSaveSettings, onResetSettings,
}) {
  const inputRef = useRef(null)

  function handleDrop(e) {
    e.preventDefault()
    e.currentTarget.classList.remove('border-[var(--color-blue)]')
    const file = e.dataTransfer.files[0]
    if (file) onSelectFile(file)
  }
  function handleDragOver(e) {
    e.preventDefault()
    e.currentTarget.classList.add('!border-[var(--color-blue)]', '!bg-[rgba(99,102,241,0.05)]')
  }
  function handleDragLeave(e) {
    e.currentTarget.classList.remove('!border-[var(--color-blue)]', '!bg-[rgba(99,102,241,0.05)]')
  }

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-card)]" style={{ padding: '32px' }}>
      <div className="flex items-center gap-3 mb-4">
        <span className="text-2xl">📂</span>
        <div>
          <h2 className="text-base font-bold text-[var(--color-text)]">Start Analysis</h2>
          <p className="text-[0.72rem] text-[var(--color-text-dim)] mt-0.5">Upload any crowd video to begin</p>
        </div>
      </div>

      {/* Drop Zone */}
      {!selectedFile && (
        <div
          className="border-2 border-dashed border-[var(--color-border)] rounded-xl 
                     p-8 text-center cursor-pointer mb-3.5 transition-colors"
          onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave}
          onClick={() => inputRef.current?.click()}
        >
          <input ref={inputRef} type="file" accept="video/*" className="hidden"
            onChange={e => onSelectFile(e.target.files[0])} />
          <div className="text-4xl mb-2">🎬</div>
          <div className="text-[0.88rem] font-semibold mb-1">Click or drag a video here</div>
          <div className="text-[0.72rem] text-[var(--color-text-dim)]">MP4 · MOV · AVI &nbsp;·&nbsp; Any resolution</div>
        </div>
      )}

      {/* File Preview */}
      {selectedFile && (
        <div className="flex items-center gap-3 bg-[rgba(99,102,241,0.07)] border border-[rgba(99,102,241,0.25)] 
                        rounded-xl px-4 py-3 mb-3.5">
          <span className="text-2xl">🎥</span>
          <div className="flex-1 min-w-0">
            <div className="text-[0.82rem] font-semibold break-all">{selectedFile.name}</div>
            <div className="text-[0.70rem] text-[var(--color-text-dim)] mt-0.5">
              {(selectedFile.size / 1024 / 1024).toFixed(1)} MB
            </div>
          </div>
          <button onClick={() => onSelectFile(null)}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-red)] transition-colors text-sm">✕</button>
        </div>
      )}

      <button onClick={onUpload} disabled={!selectedFile || uploading}
        className="w-full py-3.5 bg-gradient-to-br from-[var(--color-blue)] to-[var(--color-blue-b)]
                   rounded-xl font-bold text-[0.95rem] text-white cursor-pointer mb-3 border-none
                   shadow-[0_4px_20px_rgba(99,102,241,0.35)] transition-all
                   disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none
                   enabled:hover:opacity-90 enabled:hover:-translate-y-0.5
                   enabled:hover:shadow-[0_8px_28px_rgba(99,102,241,0.45)]">
        Analyse Video →
      </button>

      {/* Save / Reset */}
      <div className="flex items-center gap-2 mt-2.5">
        <SaveBtn onSave={onSaveSettings} />
        <span onClick={onResetSettings}
          className="text-[0.70rem] text-[var(--color-text-muted)] cursor-pointer underline 
                     underline-offset-[2px] whitespace-nowrap hover:text-[var(--color-red)] transition-colors">
          ↺ Reset to Defaults
        </span>
      </div>

      {/* Progress */}
      {uploading && (
        <div className="mt-3.5">
          <div className="text-[0.75rem] text-[var(--color-text-dim)] mb-2">{uploadLabel}</div>
          <div className="h-[5px] bg-[var(--color-border)] rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[var(--color-blue)] to-[var(--color-blue-b)] 
                            rounded-full animate-indeterminate" />
          </div>
        </div>
      )}
    </div>
  )
}

function SaveBtn({ onSave }) {
  const [saved, setSaved] = useState(false)
  function handle() { onSave(); setSaved(true); setTimeout(() => setSaved(false), 2000) }
  return (
    <button onClick={handle}
      className={`flex-1 py-2 px-3.5 rounded-[9px] border text-[0.82rem] font-semibold 
                  cursor-pointer transition-all
                  ${saved
                    ? 'border-[var(--color-green)] text-[var(--color-green)] bg-[rgba(34,197,94,0.08)]'
                    : 'border-[var(--color-border)] bg-[var(--color-surface2)] text-[var(--color-text)] hover:bg-[var(--color-border)] hover:border-[var(--color-blue)]'}`}>
      {saved ? '✅ Saved!' : '💾 Save Settings'}
    </button>
  )
}
