/** Renders active toasts from ToastContext in a fixed, stacked viewport. */
import { useToast } from '../../contexts/ToastContext'
import { Presence } from '../../components/motion/Presence'
import { Icon } from './Icon'

const TOAST_STYLES = {
  success: { icon: 'checkCircle', accent: 'text-status-success', border: 'border-status-success-border' },
  error: { icon: 'alert', accent: 'text-status-danger', border: 'border-status-danger-border' },
  warning: { icon: 'alert', accent: 'text-status-warning', border: 'border-status-warning-border' },
  info: { icon: 'info', accent: 'text-status-running', border: 'border-status-running-border' },
}

export function ToastViewport() {
  const { toasts, dismiss } = useToast()

  if (!toasts.length) return null

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2 sm:bottom-6 sm:right-6">
      {toasts.map((toast, index) => {
        const style = TOAST_STYLES[toast.type] || TOAST_STYLES.info
        return (
          <Presence key={toast.id} when origin="bottom">
            <div
              role="status"
              className={`pointer-events-auto flex items-start gap-3 rounded-xl border ${style.border} bg-card p-3.5 shadow-card`}
              style={{ transitionDelay: `${Math.min(index, 2) * 32}ms` }}
            >
              <Icon name={style.icon} size={20} className={`mt-0.5 shrink-0 ${style.accent}`} />
              <p className="flex-1 text-sm text-content-primary">{toast.message}</p>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                className="rounded-md p-0.5 text-content-muted hover:text-content-primary"
                aria-label="Dismiss notification"
              >
                <Icon name="close" size={16} />
              </button>
            </div>
          </Presence>
        )
      })}
    </div>
  )
}
