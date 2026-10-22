/**
 * App — public routing, protected workspace routing, and top-level recovery.
 *
 * Workspace settings and data only mount within the authenticated route tree.
 * This keeps public pages independent of session-bound hydration.
 */

import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { SettingsProvider } from './contexts/SettingsContext'
import { DataProvider } from './contexts/DataContext'
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
import ReceiverHistory from './pages/ReceiverHistory'
import ReceiverEarnings from './pages/ReceiverEarnings'
import ReceiverHardware from './pages/ReceiverHardware'
import NewJob from './pages/NewJob'
import JobDetails from './pages/JobDetails'
import ActiveJobs from './pages/ActiveJobs'
import CompletedJobs from './pages/CompletedJobs'
import FailedJobs from './pages/FailedJobs'
import Models from './pages/Models'
import Settings from './pages/Settings'
import Profile from './pages/Profile'
import Membership from './pages/Membership'
import DesktopLaunch from './pages/DesktopLaunch'
import NotFound from './pages/NotFound'

function AuthenticatedWorkspaceRoutes() {
  return (
    <SettingsProvider>
      <DataProvider>
        <ProtectedRoute />
      </DataProvider>
    </SettingsProvider>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          <ScrollToTop />
          <Routes>
            {/* Public pages do not mount workspace queries or restoration guards. */}
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/docs" element={<Docs />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/about" element={<About />} />

            {/* Workspace queries begin only after the route enters the protected tree. */}
            <Route element={<AuthenticatedWorkspaceRoutes />}>
              <Route path="/choose-role" element={<RoleSelect />} />
              <Route element={<AppLayout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/receiver" element={<ReceiverDashboard />} />
                <Route path="/receiver/history" element={<ReceiverHistory />} />
                <Route path="/receiver/earnings" element={<ReceiverEarnings />} />
                <Route path="/receiver/hardware" element={<ReceiverHardware />} />
                <Route path="/jobs/new" element={<NewJob />} />
                <Route path="/jobs/active" element={<ActiveJobs />} />
                <Route path="/jobs/completed" element={<CompletedJobs />} />
                <Route path="/jobs/failed" element={<FailedJobs />} />
                <Route path="/jobs/:jobId" element={<JobDetails />} />
                <Route path="/models" element={<Models />} />
                <Route path="/membership" element={<Membership />} />
                <Route path="/desktop" element={<DesktopLaunch />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/profile" element={<Profile />} />
              </Route>
            </Route>

            <Route path="/jobs" element={<Navigate to="/jobs/active" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <ToastViewport />
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}
