/**
 * Modal — accessible dialog with backdrop, Escape-to-close and body-scroll
 * locking. Used for confirmations (delete/cancel) and small forms (rename).
 * Deliberately avoids native alert()/confirm() dialogs per the PRD.
 */

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { Icon } from './Icon'

export function Modal({ open, onClose, title, description, children, footer, size = 'md' }) {
  const panelRef = useRef(null)
  const reduced = useReducedMotion()
  const [rendered, setRendered] = useState(open)
  const [phase, setPhase] = useState(open ? 'enter' : 'exited')
  const exitTimer = useRef(null)

  useEffect(() => {
    if (exitTimer.current) {
      clearTimeout(exitTimer.current)
      exitTimer.current = null
    }
    if (open) {
      setRendered(true)
      requestAnimationFrame(() => requestAnimationFrame(() => setPhase('enter')))
      return
    }
    if (rendered) {
      setPhase('exit')
      exitTimer.current = setTimeout(() => {
        setRendered(false)
        setPhase('exited')
      }, reduced ? 0 : 180)
    }
  }, [open, rendered, reduced])

  useEffect(
    () => () => {
      if (exitTimer.current) clearTimeout(exitTimer.current)
    },
    [],
  )

  useEffect(() => {
    if (!open) return undefined

    // Remember what was focused so we can restore it when the dialog closes.
    const previouslyFocused = document.activeElement

    const getFocusable = () =>
      Array.from(
        panelRef.current?.querySelectorAll(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
        ) || [],
      ).filter((el) => el.offsetParent !== null)

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose?.()
        return
      }
      // Trap Tab focus within the dialog for keyboard users.
      if (event.key === 'Tab') {
        const focusable = getFocusable()
        if (focusable.length === 0) {
          event.preventDefault()
          panelRef.current?.focus()
          return
        }
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // Move focus to the first focusable control, falling back to the panel.
    const focusable = getFocusable()
    ;(focusable[0] || panelRef.current)?.focus()

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      // Keep body locked while the exit animation plays; release after.
      const exitTimerRef = exitTimer
      const releaseScroll = () => {
        document.body.style.overflow = previousOverflow
        // Restore focus to the element that opened the dialog.
        if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
          previouslyFocused.focus()
        }
      }
      if (!open && !reduced && rendered) {
        // Defer the scroll release until the exit transition finishes.
        window.setTimeout(releaseScroll, 200)
      } else {
        releaseScroll()
      }
      void exitTimerRef
    }
  }, [open, onClose, reduced, rendered])

  if (!rendered) return null

  const maxWidth = size === 'lg' ? 'max-w-2xl' : size === 'sm' ? 'max-w-sm' : 'max-w-md'

  const panelStyle = reduced
    ? undefined
    : {
        transition: `opacity 180ms cubic-bezier(0.23,1,0.32,1), transform 180ms cubic-bezier(0.23,1,0.32,1)`,
        opacity: phase === 'exit' ? 0 : 1,
        transform: phase === 'exit' ? 'scale(0.96) translateY(-6px)' : 'scale(1) translateY(0)',
        pointerEvents: phase === 'exit' ? 'none' : 'auto',
      }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`relative w-full ${maxWidth} rounded-2xl border border-border bg-card shadow-float focus:outline-none`}
        style={panelStyle}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border p-5">
          <div>
            {title && <h2 className="text-lg font-semibold text-content-primary">{title}</h2>}
            {description && <p className="mt-1 text-sm text-content-secondary">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-content-muted hover:bg-card-hover hover:text-content-primary"
            aria-label="Close dialog"
          >
            <Icon name="close" size={20} />
          </button>
        </div>
        {children && <div className="p-5">{children}</div>}
        {footer && <div className="flex justify-end gap-2 border-t border-border p-5">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}
