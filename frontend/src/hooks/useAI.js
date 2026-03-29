import { useState, useCallback } from 'react'

const HISTORY_KEY = 'crm-prompt-history'
const HISTORY_MAX = 15

function timeAgo(ts) {
  const diff = Math.floor((Date.now() - ts) / 1000)
  if (diff < 60)    return 'just now'
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [] } catch (_) { return [] }
}

function compressImage(dataUrl, maxW = 240, maxH = 160, quality = 0.65) {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(maxW / img.width, maxH / img.height, 1)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => resolve(null)
    img.src = dataUrl
  })
}

export function useAI(config, setConfig) {
  const [aiStatus, setAiStatus]     = useState('')
  const [aiError, setAiError]       = useState(false)
  const [aiLoading, setAiLoading]   = useState(false)
  const [explanation, setExplanation] = useState(null)  // { text, chips }
  const [imageBase64, setImageBase64] = useState('')
  const [showKeyWarning, setShowKeyWarning] = useState(false)
  const [historyModalOpen, setHistoryModalOpen] = useState(false)
  const [history, setHistory]       = useState(loadHistory)

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

    try {
      const res = await fetch('/api/ai-configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, ...(imageBase64 ? { image_base64: imageBase64 } : {}) }),
      })
      const data = await res.json()

      if (data.error) {
        if (data.error.includes('GEMINI_API_KEY')) setShowKeyWarning(true)
        setAiError(true)
        setAiStatus('❌ ' + data.error)
        return
      }

      const biasInt  = Math.round(data.density_bias * 100)
      const highInt  = Math.round(data.high_score_thr * 100)
      const critInt  = Math.round(data.crit_score_thr * 100)
      const alphaInt = Math.round(data.overlay_alpha * 100)

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

      // Save to history
      const currentSettings = {
        bias: biasInt, pressure: data.pressure_enabled, calib: false,
        grid: data.grid_size, thresh: data.thresh_critical,
        highThr: highInt, critThr: critInt, alpha: alphaInt, hyst: data.hysteresis,
      }
      const imgToStore = imageBase64 ? await compressImage(imageBase64) : null
      setHistory(prev => {
        const updated = [{ prompt, settings: currentSettings, ts: Date.now(), image: imgToStore }, ...prev]
          .slice(0, HISTORY_MAX)
        try { localStorage.setItem(HISTORY_KEY, JSON.stringify(updated)) } catch (_) {}
        return updated
      })

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
    setConfig(prev => ({ ...prev, ...entry.settings }))
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
