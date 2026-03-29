import { useState, useEffect, useCallback } from 'react'

const SETTINGS_KEY = 'crm-settings'

const DEFAULTS = {
  bias: 70,           // density % (10–90)
  pressure: true,
  calib: false,
  grid: 'standard',  // 'coarse' | 'standard' | 'detailed'
  thresh: 8,
  highThr: 50,        // % (20–80)
  critThr: 75,        // % (40–95)
  alpha: 20,          // overlay alpha% (5–60)
  hyst: 8,
}

export function useConfig() {
  const [config, setConfig] = useState(() => {
    // 1. Try saved user settings
    try {
      const saved = localStorage.getItem(SETTINGS_KEY)
      if (saved) return { ...DEFAULTS, ...JSON.parse(saved) }
    } catch (_) {}
    return { ...DEFAULTS }
  })

  // Restore last session config from backend (populated when user clicks "Go Home")
  useEffect(() => {
    fetch('/api/session-config')
      .then(r => r.ok ? r.json() : null)
      .then(cfg => {
        if (!cfg) return
        setConfig(prev => ({
          ...prev,
          bias:     Math.round((cfg.density_bias ?? 0.70) * 100),
          pressure: cfg.pressure_enabled ?? true,
          calib:    cfg.auto_calib ?? false,
          grid:     cfg.grid_size ?? 'standard',
          thresh:   cfg.thresh_critical ?? 8,
          highThr:  Math.round((cfg.high_score_thr ?? 0.50) * 100),
          critThr:  Math.round((cfg.crit_score_thr ?? 0.75) * 100),
          alpha:    Math.round((cfg.overlay_alpha ?? 0.20) * 100),
          hyst:     cfg.hysteresis ?? 8,
        }))
      })
      .catch(() => {}) // backend may not be running during dev
  }, [])

  const update = useCallback((key, value) => {
    setConfig(prev => ({ ...prev, [key]: value }))
  }, [])

  const saveSettings = useCallback(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(config))
    return true
  }, [config])

  const resetSettings = useCallback(() => {
    localStorage.removeItem(SETTINGS_KEY)
    setConfig({ ...DEFAULTS })
  }, [])

  return { config, update, setConfig, saveSettings, resetSettings }
}
