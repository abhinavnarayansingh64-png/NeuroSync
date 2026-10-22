/** Signal & Structure style reminder: precise neural-circuit mark, cream signal, technical restraint. */
import { Link } from 'react-router-dom'

export function Logo({ to = '/', className = '', showText = true, size = 30 }) {
  return (
    <Link to={to} className={`inline-flex items-center gap-2.5 ${className}`} aria-label="NeuroSync home">
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0" aria-hidden="true">
        <defs>
          <linearGradient id="nsLogoGrad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#fffdf8" />
            <stop offset="100%" stopColor="#c8c2b9" />
          </linearGradient>
        </defs>
        {[8, 16, 24, 32].map((pos) => (
          <g key={pos}>
            <line x1={pos} y1="0" x2={pos} y2="6" stroke="url(#nsLogoGrad)" strokeWidth="2" strokeLinecap="round" />
            <line x1={pos} y1="34" x2={pos} y2="40" stroke="url(#nsLogoGrad)" strokeWidth="2" strokeLinecap="round" />
            <line x1="0" y1={pos} x2="6" y2={pos} stroke="url(#nsLogoGrad)" strokeWidth="2" strokeLinecap="round" />
            <line x1="34" y1={pos} x2="40" y2={pos} stroke="url(#nsLogoGrad)" strokeWidth="2" strokeLinecap="round" />
          </g>
        ))}
        <rect x="7" y="7" width="26" height="26" rx="6" fill="#121211" stroke="url(#nsLogoGrad)" strokeWidth="1.6" />
        <path d="M21.5 11L14 21.5H19.5L18 29L26 18H20L21.5 11Z" fill="url(#nsLogoGrad)" />
      </svg>

      {showText && <span className="font-display text-lg font-semibold tracking-heading text-content-primary">NeuroSync</span>}
    </Link>
  )
}
