/**
 * Reveal — viewport-gated entrance primitive (Level 2 structural motion).
 *
 * Adds .is-in when the element enters the viewport (or immediately when
 * reduced motion is preferred). Uses a single shared IntersectionObserver
 * via a module-level pool so sections never mount duplicate observers.
 *
 * Rules honored:
 * - transform + opacity only
 * - never scales from 0 (baseline is 0.98)
 * - fully CSS-driven so interrupted transitions are harmless
 * - content is always in the DOM and keyboard reachable before reveal
 */
import { useEffect, useRef } from 'react'
import { useReducedMotion } from '../../hooks/useReducedMotion'

/** Shared observer pool — creates lazily, never duplicated per instance. */
let sharedObserver = null
const queue = []

function getObserver() {
  if (typeof IntersectionObserver === 'undefined') return null
  if (!sharedObserver) {
    sharedObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in')
            sharedObserver.unobserve(entry.target)
          }
        })
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    )
  }
  return sharedObserver
}

export function Reveal({
  children,
  className = '',
  delay = 0,
  as: Tag = 'div',
  ...rest
}) {
  const ref = useRef(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (reduced) {
      el.classList.add('is-in')
      return
    }
    const observer = getObserver()
    if (observer) {
      observer.observe(el)
      return () => observer.unobserve(el)
    }
    el.classList.add('is-in')
  }, [reduced])

  const style = delay ? { transitionDelay: `${delay}ms` } : undefined

  return (
    <Tag ref={ref} className={`ns-reveal ${className}`} style={style} {...rest}>
      {children}
    </Tag>
  )
}

/** Convenience group wrapper that staggers children (32–72ms, noncritical). */
export function RevealGroup({ children, className = '', stagger = 56, as: Tag = 'div', ...rest }) {
  return (
    <Tag className={className} {...rest}>
      {Array.isArray(children)
        ? children.map((child, i) =>
            child === null || child === undefined ? child : (
              <Reveal key={i} delay={i * stagger}>
                {child}
              </Reveal>
            ),
          )
        : children}
    </Tag>
  )
}
