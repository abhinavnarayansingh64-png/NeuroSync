/**
 * ProtectedRoute — gates authenticated routes. While auth state is being
 * restored from localStorage it shows a spinner (avoiding a flash of the
 * login page), then redirects unauthenticated users to /login, preserving
 * the attempted location so they can be returned after signing in.
 */

import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { LoadingState } from './ui/Spinner'

export function ProtectedRoute() {
  const { isAuthenticated, initializing } = useAuth()
  const location = useLocation()

  if (initializing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-base">
        <LoadingState label="Loading your workspace…" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}
