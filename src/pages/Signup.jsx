/**
 * Signup page (PRD Section 1). Full name, email, password, confirm password
 * with full inline validation. On success the account is created, the
 * session is persisted, and the user lands on /choose-role.
 */

import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { AuthShell } from '../components/AuthShell'
import { Input, PasswordInput } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import {
  validateEmail,
  validatePassword,
  validatePasswordMatch,
  validateRequired,
  isFormValid,
} from '../utils/validation'

export default function Signup() {
  const { signup, isAuthenticated } = useAuth()
  const navigate = useNavigate()

  const [values, setValues] = useState({ fullName: '', email: '', password: '', confirmPassword: '' })
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
    fullName: validateRequired(values.fullName, 'Full Name'),
    email: validateEmail(values.email),
    password: validatePassword(values.password),
    confirmPassword: validatePasswordMatch(values.password, values.confirmPassword),
  })

  const handleSubmit = (event) => {
    event.preventDefault()
    const nextErrors = validate()
    setErrors(nextErrors)
    if (!isFormValid(nextErrors)) return

    setSubmitting(true)
    setTimeout(() => {
      const result = signup(values)
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
      title="Initialize your workspace"
      subtitle="Register an identity before routing your first training job."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-accent hover:underline">
            Authenticate
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
          label="Full Name"
          autoComplete="name"
          placeholder="Ada Lovelace"
          value={values.fullName}
          onChange={(e) => setField('fullName', e.target.value)}
          error={errors.fullName}
          required
        />
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
          autoComplete="new-password"
          placeholder="At least 6 characters"
          value={values.password}
          onChange={(e) => setField('password', e.target.value)}
          error={errors.password}
          required
        />
        <PasswordInput
          label="Confirm Password"
          autoComplete="new-password"
          placeholder="Re-enter your password"
          value={values.confirmPassword}
          onChange={(e) => setField('confirmPassword', e.target.value)}
          error={errors.confirmPassword}
          required
        />

        <Button type="submit" fullWidth loading={submitting}>
          Create workspace identity
        </Button>
      </form>
    </AuthShell>
  )
}
