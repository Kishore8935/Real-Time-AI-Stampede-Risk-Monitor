import { createContext, useContext, useState, useCallback, useEffect } from 'react'

// =============================================================================
// AuthContext — stores JWT token + user info across the app
//
// Usage in any component:
//   const { user, token, login, logout, isAuthenticated } = useAuth()
// =============================================================================

const AuthContext = createContext(null)

const TOKEN_KEY = 'crm-auth-token'
const USER_KEY  = 'crm-auth-user'

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY))
  const [user,  setUser]  = useState(() => {
    try { return JSON.parse(localStorage.getItem(USER_KEY)) } catch { return null }
  })

  // On first load, verify the stored token is still valid
  useEffect(() => {
    if (!token) return
    fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => setUser({ email: data.email, user_id: data.user_id }))
      .catch(() => {
        // Token expired or invalid — clear everything
        localStorage.removeItem(TOKEN_KEY)
        localStorage.removeItem(USER_KEY)
        setToken(null)
        setUser(null)
      })
  }, []) // run once on mount

  const login = useCallback((accessToken, userInfo) => {
    localStorage.setItem(TOKEN_KEY, accessToken)
    localStorage.setItem(USER_KEY, JSON.stringify(userInfo))
    setToken(accessToken)
    setUser(userInfo)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setToken(null)
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{
      token,
      user,
      login,
      logout,
      isAuthenticated: !!token && !!user,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
