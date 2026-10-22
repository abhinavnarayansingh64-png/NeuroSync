import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { trpc } from '../lib/trpc'
import { workspaceRouteForRole } from '../utils/workspaceRoute'
import { AuthShell } from '../components/AuthShell'
import { Button } from '../components/ui/Button'

export default function Login() {
  const { login, isAuthenticated } = useAuth()
  const profileQuery = trpc.workspace.profile.useQuery(undefined, { enabled: isAuthenticated, retry: false, staleTime: 30_000 })

  if (isAuthenticated && profileQuery.isLoading) return null
  if (isAuthenticated) return <Navigate to={workspaceRouteForRole(profileQuery.data?.workspaceRole)} replace />

  return (
    <AuthShell
      title="Enter the workspace"
      subtitle="Use your managed NeuroSync identity to resume routed training work."
      footer={
        <>
          New to NeuroSync?{' '}
          <Link to="/signup" className="font-medium text-accent hover:underline">
            Learn about workspace access
          </Link>
        </>
      }
    >
      <div className="space-y-5">
        <div className="rounded-xl border border-border bg-surface/70 p-4 text-sm leading-relaxed text-content-secondary">
          Authentication is managed securely through the connected identity provider. NeuroSync never stores your password.
        </div>
        <Button type="button" fullWidth onClick={() => login()}>
          Continue with secure sign-in
        </Button>
        <p className="text-center font-mono-tech text-[10px] uppercase tracking-[0.12em] text-content-muted">
          Encrypted session handoff · OAuth protected
        </p>
      </div>
    </AuthShell>
  )
}
