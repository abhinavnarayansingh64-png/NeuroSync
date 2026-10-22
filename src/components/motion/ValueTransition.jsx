/**
 * ValueTransition — short tabular-number transition for telemetry.
 *
 * When `value` changes, the number crossfades with a tiny vertical slide
 * instead of flashing or jumping. Values never overshoot: the displayed
 * value is always an exact render of the prop; only the container animates.
 *
 * In reduced-motion mode the crossfade is removed and the number updates
 * instantly but stays fully readable.
 */
import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from '../../hooks/useReducedMotion'

const FLIP_MS = 300

export function ValueTransition({ value, className = '' }) {
  const reduced = useReducedMotion()
  const [display, setDisplay] = useState(value)
  const [animating, setAnimating] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => {
    if (value === display) return
    if (reduced) {
      setDisplay(value)
      return
    }
    setAnimating(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    // Start the exit the frame the value changes, settle at the new value.
    timerRef.current = setTimeout(() => {
      setDisplay(value)
      timerRef.current = setTimeout(() => setAnimating(false), FLIP_MS)
    }, FLIP_MS / 2)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [value, display, reduced])

  return (
    <span
      className={`inline-block font-tabular transition-all duration-[150ms] ease-[cubic-bezier(0.23,1,0.32,1)] ${
        animating ? 'translate-y-[2px] opacity-70' : 'translate-y-0 opacity-100'
      } ${className}`}
    >
      {display}
    </span>
  )
}
