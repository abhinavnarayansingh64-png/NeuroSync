import { useEffect, useRef } from 'react'
import { useReducedMotion } from '../hooks/useReducedMotion'
import './ScrollExpand.css'

/**
 * Expands a bounded system panel as it enters the viewport. It writes a CSS
 * variable only, keeping the scroll interaction visual and non-blocking.
 */
export function ScrollExpand({ children, className = '' }) {
  const ref = useRef(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    const element = ref.current
    if (!element) return undefined
    if (reduced) {
      element.style.setProperty('--scroll-expand', '1')
      return undefined
    }

    let frame = 0
    const update = () => {
      frame = 0
      const rect = element.getBoundingClientRect()
      const viewport = window.innerHeight || 1
      const progress = Math.min(1, Math.max(0, (viewport - rect.top) / (viewport * 0.72)))
      element.style.setProperty('--scroll-expand', progress.toFixed(3))
    }
    const requestUpdate = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }

    update()
    window.addEventListener('scroll', requestUpdate, { passive: true })
    window.addEventListener('resize', requestUpdate)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', requestUpdate)
      window.removeEventListener('resize', requestUpdate)
    }
  }, [reduced])

  return (
    <div ref={ref} className={`scroll-expand ${className}`}>
      <div className="scroll-expand__panel">{children}</div>
    </div>
  )
}
