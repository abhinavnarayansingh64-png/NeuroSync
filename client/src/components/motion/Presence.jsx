/**
 * Presence — mount/unmount transition primitive (Level 2 structural motion).
 *
 * Used for drawers, menus, modals, accordions, and dropdowns. When `when`
 * goes true the element enters; when false it plays the exit animation,
 * then unmounts via a timeout. Transitions are interruptible: re-entering
 * during exit cancels the unmount timer. Reduced-motion users get instant
 * mount/unmount with identical content and keyboard behavior.
 *
 * Uses transform + opacity only, starts near final size (scale 0.96 max),
 * and never from scale 0.
 */
import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from '../../hooks/useReducedMotion'

const EXIT_MS = 180

export function Presence({
  when,
  children,
  origin = 'top', // top | bottom | left | right | center
  className = '',
  role = 'dialog',
}) {
  const reduced = useReducedMotion()
  const [rendered, setRendered] = useState(when)
  const [phase, setPhase] = useState(when ? 'enter' : 'exited')
  const timerRef = useRef(null)

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }

    if (when) {
      setRendered(true)
      // Double rAF so the enter class applies after mount paints.
      const raf = requestAnimationFrame(() => requestAnimationFrame(() => setPhase('enter')))
      return () => cancelAnimationFrame(raf)
    }

    if (rendered) {
      setPhase('exit')
      timerRef.current = setTimeout(() => {
        setRendered(false)
        setPhase('exited')
      }, reduced ? 0 : EXIT_MS)
    }
  }, [when, rendered, reduced])

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    },
    [],
  )

  if (!rendered) return null

  const originClasses = {
    top: 'origin-top',
    bottom: 'origin-bottom',
    left: 'origin-left',
    right: 'origin-right',
    center: 'origin-center',
  }

  const isEnter = phase === 'enter'
  const style = reduced
    ? undefined
    : {
        animation: isEnter ? undefined : undefined,
        transition: `opacity ${EXIT_MS}ms cubic-bezier(0.23,1,0.32,1), transform ${EXIT_MS}ms cubic-bezier(0.23,1,0.32,1)`,
        opacity: isEnter ? 1 : 0,
        transform: isEnter ? 'scale(1) translateY(0)' : 'scale(0.97) translateY(-6px)',
        pointerEvents: isEnter ? 'auto' : 'none',
      }

  return (
    <div role={role} className={`${originClasses[origin]} ${className}`} style={style}>
      {children}
    </div>
  )
}
