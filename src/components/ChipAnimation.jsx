import { useEffect, useRef } from 'react'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { VisibilityGate } from './motion/VisibilityGate'

/**
 * CPU/IC-shaped canvas animation: a square die with pins on all four
 * edges, a perimeter "bus" trace loop, a denser internal core grid with
 * comet-trailed signal pulses, a faint background PCB dot-grid for depth,
 * and a slow diagonal sheen sweep across the die surface. Recolored to the
 * app's cyan accent. Runs entirely client-side — no video file to fetch.
 */
function ChipCanvas() {
  const canvasRef = useRef(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let raf
    let width, height, dpr
    let die = { x: 0, y: 0, size: 0 }
    let cores = []
    let edges = []
    let pulses = []
    let pins = []
    let bgDots = []
    let sheenT = 0

    const ACCENT = '59, 166, 241' // accent.DEFAULT
    const ACCENT_HOVER = '92, 182, 244' // accent.hover
    const ACCENT_EDGE = '51, 152, 225' // accent.edge

    function buildLayout() {
      const size = Math.min(width, height) * 0.62
      die = { x: (width - size) / 2, y: (height - size) / 2, size }

      // Pins along all four edges.
      pins = []
      const pinCount = 7
      for (let i = 0; i < pinCount; i++) {
        const t = (i + 0.5) / pinCount
        pins.push({ side: 'top', pos: die.x + t * die.size })
        pins.push({ side: 'bottom', pos: die.x + t * die.size })
        pins.push({ side: 'left', pos: die.y + t * die.size })
        pins.push({ side: 'right', pos: die.y + t * die.size })
      }

      // Denser core grid.
      const cols = 6
      const rows = 6
      const pad = die.size * 0.14
      const innerSize = die.size - pad * 2
      const stepX = innerSize / (cols - 1)
      const stepY = innerSize / (rows - 1)

      cores = []
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const isHub = r % 2 === 0 && c % 2 === 0
          cores.push({
            x: die.x + pad + c * stepX,
            y: die.y + pad + r * stepY,
            r: isHub ? 2.6 : 1.4,
          })
        }
      }

      const idx = (r, c) => r * cols + c
      edges = []
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (c < cols - 1) edges.push([idx(r, c), idx(r, c + 1)])
          if (r < rows - 1) edges.push([idx(r, c), idx(r + 1, c)])
          if (r < rows - 1 && c < cols - 1 && (r + c) % 3 === 0) edges.push([idx(r, c), idx(r + 1, c + 1)])
        }
      }

      const palette = [ACCENT, ACCENT_HOVER, ACCENT_EDGE]
      pulses = edges.slice(0, Math.min(22, edges.length)).map((e, i) => ({
        edge: e,
        t: Math.random(),
        speed: 0.006 + Math.random() * 0.016,
        color: palette[i % palette.length],
        trail: [],
      }))

      // Sparse background PCB dot-grid, outside the die, for depth.
      bgDots = []
      const dotSpacing = 26
      for (let x = dotSpacing / 2; x < width; x += dotSpacing) {
        for (let y = dotSpacing / 2; y < height; y += dotSpacing) {
          const insideDie = x > die.x - 20 && x < die.x + die.size + 20 && y > die.y - 20 && y < die.y + die.size + 20
          if (!insideDie) bgDots.push({ x, y })
        }
      }
    }

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      const rect = canvas.parentElement.getBoundingClientRect()
      width = rect.width
      height = rect.height
      canvas.width = width * dpr
      canvas.height = height * dpr
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      buildLayout()
    }

    function drawBgGrid() {
      bgDots.forEach((d) => {
        ctx.beginPath()
        ctx.arc(d.x, d.y, 0.9, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${ACCENT}, 0.08)`
        ctx.fill()
      })
    }

    function drawPins() {
      ctx.lineWidth = 2
      pins.forEach((p) => {
        ctx.strokeStyle = `rgba(${ACCENT}, 0.4)`
        ctx.beginPath()
        if (p.side === 'top') {
          ctx.moveTo(p.pos, die.y)
          ctx.lineTo(p.pos, die.y - 11)
        } else if (p.side === 'bottom') {
          ctx.moveTo(p.pos, die.y + die.size)
          ctx.lineTo(p.pos, die.y + die.size + 11)
        } else if (p.side === 'left') {
          ctx.moveTo(die.x, p.pos)
          ctx.lineTo(die.x - 11, p.pos)
        } else {
          ctx.moveTo(die.x + die.size, p.pos)
          ctx.lineTo(die.x + die.size + 11, p.pos)
        }
        ctx.stroke()
      })
    }

    function drawBusLoop() {
      // A slightly inset rectangular trace loop, like a power/bus rail
      // running just inside the die perimeter.
      const inset = 5
      ctx.strokeStyle = `rgba(${ACCENT}, 0.22)`
      ctx.lineWidth = 1
      ctx.setLineDash([3, 5])
      ctx.strokeRect(die.x + inset, die.y + inset, die.size - inset * 2, die.size - inset * 2)
      ctx.setLineDash([])
    }

    function drawDie() {
      ctx.fillStyle = 'rgba(20, 18, 16, 0.92)'
      ctx.strokeStyle = `rgba(${ACCENT}, 0.55)`
      ctx.lineWidth = 1.6
      ctx.beginPath()
      ctx.roundRect(die.x, die.y, die.size, die.size, 10)
      ctx.fill()
      ctx.stroke()

      // Diagonal sheen sweep — a soft light band crossing the die on a loop.
      ctx.save()
      ctx.beginPath()
      ctx.roundRect(die.x, die.y, die.size, die.size, 10)
      ctx.clip()
      const sweepPos = die.x + (die.size * 1.6) * (sheenT % 1) - die.size * 0.3
      const sheenGrad = ctx.createLinearGradient(sweepPos - 40, 0, sweepPos + 40, 0)
      sheenGrad.addColorStop(0, 'rgba(255, 255, 255, 0)')
      sheenGrad.addColorStop(0.5, `rgba(${ACCENT_HOVER}, 0.06)`)
      sheenGrad.addColorStop(1, 'rgba(255, 255, 255, 0)')
      ctx.fillStyle = sheenGrad
      ctx.fillRect(die.x, die.y, die.size, die.size)
      ctx.restore()
    }

    function draw() {
      ctx.clearRect(0, 0, width, height)

      if (reduced) {
        // Reduced motion: draw the static structure only — no pulses, no sheen.
        drawBgGrid()
        drawPins()
        drawDie()
        drawBusLoop()
        edges.forEach(([a, b]) => {
          const A = cores[a]
          const B = cores[b]
          ctx.strokeStyle = `rgba(${ACCENT}, 0.13)`
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(A.x, A.y)
          ctx.lineTo(B.x, B.y)
          ctx.stroke()
        })
        cores.forEach((n) => {
          ctx.beginPath()
          ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(${ACCENT}, 0.32)`
          ctx.fill()
        })
        return
      }

      drawBgGrid()
      drawPins()
      drawDie()
      drawBusLoop()

      // internal traces
      edges.forEach(([a, b]) => {
        const A = cores[a]
        const B = cores[b]
        ctx.strokeStyle = `rgba(${ACCENT}, 0.13)`
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(A.x, A.y)
        ctx.lineTo(B.x, B.y)
        ctx.stroke()
      })

      // cores
      cores.forEach((n) => {
        ctx.beginPath()
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${ACCENT}, 0.32)`
        ctx.fill()
      })

      // signal pulses with short comet trails
      pulses.forEach((p) => {
        p.t += p.speed
        if (p.t > 1) {
          p.t = 0
          if (Math.random() > 0.45) p.edge = edges[Math.floor(Math.random() * edges.length)]
        }
        const A = cores[p.edge[0]]
        const B = cores[p.edge[1]]
        const x = A.x + (B.x - A.x) * p.t
        const y = A.y + (B.y - A.y) * p.t

        p.trail.unshift({ x, y })
        if (p.trail.length > 6) p.trail.pop()

        // Comet trail — reduced in count so the canvas stays quiet.
        p.trail.forEach((pos, i) => {
          const fade = 1 - i / p.trail.length
          const radius = 0.8 + fade * 2.6
          const alpha = fade * 0.45
          const grad = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, radius * 2)
          grad.addColorStop(0, `rgba(${p.color}, ${alpha})`)
          grad.addColorStop(1, `rgba(${p.color}, 0)`)
          ctx.beginPath()
          ctx.arc(pos.x, pos.y, radius * 2, 0, Math.PI * 2)
          ctx.fillStyle = grad
          ctx.fill()
        })

        ctx.beginPath()
        ctx.arc(x, y, 1.6, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${p.color}, 1)`
        ctx.fill()
      })

      sheenT += 0.0035

      raf = requestAnimationFrame(draw)
    }

    resize()
    draw()

    const onResize = () => resize()
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
    }
  }, [reduced])

  return <canvas ref={canvasRef} className="block h-full w-full" aria-hidden="true" />
}

