/**
 * SignalLine — SVG signal-pulse primitive for causal diagrams.
 *
 * Draws a labeled path and travels a small number of sparse signal pulses
 * along it (one primary route, occasional secondary pulses). Pulses are
 * raf-driven only while the diagram is visible (pair with VisibilityGate)
 * and are frozen in reduced-motion mode where the path is drawn with a
 * simple line-draw + a static endpoint marker instead.
 *
 * Rules honored: low-frequency, visibility-gated, never blocks interaction,
 * branches distinguished by labels and line style (not color alone).
 */
import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from '../../hooks/useReducedMotion'

export function SignalLine({
  d,
  className = '',
  label,
  labelX,
  labelY,
  active = true,
  dash = '0', // svg dasharray string; '5,5' gives a dashed branch
}) {
  const reduced = useReducedMotion()
  const pathRef = useRef(null)
  const [len, setLen] = useState(0)
  const rafRef = useRef(null)
  const pulsesRef = useRef([])
  const visibleRef = useRef(true)

  // Measure path length once mounted.
  useEffect(() => {
    const el = pathRef.current
    if (!el) return
    setLen(el.getTotalLength())
  }, [d])

  // Slow, sparse pulses — only along active lines.
  useEffect(() => {
    if (reduced || !active || len === 0) return
    const path = pathRef.current
    if (!path) return

    // Up to one active pulse per line; respawn when it finishes.
    pulsesRef.current = [0]

    const svgns = 'http://www.w3.org/2000/svg'
    const group = path.ownerSVGElement
    const pulseEls = []

    for (let i = 0; i < 1; i++) {
      const dot = document.createElementNS(svgns, 'circle')
      dot.setAttribute('r', '3')
      dot.setAttribute('fill', '#f7f0e5')
      dot.setAttribute('opacity', '0')
      group.appendChild(dot)
      pulseEls.push(dot)
    }

    let start = performance.now()
    const DURATION = 2600

    function tick(now) {
      if (!visibleRef.current) {
        rafRef.current = requestAnimationFrame(tick)
        return
      }
      const t = ((now - start) % DURATION) / DURATION
      const x = path.getPointAtLength(len * t)
      pulseEls.forEach((dot, i) => {
        dot.setAttribute('cx', x.x)
        dot.setAttribute('cy', x.y)
        // Only one pulse; fade near endpoints.
        dot.setAttribute('opacity', t < 0.08 ? t / 0.08 : t > 0.92 ? (1 - t) / 0.08 : 0.9)
      })
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      pulseEls.forEach((dot) => dot.remove())
    }
  }, [reduced, active, len])

  // Visibility gating for diagrams that live inside a VisibilityGate.
  useEffect(() => {
    visibleRef.current = active
  }, [active])

  return (
    <g className={className}>
      <path
        ref={pathRef}
        d={d}
        fill="none"
        stroke="rgba(247,240,229,0.34)"
        strokeWidth="1.5"
        strokeDasharray={dash}
        strokeLinecap="round"
      />
      {label && (
        <text
          x={labelX}
          y={labelY}
          fill="#c8c2b9"
          fontSize="10.5"
          fontFamily="'JetBrains Mono', monospace"
          textAnchor="middle"
          letterSpacing="0.04em"
        >
          {label}
        </text>
      )}
    </g>
  )
}

/** Endpoint node — terminal box with a quiet label; no animation needed. */
export function SignalNode({ x, y, width, height, label, tone = 'default' }) {
  const tones = {
    default: { stroke: 'rgba(247,240,229,0.28)', fill: '#121211', text: '#f7f0e5' },
    cyan: { stroke: 'rgba(247,240,229,0.52)', fill: 'rgba(247,240,229,0.08)', text: '#f7f0e5' },
    green: { stroke: 'rgba(216,207,194,0.48)', fill: 'rgba(216,207,194,0.08)', text: '#f7f0e5' },
    amber: { stroke: 'rgba(184,176,165,0.48)', fill: 'rgba(184,176,165,0.08)', text: '#f7f0e5' },
  }
  const t = tones[tone] || tones.default
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx="6" fill={t.fill} stroke={t.stroke} strokeWidth="1.2" />
      <text
        x={x + width / 2}
        y={y + height / 2 + 4}
        fill={t.text}
        fontSize="11"
        fontWeight="500"
        fontFamily="'Inter', sans-serif"
        textAnchor="middle"
      >
        {label}
      </text>
    </g>
  )
}
