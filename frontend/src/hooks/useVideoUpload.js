import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

export function useVideoUpload(config) {
  const navigate = useNavigate()
  const [selectedFile, setSelectedFile] = useState(null)
  const [uploading, setUploading]       = useState(false)
  const [uploadLabel, setUploadLabel]   = useState('')

  const selectFile = useCallback((file) => {
    if (!file) return
    setSelectedFile(file)
  }, [])

  const upload = useCallback(async () => {
    if (!selectedFile) return
    setUploading(true)
    setUploadLabel(`Uploading "${selectedFile.name}"…`)

    try {
      const form = new FormData()
      form.append('file', selectedFile)

      // Core weights
      form.append('density_bias',     (config.bias / 100).toFixed(2))
      form.append('pressure_enabled', config.pressure ? 'true' : 'false')
      form.append('auto_calib',       config.calib   ? 'true' : 'false')

      // Visuals
      form.append('overlay_alpha', (config.alpha / 100).toFixed(2))
      form.append('grid_size',     config.grid)

      // Advanced thresholds
      form.append('thresh_critical', config.thresh)
      form.append('high_score_thr',  (config.highThr / 100).toFixed(2))
      form.append('crit_score_thr',  (config.critThr / 100).toFixed(2))
      form.append('hysteresis',      config.hyst)

      const res = await fetch('/upload', { method: 'POST', body: form })
      if (!res.ok) throw new Error('Upload failed')

      setUploadLabel('Starting analysis engine…')

      // Save config to localStorage for restoration on "Go Home"
      localStorage.setItem('crm-last-session-config', JSON.stringify({
        density_bias:     config.bias / 100,
        pressure_enabled: config.pressure,
        auto_calib:       config.calib,
        grid_size:        config.grid,
        thresh_critical:  config.thresh,
        high_score_thr:   config.highThr / 100,
        crit_score_thr:   config.critThr / 100,
        overlay_alpha:    config.alpha / 100,
        hysteresis:       config.hyst,
      }))

      await new Promise(r => setTimeout(r, 1500))
      navigate('/dashboard')

    } catch (err) {
      setUploadLabel('❌ ' + err.message)
      setUploading(false)
    }
  }, [selectedFile, config, navigate])

  return { selectedFile, selectFile, uploading, uploadLabel, upload }
}
