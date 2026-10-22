/**
 * Toast (transient notification) context.
 *
 * Lightweight, dependency-free toasts used for immediate feedback such as
 * "Saved" or "Training started". These are separate from the persistent
 * in-app notification centre (see DataContext). Toasts auto-dismiss.
 */

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { uid } from '../utils/id'

const ToastContext = createContext(null)

const DEFAULT_DURATION = 4000

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef(new Map())

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const push = useCallback(
    (message, { type = 'info', duration = DEFAULT_DURATION } = {}) => {
      const id = uid('toast')
      setToasts((current) => [...current, { id, message, type }])
      if (duration > 0) {
        const timer = setTimeout(() => dismiss(id), duration)
        timers.current.set(id, timer)
      }
      return id
    },
    [dismiss],
  )

  const value = useMemo(
    () => ({
      toasts,
      dismiss,
      toast: {
        info: (message, options) => push(message, { ...options, type: 'info' }),
        success: (message, options) => push(message, { ...options, type: 'success' }),
        error: (message, options) => push(message, { ...options, type: 'error' }),
        warning: (message, options) => push(message, { ...options, type: 'warning' }),
      },
    }),
    [toasts, dismiss, push],
  )

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider.')
  }
  return context
}
