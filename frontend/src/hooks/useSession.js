import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

export function useSession() {
  const navigate = useNavigate()
  const [showModal, setShowModal]   = useState(false)
  const [summary, setSummary]       = useState(null)
  const [flowOverlay, setFlowOverlay] = useState(false)

  const stopAnalysis = useCallback(async () => {
    try {
      const res = await fetch('/cancel', { method: 'POST' })
      const data = await res.json()
      setSummary(data)
      setShowModal(true)
    } catch (err) {
      console.error('[session] cancel failed:', err)
    }
  }, [])

  const goHome = useCallback(() => {
    setShowModal(false)
    navigate('/')
  }, [navigate])

  const toggleFlowOverlay = useCallback(async (currentState) => {
    const next = !currentState
    try {
      await fetch(`/api/flow-overlay/${next ? 'on' : 'off'}`, { method: 'POST' })
      setFlowOverlay(next)
    } catch (_) {}
  }, [])

  return {
    showModal, summary, goHome,
    stopAnalysis,
    flowOverlay, toggleFlowOverlay,
  }
}
