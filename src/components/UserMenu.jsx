/** User dropdown in the top bar: profile, settings, logout. */
import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useClickOutside } from '../hooks/useClickOutside'
import { Presence } from './motion/Presence'
import { Icon } from './ui/Icon'

function initials(name = '') {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('')
}

export function UserMenu() {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const navigate = useNavigate()
  useClickOutside(ref, () => setOpen(false), open)

  const handleLogout = () => {
    setOpen(false)
    logout()
    navigate('/', { replace: true })
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg p-1 pr-2 text-sm transition-colors hover:bg-card-hover"
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-xs font-bold text-accent">
          {initials(user?.fullName) || 'U'}
        </span>
        <span className="hidden max-w-[10rem] truncate font-medium text-content-primary sm:block">
          {user?.fullName || 'User'}
        </span>
        <Icon name="chevronDown" size={16} className="hidden text-content-muted sm:block" />
      </button>

      <Presence when={open} origin="top">
        <div className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-border bg-card shadow-float">
          <div className="border-b border-border px-4 py-3">
            <p className="truncate text-sm font-semibold text-content-primary">{user?.fullName}</p>
            <p className="truncate text-xs text-content-muted">{user?.email}</p>
          </div>
          <div className="p-1.5">
            <Link
              to="/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-content-secondary hover:bg-card-hover hover:text-content-primary"
            >
              <Icon name="user" size={18} /> Profile
            </Link>
            <Link
              to="/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-content-secondary hover:bg-card-hover hover:text-content-primary"
            >
              <Icon name="settings" size={18} /> Settings
            </Link>
          </div>
          <div className="border-t border-border p-1.5">
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-status-danger hover:bg-status-danger/10"
            >
              <Icon name="logout" size={18} /> Logout
            </button>
          </div>
        </div>
      </Presence>
    </div>
  )
}
