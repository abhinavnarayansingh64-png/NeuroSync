import { useCallback, useRef } from 'react'
import './EdgeGlowCard.css'

/**
 * A pointer-aware cream edge treatment for information cards. The visual is
 * intentionally monochrome and also has a focus state for keyboard users.
 */
export function EdgeGlowCard({ children, className = '', label }) {
  const ref = useRef(null)

  const setStrength = useCallback((strength) => {
    ref.current?.style.setProperty('--edge-strength', String(strength))
  }, [])

  return (
    <div
      ref={ref}
      className="edge-glow-card"
      tabIndex={0}
      role="group"
      aria-label={label}
      onPointerEnter={(event) => event.pointerType !== 'touch' && setStrength(1)}
      onPointerLeave={() => setStrength(0)}
      onFocus={() => setStrength(1)}
      onBlur={() => setStrength(0)}
    >
      <div className={`edge-glow-card__surface ${className}`}>{children}</div>
    </div>
  )
}
