import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import LandingPage  from './pages/LandingPage'
import DashboardPage from './pages/DashboardPage'
import LoginPage    from './pages/LoginPage'
import SignupPage   from './pages/SignupPage'

// Guard — redirects to /login if not authenticated
function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? children : <Navigate to="/login" replace />
}

// Public-only route — redirects logged-in users away from login/signup
function PublicRoute({ children }) {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? <Navigate to="/" replace /> : children
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/login"  element={<PublicRoute><LoginPage  /></PublicRoute>} />
          <Route path="/signup" element={<PublicRoute><SignupPage /></PublicRoute>} />

          {/* Protected routes */}
          <Route path="/" element={
            <ProtectedRoute><LandingPage /></ProtectedRoute>
          } />
          <Route path="/dashboard/:sessionId?" element={
            <ProtectedRoute><DashboardPage /></ProtectedRoute>
          } />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
