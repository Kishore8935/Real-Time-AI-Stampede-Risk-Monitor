import { useState, useCallback } from 'react'

export const PRESETS = {
  concert:    { bias: 45, pressure: true,  calib: false, grid: 'standard', thresh: 7,  highThr: 55, critThr: 75, alpha: 20, hyst: 8 },
  pilgrimage: { bias: 60, pressure: true,  calib: false, grid: 'coarse',   thresh: 9,  highThr: 50, critThr: 72, alpha: 18, hyst: 10 },
  subway:     { bias: 75, pressure: false, calib: false, grid: 'detailed', thresh: 10, highThr: 55, critThr: 80, alpha: 20, hyst: 12 },
  mall:       { bias: 55, pressure: true,  calib: false, grid: 'coarse',   thresh: 8,  highThr: 55, critThr: 78, alpha: 22, hyst: 8 },
  stadium:    { bias: 80, pressure: true,  calib: false, grid: 'detailed', thresh: 7,  highThr: 45, critThr: 65, alpha: 25, hyst: 10 },
  drone:      { bias: 65, pressure: true,  calib: false, grid: 'coarse',   thresh: 12, highThr: 50, critThr: 70, alpha: 15, hyst: 6 },
}

export const PRESET_LABELS = {
  concert:    'Concert / Mosh Pit',
  pilgrimage: 'Religious Pilgrimage',
  subway:     'Subway / Platform',
  mall:       'Shopping Mall',
  stadium:    'Stadium Corridor',
  drone:      'Drone / Top-Down',
}

export function usePresets(setConfig) {
  const [activePreset, setActivePreset] = useState(null)
  const [appliedLabel, setAppliedLabel] = useState('')

  const applyPreset = useCallback((name) => {
    const p = PRESETS[name]
    if (!p) return
    setConfig(prev => ({ ...prev, ...p }))
    setActivePreset(name)
    setAppliedLabel(`"${PRESET_LABELS[name]}" preset applied — all parameters updated.`)
  }, [setConfig])

  const clearPreset = useCallback(() => {
    setActivePreset(null)
    setAppliedLabel('')
  }, [])

  return { activePreset, appliedLabel, applyPreset, clearPreset }
}
