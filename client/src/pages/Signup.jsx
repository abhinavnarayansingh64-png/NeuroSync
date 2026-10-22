import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { AuthShell } from '../components/AuthShell'
import { Button } from '../components/ui/Button'

export default function Signup() {
  const { signup, isAuthenticated } = useAuth()

  if (isAuthenticated) return <Navigate to="/choose-role" replace />

  return (
    <AuthShell
      title="Initialize your workspace"
      subtitle="Verify a managed identity before routing your first training job."
      footer={
        <>
          Already provisioned?{' '}
          <Link to="/login" className="font-medium text-accent hover:underline">
            Authenticate
          </Link>
        </>
      }
    >
      <div className="space-y-5">
        <div className="rounded-xl border border-border bg-surface/70 p-4 text-sm leading-relaxed text-content-secondary">
          Your profile is created automatically the first time you authenticate. Workspace settings and job history are stored securely in NeuroSync.
        </div>
        <Button type="button" fullWidth onClick={() => signup()}>
          Continue with secure sign-in
        </Button>
        <p className="text-center font-mono-tech text-[10px] uppercase tracking-[0.12em] text-content-muted">
          Identity provisioned on first sign-in
        </p>
      </div>
    </AuthShell>
  )
}
