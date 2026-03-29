import { useState, useEffect, useRef } from 'react'

const EMPTY_STATS = {
  active:         false,
  risk_score:     0,
  status:         'Idle',
  person_count:   0,
  fps:            0,
  high_cells:     0,
  critical_cells: 0,
  grid_rows:      0,
  grid_cols:      0,
  current_video:  '',
  avg_pressure:   0,
  avg_divergence: 0,
  avg_curl:       0,
  calib_mode:     false,
  calib_status:   'off',
  density_weight: 70,
  motion_weight:  30,
  calib_sample_target:     0,
  calib_samples_collected: 0,
}

export function useRiskStats(pollInterval = 500) {
  const [stats, setStats]         = useState(EMPTY_STATS)
  const [history, setHistory]     = useState([])  // last 60 risk scores for chart
  const intervalRef               = useRef(null)

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      fetch('/api/stats')
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (!data) return
          setStats(data)
          if (data.active) {
            setHistory(prev => {
              const next = [...prev, data.risk_score]
              return next.length > 60 ? next.slice(-60) : next
            })
          }
        })
        .catch(() => {})
    }, pollInterval)

    return () => clearInterval(intervalRef.current)
  }, [pollInterval])

  return { stats, history }
}
