import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function TopBar() {
  const [light, setLight] = useState(() => localStorage.getItem('crm-theme') === 'light')
  const { user, logout, isAuthenticated } = useAuth()
  const navigate = useNavigate()

  function toggleTheme() {
    const next = !light
    setLight(next)
    localStorage.setItem('crm-theme', next ? 'light' : 'dark')
    document.body.classList.toggle('light', next)
  }

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-3.5
                    bg-[var(--color-surface)] bg-opacity-90 backdrop-blur-[14px] border-b border-[var(--color-border)]">
      {/* Brand */}
      <div className="flex items-center gap-2.5">
        <span className="text-2xl">🚦</span>
        <span className="text-[0.95rem] font-bold text-[var(--color-text)]">Stampede Risk Monitor</span>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2.5">
        {/* Session History link — only when logged in */}
        {isAuthenticated && (
          <Link to="/history"
            className="bg-[var(--color-surface2)] border border-[var(--color-border)] rounded-lg
                       px-2.5 py-1.5 text-[0.75rem] font-medium text-[var(--color-text-dim)] cursor-pointer
                       hover:bg-[var(--color-border)] transition-colors no-underline">
            📁 History
          </Link>
        )}

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="bg-[var(--color-surface2)] border border-[var(--color-border)] rounded-lg
                     px-2.5 py-1.5 text-base text-[var(--color-text)] cursor-pointer
                     hover:bg-[var(--color-border)] transition-colors"
          title="Toggle theme"
        >
          {light ? '🌙' : '☀️'}
        </button>

        {/* User info + logout */}
        {isAuthenticated && user && (
          <div className="flex items-center gap-2 pl-1 border-l border-[var(--color-border)]">
            <span className="text-[0.72rem] text-[var(--color-text-muted)] hidden sm:block max-w-[160px] truncate">
              {user.email}
            </span>
            <button
              onClick={handleLogout}
              className="bg-[var(--color-surface2)] border border-[var(--color-border)] rounded-lg
                         px-2.5 py-1.5 text-[0.72rem] font-semibold text-[var(--color-red)]
                         cursor-pointer hover:bg-[rgba(239,68,68,0.10)] transition-colors"
              title="Sign out"
            >
              Sign Out
            </button>
          </div>
        )}
      </div>
    </nav>
  )
}
