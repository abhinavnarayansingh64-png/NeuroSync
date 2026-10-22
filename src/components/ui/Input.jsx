/**
 * Input & PasswordInput — labelled form fields with inline validation.
 *
 * Errors render beneath the field (never as browser alerts, per the PRD) and
 * are wired up with aria-invalid / aria-describedby for accessibility.
 */

import { forwardRef, useId, useState } from 'react'
import { Icon } from './Icon'

export const Input = forwardRef(function Input(
  { label, error, hint, id, className = '', required = false, rightAdornment, ...rest },
  ref,
) {
  const generatedId = useId()
  const inputId = id || generatedId
  const errorId = `${inputId}-error`
  const hintId = `${inputId}-hint`

  return (
    <div className={className}>
      {label && (
        <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-content-secondary">
          {label}
          {required && <span className="ml-0.5 text-accent">*</span>}
        </label>
      )}
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : hint ? hintId : undefined}
          className={[
            'w-full rounded-md bg-surface px-3.5 text-sm text-content-primary placeholder:text-content-muted',
            'border transition-colors duration-150 h-11',
            rightAdornment ? 'pr-11' : '',
            error
              ? 'border-status-danger focus:border-status-danger focus:ring-2 focus:ring-status-danger/30'
              : 'border-border focus:border-accent focus:ring-2 focus:ring-accent/30',
            'focus:outline-none',
          ].join(' ')}
          {...rest}
        />
        {rightAdornment && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-2">{rightAdornment}</div>
        )}
      </div>
      {error ? (
        <p id={errorId} className="mt-1.5 text-xs text-status-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="mt-1.5 text-xs text-content-muted">
          {hint}
        </p>
      ) : null}
    </div>
  )
})

export const PasswordInput = forwardRef(function PasswordInput({ ...props }, ref) {
  const [visible, setVisible] = useState(false)
  return (
    <Input
      ref={ref}
      type={visible ? 'text' : 'password'}
      rightAdornment={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="rounded-lg p-1.5 text-content-muted hover:text-content-primary"
          aria-label={visible ? 'Hide password' : 'Show password'}
          tabIndex={-1}
        >
          <Icon name={visible ? 'eyeOff' : 'eye'} size={18} />
        </button>
      }
      {...props}
    />
  )
})
