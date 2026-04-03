import TopBar from '../components/shared/TopBar'
import VideoUpload from '../components/landing/VideoUpload'
import QuickPresets from '../components/landing/QuickPresets'
import AIAssistant from '../components/landing/AIAssistant'
import RiskWeightsPanel from '../components/landing/RiskWeightsPanel'
import VisualSettings from '../components/landing/VisualSettings'
import AdvancedSettings from '../components/landing/AdvancedSettings'

import { useConfig } from '../hooks/useConfig'
import { usePresets } from '../hooks/usePresets'
import { useAI } from '../hooks/useAI'
import { useVideoUpload } from '../hooks/useVideoUpload'

export default function LandingPage() {
  const { config, update, setConfig, saveSettings, resetSettings } = useConfig()
  const { activePreset, appliedLabel, applyPreset } = usePresets(setConfig)
  const ai = useAI(config, setConfig)
  const upload = useVideoUpload(config)

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg)' }}>
      {/* Background radial glow — centred behind hero */}
      <div className="fixed inset-0 z-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse 70% 50% at 50% -5%, rgba(99,102,241,0.13) 0%, transparent 65%)'
      }} />

      <TopBar />

      <main className="relative z-10" style={{ maxWidth: 1440, margin: '0 auto', padding: '0 32px 80px' }}>

        {/* ══════════════ HERO ══════════════ */}
        <section style={{ textAlign: 'center', padding: '52px 0 44px' }}>

          {/* Eyebrow */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '5px 14px', borderRadius: 999, marginBottom: 20,
            background: 'rgba(99,102,241,0.10)', border: '1px solid rgba(99,102,241,0.30)',
            fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.14em',
            color: 'var(--color-blue-b)', textTransform: 'uppercase' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%',
              background: 'var(--color-blue)', display: 'inline-block',
              animation: 'pulse-dot 1.5s ease-in-out infinite' }} />
            Capstone Research Project · 2026
          </div>

          {/* Title — two distinct lines */}
          <h1 style={{ fontSize: 'clamp(1.9rem, 4vw, 3rem)', fontWeight: 800,
            lineHeight: 1.15, letterSpacing: '-0.02em',
            margin: '0 auto 16px', maxWidth: 700 }}>
            Real-Time AI-Powered
            <br />
            <span style={{
              background: 'linear-gradient(90deg, #6366f1, #818cf8 45%, #22c55e)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
            }}>
              Stampede Risk Monitor
            </span>
          </h1>

          {/* Subtitle — inline style guarantees centering */}
          <p style={{ fontSize: '0.92rem', lineHeight: 1.75, maxWidth: 500,
            margin: '0 auto 28px', textAlign: 'center',
            color: 'var(--color-text-dim)', fontWeight: 300 }}>
            Upload a crowd video, tune parameters with Gemini AI, and get
            live stampede risk scores — cell-by-cell, frame-by-frame.
          </p>

          {/* Tech pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
            {[
              { emoji: '🧠', text: 'YOLOv11' },
              { emoji: '🌊', text: 'Optical Flow' },
              { emoji: '🗜️', text: 'Crowd Pressure' },
              { emoji: '🤖', text: 'Gemini AI' },
              { emoji: '⚡', text: 'FastAPI' },
            ].map(({ emoji, text }) => (
              <span key={text} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '5px 13px', borderRadius: 999,
                background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                fontSize: '0.73rem', fontWeight: 500, color: 'var(--color-text-dim)'
              }}>
                {emoji} {text}
              </span>
            ))}
          </div>
        </section>

        {/* ══════════════ DIVIDER ══════════════ */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
          <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
          <span style={{ fontSize: '0.62rem', color: 'var(--color-text-muted)',
            letterSpacing: '0.14em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
            Configure &amp; Analyse
          </span>
          <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
        </div>

        {/* ══════════════ CARD GRID ══════════════ */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
          <VideoUpload
            selectedFile={upload.selectedFile}
            onSelectFile={upload.selectFile}
            onUpload={upload.upload}
            uploading={upload.uploading}
            uploadLabel={upload.uploadLabel}
            onSaveSettings={saveSettings}
            onResetSettings={resetSettings}
          />
          <QuickPresets
            activePreset={activePreset}
            appliedLabel={appliedLabel}
            onApplyPreset={applyPreset}
          />
          <AIAssistant
            aiStatus={ai.aiStatus}
            aiError={ai.aiError}
            aiLoading={ai.aiLoading}
            explanation={ai.explanation}
            imageBase64={ai.imageBase64}
            onSelectImage={ai.selectImage}
            onClearImage={ai.clearImage}
            showKeyWarning={ai.showKeyWarning}
            history={ai.history}
            historyModalOpen={ai.historyModalOpen}
            onOpenHistory={() => ai.setHistoryModalOpen(true)}
            onCloseHistory={() => ai.setHistoryModalOpen(false)}
            onAskAI={ai.askAI}
            onRestoreFromHistory={ai.restoreFromHistory}
            timeAgo={ai.timeAgo}
          />
          <RiskWeightsPanel config={config} onUpdate={update} />
          <VisualSettings   config={config} onUpdate={update} />
          <AdvancedSettings config={config} onUpdate={update} />
        </div>

        {/* Footer */}
        <p style={{ textAlign: 'center', marginTop: 40, fontSize: '0.68rem',
          color: 'var(--color-text-muted)' }}>
          Built with&nbsp;
          <span style={{ color: 'var(--color-text-dim)' }}>YOLOv11n</span> ·{' '}
          <span style={{ color: 'var(--color-text-dim)' }}>Farneback Optical Flow</span> ·{' '}
          <span style={{ color: 'var(--color-text-dim)' }}>FastAPI</span> ·{' '}
          <span style={{ color: 'var(--color-text-dim)' }}>React + Tailwind</span>
        </p>
      </main>
    </div>
  )
}
