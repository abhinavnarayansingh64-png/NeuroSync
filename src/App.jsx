/**
 * App — provider composition, routing and a top-level error boundary.
 *
 * Provider order matters: DataProvider depends on SettingsProvider (for
 * notification preferences), so Settings must wrap Data.
 */

import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { SettingsProvider } from './contexts/SettingsContext'
import { DataProvider } from './contexts/DataContext'
import { ReceiversProvider } from './contexts/ReceiversContext'
import { ToastProvider } from './contexts/ToastContext'
import { ToastViewport } from './components/ui/ToastViewport'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ScrollToTop } from './components/ScrollToTop'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AppLayout } from './layouts/AppLayout'

import Landing from './pages/Landing'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Docs from './pages/Docs'
import PricingPage from './pages/PricingPage'
import About from './pages/About'
import RoleSelect from './pages/RoleSelect'
import Dashboard from './pages/Dashboard'
import ReceiverDashboard from './pages/ReceiverDashboard'
import NewJob from './pages/NewJob'
import JobDetails from './pages/JobDetails'
import ActiveJobs from './pages/ActiveJobs'
import CompletedJobs from './pages/CompletedJobs'
import FailedJobs from './pages/FailedJobs'
import Models from './pages/Models'
import Settings from './pages/Settings'
import Profile from './pages/Profile'
import NotFound from './pages/NotFound'

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <SettingsProvider>
          <ReceiversProvider>
          <DataProvider>
            <ToastProvider>
              <ScrollToTop />
              <Routes>
                {/* Public routes */}
                <Route path="/" element={<Landing />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/docs" element={<Docs />} />
                <Route path="/pricing" element={<PricingPage />} />
                <Route path="/about" element={<About />} />

                {/* Authenticated routes share the application layout */}
                <Route element={<ProtectedRoute />}>
                  <Route path="/choose-role" element={<RoleSelect />} />
                  <Route element={<AppLayout />}>
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/receiver" element={<ReceiverDashboard />} />
                    <Route path="/jobs/new" element={<NewJob />} />
                    <Route path="/jobs/active" element={<ActiveJobs />} />
                    <Route path="/jobs/completed" element={<CompletedJobs />} />
                    <Route path="/jobs/failed" element={<FailedJobs />} />
                    <Route path="/jobs/:jobId" element={<JobDetails />} />
                    <Route path="/models" element={<Models />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/profile" element={<Profile />} />
                  </Route>
                </Route>

                {/* Redirect legacy path and catch-all 404 */}
                <Route path="/jobs" element={<Navigate to="/jobs/active" replace />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
              <ToastViewport />
            </ToastProvider>
          </DataProvider>
          </ReceiversProvider>
        </SettingsProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}
