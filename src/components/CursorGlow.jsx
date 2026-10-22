import { useEffect, useRef } from 'react'

import { useReducedMotion } from '../hooks/useReducedMotion'

/**
 * A soft cyan comet trail that follows the cursor — used only on the
 * landing page (mounted locally there, not app-wide, so it never shows up
 * inside the dashboard). Fades to near-invisible whenever the cursor is
 * over a card, button, or link, so the glow stays in open space instead of
 * washing out content. No-op on touch-only devices and fully disabled in
 * reduced-motion mode (it is decoration, and the PDR removes it there).
 *
 * Cost controls: the trail canvas never clears on a timer outside its own
 * raf, pointer events are sampled passively, and the loop cleans up on
 * unmount.
 */
export function CursorGlow() {
  const canvasRef = useRef(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    const isTouch = window.matchMedia('(pointer: coarse)').matches
    if (isTouch || reduced) return undefined

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let raf
    let width, height, dpr

    const pos = { x: -200, y: -200 }
    const trail = [] // { x, y, life }
    const TRAIL_LENGTH = 16
    let targetIntensity = 1 // 1 = open space, ~0.08 = hovering interactive content
    let intensity = 1

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = width * dpr
      canvas.height = height * dpr
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    // elementFromPoint runs only every other move to cut per-pixel cost.
    let moveCount = 0
    const handleMove = (e) => {
      pos.x = e.clientX
      pos.y = e.clientY

      moveCount += 1
      if (moveCount % 2 !== 0) return

      const el = document.elementFromPoint(e.clientX, e.clientY)
      const overContent = el && el.closest('a, button, input, textarea, [role="button"], .bg-card, .surface-card')
      targetIntensity = overContent ? 0.08 : 1
    }

    function draw() {
      ctx.clearRect(0, 0, width, height)
      intensity += (targetIntensity - intensity) * 0.15

      trail.unshift({ x: pos.x, y: pos.y })
      if (trail.length > TRAIL_LENGTH) trail.pop()

      // Comet trail — a chain of fading, shrinking cyan circles.
      trail.forEach((p, i) => {
        const t = 1 - i / TRAIL_LENGTH
        const radius = 3 + t * 16
        const alpha = t * t * 0.32 * intensity
        if (alpha <= 0.002) return
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius)
        grad.addColorStop(0, `rgba(59, 166, 241, ${alpha})`)
        grad.addColorStop(1, 'rgba(59, 166, 241, 0)')
        ctx.beginPath()
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2)
        ctx.fillStyle = grad
        ctx.fill()
      })

      raf = requestAnimationFrame(draw)
    }

    resize()
    window.addEventListener('resize', resize)
    window.addEventListener('mousemove', handleMove, { passive: true })
    raf = requestAnimationFrame(draw)

    return () => {
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', handleMove)
      cancelAnimationFrame(raf)
    }
  }, [])

  return <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-[999] hidden md:block" />
}