export function ChipAnimation({ className = '' }) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-border bg-card ${className}`}
      role="img"
      aria-label="Conceptual animation of signal pulses traveling across a chip die, representing connected GPU compute"
    >
      <VisibilityGate>
        {(visible) => (visible ? <ChipCanvas /> : <StaticDie />)}
      </VisibilityGate>
    </div>
  )
}

/** Static fallback while offscreen — shows structure without any raf work. */
function StaticDie() {
  const ACCENT = '59, 166, 241'
  return (
    <svg
      viewBox="0 0 200 200"
      className="block h-full w-full"
      aria-hidden="true"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* background dots */}
      {Array.from({ length: 49 }, (_, i) => {
        const x = 25 + (i % 7) * 25
        const y = 25 + Math.floor(i / 7) * 25
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r="1"
            fill={`rgba(${ACCENT}, 0.10)`}
          />
        )
      })}
      {/* die */}
      <rect x="60" y="60" width="80" height="80" rx="10" fill="#1c1917" stroke={`rgba(${ACCENT}, 0.55)`} strokeWidth="1.6" />
      <rect x="66" y="66" width="68" height="68" rx="6" fill="none" stroke={`rgba(${ACCENT}, 0.22)`} strokeWidth="1" strokeDasharray="3 5" />
      {/* core grid */}
      {[0, 1, 2, 3, 4].map((r) =>
        [0, 1, 2, 3, 4].map((c) => {
          const isHub = r % 2 === 0 && c % 2 === 0
          const x = 74 + c * 13
          const y = 74 + r * 13
          const lines = []
          if (c < 4) lines.push(<line key={`h${r}${c}`} x1={x} y1={y} x2={x + 13} y2={y} stroke={`rgba(${ACCENT}, 0.13)`} strokeWidth="1" />)
          if (r < 4) lines.push(<line key={`v${r}${c}`} x1={x} y1={y} x2={x} y2={y + 13} stroke={`rgba(${ACCENT}, 0.13)`} strokeWidth="1" />)
          return (
            <g key={`${r}${c}`}>
              {lines}
              <circle cx={x} cy={y} r={isHub ? 2.6 : 1.4} fill={`rgba(${ACCENT}, 0.32)`} />
            </g>
          )
        }),
      )}
      {/* pins */}
      {[1, 2, 3, 4, 5, 6].map((i) => {
        const pos = 72 + i * 11
        return (
          <g key={pos}>
            <line x1={pos} y1={60} x2={pos} y2={49} stroke={`rgba(${ACCENT}, 0.4)`} strokeWidth="2" />
            <line x1={pos} y1={151} x2={pos} y2={140} stroke={`rgba(${ACCENT}, 0.4)`} strokeWidth="2" />
            <line x1={60} y1={pos} x2={49} y2={pos} stroke={`rgba(${ACCENT}, 0.4)`} strokeWidth="2" />
            <line x1={151} y1={pos} x2={140} y2={pos} stroke={`rgba(${ACCENT}, 0.4)`} strokeWidth="2" />
          </g>
        )
      })}
    </svg>
  )
}
