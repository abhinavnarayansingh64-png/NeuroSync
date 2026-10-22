/**
 * NotificationPanel — the bell dropdown in the app top bar (PRD Section 5:
 * Notifications). Shows persistent in-app notifications with unread counts
 * and mark-as-read / clear controls.
 */

import { useRef, useState } from 'react'
import { useData } from '../contexts/DataContext'
import { useClickOutside } from '../hooks/useClickOutside'
import { Presence } from './motion/Presence'
import { Icon } from './ui/Icon'
import { timeAgo } from '../utils/format'

const TYPE_COLOR = {
  success: 'text-accent',
  error: 'text-status-danger',
  warning: 'text-status-warning',
  info: 'text-status-running',
}

const TYPE_ICON = {
  success: 'checkCircle',
  error: 'alert',
  warning: 'alert',
  info: 'info',
}

export function NotificationPanel() {
  const { notifications, unreadCount, markNotificationRead, markAllNotificationsRead, clearNotifications } = useData()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useClickOutside(ref, () => setOpen(false), open)

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-lg p-2 text-content-secondary transition-colors hover:bg-card-hover hover:text-content-primary"
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <Icon name="bell" size={20} />
        {unreadCount > 0 && (
          <span className="ns-solid-button absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold" style={{ color: '#151310' }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <Presence when={open} origin="top">
        <div className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] origin-top-right overflow-hidden rounded-2xl border border-border bg-card shadow-float sm:w-96">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold text-content-primary">Notifications</h3>
            {notifications.length > 0 && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={markAllNotificationsRead}
                  className="rounded-md px-2 py-1 text-xs text-content-secondary hover:text-content-primary"
                >
                  Mark all read
                </button>
                <button
                  type="button"
                  onClick={clearNotifications}
                  className="rounded-md px-2 py-1 text-xs text-content-secondary hover:text-content-primary"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-content-muted">
                <Icon name="bell" size={24} className="mx-auto mb-2 opacity-50" />
                You&apos;re all caught up.
              </div>
            ) : (
              <ul>
                {notifications.map((notification) => (
                  <li key={notification.id}>
                    <button
                      type="button"
                      onClick={() => markNotificationRead(notification.id)}
                      className={`flex w-full items-start gap-3 border-b border-border/60 px-4 py-3 text-left transition-colors hover:bg-card-hover ${
                        notification.read ? 'opacity-60' : ''
                      }`}
                    >
                      <Icon
                        name={TYPE_ICON[notification.type] || 'info'}
                        size={18}
                        className={`mt-0.5 shrink-0 ${TYPE_COLOR[notification.type] || 'text-content-secondary'}`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-content-primary">{notification.title}</span>
                          {!notification.read && <span className="h-2 w-2 shrink-0 rounded-full bg-accent" />}
                        </span>
                        <span className="mt-0.5 block text-xs text-content-secondary">{notification.message}</span>
                        <span className="mt-1 block text-[11px] text-content-muted">{timeAgo(notification.createdAt)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Presence>
    </div>
  )
}
