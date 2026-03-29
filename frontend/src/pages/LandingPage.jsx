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
    <div className="min-h-screen bg-[var(--color-bg)]">
      {/* Background glow */}
      <div className="fixed inset-0 z-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 60% 45% at 30% 20%, rgba(99,102,241,0.10) 0%, transparent 70%),
                       radial-gradient(ellipse 50% 40% at 70% 70%, rgba(34,197,94,0.05)  0%, transparent 60%)`
        }} />

      <TopBar />

      <div className="relative z-10 max-w-[1400px] mx-auto px-5 py-10 pb-16">
        {/* Hero */}
        <div className="text-center mb-9">
          <div className="flex justify-center gap-2 mb-4 flex-wrap">
            {[
              { color: 'var(--color-blue)',   label: 'YOLOv11' },
              { color: 'var(--color-green)',  label: 'Optical Flow' },
              { color: 'var(--color-orange)', label: 'Crowd Pressure' },
            ].map(({ color, label }) => (
              <span key={label}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[0.72rem] font-semibold
                           bg-[var(--color-surface)] border border-[var(--color-border)]">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
                {label}
              </span>
            ))}
          </div>

          <h1 className="text-[clamp(1.6rem,4vw,2.8rem)] font-extrabold leading-tight mb-3">
            Real-Time AI<br />
            <span className="bg-gradient-to-br from-[var(--color-blue)] via-[var(--color-blue-b)] to-[var(--color-green)]
                             bg-clip-text text-transparent">
              Stampede Risk Monitor
            </span>
          </h1>
          <p className="text-[0.88rem] text-[var(--color-text-dim)] max-w-[560px] mx-auto mb-5 leading-relaxed">
            Upload a crowd video, configure the analysis parameters, and get instant stampede risk
            analysis with cell-by-cell density mapping, motion chaos detection, and crowd pressure scoring.
          </p>

          <div className="flex justify-center flex-wrap gap-2.5">
            {[
              ['🧠', 'YOLO Object Detection'],
              ['🌊', 'Farneback Optical Flow'],
              ['🗜️', 'Crowd Pressure (P=ρ×σᵥ)'],
              ['📊', 'Live Risk Timeline'],
            ].map(([icon, text]) => (
              <div key={text}
                className="flex items-center gap-1.5 text-[0.75rem] text-[var(--color-text-dim)]
                           bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-2.5 py-1.5">
                <span>{icon}</span>{text}
              </div>
            ))}
          </div>
        </div>

        {/* 3-Column Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-start">
          {/* Col 1: Upload */}
          <VideoUpload
            selectedFile={upload.selectedFile}
            onSelectFile={upload.selectFile}
            onUpload={upload.upload}
            uploading={upload.uploading}
            uploadLabel={upload.uploadLabel}
            onSaveSettings={saveSettings}
            onResetSettings={resetSettings}
          />

          {/* Col 2: Presets + AI */}
          <div className="flex flex-col gap-5">
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
          </div>

          {/* Col 3: Config panels */}
          <div className="flex flex-col gap-5">
            <RiskWeightsPanel config={config} onUpdate={update} />
            <VisualSettings   config={config} onUpdate={update} />
            <AdvancedSettings config={config} onUpdate={update} />
          </div>
        </div>

        {/* Footer */}
        <div className="mt-10 text-center text-[0.70rem] text-[var(--color-text-muted)] leading-relaxed">
          Capstone Project · 2026 &nbsp;·&nbsp;
          <span className="text-[var(--color-text-dim)] font-medium">YOLOv11n</span> +&nbsp;
          <span className="text-[var(--color-text-dim)] font-medium">Farneback Optical Flow</span> +&nbsp;
          <span className="text-[var(--color-text-dim)] font-medium">FastAPI</span>
        </div>
      </div>
    </div>
  )
}
