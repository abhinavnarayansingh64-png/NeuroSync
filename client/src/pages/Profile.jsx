/**
 * Profile (PRD Section 5: Profile). View account information, update the
 * profile, change the password, and log out.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { PageContainer, PageHeader } from '../components/ui/PageContainer'
import { Card } from '../components/ui/Card'
import { Input, PasswordInput } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { Icon } from '../components/ui/Icon'
import {
  validateRequired,
  validateEmail,
  validatePassword,
  validatePasswordMatch,
  isFormValid,
} from '../utils/validation'
import { formatDateTime } from '../utils/format'

export default function Profile() {
  const { user, updateProfile, changePassword, logout } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [profile, setProfile] = useState({ fullName: user?.fullName || '', email: user?.email || '' })
  const [profileErrors, setProfileErrors] = useState({})

  const [password, setPassword] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [passwordErrors, setPasswordErrors] = useState({})
  const [passwordFormError, setPasswordFormError] = useState('')
  const [loggingOut, setLoggingOut] = useState(false)

  const saveProfile = (event) => {
    event.preventDefault()
    const errors = {
      fullName: validateRequired(profile.fullName, 'Full Name'),
      email: validateEmail(profile.email),
    }
    setProfileErrors(errors)
    if (!isFormValid(errors)) return

    const result = updateProfile(profile)
    if (!result.success) {
      setProfileErrors((current) => ({ ...current, email: result.error }))
      return
    }
    toast.success('Profile updated')
  }

  const savePassword = (event) => {
    event.preventDefault()
    setPasswordFormError('')
    const errors = {
      currentPassword: validateRequired(password.currentPassword, 'Current password'),
      newPassword: validatePassword(password.newPassword),
      confirmPassword: validatePasswordMatch(password.newPassword, password.confirmPassword),
    }
    setPasswordErrors(errors)
    if (!isFormValid(errors)) return

    const result = changePassword(password)
    if (!result.success) {
      setPasswordFormError(result.error)
      return
    }
    setPassword({ currentPassword: '', newPassword: '', confirmPassword: '' })
    toast.success('Password changed')
  }

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await logout()
      navigate('/', { replace: true })
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <PageContainer size="narrow">
      <PageHeader title="Profile" description="Manage your account details and security." />

      <div className="space-y-6">
        {/* Account summary */}
        <Card>
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-lg font-bold text-accent">
              {(user?.fullName || 'U')
                .trim()
                .split(/\s+/)
                .slice(0, 2)
                .map((part) => part[0]?.toUpperCase())
                .join('')}
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold text-content-primary">{user?.fullName}</h2>
              <p className="truncate text-sm text-content-secondary">{user?.email}</p>
              <p className="mt-0.5 text-xs text-content-muted">Member since {formatDateTime(user?.createdAt)}</p>
            </div>
          </div>
        </Card>

        {/* Update profile */}
        <Card title="Account Information" description="Update your name and email address.">
          <form onSubmit={saveProfile} noValidate className="space-y-4">
            <Input
              label="Full Name"
              value={profile.fullName}
              onChange={(e) => setProfile((c) => ({ ...c, fullName: e.target.value }))}
              error={profileErrors.fullName}
              required
            />
            <Input
              label="Email"
              type="email"
              value={profile.email}
              onChange={(e) => setProfile((c) => ({ ...c, email: e.target.value }))}
              error={profileErrors.email}
              required
            />
            <div className="flex justify-end">
              <Button type="submit">Save changes</Button>
            </div>
          </form>
        </Card>

        {/* Change password */}
        <Card title="Change Password" description="Use a strong password you don't reuse elsewhere.">
          <form onSubmit={savePassword} noValidate className="space-y-4">
            {passwordFormError && (
              <div className="rounded-xl border border-status-danger/30 bg-status-danger/10 px-3.5 py-2.5 text-sm text-status-danger">
                {passwordFormError}
              </div>
            )}
            <PasswordInput
              label="Current Password"
              autoComplete="current-password"
              value={password.currentPassword}
              onChange={(e) => setPassword((c) => ({ ...c, currentPassword: e.target.value }))}
              error={passwordErrors.currentPassword}
              required
            />
            <PasswordInput
              label="New Password"
              autoComplete="new-password"
              value={password.newPassword}
              onChange={(e) => setPassword((c) => ({ ...c, newPassword: e.target.value }))}
              error={passwordErrors.newPassword}
              required
            />
            <PasswordInput
              label="Confirm New Password"
              autoComplete="new-password"
              value={password.confirmPassword}
              onChange={(e) => setPassword((c) => ({ ...c, confirmPassword: e.target.value }))}
              error={passwordErrors.confirmPassword}
              required
            />
            <div className="flex justify-end">
              <Button type="submit">Update password</Button>
            </div>
          </form>
        </Card>

        {/* Logout */}
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-content-primary">Log out</p>
              <p className="mt-0.5 text-xs text-content-secondary">Sign out of your NeuroSync workspace on this device.</p>
            </div>
            <Button variant="danger" icon="logout" onClick={handleLogout} disabled={loggingOut}>
              {loggingOut ? 'Logging out…' : 'Logout'}
            </Button>
          </div>
        </Card>
      </div>
    </PageContainer>
  )
}
