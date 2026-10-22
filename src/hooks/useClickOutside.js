import { useEffect } from 'react'

/**
 * Invoke `handler` when a pointer or Escape-key event occurs outside the
 * referenced element. Used to dismiss dropdowns and panels. `active` allows
 * the listener to be attached only while the element is open.
 */
export function useClickOutside(ref, handler, active = true) {
  useEffect(() => {
    if (!active) return undefined

    const onPointerDown = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        handler(event)
      }
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') handler(event)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [ref, handler, active])
}
