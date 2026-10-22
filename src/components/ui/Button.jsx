/**
 * Button — the single button primitive used across the app.
 *
 * `variant` covers the PRD's Primary and Secondary buttons plus common
 * ghost/danger needs. It renders a spinner and disables interaction while
 * `loading` is true, which the training-start flow relies on to prevent
 * duplicate submissions.
 */

import { forwardRef } from 'react'
import { Spinner } from './Spinner'
import { Icon } from './Icon'

// Seline buttons are pill-shaped; the cyan fill is the only chromatic filled
// element on any screen. Secondary is a quiet hairline ghost companion.
const VARIANTS = {
  primary: 'bg-accent text-white font-medium border border-accent-edge hover:bg-accent-hover disabled:hover:bg-accent',
  secondary:
    'bg-transparent text-content-primary border border-border-strong hover:bg-card-hover hover:border-content-muted',
  ghost: 'bg-transparent text-content-secondary hover:text-content-primary hover:bg-card-hover',
  danger:
    'bg-transparent text-status-danger border border-status-danger-border hover:bg-status-danger-soft',
  'danger-solid': 'bg-status-danger-strong text-white font-medium hover:brightness-110',
}

const SIZES = {
  sm: 'h-9 px-4 text-sm gap-1.5',
  md: 'h-11 px-5 text-sm gap-2',
  lg: 'h-12 px-7 text-base gap-2',
}

export const Button = forwardRef(function Button(
  {
    children,
    variant = 'primary',
    size = 'md',
    type = 'button',
    loading = false,
    disabled = false,
    fullWidth = false,
    icon,
    iconRight,
    className = '',
    ...rest
  },
  ref,
) {
  const isDisabled = disabled || loading
  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      className={[
        'inline-flex items-center justify-center rounded-full transition-colors duration-150',
        'focus-visible:outline-2 focus-visible:outline-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed select-none',
        VARIANTS[variant] || VARIANTS.primary,
        SIZES[size] || SIZES.md,
        fullWidth ? 'w-full' : '',
        className,
      ].join(' ')}
      {...rest}
    >
      {loading ? (
        <Spinner size={size === 'lg' ? 20 : 16} className={variant === 'primary' ? 'text-white' : ''} />
      ) : (
        icon && <Icon name={icon} size={size === 'lg' ? 20 : 18} />
      )}
      {children}
      {!loading && iconRight && <Icon name={iconRight} size={size === 'lg' ? 20 : 18} />}
    </button>
  )
})
