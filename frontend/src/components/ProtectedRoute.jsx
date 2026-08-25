import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()
  if (isLoading) return <div className="route-loader">Checking your session…</div>
  return isAuthenticated ? children : <Navigate to="/login" replace state={{ from: location }} />
}
export default ProtectedRoute
