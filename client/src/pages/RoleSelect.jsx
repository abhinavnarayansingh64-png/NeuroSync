/**
 * RoleSelect — shown right after login/signup, before the dashboard, so the
 * user picks which side of the marketplace they're using. Replaces the
 * pill switch that used to live inside the sidebar. The choice can be
 * changed later from Settings. Signal & Structure reminder: the role choice
 * is a routing decision, presented as an operational handoff.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useSettings } from '../contexts/SettingsContext'
import { Logo } from '../components/Logo'
import { RevealGroup } from '../components/motion/Reveal'
import { Icon } from '../components/ui/Icon'

function RoleCard({ icon, title, subtitle, description, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group w-full max-w-sm rounded-2xl border border-border bg-card/95 p-8 text-left transition-all duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-0.5 hover:border-accent-border hover:bg-card-hover disabled:pointer-events-none disabled:opacity-60"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-accent-soft text-accent">
        <Icon name={icon} size={26} />
      </div>
      <p className="mt-6 text-xs font-medium uppercase tracking-wide text-content-muted">{subtitle}</p>
      <h3 className="mt-1 text-2xl font-medium tracking-heading text-content-primary">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-content-secondary">{description}</p>
      <div className="mt-6 flex items-center gap-1.5 text-sm font-medium text-accent">
        <span>Route to workspace</span>
        <Icon name="chevronRight" size={16} className="transition-transform group-hover:translate-x-0.5" />
      </div>
    </button>
  )
}

export default function RoleSelect() {
  const { user } = useAuth()
  const { updateSettings } = useSettings()
  const navigate = useNavigate()
  const [pendingRole, setPendingRole] = useState(null)

  const choose = async (role) => {
    setPendingRole(role)
    try {
      const result = await updateSettings({ workspaceRole: role })
      if (!result.success) return
      navigate(role === 'receiver' ? '/receiver' : '/dashboard', { replace: true })
    } finally {
      setPendingRole(null)
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-base px-4 py-16 texture-ruled">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.92),transparent_30%)]" aria-hidden="true" />
      <div className="relative flex flex-col items-center">
      <Logo />
      <p className="mt-7 font-mono-tech text-[10px] uppercase tracking-[0.14em] text-accent">Workspace routing · step 01</p>
      <h1 className="mt-3 text-center text-2xl font-medium tracking-heading text-content-primary sm:text-3xl">
        Select the role that receives your next signal{user?.fullName ? `, ${user.fullName.split(' ')[0]}` : ''}.
      </h1>
      <p className="mt-2 text-center text-sm text-content-secondary">
        This only sets the initial route. Reconfigure it later in Settings.
      </p>

      <RevealGroup as="div" className="mt-10 flex flex-col gap-5 sm:flex-row" stagger={72}>
        <RoleCard
          icon="plus"
          subtitle="I have a dataset"
          title="Send training jobs"
          description="Pick a model, upload a dataset, and get it fine-tuned on someone else's GPU."
          onClick={() => choose('sender')}
          disabled={!!pendingRole}
        />
        <RoleCard
          icon="chip"
          subtitle="I have a GPU"
          title="Receive training jobs"
          description="Let your machine pick up incoming jobs and earn a payout for every one you complete."
          onClick={() => choose('receiver')}
          disabled={!!pendingRole}
        />
      </RevealGroup>
      </div>
    </div>
  )
}
