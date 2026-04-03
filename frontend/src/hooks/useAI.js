import { useState, useCallback, useEffect } from 'react'

const TOKEN_KEY = 'crm-auth-token'
const USER_KEY  = 'crm-auth-user'

function getAuth() {
  const token = localStorage.getItem(TOKEN_KEY)
  let user = null
  try { user = JSON.parse(localStorage.getItem(USER_KEY)) } catch (_) {}
  return { token, user }
}

function timeAgo(isoString) {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000)
  if (diff < 60)    return 'just now'
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function compressImage(dataUrl, maxW = 240, maxH = 160, quality = 0.65) {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(maxW / img.width, maxH / img.height, 1)
      const canvas = document.createElement('canvas')
      canvas.width  = Math.round(img.width  * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => resolve(null)
    img.src = dataUrl
  })
}

async function fetchHistory(token) {
  if (!token) return []
  try {
    const res = await fetch('/api/ai-history', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return []
    return await res.json()
  } catch {
    return []
  }
}

export function useAI(config, setConfig) {
  const [aiStatus,      setAiStatus]      = useState('')
  const [aiError,       setAiError]       = useState(false)
  const [aiLoading,     setAiLoading]     = useState(false)
  const [explanation,   setExplanation]   = useState(null)
  const [imageBase64,   setImageBase64]   = useState('')
  const [showKeyWarning, setShowKeyWarning] = useState(false)
  const [historyModalOpen, setHistoryModalOpen] = useState(false)
  const [history,       setHistory]       = useState([])

  // Load history from API on mount
  useEffect(() => {
    const { token } = getAuth()
    fetchHistory(token).then(setHistory)
  }, [])

  const selectImage = useCallback((file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = e => setImageBase64(e.target.result)
    reader.readAsDataURL(file)
  }, [])

  const clearImage = useCallback(() => setImageBase64(''), [])

  const askAI = useCallback(async (prompt) => {
    if (!prompt.trim()) {
      setAiStatus('⚠ Please describe your scenario first.')
      setAiError(true)
      return
    }
    setAiLoading(true)
    setAiError(false)
    setExplanation(null)
    setAiStatus('🤖 Analysing your scenario…')

    const { token, user } = getAuth()

    try {
      // Compress thumbnail before sending (saves DB space)
      const thumbnail = imageBase64 ? await compressImage(imageBase64) : null

      const res = await fetch('/api/ai-configure', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          prompt,
          ...(imageBase64  ? { image_base64:      imageBase64 } : {}),
          ...(thumbnail    ? { image_thumbnail_b64: thumbnail } : {}),
          ...(user         ? { user_id: user.user_id }          : {}),
        }),
      })
      const data = await res.json()

      if (data.error) {
        if (data.error.includes('GEMINI_API_KEY')) setShowKeyWarning(true)
        setAiError(true)
        setAiStatus('❌ ' + data.error)
        return
      }

      const biasInt  = Math.round(data.density_bias   * 100)
      const highInt  = Math.round(data.high_score_thr * 100)
      const critInt  = Math.round(data.crit_score_thr * 100)
      const alphaInt = Math.round(data.overlay_alpha  * 100)

      setConfig(prev => ({
        ...prev,
        bias: biasInt, pressure: data.pressure_enabled, calib: false,
        grid: data.grid_size, thresh: data.thresh_critical,
        highThr: highInt, critThr: critInt, alpha: alphaInt,
        hyst: data.hysteresis,
      }))

      setExplanation({
        text: data.explanation,
        chips: [
          `Density ${biasInt}% / Motion ${100 - biasInt}%`,
          `Pressure ${data.pressure_enabled ? 'ON' : 'OFF'}`,
          `Grid: ${data.grid_size}`,
          `Alert @ ${highInt}% / ${critInt}%`,
          `Thresh: ${data.thresh_critical} ppl/cell`,
        ],
      })
      setAiError(false)
      setAiStatus('✅ All sliders updated by AI — ready to analyse.')

      // Refresh history from API so the new entry appears
      fetchHistory(token).then(setHistory)

    } catch (err) {
      setAiError(true)
      setAiStatus('❌ Network error: ' + err.message)
    } finally {
      setAiLoading(false)
    }
  }, [imageBase64, setConfig])

  const restoreFromHistory = useCallback((index) => {
    const entry = history[index]
    if (!entry) return
    // Map DB shape back to config sliders
    const snap = entry.config_snapshot
    if (snap) {
      setConfig(prev => ({
        ...prev,
        bias:     Math.round((snap.density_bias   ?? prev.bias / 100) * 100),
        pressure: snap.pressure_enabled ?? prev.pressure,
        grid:     snap.grid_size        ?? prev.grid,
        thresh:   snap.thresh_critical  ?? prev.thresh,
        highThr:  Math.round((snap.high_score_thr ?? prev.highThr / 100) * 100),
        critThr:  Math.round((snap.crit_score_thr ?? prev.critThr / 100) * 100),
        alpha:    Math.round((snap.overlay_alpha  ?? prev.alpha  / 100) * 100),
        hyst:     snap.hysteresis       ?? prev.hyst,
      }))
    }
    setHistoryModalOpen(false)
    setAiStatus('✅ Settings restored from history.')
    setTimeout(() => setAiStatus(''), 2500)
  }, [history, setConfig])

  return {
    aiStatus, aiError, aiLoading, explanation,
    imageBase64, selectImage, clearImage,
    showKeyWarning,
    history, historyModalOpen, setHistoryModalOpen,
    askAI, restoreFromHistory, timeAgo,
  }
}
