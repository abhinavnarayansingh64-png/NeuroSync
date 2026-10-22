/**
 * AppLayout — the shared shell for every authenticated page (PRD Section 1:
 * Application Layout). Provides a persistent sidebar for primary navigation,
 * a top bar with the logo, notifications and the user menu, and a scrollable
 * content area rendered via <Outlet />. Fully responsive: the sidebar becomes
 * a slide-in drawer on small screens.
 *
 * Sender vs receiver navigation is driven by settings.workspaceRole, chosen
 * once on /choose-role right after login (and changeable from Settings) —
 * there's no in-sidebar switcher anymore.
 */

import { useEffect, useState } from 'react'
import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom'
import { Logo } from '../components/Logo'
import { UserMenu } from '../components/UserMenu'
import { NotificationPanel } from '../components/NotificationPanel'
import { Presence } from '../components/motion/Presence'
import { Icon } from '../components/ui/Icon'
import { useData } from '../contexts/DataContext'
import { useSettings } from '../contexts/SettingsContext'
import { isActiveStatus, isTerminalStatus, JOB_STATUS } from '../services/trainingSimulator'

const SENDER_NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: 'dashboard', end: true },
  { to: '/jobs/new', label: 'New Job', icon: 'plus' },
  { to: '/jobs/active', label: 'Active Jobs', icon: 'activity', badgeKey: 'active' },
  { to: '/jobs/completed', label: 'Completed', icon: 'checkCircle' },
  { to: '/jobs/failed', label: 'Failed', icon: 'alert' },
  { to: '/models', label: 'Models', icon: 'cube' },
  { to: '/settings', label: 'Settings', icon: 'settings' },
]

const RECEIVER_NAV_ITEMS = [
  { to: '/receiver', label: 'Receiver Dashboard', icon: 'chip', end: true },
  { to: '/settings', label: 'Settings', icon: 'settings' },
]

function SidebarContent({ onNavigate, counts, mode }) {
  const items = mode === 'receiver' ? RECEIVER_NAV_ITEMS : SENDER_NAV_ITEMS
  return (
    <nav className="flex h-full flex-col gap-1 p-3">
      {items.map((item) => {
        const count = item.badgeKey ? counts[item.badgeKey] : 0
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              [
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-accent-soft text-accent'
                  : 'text-content-secondary hover:bg-card-hover hover:text-content-primary',
              ].join(' ')
            }
          >
            <Icon name={item.icon} size={18} />
            <span className="flex-1">{item.label}</span>
            {count > 0 && (
              <span className="rounded-full bg-status-running/20 px-2 py-0.5 text-[11px] font-semibold text-status-running">
                {count}
              </span>
            )}
          </NavLink>
        )
      })}
    </nav>
  )
}

export function AppLayout() {
  const { jobs } = useData()
  const { settings } = useSettings()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const location = useLocation()

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname])

  // Every authenticated user picks a side once, right after login
  // (RoleSelect); until then, keep them out of the dashboard shell.
  if (!settings.workspaceRole) {
    return <Navigate to="/choose-role" replace />
  }

  const mode = settings.workspaceRole === 'receiver' ? 'receiver' : 'sender'

  const counts = {
    active: jobs.filter((job) => isActiveStatus(job.status)).length,
    completed: jobs.filter((job) => job.status === JOB_STATUS.COMPLETED).length,
    failed: jobs.filter((job) => isTerminalStatus(job.status) && job.status !== JOB_STATUS.COMPLETED).length,
  }

  return (
    <div className="min-h-screen bg-base">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-border bg-base/90 backdrop-blur-md">
        <div className="flex h-16 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-lg p-2 text-content-secondary hover:bg-card-hover hover:text-content-primary lg:hidden"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open navigation menu"
            >
              <Icon name="menu" size={22} />
            </button>
            <Logo to={mode === 'receiver' ? '/receiver' : '/dashboard'} />
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <NotificationPanel />
            <UserMenu />
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1600px]">
        {/* Desktop sidebar */}
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-64 shrink-0 border-r border-border lg:block">
          <SidebarContent counts={counts} mode={mode} />
        </aside>

        {/* Mobile drawer — enter/exit transitions via Presence (instant in reduced motion) */}
        <Presence when={drawerOpen} origin="left" className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-black/70 animate-fade-in" onClick={() => setDrawerOpen(false)} aria-hidden="true" />
          <div className="absolute left-0 top-0 h-full w-72 border-r border-border bg-base">
            <div className="flex h-16 items-center justify-between border-b border-border px-4">
              <Logo to={mode === 'receiver' ? '/receiver' : '/dashboard'} />
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="rounded-lg p-2 text-content-secondary hover:text-content-primary"
                aria-label="Close navigation menu"
              >
                <Icon name="close" size={22} />
              </button>
            </div>
            <SidebarContent
              onNavigate={() => setDrawerOpen(false)}
              counts={counts}
              mode={mode}
            />
          </div>
        </Presence>

        {/* Main content */}
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
