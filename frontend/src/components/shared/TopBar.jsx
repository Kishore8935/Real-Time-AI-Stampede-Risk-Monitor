import { useState } from 'react'

export default function TopBar() {
  const [light, setLight] = useState(() => localStorage.getItem('crm-theme') === 'light')

  function toggleTheme() {
    const next = !light
    setLight(next)
    localStorage.setItem('crm-theme', next ? 'light' : 'dark')
    document.body.classList.toggle('light', next)
  }

  return (
    <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-3.5 
                    bg-[rgba(8,12,20,0.85)] backdrop-blur-[14px] border-b border-[var(--color-border)]">
      <div className="flex items-center gap-2.5">
        <span className="text-2xl">🚦</span>
        <span className="text-[0.95rem] font-bold text-[var(--color-text)]">Stampede Risk Monitor</span>
      </div>
      <button
        onClick={toggleTheme}
        className="bg-[var(--color-surface2)] border border-[var(--color-border)] rounded-lg 
                   px-2.5 py-1.5 text-base text-[var(--color-text)] cursor-pointer 
                   hover:bg-[var(--color-border)] transition-colors"
        title="Toggle theme"
      >
        {light ? '🌙' : '☀️'}
      </button>
    </nav>
  )
}
