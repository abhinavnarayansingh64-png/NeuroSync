/**
 * StatusTransition — a short, stable cue when a job's lifecycle status
 * actually changes. Motion explains the transition but never invents,
 * reorders, or preannounces a status: the underlying status must already
 * be the source of truth.
 *
 * The badge crossfades + slides a few pixels on change. Reduced motion
 * renders the new status instantly with the same colors, borders, and
 * icons, so semantic meaning never depends on animation.
 */
import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from '../../hooks/useReducedMotion'

const CUE_MS = 340

export function StatusTransition({ children, className = '' }) {
  const reduced = useReducedMotion()
  const prevRef = useRef(null)
  const [cue, setCue] = useState(false)
  const timerRef = useRef(null)

  // `children` content (e.g. a status string or a rendered badge)
  const key = typeof children === 'string' ? children : null

  useEffect(() => {
    if (key !== null && prevRef.current !== null && prevRef.current !== key) {
      if (reduced) return
      setCue(true)
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setCue(false), CUE_MS)
    }
    prevRef.current = key
  }, [key, reduced])

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    },
    [],
  )

  return (
    <span
      className={`inline-block transition-all duration-[340ms] ease-[cubic-bezier(0.77,0,0.175,1)] ${
        cue ? 'scale-[1.03] brightness-125' : 'scale-100 brightness-100'
      } ${className}`}
    >
      {children}
    </span>
  )
}
