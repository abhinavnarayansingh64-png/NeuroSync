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

// Cream-filled controls need dark ink for accessible contrast on the black UI.
const VARIANTS = {
  primary: 'ns-solid-button bg-accent font-medium border border-accent-edge hover:bg-accent-hover disabled:hover:bg-accent',
  secondary:
    'bg-[#1b1916] text-[#f7f0e5] border border-[#5a554e] hover:bg-[#292620] hover:text-[#fffdf7] hover:border-[#f7f0e5] active:bg-[#12110f]',
  outline:
    'bg-accent text-[#151310] border border-accent-edge hover:bg-accent-hover hover:text-[#151310] active:bg-accent',
  ghost: 'bg-transparent text-content-secondary hover:text-content-primary hover:bg-card-hover',
  danger:
    'bg-transparent text-status-danger border border-status-danger-border hover:bg-status-danger-soft',
  'danger-solid': 'ns-solid-button bg-status-danger-strong font-medium hover:brightness-110',
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
    style: styleProp,
    ...rest
  },
  ref,
) {
  const isDisabled = disabled || loading
  const isSolid = variant === 'primary' || variant === 'outline' || variant === 'danger-solid'
  const controlStyle = isSolid ? { color: '#151310', ...styleProp } : styleProp
  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      className={[
        'inline-flex items-center justify-center rounded-full transition-colors duration-150',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f7f0e5]',
        'disabled:opacity-50 disabled:cursor-not-allowed select-none',
        VARIANTS[variant] || VARIANTS.primary,
        SIZES[size] || SIZES.md,
        fullWidth ? 'w-full' : '',
        className,
      ].join(' ')}
      {...rest}
      style={controlStyle}
    >
      {loading ? (
        <Spinner size={size === 'lg' ? 20 : 16} className={variant === 'primary' ? 'text-[#151310]' : ''} />
      ) : (
        icon && <Icon name={icon} size={size === 'lg' ? 20 : 18} />
      )}
      {children}
      {!loading && iconRight && <Icon name={iconRight} size={size === 'lg' ? 20 : 18} />}
    </button>
  )
})
