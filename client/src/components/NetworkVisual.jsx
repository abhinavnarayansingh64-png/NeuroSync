/**
 * A readable sender-to-receiver handoff diagram. It names the physical ends
 * of the route and shows the scheduler rather than relying on abstract nodes.
 */
export function NetworkVisual({ className = '' }) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-border bg-[#0e0e0d] ${className}`}
      role="img"
      aria-label="Training job route from a sender PC through the NeuroSync scheduler to a ready GPU receiver, followed by a checkpoint return"
    >
      <div className="absolute inset-0 opacity-40 [background-image:radial-gradient(rgba(247,240,229,0.15)_0.75px,transparent_0.75px)] [background-size:18px_18px]" aria-hidden="true" />
      <svg viewBox="0 0 640 260" className="relative h-full w-full" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <defs>
          <linearGradient id="compute-route-fade" x1="0" x2="1">
            <stop offset="0%" stopColor="#f7f0e5" stopOpacity="0.18" />
            <stop offset="48%" stopColor="#f7f0e5" stopOpacity="0.82" />
            <stop offset="100%" stopColor="#f7f0e5" stopOpacity="0.24" />
          </linearGradient>
          <filter id="compute-route-glow" x="-30%" y="-50%" width="160%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        <path d="M150 172 C242 172 280 112 320 112 C372 112 395 76 492 76" fill="none" stroke="url(#compute-route-fade)" strokeWidth="2" strokeDasharray="5 7" />
        <path d="M492 92 C397 92 373 158 320 158 C278 158 241 194 150 194" fill="none" stroke="rgba(247,240,229,0.18)" strokeWidth="1.2" strokeDasharray="3 8" />
        <circle cx="304" cy="122" r="4" fill="#f7f0e5" filter="url(#compute-route-glow)" />
        <circle cx="369" cy="92" r="3" fill="#d8cfc2" filter="url(#compute-route-glow)" />

        <g transform="translate(54 118)">
          <rect width="108" height="84" rx="10" fill="#151513" stroke="rgba(247,240,229,0.45)" />
          <rect x="26" y="16" width="56" height="34" rx="4" fill="none" stroke="#f7f0e5" strokeWidth="1.7" />
          <path d="M46 66H62M54 50V66M32 66H76" stroke="#f7f0e5" strokeWidth="1.7" strokeLinecap="round" />
          <circle cx="34" cy="24" r="2" fill="#d8cfc2" />
          <text x="54" y="104" textAnchor="middle" fill="#f7f0e5" fontSize="11" fontFamily="JetBrains Mono, monospace" letterSpacing="1.5">PC / SENDER</text>
          <text x="54" y="119" textAnchor="middle" fill="#c8c2b9" fontSize="9" fontFamily="JetBrains Mono, monospace">JOB SUBMITTED</text>
        </g>

        <g transform="translate(270 89)">
          <rect width="102" height="66" rx="9" fill="#171614" stroke="rgba(247,240,229,0.5)" />
          <path d="M25 21H77M25 33H77M25 45H57" stroke="rgba(247,240,229,0.74)" strokeWidth="1.4" strokeLinecap="round" />
          <circle cx="72" cy="45" r="3" fill="#f7f0e5" />
          <text x="51" y="84" textAnchor="middle" fill="#f7f0e5" fontSize="10" fontFamily="JetBrains Mono, monospace" letterSpacing="1.1">SCHEDULER</text>
        </g>

        <g transform="translate(480 24)">
          <rect width="108" height="84" rx="10" fill="#151513" stroke="rgba(247,240,229,0.45)" />
          <rect x="21" y="18" width="66" height="37" rx="4" fill="none" stroke="#f7f0e5" strokeWidth="1.7" />
          <rect x="29" y="26" width="22" height="21" rx="2" fill="rgba(247,240,229,0.08)" stroke="rgba(247,240,229,0.6)" />
          <path d="M60 28H77M60 36H77M60 44H77M26 13V18M41 13V18M56 13V18M71 13V18M26 55V60M41 55V60M56 55V60M71 55V60" stroke="#f7f0e5" strokeWidth="1.3" strokeLinecap="round" />
          <text x="54" y="104" textAnchor="middle" fill="#f7f0e5" fontSize="11" fontFamily="JetBrains Mono, monospace" letterSpacing="1.5">GPU / RECEIVER</text>
          <text x="54" y="119" textAnchor="middle" fill="#c8c2b9" fontSize="9" fontFamily="JetBrains Mono, monospace">READY · 24 GB VRAM</text>
        </g>

        <text x="322" y="226" textAnchor="middle" fill="#c8c2b9" fontSize="9" fontFamily="JetBrains Mono, monospace" letterSpacing="1.25">TRAINING STREAM → CHECKPOINT RETURN</text>
      </svg>
    </div>
  )
}
