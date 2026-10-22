/**
 * Additional form primitives: Select, Textarea, Toggle and Checkbox.
 * They share the visual language of Input for a consistent form experience.
 */

import { forwardRef, useId } from 'react'
import { Icon } from './Icon'

function FieldWrapper({ label, error, hint, htmlFor, required, children }) {
  return (
    <div>
      {label && (
        <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-content-secondary">
          {label}
          {required && <span className="ml-0.5 text-accent">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="mt-1.5 text-xs text-status-danger">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-content-muted">{hint}</p>
      ) : null}
    </div>
  )
}

export const Select = forwardRef(function Select(
  { label, error, hint, id, required, options = [], className = '', children, ...rest },
  ref,
) {
  const generatedId = useId()
  const selectId = id || generatedId
  return (
    <div className={className}>
      <FieldWrapper label={label} error={error} hint={hint} htmlFor={selectId} required={required}>
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            aria-invalid={!!error}
            className={[
              'w-full appearance-none rounded-md bg-surface px-3.5 pr-10 text-sm text-content-primary h-11',
              'border transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-accent/30',
              error ? 'border-status-danger' : 'border-border focus:border-accent',
            ].join(' ')}
            {...rest}
          >
            {options.length
              ? options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))
              : children}
          </select>
          <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-content-muted">
            <Icon name="chevronDown" size={18} />
          </span>
        </div>
      </FieldWrapper>
    </div>
  )
})

export const Textarea = forwardRef(function Textarea(
  { label, error, hint, id, required, className = '', rows = 3, ...rest },
  ref,
) {
  const generatedId = useId()
  const textareaId = id || generatedId
  return (
    <div className={className}>
      <FieldWrapper label={label} error={error} hint={hint} htmlFor={textareaId} required={required}>
        <textarea
          ref={ref}
          id={textareaId}
          rows={rows}
          aria-invalid={!!error}
          className={[
            'w-full rounded-md bg-surface px-3.5 py-2.5 text-sm text-content-primary placeholder:text-content-muted',
            'border transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-accent/30 resize-y',
            error ? 'border-status-danger' : 'border-border focus:border-accent',
          ].join(' ')}
          {...rest}
        />
      </FieldWrapper>
    </div>
  )
})

/** Accessible toggle switch. */
export function Toggle({ checked, onChange, label, description, id }) {
  const generatedId = useId()
  const toggleId = id || generatedId
  return (
    <div className="flex items-center justify-between gap-4">
      {(label || description) && (
        <label htmlFor={toggleId} className="cursor-pointer">
          {label && <span className="block text-sm font-medium text-content-primary">{label}</span>}
          {description && <span className="mt-0.5 block text-xs text-content-secondary">{description}</span>}
        </label>
      )}
      <button
        id={toggleId}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={[
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200',
          checked ? 'bg-accent' : 'bg-border-strong',
        ].join(' ')}
      >
        <span
          className={[
            'inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200',
            checked ? 'translate-x-6' : 'translate-x-1',
          ].join(' ')}
        />
      </button>
    </div>
  )
}

/** Checkbox with label (used for "Remember me"). */
export function Checkbox({ checked, onChange, label, id }) {
  const generatedId = useId()
  const checkboxId = id || generatedId
  return (
    <label htmlFor={checkboxId} className="flex cursor-pointer items-center gap-2 select-none">
      <span className="relative flex h-4 w-4">
        <input
          id={checkboxId}
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="peer h-4 w-4 appearance-none rounded border border-border-strong bg-surface checked:border-accent checked:bg-accent focus:outline-none focus-visible:outline-2 focus-visible:outline-accent"
        />
        <Icon
          name="check"
          size={12}
          className="pointer-events-none absolute left-0.5 top-0.5 hidden text-white peer-checked:block"
        />
      </span>
      {label && <span className="text-sm text-content-secondary">{label}</span>}
    </label>
  )
}
