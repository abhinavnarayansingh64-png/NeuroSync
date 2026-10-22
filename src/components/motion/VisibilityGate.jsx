/**
 * VisibilityGate — gates continuous motion (canvas loops, svg signal
 * travel) behind viewport visibility. While offscreen, the gated child
 * receives `running={false}` so it can pause its own loop; the gate itself
 * unmounts its observer on cleanup, so there are no leaked frames.
 *
 * Combined with useReducedMotion, continuous loops are frozen outright in
 * reduced-motion mode.
 */
import { useEffect, useRef, useState } from 'react'

export function VisibilityGate({ children, rootMargin = '120px' }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return

    // Start visible (first paint), then gate on scroll position.
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { rootMargin, threshold: 0 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [rootMargin])

  return (
    <div ref={ref}>
      {typeof children === 'function' ? children(visible) : children}
    </div>
  )
}
