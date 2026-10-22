/**
 * LineChart — a lightweight, dependency-free SVG line/area chart for a single
 * metric series (training loss, learning rate, GPU usage, …). It uses a
 * viewBox so it scales fluidly and stays crisp on any screen, and it is
 * decorative-safe: an accessible text summary is provided for screen readers.
 */

import { useMemo, useRef, useState } from 'react'
import { useReducedMotion } from '../../hooks/useReducedMotion'

// Cream is the active signal; neutral tonal variation keeps secondary
// series legible within the black workspace palette.
const TONE_COLORS = {
  accent: '#f7f0e5',
  blue: '#d8cfc2',
  amber: '#b8b0a5',
  purple: '#8f887e',
}

export function LineChart({
  data = [],
  tone = 'accent',
  height = 140,
  formatValue = (v) => String(v),
  label = 'series',
  yMin,
  yMax,
}) {
  const width = 320
  const padding = { top: 10, right: 6, bottom: 6, left: 6 }
  const color = TONE_COLORS[tone] || TONE_COLORS.accent

  const { linePath, areaPath, min, max, last } = useMemo(() => {
    if (!data.length) return { linePath: '', areaPath: '', min: 0, max: 0, last: null }

    const values = data.map((d) => (typeof d === 'number' ? d : d.value))
    const computedMin = yMin !== undefined ? yMin : Math.min(...values)
    const computedMax = yMax !== undefined ? yMax : Math.max(...values)
    const range = computedMax - computedMin || 1

    const innerW = width - padding.left - padding.right
    const innerH = height - padding.top - padding.bottom
    const stepX = data.length > 1 ? innerW / (data.length - 1) : 0

    const points = values.map((value, i) => {
      const x = padding.left + i * stepX
      const y = padding.top + innerH - ((value - computedMin) / range) * innerH
      return [x, y]
    })

    const line = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
    const area =
      `M${points[0][0].toFixed(1)},${(height - padding.bottom).toFixed(1)} ` +
      points.map(([x, y]) => `L${x.toFixed(1)},${y.toFixed(1)}`).join(' ') +
      ` L${points[points.length - 1][0].toFixed(1)},${(height - padding.bottom).toFixed(1)} Z`

    return {
      linePath: line,
      areaPath: area,
      min: computedMin,
      max: computedMax,
      last: values[values.length - 1],
    }
  }, [data, height, yMin, yMax])

  const gradientId = `grad-${tone}`
  const reduced = useReducedMotion()
  const pathRef = useRef(null)
  const [drawn, setDrawn] = useState(false)

  // One-time, non-looping entrance draw — pure CSS, no rAF.
  useMemo(() => {
    if (reduced || !data.length || drawn) return
    const path = pathRef.current
    if (!path) return
    const len = path.getTotalLength()
    path.style.strokeDasharray = len
    path.style.strokeDashoffset = len
    // Force a paint so the draw transition has a starting point.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      path.style.transition = 'stroke-dashoffset 0.9s cubic-bezier(0.23,1,0.32,1)'
      path.style.strokeDashoffset = '0'
    }))
    setDrawn(true)
  }, [data, reduced, drawn])

  if (!data.length) {
    return (
      <div
        className="flex items-center justify-center rounded-lg bg-surface/60 text-xs text-content-muted"
        style={{ height }}
      >
        Waiting for data…
      </div>
    )
  }

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        preserveAspectRatio="none"
        role="img"
        aria-label={`${label} chart. Latest value ${formatValue(last)}. Range ${formatValue(min)} to ${formatValue(max)}.`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#${gradientId})`} />
        <path
          ref={pathRef}
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          style={reduced ? undefined : { strokeDasharray: '100%', strokeDashoffset: drawn ? '0' : '100%', transition: 'stroke-dashoffset 0.9s cubic-bezier(0.23,1,0.32,1)' }}
        />
      </svg>
    </div>
  )
}
