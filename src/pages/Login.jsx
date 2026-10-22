/**
 * Login page (PRD Section 1). Email + password + remember-me, with inline
 * validation beneath each field (never browser alerts). On success the user
 * always lands on /choose-role — every login re-confirms which side of the
 * marketplace they're using that session, rather than only asking once.
 */

import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { AuthShell } from '../components/AuthShell'
import { Input, PasswordInput } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { Checkbox } from '../components/ui/Field'
import { validateEmail, validateRequired, isFormValid } from '../utils/validation'

export default function Login() {
  const { login, isAuthenticated } = useAuth()
  const navigate = useNavigate()

  const [values, setValues] = useState({ email: '', password: '', remember: true })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (isAuthenticated) return <Navigate to="/choose-role" replace />

  const setField = (field, value) => {
    setValues((current) => ({ ...current, [field]: value }))
    if (errors[field]) setErrors((current) => ({ ...current, [field]: '' }))
    if (formError) setFormError('')
  }

  const validate = () => ({
    email: validateEmail(values.email),
    password: validateRequired(values.password, 'Password'),
  })

  const handleSubmit = (event) => {
    event.preventDefault()
    const nextErrors = validate()
    setErrors(nextErrors)
    if (!isFormValid(nextErrors)) return

    setSubmitting(true)
    // Mock auth is synchronous; a short delay makes the loading state visible
    // and mirrors a real network round-trip.
    setTimeout(() => {
      const result = login(values)
      if (!result.success) {
        setFormError(result.error)
        setSubmitting(false)
        return
      }
      navigate('/choose-role', { replace: true })
    }, 400)
  }

  return (
    <AuthShell
      title="Enter the workspace"
      subtitle="Authenticate to resume your routed training work."
      footer={
        <>
          Don&apos;t have an account?{' '}
          <Link to="/signup" className="font-medium text-accent hover:underline">
            Initialize account
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {formError && (
          <div className="rounded-xl border border-status-danger/30 bg-status-danger/10 px-3.5 py-2.5 text-sm text-status-danger">
            {formError}
          </div>
        )}

        <Input
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={values.email}
          onChange={(e) => setField('email', e.target.value)}
          error={errors.email}
          required
        />
        <PasswordInput
          label="Password"
          autoComplete="current-password"
          placeholder="Enter your password"
          value={values.password}
          onChange={(e) => setField('password', e.target.value)}
          error={errors.password}
          required
        />

        <div className="flex items-center justify-between">
          <Checkbox
            checked={values.remember}
            onChange={(checked) => setField('remember', checked)}
            label="Remember me"
          />
          <a href="#forgot" className="text-sm font-medium text-accent hover:underline">
            Forgot Password?
          </a>
        </div>

        <Button type="submit" fullWidth loading={submitting}>
          Authenticate & enter
        </Button>
      </form>
    </AuthShell>
  )
}
