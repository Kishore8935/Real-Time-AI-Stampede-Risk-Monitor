import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

const TOKEN_KEY = 'crm-auth-token'

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
      const token = localStorage.getItem(TOKEN_KEY)
      const form  = new FormData()
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

      const res = await fetch('/upload', {
        method:  'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body:    form,
      })

      if (res.status === 401) throw new Error('Session expired. Please log in again.')
      if (!res.ok)            throw new Error('Upload failed')

      const data = await res.json()
      const sessionId = data.session_id

      setUploadLabel('Starting analysis engine…')

      // Keep localStorage config for slider restoration on "Go Home"
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
      // Navigate to the session-specific dashboard URL
      navigate(sessionId ? `/dashboard/${sessionId}` : '/dashboard')

    } catch (err) {
      setUploadLabel('❌ ' + err.message)
      setUploading(false)
    }
  }, [selectedFile, config, navigate])

  return { selectedFile, selectFile, uploading, uploadLabel, upload }
}
