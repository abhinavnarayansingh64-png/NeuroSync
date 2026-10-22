/**
 * WorkflowDiagram — causal workflow animation (PDR §7.3).
 *
 * Reads as a causal sequence even when motion is disabled:
 *  1. Start at Model + Dataset input
 *  2. Signal reaches the Smart Scheduler
 *  3. Branches into Single-GPU / Distributed / Checkpoint-Migration paths
 *  4. Distributed shows synchronization labels; checkpoint path shows
 *     disconnect → handoff → resume semantics
 *  5. All paths converge on a returned Fine-Tuned Model
 *
 * Motion rules honored:
 * - Static layout is fully understandable alone (labeled boxes, arrows)
 * - Branches distinguished by labels + line style, never color alone
 * - One primary pulse travels at a time; sparse, low-frequency
 * - Pauses when offscreen (VisibilityGate), frozen in reduced motion
 * - No product action depends on the diagram
 */
import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { VisibilityGate } from './motion/VisibilityGate'

const ACCENT = '#f7f0e5'
const GREEN = '#d8cfc2'
const AMBER = '#b8b0a5'
const STROKE_DIM = 'rgba(247,240,229,0.28)'

function Diagram() {
  const reduced = useReducedMotion()
  const visibleRef = useRef(true)
  const svgRef = useRef(null)
  const rafRef = useRef(null)
  const pulseEls = useRef([])

  // Path geometry (viewBox 900 x 400)
  const BOX_W = 150
  const BOX_H = 56
  const nodes = {
    input: { x: 40, y: 170, w: 160, h: 60, label: ['Model + Dataset', 'input'] },
    scheduler: { x: 290, y: 170, w: 150, h: 60, label: ['Smart Scheduler', ''] },
    single: { x: 520, y: 60, w: 150, h: 56, label: ['Single GPU', 'training'] },
    distributed: { x: 520, y: 170, w: 150, h: 56, label: ['Distributed', 'fine-tuning'] },
    checkpoint: { x: 520, y: 280, w: 150, h: 56, label: ['Checkpoint', 'migration'] },
    sync: { x: 520, y: 232, w: 150, h: 0, label: ['per-step sync', ''] },
    result: { x: 750, y: 170, w: 150, h: 60, label: ['Fine-tuned Model', 'returned'] },
  }

  const paths = {
    toScheduler: { d: `M 200 200 L 290 200`, active: true },
    toSingle: { d: `M 440 200 C 470 200 470 88 520 88`, branch: true },
    toDistributed: { d: `M 440 200 L 520 200`, active: true },
    toCheckpoint: { d: `M 440 200 C 470 200 470 308 520 308`, branch: true },
    singleResult: { d: `M 670 88 C 700 88 710 200 750 200`, branch: true },
    distributedResult: { d: `M 670 200 L 750 200`, active: true },
    checkpointResult: { d: `M 670 308 C 700 308 710 200 750 200`, branch: true },
  }

  const pulsePhases = [
    { pathKey: 'toScheduler', start: 0, dur: 1.1 },
    { pathKey: 'toDistributed', start: 1.3, dur: 1.0 },
    { pathKey: 'distributedResult', start: 2.5, dur: 1.0 },
    { pathKey: 'toSingle', start: 4.2, dur: 1.2 },
    { pathKey: 'singleResult', start: 5.6, dur: 1.2 },
    { pathKey: 'toCheckpoint', start: 7.4, dur: 1.2 },
    { pathKey: 'checkpointResult', start: 8.8, dur: 1.2 },
  ]
  const CYCLE = 10.8

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return

    // Build pulse dots per path.
    const svgns = 'http://www.w3.org/2000/svg'
    pulseEls.current = Object.entries(paths).map(([key, { d }]) => {
      const path = document.createElementNS(svgns, 'path')
      path.setAttribute('d', d)
      path.setAttribute('fill', 'none')
      path.setAttribute('opacity', '0')
      svg.appendChild(path)
      const dot = document.createElementNS(svgns, 'circle')
      dot.setAttribute('r', '3.5')
      dot.setAttribute('fill', ACCENT)
      dot.setAttribute('opacity', '0')
      svg.appendChild(dot)
      return { key, path, dot, len: 0, ready: false }
    })

    // Measure lengths after a paint so path geometry is laid out.
    const measureRaf = requestAnimationFrame(() => {
      pulseEls.current.forEach((p) => {
        p.len = p.path.getTotalLength()
        p.ready = true
      })
    })

    let start = performance.now()

    function tick(now) {
      const t = ((now - start) % CYCLE) / CYCLE

      pulseEls.current.forEach((p) => {
        if (!p.ready) return
        const phase = pulsePhases.find((f) => f.pathKey === p.key)
        if (!phase) return

        const localT = (t * CYCLE - phase.start) / phase.dur
        let shown = false
        if (localT >= 0 && localT <= 1) {
          const pt = p.path.getPointAtLength(p.len * Math.min(localT, 1))
          p.dot.setAttribute('cx', pt.x)
          p.dot.setAttribute('cy', pt.y)
          const fade = localT < 0.12 ? localT / 0.12 : localT > 0.88 ? (1 - localT) / 0.12 : 1
          p.dot.setAttribute('opacity', fade * 0.95)
          shown = true
        } else {
          p.dot.setAttribute('opacity', '0')
        }
        void shown
      })

      if (visibleRef.current && !reducedRef.current) {
        rafRef.current = requestAnimationFrame(tick)
      }
    }

    rafRef.current = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(measureRaf)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      pulseEls.current.forEach(({ path, dot }) => {
        path.remove()
        dot.remove()
      })
      pulseEls.current = []
    }
  }, [])

  const reducedRef = useRef(reduced)
  useEffect(() => {
    reducedRef.current = reduced
  }, [reduced])

  const box = (n, tone = 'default') => {
    const tones = {
      default: { stroke: STROKE_DIM, fill: '#121211' },
      cyan: { stroke: 'rgba(247,240,229,0.54)', fill: 'rgba(247,240,229,0.08)' },
      green: { stroke: 'rgba(216,207,194,0.54)', fill: 'rgba(216,207,194,0.10)' },
      amber: { stroke: 'rgba(184,176,165,0.54)', fill: 'rgba(184,176,165,0.10)' },
    }
    const t = tones[tone] || tones.default
    return (
      <g key={n.label[0]}>
        <rect x={n.x} y={n.y} width={n.w} height={n.h || BOX_H} rx="8" fill={t.fill} stroke={t.stroke} strokeWidth="1.3" />
        <text
          x={n.x + (n.w || BOX_W) / 2}
          y={n.y + (n.h || BOX_H) / 2 + (n.label[1] ? -2 : 4)}
          fill="#f7f0e5"
          fontSize="12.5"
          fontWeight="600"
          fontFamily="'Inter', sans-serif"
          textAnchor="middle"
        >
          {n.label[0]}
        </text>
        {n.label[1] && (
          <text
            x={n.x + (n.w || BOX_W) / 2}
            y={n.y + (n.h || BOX_H) / 2 + 14}
            fill="#c8c2b9"
            fontSize="10"
            fontFamily="'JetBrains Mono', monospace"
            textAnchor="middle"
            letterSpacing="0.05em"
          >
            {n.label[1].toUpperCase()}
          </text>
        )}
      </g>
    )
  }

  const trace = (key, dashed = false) => (
    <path
      key={key}
      d={paths[key].d}
      fill="none"
      stroke={STROKE_DIM}
      strokeWidth="1.5"
      strokeDasharray={dashed ? '4 5' : '0'}
      strokeLinecap="round"
    />
  )

  return (
    <VisibilityGate>
      {(v) => {
        visibleRef.current = v
        return (
          <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 sm:p-6">
            <svg
              ref={svgRef}
              viewBox="0 0 900 400"
              className="h-auto w-full"
              role="img"
              aria-label="Workflow diagram: a model and dataset enter the smart scheduler, which routes training to a single GPU, distributed fine-tuning, or checkpoint migration, returning a fine-tuned model"
            >
              {/* arrowheads */}
              <defs>
                <marker id="ns-arrow" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
                  <path d="M0,0 L7,3.5 L0,7 z" fill="rgba(247,240,229,0.48)" />
                </marker>
                <marker id="ns-arrow-cyan" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
                  <path d="M0,0 L7,3.5 L0,7 z" fill="rgba(247,240,229,0.84)" />
                </marker>
              </defs>

              {/* structure: static traces with arrowheads */}
              <g markerEnd="url(#ns-arrow)">
                {trace('toScheduler')}
                {trace('toSingle', true)}
                {trace('toDistributed')}
                {trace('toCheckpoint', true)}
                {trace('singleResult', true)}
                {trace('distributedResult')}
                {trace('checkpointResult', true)}
              </g>

              {/* branch labels — never color-dependent */}
              <g fontFamily="'JetBrains Mono', monospace" fontSize="10" letterSpacing="0.06em">
                <text x="455" y="128" fill="#c8c2b9">ROUTE A · SINGLE GPU</text>
                <text x="455" y="240" fill="#c8c2b9">ROUTE B · DISTRIBUTED</text>
                <text x="455" y="388" fill="#c8c2b9">ROUTE C · CHECKPOINT</text>
              </g>

              {/* distributed synchronization detail */}
              <g>
                <rect x="520" y="138" width="150" height="24" rx="4" fill="none" stroke="rgba(247,240,229,0.36)" strokeWidth="1" strokeDasharray="3 4" />
                <text x="595" y="154" fill={ACCENT} fontSize="9.5" fontFamily="'JetBrains Mono', monospace" textAnchor="middle" letterSpacing="0.05em">
                  PER-STEP SYNC
                </text>
                <rect x="520" y="344" width="150" height="24" rx="4" fill="none" stroke="rgba(184,176,165,0.48)" strokeWidth="1" strokeDasharray="3 4" />
                <text x="595" y="360" fill={AMBER} fontSize="9.5" fontFamily="'JetBrains Mono', monospace" textAnchor="middle" letterSpacing="0.05em">
                  DISCONNECT → RESUME
                </text>
              </g>

              {/* nodes */}
              {box(nodes.input, 'default')}
              {box(nodes.scheduler, 'cyan')}
              {box(nodes.single, 'default')}
              {box(nodes.distributed, 'cyan')}
              {box(nodes.checkpoint, 'amber')}
              {box(nodes.result, 'green')}

              {/* terminal marker on result */}
              <circle cx={nodes.result.x + nodes.result.w + 14} cy={nodes.result.y + 30} r="4" fill={GREEN} />
            </svg>
          </div>
        )
      }}
    </VisibilityGate>
  )
}

export function WorkflowDiagram() {
  return <Diagram />
}
