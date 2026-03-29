import DashboardHeader     from '../components/dashboard/DashboardHeader'
import VideoPanel           from '../components/dashboard/VideoPanel'
import StatusCard           from '../components/dashboard/StatusCard'
import RiskScoreCard        from '../components/dashboard/RiskScoreCard'
import LiveMetricsCard      from '../components/dashboard/LiveMetricsCard'
import CellBreakdownCard    from '../components/dashboard/CellBreakdownCard'
import PressureCard         from '../components/dashboard/PressureCard'
import FlowFieldCard        from '../components/dashboard/FlowFieldCard'
import CalibrationCard      from '../components/dashboard/CalibrationCard'
import SessionSummaryModal  from '../components/dashboard/SessionSummaryModal'

import { useRiskStats } from '../hooks/useRiskStats'
import { useSession }   from '../hooks/useSession'

async function setCalibMode(enabled) {
  await fetch(`/api/calibration-mode/${enabled ? 'on' : 'off'}`, { method: 'POST' })
}

export default function DashboardPage() {
  const { stats, history } = useRiskStats(500)
  const { showModal, summary, goHome, stopAnalysis, flowOverlay, toggleFlowOverlay } = useSession()

  return (
    <div className="flex flex-col h-screen bg-[var(--color-bg)] overflow-hidden">
      <DashboardHeader
        videoName={stats.current_video}
        flowOverlay={flowOverlay}
        onToggleFlow={() => toggleFlowOverlay(flowOverlay)}
        onStop={stopAnalysis}
      />

      {/* Main layout: video + sidebar */}
      <div className="grid flex-1 min-h-0 gap-3.5 p-3.5 px-6"
        style={{ gridTemplateColumns: '1fr 430px' }}>

        {/* Video panel */}
        <VideoPanel fps={stats.fps} />

        {/* Sidebar */}
        <div className="flex flex-col gap-3 overflow-y-auto sidebar-scroll">
          <StatusCard    status={stats.status} />
          <RiskScoreCard score={stats.risk_score} history={history} />
          <LiveMetricsCard stats={stats} />
          <CellBreakdownCard stats={stats} />
          <PressureCard  pressure={stats.avg_pressure} />
          <FlowFieldCard divergence={stats.avg_divergence} curl={stats.avg_curl} />
          <CalibrationCard
            stats={stats}
            onToggle={enabled => setCalibMode(enabled)}
          />
        </div>
      </div>

      {/* Session Summary Modal */}
      {showModal && (
        <SessionSummaryModal summary={summary} onGoHome={goHome} />
      )}
    </div>
  )
}
