/**
 * NetworkVisual — the hero compute/network diagram.
 *
 * Conceptual "connected compute" story: a central job node dispatches
 * sparse signal pulses along a primary route to receiver nodes (GPU
 * machines), with occasional secondary pulses. It suggests nodes,
 * receiver capacity, scheduling, and a destination without pretending to
 * show live infrastructure.
 *
 * Cost controls (PDR §6/§7.1):
 * - The raf loop only runs while the visual is onscreen (VisibilityGate).
 * - It is frozen entirely in prefers-reduced-motion.
 * - Pulse count is sparse (one primary + max two secondary), not a field.
 * - On unmount, all timers/frames/listeners are cleaned up.
 */
import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { VisibilityGate } from './motion/VisibilityGate'

function NetworkCanvas({ visible }) {
  const canvasRef = useRef(null)
  const reduced = useReducedMotion()
  const visibleRef = useRef(visible)
  visibleRef.current = visible

  useEffect(() => {
    visibleRef.current = visible
  }, [visible])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let raf
    let width, height, dpr
    let nodes = []
    let edges = []
    let pulses = []
    let bgDots = []

    const ACCENT = '59, 166, 241'
    const GREEN = '107, 191, 138'

    function buildLayout() {
      width = canvas.parentElement.clientWidth
      height = canvas.parentElement.clientHeight
      canvas.width = width * dpr
      canvas.height = height * dpr
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const cx = width / 2
      const cy = height / 2

      // Central job node + surrounding receiver nodes on an ellipse.
      nodes = [
        { x: cx, y: cy, r: 7, kind: 'job', label: 'Job' },
        { x: cx - width * 0.30, y: cy - height * 0.28, r: 5, kind: 'gpu' },
        { x: cx + width * 0.30, y: cy - height * 0.28, r: 5, kind: 'gpu' },
        { x: cx - width * 0.30, y: cy + height * 0.28, r: 5, kind: 'gpu' },
        { x: cx + width * 0.30, y: cy + height * 0.28, r: 5, kind: 'gpu' },
        { x: cx - width * 0.42, y: cy, r: 4, kind: 'edge' },
        { x: cx + width * 0.42, y: cy, r: 4, kind: 'edge' },
      ]

      edges = [
        [0, 1], // primary route
        [0, 2], // secondary
        [0, 3], // secondary
        [0, 4],
        [0, 5],
        [0, 6],
      ]

      pulses = edges.map((e, i) => ({
        edge: e,
        t: i === 0 ? 0 : 0.35 + i * 0.18, // primary pulse starts first
        speed: 0.0055,
        active: i === 0, // only primary travels; secondaries stay sparse
      }))

      bgDots = []
      const spacing = 30
      for (let x = spacing / 2; x < width; x += spacing) {
        for (let y = spacing / 2; y < height; y += spacing) {
          const nearCenter = Math.hypot(x - cx, y - cy) < Math.min(width, height) * 0.22
          if (!nearCenter) bgDots.push({ x, y })
        }
      }
    }

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      buildLayout()
    }

    function draw() {
      ctx.clearRect(0, 0, width, height)

      // Quiet dot texture, outside the core zone.
      bgDots.forEach((d) => {
        ctx.beginPath()
        ctx.arc(d.x, d.y, 0.8, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${ACCENT}, 0.07)`
        ctx.fill()
      })

      // Ruled trace lines (static structure).
      edges.forEach(([a, b]) => {
        const A = nodes[a]
        const B = nodes[b]
        ctx.strokeStyle = 'rgba(59,166,241,0.16)'
        ctx.lineWidth = 1
        ctx.setLineDash([2, 4])
        ctx.beginPath()
        ctx.moveTo(A.x, A.y)
        ctx.lineTo(B.x, B.y)
        ctx.stroke()
        ctx.setLineDash([])
      })

      // Pulses (sparse, low-frequency).
      pulses.forEach((p) => {
        if (p.active && visibleRef.current && !reduced) p.t += p.speed
        if (p.t > 1) {
          p.t = 0
          if (Math.random() > 0.6) p.active = false // secondary pulses are occasional
        }
        if (!p.active) return
        const A = nodes[p.edge[0]]
        const B = nodes[p.edge[1]]
        const x = A.x + (B.x - A.x) * p.t
        const y = A.y + (B.y - A.y) * p.t

        const grad = ctx.createRadialGradient(x, y, 0, x, y, 7)
        grad.addColorStop(0, `rgba(${ACCENT}, 0.9)`);
        grad.addColorStop(1, `rgba(${ACCENT}, 0)`)
        ctx.beginPath()
        ctx.arc(x, y, 7, 0, Math.PI * 2)
        ctx.fillStyle = grad
        ctx.fill()

        ctx.beginPath()
        ctx.arc(x, y, 1.6, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${ACCENT}, 1)`
        ctx.fill()
      })

      // Nodes.
      nodes.forEach((n) => {
        ctx.beginPath()
        ctx.arc(n.x, n.y, n.r + 5, 0, Math.PI * 2)
        ctx.fillStyle = n.kind === 'job' ? 'rgba(59,166,241,0.10)' : 'rgba(107,191,138,0.08)'
        ctx.fill()

        ctx.beginPath()
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2)
        ctx.fillStyle = n.kind === 'job' ? '#0c0a09' : '#0c0a09'
        ctx.fill()
        ctx.strokeStyle = n.kind === 'job' ? `rgba(${ACCENT}, 0.7)` : `rgba(${GREEN}, 0.55)`
        ctx.lineWidth = 1.4
        ctx.stroke()

        ctx.beginPath()
        ctx.arc(n.x, n.y, 2.2, 0, Math.PI * 2)
        ctx.fillStyle = n.kind === 'job' ? `rgba(${ACCENT}, 0.9)` : `rgba(${GREEN}, 0.8)`
        ctx.fill()
      })

      raf = requestAnimationFrame(draw)
    }

    resize()
    const onResize = () => resize()
    window.addEventListener('resize', onResize)
    raf = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
    }
  }, [reduced])

  return (
    <canvas
      ref={canvasRef}
      className="block h-full w-full"
      aria-hidden="true"
    />
  )
}

/**
 * Public component: a framed hero visual that pauses its canvas entirely
 * when offscreen and when reduced motion is preferred.
 */
export function NetworkVisual({ className = '' }) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-border bg-card ${className}`}
      role="img"
      aria-label="Conceptual diagram of a training job dispatching signal pulses to connected GPU receiver machines"
    >
      <VisibilityGate>
        {(visible) => <NetworkCanvas visible={visible} />}
      </VisibilityGate>
    </div>
  )
}
